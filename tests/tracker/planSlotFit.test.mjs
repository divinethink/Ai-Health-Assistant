import test from "node:test";
import assert from "node:assert/strict";
import { buildMealPlan, slotTargets } from "../../src/health/tracker/mealPlanData.js";

test("প্ল্যানের প্রতি বেলা নিজের বরাদ্দের ±৫৫-এর মধ্যে (১২০০–২৫০০)", () => {
  for (let t = 1200; t <= 2500; t += 50) {
    const g = slotTargets(t);
    buildMealPlan(t, []).slots.forEach((s) => assert.ok(Math.abs(s.kcal - g[s.id]) <= 55, t + " " + s.id + " " + s.kcal + "/" + g[s.id]));
  }
});
test("সকাল ≥ রাত (রাতে কম)", () => {
  [1500, 2040, 2400].forEach((t) => { const s = buildMealPlan(t, []).slots; assert.ok(s[0].kcal > s[4].kcal); });
});
