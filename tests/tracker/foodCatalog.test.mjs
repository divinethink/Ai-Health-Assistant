// চালানো: node --test tests/tracker/foodCatalog.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FOODS, buildMealPlan, itemText } from "../../src/health/tracker/mealPlanData.js";
import { CATALOG_FOODS, FOOD_GROUPS, searchFoods } from "../../src/health/tracker/foodCatalog.js";
import { sanitizePlanPrefs, applyMealPrefs, draftKcal, addDraftFood, mealOptions } from "../../src/health/tracker/planPrefs.js";

const CORE = ["roti", "rice", "dal", "veg", "salad", "egg", "fish", "chicken", "banana", "muri", "tea", "greentea"];
const TAGS = ["egg", "fish", "chicken", "wheat", "dairy"];
const GROUPS = FOOD_GROUPS.map(([id]) => id);

test("ক্যাটালগ: ৫০+ খাবার, কোর-কী-র সাথে সংঘর্ষ নেই, মোট = কোর + ক্যাটালগ", () => {
  assert.ok(Object.keys(CATALOG_FOODS).length >= 50);
  CORE.forEach((k) => assert.ok(!(k in CATALOG_FOODS), k));
  assert.equal(Object.keys(FOODS).length, CORE.length + Object.keys(CATALOG_FOODS).length);
});
test("প্রতিটি খাবার: নাম/ইউনিট, কিলোক্যালরি ০–১০০০ পূর্ণসংখ্যা, বৈধ গ্রুপ ও এলার্জি-ট্যাগ", () => {
  Object.entries(FOODS).forEach(([k, f]) => {
    assert.ok(f.n && f.n.length <= 30 && f.u, k);
    assert.ok(Number.isInteger(f.k) && f.k >= 0 && f.k <= 1000, k);
    assert.ok(GROUPS.includes(f.g), k + " গ্রুপ");
    if (f.al) assert.ok(TAGS.includes(f.al), k + " ট্যাগ");
  });
});
test("বেস-প্ল্যান অপরিবর্তিত: ১৬৫০ টার্গেটে এখনো ±৮০", () => {
  const p = buildMealPlan(1650, []);
  assert.ok(Math.abs(p.total - 1650) <= 80);
});
test("সার্চ: নাম, গ্রুপ, এলার্জি-বাদ, সীমা", () => {
  assert.deepEqual(searchFoods(FOODS, { query: "ইলিশ" }).map((x) => x.key).sort(), ["hilshaBhaja", "hilshaJhol"]);
  assert.ok(searchFoods(FOODS, { query: "ইলিশ", allergyTags: ["fish"] }).length === 0);
  assert.ok(searchFoods(FOODS, { group: "fruit" }).every((x) => x.f.g === "fruit"));
  assert.equal(searchFoods(FOODS, { limit: 5 }).length, 5);
  assert.equal(searchFoods(FOODS, { query: "zzz" }).length, 0);
  assert.ok(!searchFoods(FOODS, { allergyTags: TAGS }).some((x) => x.f.al));
});
test("নতুন খাবার প্ল্যানে: সংরক্ষণ-যাচাই পাস, ক্যালরি ঠিক, এলার্জিতে বাদ", () => {
  const prefs = { meal: { lunch: [{ food: "hilshaBhaja", qty: 1 }, { food: "rice", qty: 1.5 }, { food: "bogus", qty: 1 }] } };
  const s = sanitizePlanPrefs(prefs);
  assert.deepEqual(s.meal.lunch.map((r) => r.food), ["hilshaBhaja", "rice"]);
  const base = buildMealPlan(1650, []);
  const plan = applyMealPrefs(base, prefs, []);
  assert.equal(plan.slots.find((x) => x.id === "lunch").kcal, 200 + 300);
  const blocked = applyMealPrefs(base, prefs, ["fish"]);
  assert.equal(blocked.slots.find((x) => x.id === "lunch").kcal, 300);
  assert.ok(!mealOptions(["fish"]).some((o) => o.key === "hilshaBhaja"));
  assert.equal(draftKcal(addDraftFood([], "mango")), 130);
  assert.equal(itemText("pauruti", 2), "২ স্লাইস পাউরুটি");
});
