// পার্ট ৮ — চালানো: node --test tests/tracker/weeklySummary.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { weeklySummary, weeklySummaryRows, targetCtxFor, last7DatesISO } from "../../src/health/tracker/weeklyTrend.js";

const dates = last7DatesISO(new Date(2026, 10, 8)); // ০২–০৮ নভেম্বর
const adultCtx = targetCtxFor({ age: 30, flags: {}, goal: { calc: { calorieTarget: 2000 } } });

test("ডেটা না থাকলে null → সেকশন লুকাবে", () => {
  assert.equal(weeklySummary([], dates, adultCtx), null);
  assert.equal(weeklySummary(null, dates, adultCtx), null);
  assert.equal(weeklySummary([{ date: "2026-10-01", exerciseMin: 5 }], dates, adultCtx), null); // সপ্তাহের বাইরে
  assert.deepEqual(weeklySummaryRows(null), []);
});
test("গড়/যোগফল/ওজন-পরিবর্তন/টার্গেট-দিন", () => {
  const docs = [
    { date: "2026-11-02", caloriesIn: 1800, exerciseMin: 30, waterGlasses: 8, sleepMinutes: 420, weightKg: 70 },
    { date: "2026-11-04", caloriesIn: 2200, exerciseMin: 20, sleepMinutes: 480 },
    { date: "2026-11-08", exerciseMin: 40, waterGlasses: 9, weightKg: 69.5 },
  ];
  const s = weeklySummary(docs, dates, adultCtx);
  assert.equal(s.loggedDays, 3);
  assert.equal(s.avgKcal, 2000);
  assert.equal(s.kcalDays, 2);
  assert.equal(s.exerciseTotalMin, 90);
  assert.equal(s.avgSleepH, 7.5);
  assert.equal(s.weightChangeKg, -0.5);
  // ০২: ক্যালরি ✓(১৮০০≥১৬০০), ব্যায়াম ✓, পানি ✓ → হিট; ০৪: ক্যালরি ✓, ঘুম ✓(৮ঘ) → হিট; ০৮: ব্যায়াম ✓ + পানি ✓ → হিট
  assert.equal(s.targetDays, 3);
});
test("একটিমাত্র ওজন হলে পরিবর্তন নেই; সারিতে সংশ্লিষ্ট লাইন বাদ", () => {
  const s = weeklySummary([{ date: "2026-11-08", weightKg: 70, exerciseMin: 0 }], dates, adultCtx);
  assert.equal(s.weightChangeKg, null);
  assert.equal(s.avgKcal, null);
  const labels = weeklySummaryRows(s).map((r) => r[0]);
  assert.ok(!labels.includes("ওজন-পরিবর্তন"));
  assert.ok(!labels.some((l) => l.startsWith("গড় ক্যালরি")));
  assert.ok(!labels.includes("গড় ঘুম"));
  assert.ok(labels.includes("টার্গেট-দিন"));
});
test("সারির বিন্যাস", () => {
  const s = weeklySummary([{ date: "2026-11-02", caloriesIn: 1500, weightKg: 70 }, { date: "2026-11-08", weightKg: 71.2 }], dates, adultCtx);
  const r = Object.fromEntries(weeklySummaryRows(s));
  assert.equal(r["লগ-করা দিন"], "2/7");
  assert.equal(r["ওজন-পরিবর্তন"], "+1.2 kg (70 → 71.2)");
});
test("লক্ষ্য-ctx: ব্লকড (শিশু/ডায়াবেটিস) হলে ক্যালরি-টার্গেট নেই; কিডনি = পানি নেই", () => {
  assert.equal(targetCtxFor({ age: 10, flags: {}, goal: { calc: { calorieTarget: 1800 } } }).calorieTarget, null);
  assert.equal(targetCtxFor({ age: 30, flags: { diabetes: true }, goal: { calc: { calorieTarget: 1800 } } }).calorieTarget, null);
  assert.equal(targetCtxFor({ age: 30, flags: { kidney: true }, goal: null }).waterTarget, null);
  assert.equal(targetCtxFor({ age: 30, flags: {}, goal: null }).calorieTarget, null);
  assert.equal(targetCtxFor({ age: 10, flags: {}, goal: null }).exTarget, 60);
});
