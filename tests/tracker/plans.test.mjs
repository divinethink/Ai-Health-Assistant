// চালানো: node --test tests/tracker/plans.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildMealPlan, allergyTagsOf, caloriesForEaten, qtyText } from "../../src/health/tracker/mealPlanData.js";
import { exercisePlan, plannedWeeklyMinutes, weekDatesISO, bdDayIndex } from "../../src/health/tracker/exercisePlanData.js";

test("মিল-প্ল্যান: ১২০০–২৫০০ টার্গেটে মোট ±৮০ এর মধ্যে", () => {
  for (let t = 1200; t <= 2500; t += 50) {
    const p = buildMealPlan(t, []);
    assert.ok(Math.abs(p.total - t) <= 80, t + " → " + p.total);
    assert.equal(p.slots.length, 5);
    assert.equal(p.slots.reduce((a, s) => a + s.kcal, 0), p.total);
  }
});
test("মিল-প্ল্যান: ন্যূনতমের নিচে বা সর্বোচ্চের ওপরে গেলে সীমায় থামে", () => {
  assert.ok(buildMealPlan(900, []).total >= 1100);
  assert.ok(buildMealPlan(3500, []).total <= 2600);
});
test("এলার্জি: ডিম/মাছ/গম/দুধ বদলায়, দুটোই এলার্জি হলে বাদ", () => {
  const names = (p) => p.slots.flatMap((s) => s.items.map((i) => i.key));
  assert.ok(!names(buildMealPlan(1650, ["egg"])).includes("egg"));
  assert.ok(!names(buildMealPlan(1650, ["wheat"])).includes("roti"));
  assert.ok(!names(buildMealPlan(1650, ["dairy"])).includes("tea"));
  const both = buildMealPlan(1650, ["fish", "chicken"]);
  assert.ok(!names(both).includes("fish") && !names(both).includes("chicken"));
  assert.ok(both.notes.length >= 2);
});
test("এলার্জি-ট্যাগ চেনা (বাংলা/ইংরেজি)", () => {
  assert.deepEqual(allergyTagsOf(["চিংড়ি", "Egg", "বাদাম"]), ["egg"]);
  assert.deepEqual(allergyTagsOf(["Gluten", "দুধ"]).sort(), ["dairy", "wheat"]);
  assert.deepEqual(allergyTagsOf([]), []);
});
test("খাওয়া ক্যালরি যোগ", () => {
  const p = buildMealPlan(1650, []);
  assert.equal(caloriesForEaten(p, []), 0);
  assert.equal(caloriesForEaten(p, ["breakfast", "dinner"]), p.slots[0].kcal + p.slots[4].kcal);
  assert.equal(caloriesForEaten(p, ["nope"]), 0);
});
test("qtyText", () => {
  assert.equal(qtyText(0.5), "আধা"); assert.equal(qtyText(1.5), "দেড়"); assert.equal(qtyText(2), "২"); assert.equal(qtyText(2.5), "২½");
});
test("ব্যায়াম-প্ল্যান: প্রাপ্তবয়স্ক ১৫০, পেশি-লক্ষ্যেও ১৫০, শিশু ৪২০", () => {
  assert.equal(plannedWeeklyMinutes(exercisePlan(30, "fit")), 150);
  assert.equal(plannedWeeklyMinutes(exercisePlan(30, "muscle")), 150);
  assert.equal(plannedWeeklyMinutes(exercisePlan(70, "fit")), 150);
  assert.equal(plannedWeeklyMinutes(exercisePlan(10, "fit")), 420);
  assert.equal(exercisePlan(3, "fit").routine, null);
  assert.equal(exercisePlan(null, "fit"), null);
  assert.equal(exercisePlan(30, "fit").routine.length, 7);
});
test("সপ্তাহ শনি–শুক্র", () => {
  const d = weekDatesISO(new Date(2026, 10, 8)); // রবিবার ৮ নভেম্বর ২০২৬
  assert.equal(d[0], "2026-11-07"); assert.equal(d[1], "2026-11-08"); assert.equal(d[6], "2026-11-13");
  assert.equal(bdDayIndex(new Date(2026, 10, 7)), 0); assert.equal(bdDayIndex(new Date(2026, 10, 13)), 6);
  const m = weekDatesISO(new Date(2026, 11, 31)); // মাস/বছর পেরোনো
  assert.equal(m.length, 7);
});

import { last7DatesISO, buildTrend, reviewPoints, reviewComment } from "../../src/health/tracker/weeklyTrend.js";
test("ট্রেন্ড: ৭ দিন, শেষ দিন আজ", () => {
  const d = last7DatesISO(new Date(2026, 10, 8));
  assert.equal(d.length, 7); assert.equal(d[6], "2026-11-08"); assert.equal(d[0], "2026-11-02");
  assert.equal(last7DatesISO(new Date(2026, 0, 3))[0], "2025-12-28");
});
test("ট্রেন্ড-সারাংশ ও মন্তব্য", () => {
  const dates = last7DatesISO(new Date(2026, 10, 8));
  const docs = [
    { date: dates[0], weightKg: 68.4, caloriesIn: 1600, sleepMinutes: 360, exerciseMin: 30 },
    { date: dates[3], caloriesIn: 1650, sleepMinutes: 380, exerciseMin: 20 },
    { date: dates[6], weightKg: 67.8, caloriesIn: 1200, sleepMinutes: 400, exerciseMin: 0 },
  ];
  const t = buildTrend(docs, dates, { calorieTarget: 1650, sleepMinH: 7, weeklyExerciseTarget: 150 });
  assert.equal(t.weightChange, -0.6); assert.equal(t.calInRange, 2); assert.equal(t.sleepLow, 3); assert.equal(t.exerciseTotal, 50);
  const bn = String;
  assert.ok(reviewPoints(t, bn).some((x) => x.includes("কমেছে")));
  assert.ok(reviewComment(t, bn).some((x) => x.includes("100")));
  assert.equal(reviewComment(buildTrend([], dates, { calorieTarget: null, sleepMinH: 7, weeklyExerciseTarget: null }), bn).length, 1);
  const big = buildTrend([{ date: dates[0], weightKg: 70 }, { date: dates[1], weightKg: 68 }, { date: dates[2], exerciseMin: 1 }], dates, { calorieTarget: null, sleepMinH: 7, weeklyExerciseTarget: null });
  assert.ok(reviewComment(big, bn).some((x) => x.includes("ডাক্তার")));
});
