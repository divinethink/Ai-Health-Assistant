// পার্ট ১০ — চালানো: node --test tests/tracker/partTen.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  waterTargetFor, sanitizeWaterTarget, checkWaterTargetInput, sanitizeFastDays, fastModeGate, activeFastDays,
  checkFastDaysInput, weekdayIndexOf, isFastDate, FAST_WARN_REASON,
} from "../../src/health/tracker/trackerCalc.js";
import { metricsOf, dayHit, streakOf, weekSummary } from "../../src/health/tracker/todaySummary.js";
import { buildTrend, weeklySummary, targetCtxFor } from "../../src/health/tracker/weeklyTrend.js";

const OK = { age: 30, flags: {} };

test("গেট ম্যাট্রিক্স: <১৮, গর্ভবতী, ডায়াবেটিস, কিডনি, ৬৫+, বয়স অজানা = বন্ধ; ১৮–৬৪ সুস্থ = খোলা", () => {
  // Approved Deviation (১০ নভেম্বর ২০২৬): কখনো ব্লক নয়; আগের ব্লক-গ্রুপে warn=true
  [OK, { age: 18, flags: {} }, { age: 64, flags: {} }].forEach((x) => { const g = fastModeGate(x); assert.equal(g.blocked, false); assert.equal(g.warn, false); assert.equal(g.reason, null); });
  [{ age: 17, flags: {} }, { age: 65, flags: {} }, { age: 30, flags: { pregnant: true } }, { age: 30, flags: { diabetes: true } }, { age: 30, flags: { kidney: true } }, { age: null, flags: {} }, { age: 10, flags: {} }]
    .forEach((x) => { const g = fastModeGate(x); assert.equal(g.blocked, false); assert.equal(g.warn, true); assert.equal(g.reason, FAST_WARN_REASON); });
  assert.ok(FAST_WARN_REASON.includes("ডাক্তারের পরামর্শ নিন"));
});
test("পড়ার পথ: সংরক্ষিত fastDays সবার জন্য (ব্লক নেই)", () => {
  const goal = { fastDays: [0, 3] };
  assert.deepEqual(activeFastDays(goal, OK), [0, 3]);
  assert.deepEqual(activeFastDays(goal, { age: 30, flags: { diabetes: true } }), [0, 3]);
  assert.deepEqual(activeFastDays(goal, { age: 70, flags: {} }), [0, 3]);
  assert.deepEqual(activeFastDays(null, OK), []);
  assert.deepEqual(activeFastDays({ fastDays: "x" }, OK), []);
});
test("সংরক্ষণ-যাচাই: গেট, সীমা, ধরন; খালি সবসময় বৈধ", () => {
  assert.equal(checkFastDaysInput([], { age: 10, flags: {} }), null); // বন্ধ করা সবসময় চলে
  assert.equal(checkFastDaysInput([1], OK), null);
  assert.equal(checkFastDaysInput([1, 4], OK), null);
  assert.equal(checkFastDaysInput([1], { age: 10, flags: {} }), null); // ব্লক নেই, শুধু সতর্কতা
  assert.ok(checkFastDaysInput([1, 2, 3], OK));                      // >২
  assert.ok(checkFastDaysInput([7], OK));
  assert.ok(checkFastDaysInput([1, 1], OK));
  assert.ok(checkFastDaysInput(["1"], OK));
  assert.ok(checkFastDaysInput(null, OK));
  assert.deepEqual(sanitizeFastDays([5, 2, 2, 9, "x", 0]), [0, 2]);
});
test("সপ্তাহ-দিনের সূচক: শনি=০ … শুক্র=৬", () => {
  assert.equal(weekdayIndexOf("2026-11-07"), 0); // শনি
  assert.equal(weekdayIndexOf("2026-11-08"), 1); // রবি
  assert.equal(weekdayIndexOf("2026-11-13"), 6); // শুক্র
  assert.equal(weekdayIndexOf("bad"), null);
  assert.equal(isFastDate("2026-11-08", [1]), true);
  assert.equal(isFastDate("2026-11-08", [0, 6]), false);
  assert.equal(isFastDate("2026-11-08", []), false);
  assert.equal(isFastDate("2026-11-08", undefined), false);
});
test("পানির ওভাররাইড: ১–২০; অবৈধ উপেক্ষা; কিডনি ও <২ বছরে কখনো নয়", () => {
  assert.equal(waterTargetFor(30, {}, 12), 12);
  assert.equal(waterTargetFor(30, {}, 1), 1);
  assert.equal(waterTargetFor(30, {}, 20), 20);
  assert.equal(waterTargetFor(30, {}, 0), 8);
  assert.equal(waterTargetFor(30, {}, 21), 8);
  assert.equal(waterTargetFor(30, {}, 8.5), 8);
  assert.equal(waterTargetFor(30, {}, null), 8);
  assert.equal(waterTargetFor(30, {}), 8);
  assert.equal(waterTargetFor(3, {}, 6), 6);
  assert.equal(waterTargetFor(30, { kidney: true }, 12), null);
  assert.equal(waterTargetFor(1, {}, 6), null);
  assert.equal(waterTargetFor(null, {}, 10), 10);
  assert.equal(sanitizeWaterTarget("12"), 12);
  assert.equal(sanitizeWaterTarget(""), null);
  assert.equal(checkWaterTargetInput(""), null);
  assert.equal(checkWaterTargetInput("10"), null);
  assert.ok(checkWaterTargetInput("0"));
  assert.ok(checkWaterTargetInput("21"));
  assert.ok(checkWaterTargetInput("2.5"));
  assert.ok(checkWaterTargetInput("abc"));
});

const ctx = { calorieTarget: 2000, exTarget: 30, waterTarget: 8, sleepMinH: 7, fastDays: [1] }; // রবি = উপবাস
test("উপবাস-দিনে ক্যালরি-লক্ষ্য প্রযোজ্য নয় (অন্য দিনে আগের মতো)", () => {
  assert.ok(!metricsOf({ date: "2026-11-08", caloriesIn: 0 }, ctx).applicable.includes("calories"));
  assert.ok(metricsOf({ date: "2026-11-09", caloriesIn: 0 }, ctx).applicable.includes("calories"));
  assert.ok(metricsOf(undefined, ctx, "2026-11-09").applicable.includes("calories"));
  assert.ok(!metricsOf(undefined, ctx, "2026-11-08").applicable.includes("calories"));
  assert.ok(metricsOf({ date: "2026-11-08" }, { ...ctx, fastDays: undefined }).applicable.includes("calories")); // ফিল্ড না থাকলে আজকের মতোই
});
test("স্ট্রিক: উপবাস-দিনে লক্ষ্য মিস হলেও ভাঙে না ও গোনা হয় না; সাধারণ দিনে মিস হলে ভাঙে", () => {
  const good = { exerciseMin: 30, waterGlasses: 8 };
  // ০৯ সোম, ০৮ রবি(উপবাস, কিছুই নেই), ০৭ শনি
  const docs = [{ date: "2026-11-09", ...good }, { date: "2026-11-07", ...good }];
  assert.equal(streakOf(docs, "2026-11-09", ctx), 2);                          // রবি স্কিপ
  assert.equal(streakOf(docs, "2026-11-09", { ...ctx, fastDays: [] }), 1);     // উপবাস-মোড ছাড়া রবি ভাঙে
  assert.equal(streakOf(docs, "2026-11-09", { ...ctx, fastDays: undefined }), 1);
  const docs2 = [{ date: "2026-11-09", ...good }, { date: "2026-11-08", ...good }, { date: "2026-11-07", ...good }];
  assert.equal(streakOf(docs2, "2026-11-09", ctx), 3);                         // উপবাসে লক্ষ্য পূরণ হলে গোনা হয়
  assert.equal(streakOf([{ date: "2026-11-09", ...good }, { date: "2026-11-06", ...good }], "2026-11-09", { ...ctx, fastDays: [0] }), 1); // শনি(০৭) উপবাস, কিন্তু ০৬(শুক্র) ফাঁকা: শনি স্কিপ, শুক্র মিস → ভাঙে
});
test("সাপ্তাহিক সারাংশ: উপবাস-দিন 'fast' (miss নয়), হিট হলে 'hit'", () => {
  const dates = ["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
  const w = weekSummary([{ date: "2026-11-07", exerciseMin: 30, waterGlasses: 8 }], dates, "2026-11-10", ctx);
  assert.deepEqual(w.days.map((d) => d.state), ["hit", "fast", "miss", "today", "future", "future", "future"]);
  assert.equal(w.hitCount, 1);
  const w2 = weekSummary([{ date: "2026-11-08", exerciseMin: 30, waterGlasses: 8 }], dates, "2026-11-10", ctx);
  assert.equal(w2.days[1].state, "hit");
});
test("ট্রেন্ড: উপবাস-দিনের ক্যালরি 'লক্ষ্যের বাইরে' হিসাবে ধরা হয় না", () => {
  const dates = ["2026-11-07", "2026-11-08", "2026-11-09"];
  const docs = [{ date: "2026-11-07", caloriesIn: 2000 }, { date: "2026-11-08", caloriesIn: 300 }, { date: "2026-11-09", caloriesIn: 2050 }];
  const withFast = buildTrend(docs, dates, { calorieTarget: 2000, sleepMinH: 7, fastDays: [1] });
  assert.equal(withFast.calInRange, 2);
  assert.equal(withFast.calRangeDays, 2);
  assert.equal(withFast.calDays, 3);
  const without = buildTrend(docs, dates, { calorieTarget: 2000, sleepMinH: 7 });
  assert.equal(without.calInRange, 2);
  assert.equal(without.calRangeDays, 3);
});
test("এক্সপোর্টের লক্ষ্য-ctx: fastDays (ব্লক ছাড়া) ও waterTarget-ওভাররাইড", () => {
  const goal = { fastDays: [1], waterTarget: 10, calc: { calorieTarget: 2000 } };
  const c = targetCtxFor({ age: 30, flags: {}, goal });
  assert.deepEqual(c.fastDays, [1]);
  assert.equal(c.waterTarget, 10);
  assert.deepEqual(targetCtxFor({ age: 30, flags: { diabetes: true }, goal }).fastDays, [1]); // ব্লক নেই (Approved Deviation)
  assert.equal(targetCtxFor({ age: 30, flags: { kidney: true }, goal }).waterTarget, null);
  const dates = ["2026-11-07", "2026-11-08", "2026-11-09"];
  const s = weeklySummary([{ date: "2026-11-08", exerciseMin: 30, waterGlasses: 10 }], dates, c);
  assert.equal(s.targetDays, 1);
});
