import test from "node:test";
import assert from "node:assert/strict";
import { FOODS, buildMealPlan, foodK, foodNote, setFoodOverrides, cleanFoodOverrides } from "../../src/health/tracker/mealPlanData.js";
import { sanitizePlanPrefs, setFoodOverride, setSlotPref, clearSlotPref, applyMealPrefs, draftKcal, mealOptions } from "../../src/health/tracker/planPrefs.js";

test("ওভাররাইড: ক্যালরি ও নোট বসে, মূল ক্যাটালগ অপরিবর্তিত", () => {
  const p = setFoodOverride(null, "rice", { k: 300, note: "  কম   তেলে  " });
  assert.deepEqual(p.foods, { rice: { k: 300, note: "কম তেলে" } });
  buildMealPlan(1650, [], p);
  assert.equal(foodK("rice"), 300);
  assert.equal(foodNote("rice"), "কম তেলে");
  assert.notEqual(FOODS.rice.k, 300);
  assert.equal(draftKcal([{ food: "rice", qty: 2 }]), 600);
  assert.equal(mealOptions([]).find((o) => o.key === "rice").kcal, 300);
});
test("ওভাররাইড সদস্য বদলালে থাকে না (prefs ছাড়া বিল্ড = মূল মান)", () => {
  buildMealPlan(1650, [], setFoodOverride(null, "rice", { k: 999 }));
  buildMealPlan(1650, [], null);
  assert.equal(foodK("rice"), FOODS.rice.k);
});
test("ওভাররাইডে প্ল্যানের ক্যালরি বদলায় (টার্গেটের কাছাকাছি থাকে)", () => {
  const base = buildMealPlan(1650, [], null);
  const p = setFoodOverride(null, "rice", { k: 400 });
  const plan = applyMealPrefs(buildMealPlan(1650, [], p), p, []);
  assert.ok(Math.abs(plan.total - 1650) <= 260);
  assert.notEqual(JSON.stringify(plan.slots.find((s) => s.id === "lunch").items), JSON.stringify(base.slots.find((s) => s.id === "lunch").items));
  setFoodOverrides(null);
});
test("মূল মানের সমান k জমা হয় না; null = মূল মানে ফেরা; শুধু-নোটও চলে", () => {
  const same = setFoodOverride(null, "rice", { k: FOODS.rice.k });
  assert.equal(same.foods, undefined);
  const noteOnly = setFoodOverride(null, "rice", { k: FOODS.rice.k, note: "ভালো" });
  assert.deepEqual(noteOnly.foods, { rice: { note: "ভালো" } });
  const back = setFoodOverride(noteOnly, "rice", null);
  assert.equal(back.foods, undefined);
  assert.ok(!("foods" in back));
});
test("অবৈধ ইনপুট বাদ: অজানা খাবার, ঋণাত্মক/বিশাল k, লম্বা নোট; সীমা ৪০", () => {
  assert.deepEqual(cleanFoodOverrides({ bogus: { k: 5 }, rice: { k: -1 }, dal: { k: 99999 } }), {});
  assert.equal(cleanFoodOverrides({ rice: { note: "x".repeat(500) } }).rice.note.length, 120);
  assert.equal(cleanFoodOverrides({ __proto__: { k: 1 }, constructor: { k: 1 } }).constructor, Object);
  const keys = Object.keys(FOODS).slice(0, 60);
  const many = Object.fromEntries(keys.map((k) => [k, { k: 10 }]));
  assert.equal(Object.keys(cleanFoodOverrides(many)).length, 40);
});
test("অন্য প্ল্যান-সংরক্ষণে foods অক্ষত থাকে; খালি হলে ফিল্ড নেই", () => {
  const p = setFoodOverride(null, "dal", { k: 150 });
  const q = setSlotPref(p, "lunch", [{ food: "rice", qty: 1 }]);
  assert.deepEqual(q.foods, { dal: { k: 150 } });
  assert.deepEqual(clearSlotPref(q, "lunch").foods, { dal: { k: 150 } });
  assert.ok(!("foods" in sanitizePlanPrefs(null)));
});
