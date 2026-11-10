// চালানো: node --test tests/tracker/foodMeasures.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FOOD_NUTRITION, nutritionOf } from "../../src/health/tracker/foodNutrition.js";
import { LIQUID_DENSITY, extraMeasuresFor } from "../../src/health/tracker/foodMeasures.js";
import { measuresOf, measureToGrams, buildFoodEntry, entryAmountText } from "../../src/health/tracker/foodCalc.js";
import { sanitizeExtraFoods } from "../../src/health/tracker/planPrefs.js";

test("তালিকার প্রতিটি key-র পুষ্টি-ডেটা আছে ও ঘনত্ব ০.৮–১.২", () => {
  for (const [k, d] of Object.entries(LIQUID_DENSITY)) {
    assert.ok(FOOD_NUTRITION[k], k);
    assert.ok(d >= 0.8 && d <= 1.2, k);
  }
});
test("ডিফল্ট (প্রথম) মাপ অপরিবর্তিত; id ও নাম অনন্য; গ্রাম ০–১০০০", () => {
  for (const k of Object.keys(LIQUID_DENSITY)) {
    const base = nutritionOf(k).measures;
    const all = measuresOf(k);
    assert.deepEqual(all[0], base[0], k);
    assert.equal(new Set(all.map((m) => m.id)).size, all.length, k);
    assert.equal(new Set(all.map((m) => m.label)).size, all.length, k);
    all.forEach((m) => assert.ok(m.g > 0 && m.g <= 1000, k + "/" + m.id));
  }
});
test("ডাল: কাটোরি ১৫০, কাপ ২৪০, চামচ ১৫ গ্রাম; পায়েসে ঘনত্ব ১.০৫", () => {
  assert.equal(measureToGrams("dal", "katori", 1), 150);
  assert.equal(measureToGrams("dal", "cup", 1), 240);
  assert.equal(measureToGrams("dal", "tbsp", 2), 30);
  assert.equal(measureToGrams("payesh", "katori", 1), 157.5);
});
test("তরল নয় এমন খাবারে বাড়তি মাপ নেই; চা-র নিজের cup আবার যোগ হয় না", () => {
  assert.deepEqual(measuresOf("rice"), nutritionOf("rice").measures);
  assert.deepEqual(measuresOf("roti"), nutritionOf("roti").measures);
  assert.deepEqual(extraMeasuresFor("tea", nutritionOf("tea").measures), []);
  assert.deepEqual(extraMeasuresFor("dal", [{ id: "cup", label: "কাপ", g: 1 }]).map((m) => m.id), ["katori", "tbsp"]);
});
test("কাটোরিতে এন্ট্রি বানানো, sanitize-সঙ্গত, লেখা ঠিক", () => {
  const e = buildFoodEntry("dal", "lunch", { measureId: "katori", qty: 1 });
  assert.equal(e.grams, 150);
  assert.equal(e.measure, "katori");
  assert.deepEqual(sanitizeExtraFoods([e]), [e]);
  assert.equal(entryAmountText(e), "১ কাটোরি ≈ ১৫০ গ্রাম");
  assert.equal(buildFoodEntry("dal", "lunch", { measureId: "nope", qty: 1 }), null);
});
