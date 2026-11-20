import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LOG_DAYS_MAX, DAY_TICKS_MAX, ALL, tickKey, sanitizeDay, sanitizeDays, overflowDates, plannedKeys,
  toggleTick, weekStartISO, weekCells, weekDoneCount, streakOf, isoOf, tickCount,
} from "../../src/health/mycare/careLogCore.js";
import { pickTodayCare } from "../../src/health/mycare/careToday.js";
import { ALL_ITEMS } from "../../src/health/mycare/data/index.js";

const M = tickKey("skin-gentle-cleanser", "morning"), N = tickKey("skin-gentle-cleanser", "night"), B = tickKey("oral-fluoride-brushing", "night");
const adult = { ageYears: 30, sex: "male", allergies: [], pregnant: false, breastfeeding: false, kidney: false, liver: false, skinType: "normal", hairType: "normal", avoidIngredients: [], preferences: [] };

test("সীমা firestore.rules-এর সাথে মেলে (৬০ দিন; ডকে শুধু অনুমোদিত ফিল্ড)", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const fn = rules.slice(rules.indexOf("function careLogOk"), rules.indexOf("function careLogOk") + 600);
  assert.ok(fn.includes("d.days.size() <= " + LOG_DAYS_MAX));
  for (const f of ["v", "memberId", "days", "lastEditedByMemberId", "createdAt", "updatedAt"]) assert.ok(fn.includes("'" + f + "'"), f);
  assert.ok(rules.includes("match /careLog/{memberId}"));
});

test("sanitizeDay: ভুল/ডুপ্লিকেট টিক বাদ; সীমা; 'all' শুধু টিক থাকলে", () => {
  assert.deepEqual(sanitizeDay([M, M, "bad", 5, "X/morning", "a/never"]), [M]);
  assert.deepEqual(sanitizeDay([ALL]), []);
  assert.deepEqual(sanitizeDay([M, ALL]), [M, ALL]);
  assert.deepEqual(sanitizeDay("x"), []);
  const many = Array.from({ length: 30 }, (_, i) => "item-" + i + "/anytime");
  assert.equal(tickCount(sanitizeDay(many)), DAY_TICKS_MAX);
});

test("sanitizeDays: ভুল তারিখ/খালি দিন বাদ; সর্বোচ্চ ৬০ নতুন দিন; overflowDates পুরনোগুলো দেয়", () => {
  const raw = { "2026-11-19": [M], "bad": [M], "2026-11-18": [], "2026-11-17": "x" };
  assert.deepEqual(Object.keys(sanitizeDays(raw)), ["2026-11-19"]);
  const big = {};
  for (let i = 0; i < 65; i++) big[isoOf(new Date(2026, 0, 1 + i))] = [M];
  assert.equal(Object.keys(sanitizeDays(big)).length, LOG_DAYS_MAX);
  assert.equal(overflowDates(big).length, 5);
  assert.ok(overflowDates(big).every((d) => d < "2026-01-06"));
  assert.deepEqual(sanitizeDays(null), {});
});

test("toggleTick: টিক/আনটিক, সব ধাপ হলে 'all', একটি সরালে 'all' যায়", () => {
  const planned = [M, N];
  let d = toggleTick([], M, planned); assert.deepEqual(d, [M]);
  d = toggleTick(d, N, planned); assert.deepEqual(d, [M, N, ALL]);
  d = toggleTick(d, M, planned); assert.deepEqual(d, [N]);
  d = toggleTick(d, N, planned); assert.deepEqual(d, []);
  assert.deepEqual(toggleTick([M], "bogus", planned), [M]);
  assert.deepEqual(toggleTick([M], N, []), [M, N]); // দেখানো তালিকা ফাঁকা = 'all' নয়
});

test("toggleTick: আজকের তালিকার বাইরের পুরনো টিক থাকলেও 'all' ঠিকমতো", () => {
  assert.deepEqual(toggleTick([B], M, [M]), [B, M, ALL]);
});

test("weekStartISO: সপ্তাহ শনিবার শুরু (শনি–শুক্র)", () => {
  assert.equal(weekStartISO("2026-11-19"), "2026-11-14"); // বৃহস্পতি → শনি ১৪
  assert.equal(weekStartISO("2026-11-14"), "2026-11-14"); // শনি নিজেই
  assert.equal(weekStartISO("2026-11-20"), "2026-11-14"); // শুক্র
  assert.equal(weekStartISO("2026-11-21"), "2026-11-21"); // পরের শনি
  assert.equal(weekStartISO("2026-03-01"), "2026-02-28"); // মাস-সীমা
});

test("weekCells: অবস্থা done/part/none/future ও আজকের চিহ্ন", () => {
  const days = { "2026-11-15": [M, N, ALL], "2026-11-16": [M], "2026-11-18": [M, N, ALL] };
  const c = weekCells(days, "2026-11-19");
  assert.equal(c.length, 7);
  assert.deepEqual(c.map((x) => x.state), ["none", "done", "part", "none", "done", "none", "future"]);
  assert.equal(c[2].count, 1);
  assert.equal(c[5].today, true);
  assert.equal(weekDoneCount(days, "2026-11-19"), 2);
});

test("streakOf: টানা পূর্ণ দিন; আজ বাকি থাকলে গতকাল থেকে গোনা; মাঝে ফাঁক হলে থামে", () => {
  const full = [M, ALL];
  assert.equal(streakOf({}, "2026-11-19"), 0);
  assert.equal(streakOf({ "2026-11-18": full, "2026-11-17": full }, "2026-11-19"), 2); // আজ বাকি
  assert.equal(streakOf({ "2026-11-19": full, "2026-11-18": full, "2026-11-17": full }, "2026-11-19"), 3);
  assert.equal(streakOf({ "2026-11-19": full, "2026-11-17": full }, "2026-11-19"), 1); // গতকাল ফাঁক
  assert.equal(streakOf({ "2026-11-18": [M] }, "2026-11-19"), 0); // আংশিক দিন গোনা হয় না
  assert.equal(streakOf({ "2026-02-28": full, "2026-03-01": full }, "2026-03-01"), 2); // মাস পেরিয়ে
});

test("plannedKeys: আজকের কার্ড থেকে slot-ভিত্তিক key; অ্যালার্জি-ছাঁকা আইটেম ধরা পড়ে না", () => {
  const care = pickTodayCare(adult, ALL_ITEMS, { season: "hemonto", date: new Date(2026, 10, 19) });
  const keys = plannedKeys(care);
  assert.ok(keys.length > 0 && keys.length === new Set(keys).size);
  assert.ok(keys.every((k) => /\/(morning|night|anytime)$/.test(k)));
  const hit = ALL_ITEMS.find((i) => i.id === "skin-sunscreen");
  const tok = (hit.ingredientAliases && hit.ingredientAliases[0]) || hit.name.en;
  const safe = plannedKeys(pickTodayCare({ ...adult, allergies: [tok] }, ALL_ITEMS, { season: "hemonto", date: new Date(2026, 10, 19) }));
  assert.ok(!safe.some((k) => k.startsWith("skin-sunscreen/")));
  assert.deepEqual(plannedKeys(null), []);
});

test("অন্যের মোডে সংরক্ষণ নেই: MyCareSection log-কে null দেয়; careLog ডেটা-লেয়ার শুধু ডক-ID = memberId", () => {
  const sec = readFileSync("src/health/mycare/MyCareSection.js", "utf8");
  assert.ok(sec.includes("log: other ? null : careLog"));
  assert.ok(!sec.includes("CareWeekCard")); // সাপ্তাহিক কার্ড MyCare থেকে সরানো (owner-request ২০২৬-১১-২০); রিভিউ ট্র্যাকারে
  const data = readFileSync("src/health/mycare/careLogData.js", "utf8");
  assert.ok(data.includes('collection("careLog").doc(memberId)'));
  assert.ok(!/console\./.test(data) && !/analytics/i.test(data));
});
