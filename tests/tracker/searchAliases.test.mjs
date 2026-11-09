import test from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";
import { searchFoods } from "../../src/health/tracker/foodCatalog.js";
import { FOOD_EN, suggestMedicines, foodEnglish } from "../../src/shared/searchAliases.js";

test("প্রতিটি খাবারের ইংলিশ নাম আছে", () => {
  const missing = Object.keys(FOODS).filter((k) => !FOOD_EN[k]);
  assert.deepEqual(missing, []);
});
test("ভাত লিখলে Rice আসে", () => {
  const r = searchFoods(FOODS, { query: "ভাত" });
  assert.ok(r.some(({ key, f }) => key === "rice" && foodEnglish(key, f) === "Rice"));
});
test("Rice / bhat দিয়েও মেলে", () => {
  assert.ok(searchFoods(FOODS, { query: "rice" }).some(({ key }) => key === "rice"));
  assert.ok(searchFoods(FOODS, { query: "bhat" }).some(({ key }) => key === "rice"));
});
test("নাপা লিখলে Napa → Paracetamol, মান জেনেরিক", () => {
  const pool = ["Paracetamol", "Ibuprofen"];
  const s = suggestMedicines(pool, "নাপা");
  assert.equal(s[0].label, "Paracetamol");
  assert.equal(s[0].value, "Paracetamol");
});
test("napa ইংলিশে ও পুল-বহির্ভূত জেনেরিক বাদ", () => {
  assert.equal(suggestMedicines(["Ibuprofen"], "napa").length, 0);
  assert.equal(suggestMedicines(["Paracetamol"], "napa")[0].label, "Napa → Paracetamol");
});
