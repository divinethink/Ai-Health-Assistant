// Logic & Calculation Audit (১৪ নভেম্বর ২০২৬) — হাতে-হিসাব করা মান ও সংশোধিত ভুলের regression।
import test from "node:test";
import assert from "node:assert/strict";
import { computeGoal, sleepMinutes, bmiOf } from "../../src/health/tracker/trackerCalc.js";
import { calorieMet, metricsOf } from "../../src/health/tracker/todaySummary.js";
import { buildTrend } from "../../src/health/tracker/weeklyTrend.js";
import { buildMealPlan, FOODS } from "../../src/health/tracker/mealPlanData.js";
import { applyMealPrefs, caloriesForDay } from "../../src/health/tracker/planPrefs.js";
import { tickedPlanEntries, sumNutrition } from "../../src/health/tracker/foodCalc.js";

test("Mifflin-St Jeor + গুণক: হাতে-হিসাবের সাথে মেলে", () => {
  // পুরুষ ৩০, ১৭৫ সেমি, ৭০ কেজি: 700+1093.75−150+5 = 1648.75; ×১.৫৫ = 2555.6
  const m = computeGoal({ goalType: "fit", activity: "medium", sex: "male", age: 30, heightCm: 175, weightKg: 70, flags: {} });
  assert.equal(m.bmr, 1649); assert.equal(m.tdee, 2556); assert.equal(m.calorieTarget, 2560);
  // মহিলা ২৫, ১৬০ সেমি, ৫৫ কেজি: 550+1000−125−161 = 1264; ×১.২ = 1516.8
  const f = computeGoal({ goalType: "fit", activity: "low", sex: "female", age: 25, heightCm: 160, weightKg: 55, flags: {} });
  assert.equal(f.bmr, 1264); assert.equal(f.tdee, 1517);
  assert.ok(Math.abs(bmiOf(70, 175) - 22.857) < 0.001);
});

test("ওজন কমানো: ০.৫ কেজি/সপ্তাহ = ৫৫০ কিলোক্যালরি/দিন ঘাটতি (৭৭০০ ÷ ৭ × ০.৫)", () => {
  const l = computeGoal({ goalType: "lose", activity: "light", sex: "male", age: 35, heightCm: 172, weightKg: 80, targetWeightKg: 72, weeks: 16, flags: {} });
  assert.equal(l.weeklyRateKg, 0.5);
  assert.ok(Math.abs((l.tdee - 550) - l.calorieTarget) <= 5); // ১০-এ রাউন্ডিং + tdee রাউন্ডিং
});

test("ন্যূনতম-ক্যালরি মেঝে ছুঁলে সাপ্তাহিক হার বাস্তব মানে আসে (আগে ০.৫ মিথ্যা দেখাত)", () => {
  const r = computeGoal({ goalType: "lose", activity: "low", sex: "female", age: 50, heightCm: 150, weightKg: 52, targetWeightKg: 48, weeks: 8, flags: {} });
  assert.equal(r.calorieTarget, 1200);
  const real = ((r.tdee - 1200) * 7) / 7700;
  assert.ok(Math.abs(r.weeklyRateKg - Math.round(real * 100) / 100) <= 0.01);
  assert.ok(r.weeklyRateKg < 0.1);
  // মেঝে ≥ TDEE: কমার ঘাটতিই নেই → ০ + সতর্কতা
  const z = computeGoal({ goalType: "lose", activity: "low", sex: "female", age: 30, heightCm: 145, weightKg: 40, targetWeightKg: 38, weeks: 8, flags: {} });
  if (z.tdee <= 1200) { assert.equal(z.weeklyRateKg, 0); assert.ok(z.notes.some((n) => n.includes("ঘাটতি থাকে না"))); }
  // মেঝে না ছুঁলে অপরিবর্তিত
  assert.equal(computeGoal({ goalType: "lose", activity: "light", sex: "male", age: 35, heightCm: 172, weightKg: 80, targetWeightKg: 72, weeks: 16, flags: {} }).weeklyRateKg, 0.5);
});

test("sleepMinutes: মধ্যরাত পেরোনো ঠিক; শোয়া=ওঠা (২৪ ঘণ্টা) ও অবৈধ সময় null", () => {
  assert.equal(sleepMinutes("23:00", "06:30"), 450);
  assert.equal(sleepMinutes("01:00", "09:00"), 480);
  assert.equal(sleepMinutes("22:00", "22:00"), null);
  assert.equal(sleepMinutes("25:99", "06:00"), null);
  assert.equal(sleepMinutes("22:00", "06:60"), null);
});

test("ক্যালরি 'লক্ষ্যের মধ্যে': আজ/ট্রেন্ড একই নিয়ম (৮০–১১০%)", () => {
  assert.equal(calorieMet(1600, 2000), true);
  assert.equal(calorieMet(1599, 2000), false);
  assert.equal(calorieMet(2200, 2000), true);
  assert.equal(calorieMet(2201, 2000), false);
  assert.equal(calorieMet(1800, null), false);
  const dates = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
  const docs = [{ date: dates[0], caloriesIn: 1700 }, { date: dates[1], caloriesIn: 1650 }, { date: dates[2], caloriesIn: 2150 }, { date: dates[3], caloriesIn: 1400 }];
  const t = buildTrend(docs, dates, { calorieTarget: 2000, sleepMinH: 7, fastDays: [] });
  const ctx = { calorieTarget: 2000, exTarget: 30, waterTarget: null, sleepMinH: 7, fastDays: [] };
  assert.equal(t.calInRange, docs.filter((d) => metricsOf(d, ctx).met.includes("calories")).length);
  assert.equal(t.calInRange, 3);
});

test("ঘুম 'লক্ষ্যের নিচে': গোলাকার ঘণ্টায় নয়, মিনিটে (৬ঘ ৫৯মি = নিচে)", () => {
  const t = buildTrend([{ date: "2026-11-10", sleepMinutes: 419 }, { date: "2026-11-11", sleepMinutes: 420 }], ["2026-11-10", "2026-11-11"], { calorieTarget: null, sleepMinH: 7, fastDays: [] });
  assert.equal(t.sleepLow, 1);
});

test("প্ল্যান-মোট টার্গেটের ±৮০ কিলোক্যালরির ভেতরে (১২০০–২৫০০; সর্বনিম্ন পরিমাণের ধাপে কম টার্গেটে সামান্য বেশি হয়)", () => {
  for (let target = 1200; target <= 2500; target += 50) {
    const p = buildMealPlan(target, [], null, {});
    assert.ok(Math.abs(p.total - target) <= 80, target + " → " + p.total);
  }
});

test("টিক-করা প্ল্যানের ম্যাক্রো: ক্যালরি-রিংয়ের একই আইটেম থেকে আসে (আগে ০ দেখাত)", () => {
  const plan = applyMealPrefs(buildMealPlan(2000, [], null, {}), null, []);
  assert.deepEqual(sumNutrition(tickedPlanEntries(plan, [])), { kcal: 0, p: 0, c: 0, f: 0, fib: 0, total: 0, withMacro: 0 });
  const eaten = ["breakfast", "lunch"];
  const s = sumNutrition(tickedPlanEntries(plan, eaten));
  assert.equal(s.kcal, caloriesForDay(plan, eaten, [])); // রিংয়ের kcal-এর সাথে হুবহু
  assert.ok(s.total > 0 && s.withMacro === s.total);
  assert.ok(s.p > 5 && s.c > 30 && s.f > 3);
  // Atwater মোটামুটি: ৪প+৪(কার্ব)+৯ফ ≈ kcal (±২৫%; ডেটা-মান ও ক্যাটালগ-k আনুমানিক)
  const est = 4 * s.p + 4 * s.c + 9 * s.f;
  assert.ok(Math.abs(est - s.kcal) / s.kcal < 0.25, est + " বনাম " + s.kcal);
});

test("টিক-করা প্ল্যান: নিজের-মান override থাকলে ওই আইটেমে শুধু kcal (ভুল ম্যাক্রো নয়)", () => {
  const prefs = { v: 1, meal: {}, exercise: {}, foods: { rice: { k: 300 } } };
  const plan = applyMealPrefs(buildMealPlan(2000, [], prefs, {}), prefs, []);
  const ent = tickedPlanEntries(plan, ["lunch"]);
  const rice = plan.slots.find((x) => x.id === "lunch").items.findIndex((i) => i.key === "rice");
  assert.ok(rice >= 0);
  assert.equal(ent[rice].p, undefined);
  const s = sumNutrition(ent);
  assert.ok(s.withMacro < s.total);
  buildMealPlan(2000, [], null, {}); // গ্লোবাল override রিসেট
  assert.ok(FOODS.rice);
});
