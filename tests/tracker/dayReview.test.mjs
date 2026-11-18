import test from "node:test";
import assert from "node:assert/strict";
import { dayReview, exerciseWeek, restView, alertList, calVerdict, sleepVerdict } from "../../src/health/tracker/dayReview.js";

const bn = (n) => String(n);
const ctx = { calorieTarget: 2000, exTarget: 30, waterTarget: 8, sleepMinH: 7, fastDays: [] };
const D = "2026-11-18"; // বুধবার
const at = (h) => new Date(2026, 10, 18, h, 0, 0);

test("আজ কিছু লেখা না থাকলে hasData=false", () => {
  assert.equal(dayReview({ doc: null, ctx, date: D, now: at(10), bn }).hasData, false);
  assert.equal(dayReview({ doc: { date: D }, ctx, date: D, now: at(10), bn }).hasData, false);
});

test("ভালো ও ভালো-করা-দরকার আলাদা; সবচেয়ে বড় ঘাটতি আগে; ৯টার আগে সাময়িক", () => {
  const doc = { date: D, caloriesIn: 2000, exerciseMin: 10, sleepMinutes: 450, waterGlasses: 2 };
  const r = dayReview({ doc, ctx, date: D, now: at(20), bn });
  assert.equal(r.final, false);
  assert.deepEqual(r.good.map((x) => x.key), ["calories", "sleep"]);
  assert.deepEqual(r.improve.map((x) => x.key), ["water", "exercise"]); // পানি ৭৫% ঘাটতি > ব্যায়াম ৬৭%
  assert.match(r.improve[1].text, /আর 20 মিনিট বাকি/);
  assert.match(r.tomorrow, /পানি/);
  assert.equal(dayReview({ doc, ctx, date: D, now: at(21), bn }).final, true);
});

test("সব লক্ষ্য পূরণ: improve খালি, উৎসাহ-বার্তা", () => {
  const r = dayReview({ doc: { date: D, caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 450, waterGlasses: 8 }, ctx, date: D, now: at(22), bn });
  assert.equal(r.improve.length, 0); assert.match(r.tomorrow, /ঠিক আছে/);
});

test("ঘুম/খাবার লেখা না থাকলে 'লেখা হয়নি' (ভালো-করা-দরকারে)", () => {
  const r = dayReview({ doc: { date: D, exerciseMin: 30, waterGlasses: 8 }, ctx, date: D, now: at(22), bn });
  const keys = r.improve.map((x) => x.key);
  assert.ok(keys.includes("sleep") && keys.includes("calories"));
  assert.ok(r.improve.some((x) => /লেখা হয়নি/.test(x.text)));
});

test("উপবাস-দিনে ক্যালরি বিচার হয় না", () => {
  const c = { ...ctx, fastDays: [4] };
  const r = dayReview({ doc: { date: D, exerciseMin: 30, sleepMinutes: 450, waterGlasses: 8 }, ctx: c, date: D, now: at(22), bn });
  assert.ok(![...r.good, ...r.improve].some((x) => x.key === "calories"));
});

test("calVerdict/sleepVerdict সীমা", () => {
  assert.equal(calVerdict(1500, 2000).key, "low"); assert.equal(calVerdict(1600, 2000).key, "good");
  assert.equal(calVerdict(2200, 2000).key, "good"); assert.equal(calVerdict(2300, 2000).key, "high");
  assert.equal(calVerdict(0, 2000).key, "missing"); assert.equal(calVerdict(100, null), null);
  assert.equal(sleepVerdict(7, 7).word, "ভালো"); assert.equal(sleepVerdict(6.2, 7).word, "একটু কম");
  assert.equal(sleepVerdict(4, 7).word, "কম"); assert.equal(sleepVerdict(null, 7).key, "missing");
});

const WEEK = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]; // শনি→শুক্র

test("exerciseWeek: মোট, বাকি, আজসহ বাকি দিন, দিনে-মিনিট (৫-এর গুণিতক)", () => {
  const by = { "2026-11-14": { exerciseMin: 30 }, "2026-11-16": { exerciseMin: 40 }, "2026-11-18": { exerciseMin: 20 } };
  const w = exerciseWeek({ weekDates: WEEK, by, todayISO: D, target: 150 });
  assert.equal(w.total, 90); assert.equal(w.remaining, 60); assert.equal(w.daysLeft, 3); assert.equal(w.perDay, 20);
  assert.equal(w.pct, 60); assert.equal(w.done, false);
  assert.equal(w.days[5].future, true); assert.equal(w.days[4].isToday, true);
});

test("exerciseWeek: লক্ষ্য পূরণ হলে perDay=0, pct ≤ ১০০; লক্ষ্য না থাকলে null", () => {
  const by = { "2026-11-14": { exerciseMin: 200 } };
  const w = exerciseWeek({ weekDates: WEEK, by, todayISO: D, target: 150 });
  assert.equal(w.done, true); assert.equal(w.perDay, 0); assert.equal(w.pct, 100);
  assert.equal(exerciseWeek({ weekDates: WEEK, by, todayISO: D, target: null }), null);
});

test("exerciseWeek: শুক্রবারে daysLeft=১", () => {
  const w = exerciseWeek({ weekDates: WEEK, by: {}, todayISO: "2026-11-20", target: 150 });
  assert.equal(w.daysLeft, 1); assert.equal(w.perDay, 150);
});

test("restView: ৭ দিন, আজ = শেষ; গড় ও রায়", () => {
  const by = { "2026-11-18": { sleepMinutes: 360, caloriesIn: 1500 }, "2026-11-17": { sleepMinutes: 480 } };
  const rv = restView({ by, endISO: D, calorieTarget: 2000, sleepMinH: 7 });
  assert.equal(rv.dates.length, 7); assert.equal(rv.dates[6], D);
  assert.equal(rv.todaySleepH, 6); assert.equal(rv.sleepAvg, 7); assert.equal(rv.sleepV.word, "একটু কম");
  assert.equal(rv.calV.key, "low"); assert.equal(rv.hasSleep, true);
  const empty = restView({ by: {}, endISO: D, calorieTarget: 2000, sleepMinH: 7 });
  assert.equal(empty.hasSleep, false); assert.equal(empty.hasCal, false);
});

test("alertList: গেট আগে (high), রোগ-সতর্কতা পরে; কিছু না থাকলে খালি", () => {
  const l = alertList({ gate: { blocked: false, warn: true, reason: "⚠ ৬৫+ বয়সে ক্যালরির টার্গেট ডাক্তারের সাথে ঠিক করুন।" }, activeMeds: [], extraFoods: [], age: 70, flags: { diabetes: true }, condKeys: [] });
  assert.equal(l[0].id, "gate"); assert.equal(l[0].level, "high"); assert.ok(!l[0].lines[0].startsWith("⚠"));
  assert.ok(l.some((x) => x.id === "food-diabetes-food"));
  assert.deepEqual(alertList({ gate: { blocked: false, warn: false, reason: null }, activeMeds: [], extraFoods: [], age: 30, flags: {}, condKeys: [] }), []);
});

test("alertList: থাইরয়েডের ওষুধ + আজ খাওয়া দই/টফু-জাতীয় খাবার → ওষুধ-নোট (high), একবারই", () => {
  const l = alertList({ gate: null, activeMeds: ["Levothyroxine"], extraFoods: [{ key: "tofu", name: "টফু", kcal: 25, slot: "lunch" }, { key: "tofu", name: "টফু", kcal: 25, slot: "dinner" }], age: 30, flags: {}, condKeys: [] });
  const med = l.filter((x) => x.id.startsWith("med-"));
  assert.equal(med.length, 1); assert.equal(med[0].level, "high");
});
