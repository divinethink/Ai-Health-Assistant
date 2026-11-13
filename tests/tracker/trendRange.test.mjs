// চালানো: node --test tests/tracker/trendRange.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { lastNMonths, shiftMonth, heatLevel, heatWeeks, monthStats, monthReview, compareMonths, compareNotes } from "../../src/health/tracker/trendRange.js";

const ctx = { calorieTarget: 2000, exTarget: 30, waterTarget: null, sleepMinH: 7 };
const bn = (n) => String(n);
const GOOD = { caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 480 };

test("lastNMonths: বছর পেরোনো, পুরনো → নতুন", () => {
  assert.deepEqual(lastNMonths(new Date(2026, 0, 15), 3), [{ y: 2025, m: 10 }, { y: 2025, m: 11 }, { y: 2026, m: 0 }]);
});
test("shiftMonth: চলতি মাসের পরে ও ১৯৯০-এর আগে যায় না", () => {
  const now = new Date(2026, 10, 13);
  const cur = { y: 2026, m: 10 };
  assert.equal(shiftMonth(cur, 1, now), cur);
  assert.deepEqual(shiftMonth(cur, -1, now), { y: 2026, m: 9 });
  assert.deepEqual(shiftMonth({ y: 2026, m: 0 }, -1, now), { y: 2025, m: 11 });
  const old = { y: 1990, m: 0 };
  assert.equal(shiftMonth(old, -1, now), old);
});
test("heatLevel: ০/১/২/৩", () => {
  assert.equal(heatLevel(null, ctx, "2026-11-01"), 0);
  assert.equal(heatLevel({ date: "2026-11-01", waterGlasses: 3 }, ctx, "2026-11-01"), 1); // রেকর্ড আছে, পানি-লক্ষ্য নেই → কিছু পূরণ নয়
  assert.equal(heatLevel({ date: "2026-11-01", exerciseMin: 30 }, ctx, "2026-11-01"), 2);
  assert.equal(heatLevel({ date: "2026-11-01", ...GOOD }, ctx, "2026-11-01"), 3);
});
test("heatWeeks: শনি-শুরু ৭-ঘরের কলাম, আজের পরের/শুরুর আগের ঘর out", () => {
  // ২০২৬-১১-১৩ = শুক্রবার; শুরু ২০২৬-১১-০১ (রবিবার)
  const w = heatWeeks([{ date: "2026-11-13", ...GOOD }], ctx, "2026-11-01", "2026-11-13");
  assert.equal(w.length, 2);
  w.forEach((c) => assert.equal(c.length, 7));
  assert.equal(w[0][0].iso, "2026-10-31"); assert.equal(w[0][0].out, true); // শনিবার, শুরুর আগে
  assert.equal(w[0][1].iso, "2026-11-01"); assert.equal(w[0][1].out, false);
  assert.equal(w[1][6].iso, "2026-11-13"); assert.equal(w[1][6].level, 3);
});
test("monthStats: গণনা ও আজের পরের দিন বাদ", () => {
  const docs = [
    { date: "2026-11-01", ...GOOD, weightKg: 70 },
    { date: "2026-11-02", caloriesIn: 3000, exerciseMin: 10, sleepMinutes: 300, weightKg: 69 },
    { date: "2026-11-20", ...GOOD }, // আজের পরে
  ];
  const s = monthStats(docs, 2026, 10, ctx, "2026-11-13");
  assert.equal(s.days, 13); assert.equal(s.loggedDays, 2);
  assert.equal(s.calDays, 2); assert.equal(s.calHit, 1);
  assert.equal(s.exTotal, 40); assert.equal(s.exActive, 2); assert.equal(s.exHit, 1);
  assert.equal(s.sleepDays, 2); assert.equal(s.sleepHit, 1); assert.equal(s.sleepAvgH, 6.5);
  assert.equal(s.weightAvg, 69.5); assert.equal(s.weightChange, -1);
  assert.equal(s.hitDays, 1);
});
test("monthReview: তথ্য কম হলে একটাই বার্তা; পর্যাপ্ত হলে সমস্যা-মন্তব্য", () => {
  const few = monthStats([{ date: "2026-11-01", ...GOOD }], 2026, 10, ctx, "2026-11-13");
  assert.match(monthReview(few, bn).comment[0], /তথ্য কম/);
  const docs = Array.from({ length: 8 }, (_, i) => ({ date: "2026-11-0" + (i + 1), caloriesIn: 3500, exerciseMin: 0, sleepMinutes: 300 }));
  const r = monthReview(monthStats(docs, 2026, 10, ctx, "2026-11-13"), bn);
  assert.ok(r.comment.some((c) => /ঘুম/.test(c)) && r.comment.some((c) => /ক্যালরি/.test(c)) && r.comment.some((c) => /ব্যায়াম/.test(c)));
});
test("compareMonths/compareNotes: পানি নেই, ওজন আপেক্ষিক, ১৫ পয়েন্টের ফারাকে নোট", () => {
  const mk = (m, ex) => monthStats(Array.from({ length: 10 }, (_, i) => ({ date: "2026-" + String(m + 1).padStart(2, "0") + "-" + String(i + 1).padStart(2, "0"), ...GOOD, exerciseMin: i < ex ? 30 : 0, weightKg: 70 })), 2026, m, ctx, "2026-12-31");
  const rows = compareMonths([mk(8, 2), mk(9, 5), mk(10, 9)], bn);
  assert.deepEqual(rows.map((r) => r.key), ["weight", "calories", "exercise", "sleep"]);
  assert.equal(rows[0].vals[0].pct, 100);
  assert.equal(rows[2].vals[2].pct, 90);
  assert.ok(compareNotes(rows).some((n) => /ব্যায়াম.*ভালো/.test(n)));
});

test("compareMonths: পানির লক্ষ্য থাকলে পানি-সারি, না থাকলে নেই", () => {
  const docs = [{ date: "2026-03-02", waterGlasses: 8 }, { date: "2026-03-03", waterGlasses: 3 }];
  const withW = monthStats(docs, 2026, 2, { ...ctx, waterTarget: 8 }, "2026-03-31");
  const noW = monthStats(docs, 2026, 2, ctx, "2026-03-31");
  const row = compareMonths([withW], bn).find((r) => r.key === "water");
  assert.equal(row.vals[0].text, "1/2 দিন".replace("দিন", "দিন"));
  assert.equal(row.vals[0].pct, 50);
  assert.equal(compareMonths([noW], bn).some((r) => r.key === "water"), false);
});
