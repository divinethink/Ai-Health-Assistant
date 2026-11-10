import test from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";
import { FOOD_NUTRITION_A } from "../../src/health/tracker/foodNutritionA.js";
import { FOOD_NUTRITION_B } from "../../src/health/tracker/foodNutritionB.js";
import { FOOD_NUTRITION_C } from "../../src/health/tracker/foodNutritionC.js";
import { FOOD_NUTRITION } from "../../src/health/tracker/foodNutrition.js";

test("ব্যাচ A/B/C-তে একই key দুবার নেই", () => {
  const all = [...Object.keys(FOOD_NUTRITION_A), ...Object.keys(FOOD_NUTRITION_B), ...Object.keys(FOOD_NUTRITION_C)];
  assert.equal(new Set(all).size, all.length);
  assert.equal(Object.keys(FOOD_NUTRITION).length, all.length);
});

test("মিল-প্ল্যানের প্রতিটি খাবারের পুষ্টি-ডেটা আছে (পূর্ণ কভারেজ)", () => {
  const missing = Object.keys(FOODS).filter((k) => !FOOD_NUTRITION[k]);
  assert.deepEqual(missing, []);
});
