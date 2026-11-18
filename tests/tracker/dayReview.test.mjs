import test from "node:test";
import assert from "node:assert/strict";
import { dayReview, exerciseWeek, restView, calVerdict, sleepVerdict, countInputs, pickReviewDay } from "../../src/health/tracker/dayReview.js";

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

test("countInputs: প্রযোজ্য বিষয়ের মধ্যে কয়টিতে তথ্য; ৩টি হলে ok", () => {
  assert.deepEqual(countInputs({ date: D, caloriesIn: 1800, sleepMinutes: 400 }, ctx, D), { count: 2, need: 3, ok: false });
  const c = countInputs({ date: D, caloriesIn: 1800, sleepMinutes: 400, waterGlasses: 2 }, ctx, D);
  assert.equal(c.count, 3); assert.equal(c.ok, true);
  assert.equal(countInputs(null, ctx, D).ok, false);
});

test("countInputs: লক্ষ্য কম থাকলে need = প্রযোজ্য সংখ্যা (আটকে যায় না); উপবাস-দিনে ক্যালরি গোনা হয় না", () => {
  const two = { calorieTarget: null, exTarget: 30, waterTarget: null, sleepMinH: 7, fastDays: [] };
  const c = countInputs({ date: D, exerciseMin: 10, sleepMinutes: 400 }, two, D);
  assert.equal(c.need, 2); assert.equal(c.ok, true);
  const fast = { ...ctx, fastDays: [4] }; // বুধবার সিয়াম
  const f = countInputs({ date: D, caloriesIn: 500, exerciseMin: 10, sleepMinutes: 400 }, fast, D);
  assert.equal(f.count, 2); assert.equal(f.ok, false);
});

const full = (date) => ({ date, caloriesIn: 1900, exerciseMin: 30, sleepMinutes: 420 });
const part = (date) => ({ date, sleepMinutes: 420, waterGlasses: 3 });

test("pickReviewDay: আজ ৩টি পূরণ হলে আজ", () => {
  const p = pickReviewDay({ by: { [D]: full(D), "2026-11-17": full("2026-11-17") }, todayISO: D, ctx });
  assert.equal(p.kind, "today"); assert.equal(p.date, D);
});

test("pickReviewDay: আজ ২টি হলে গতকালের; গতকালও অযোগ্য হলে আগের যোগ্য দিন", () => {
  const a = pickReviewDay({ by: { [D]: part(D), "2026-11-17": full("2026-11-17") }, todayISO: D, ctx });
  assert.equal(a.kind, "yesterday"); assert.equal(a.date, "2026-11-17");
  const b = pickReviewDay({ by: { [D]: part(D), "2026-11-17": part("2026-11-17"), "2026-11-16": full("2026-11-16") }, todayISO: D, ctx });
  assert.equal(b.kind, "earlier"); assert.equal(b.date, "2026-11-16");
});

test("pickReviewDay: ৭ দিনে যোগ্য দিন না থাকলে null; মাস পেরিয়েও খোঁজে", () => {
  assert.equal(pickReviewDay({ by: { [D]: part(D) }, todayISO: D, ctx }), null);
  const p = pickReviewDay({ by: { "2026-10-31": full("2026-10-31") }, todayISO: "2026-11-02", ctx });
  assert.equal(p.date, "2026-10-31"); assert.equal(p.kind, "earlier");
});

test("dayReview: আগের দিনের রিভিউ সবসময় চূড়ান্ত (সকালেও); আজের রিভিউ ৯টার আগে সাময়িক", () => {
  const doc = full("2026-11-17");
  assert.equal(dayReview({ doc, ctx, date: "2026-11-17", now: at(9), bn, isToday: false }).final, true);
  assert.equal(dayReview({ doc: full(D), ctx, date: D, now: at(9), bn, isToday: true }).final, false);
});
