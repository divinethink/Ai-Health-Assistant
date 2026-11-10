import test from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";
import { FOOD_NUTRITION, nutritionOf } from "../../src/health/tracker/foodNutrition.js";

const entries = Object.entries(FOOD_NUTRITION);

test("ডেটা আছে ও প্রতিটি key বিদ্যমান ক্যাটালগে আছে", () => {
  assert.ok(entries.length >= 41);
  for (const [k] of entries) assert.ok(FOODS[k], "ক্যাটালগে নেই: " + k);
});

test("সংখ্যা বৈধ: অ-ঋণাত্মক, সীমার মধ্যে, ফাইবার ≤ কার্ব, প্রোটিন+কার্ব+ফ্যাট ≤ ১০০", () => {
  for (const [k, v] of entries) {
    const { kcal, p, c, f, fib } = v.per100;
    for (const x of [kcal, p, c, f, fib]) assert.ok(Number.isFinite(x) && x >= 0, k);
    assert.ok(kcal <= 900 && p <= 100 && c <= 100 && f <= 100, k);
    assert.ok(fib <= c, k + ": ফাইবার > কার্ব");
    assert.ok(p + c + f <= 100.5, k + ": ম্যাক্রোর যোগ > ১০০ গ্রাম");
  }
});

test("Atwater-সঙ্গতি: ৪p + ৪(c−fib) + ২fib + ৯f ≈ kcal (±১০% বা ৬ kcal)", () => {
  for (const [k, v] of entries) {
    const { kcal, p, c, f, fib } = v.per100;
    const at = 4 * p + 4 * (c - fib) + 2 * fib + 9 * f;
    assert.ok(Math.abs(at - kcal) <= Math.max(0.1 * kcal, 6), k + ": kcal=" + kcal + " অথচ ম্যাক্রো থেকে " + at.toFixed(0));
  }
});

test("মাপ: অন্তত একটি, id অনন্য, গ্রাম > ০ ও ≤ ১০০০", () => {
  for (const [k, v] of entries) {
    assert.ok(v.measures.length >= 1, k);
    assert.equal(new Set(v.measures.map((m) => m.id)).size, v.measures.length, k);
    for (const m of v.measures) assert.ok(m.label && m.g > 0 && m.g <= 1000, k + "/" + m.id);
  }
});

test("ডিফল্ট মাপের kcal বিদ্যমান ক্যাটালগের kcal-এর ±১৫%-এর মধ্যে (প্ল্যানের সাথে সঙ্গতি)", () => {
  for (const [k, v] of entries) {
    const def = (v.per100.kcal * v.measures[0].g) / 100;
    const old = FOODS[k].k;
    assert.ok(Math.abs(def - old) <= 0.15 * old, k + ": নতুন " + def.toFixed(0) + " বনাম পুরনো " + old);
  }
});

test("src/chk/ref সঠিক ধরনের", () => {
  for (const [k, v] of entries) {
    assert.ok(v.src === "table" || v.src === "recipe", k);
    assert.ok(v.chk === 0 || v.chk === 1, k);
    assert.ok(typeof v.ref === "string" && v.ref.length > 0, k);
  }
});

test("nutritionOf: আছে → এন্ট্রি; নেই বা প্রোটোটাইপ-নাম → null", () => {
  assert.equal(nutritionOf("rice").per100.kcal, 130);
  assert.equal(nutritionOf("nosuchfood"), null);
  assert.equal(nutritionOf("toString"), null);
  assert.equal(nutritionOf("constructor"), null);
});
