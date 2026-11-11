// চালানো: node --test tests/tracker/planExplain.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { explainMeal, explainExercise } from "../../src/health/tracker/planExplain.js";
import { exercisePlan } from "../../src/health/tracker/exercisePlanData.js";

const goal = { goalType: "lose", activity: "medium", calc: { bmr: 1500, tdee: 2325, calorieTarget: 2020, notes: ["নোট-১"] } };

test("explainMeal: calc না থাকলে বা অসম্পূর্ণ হলে null", () => {
  assert.equal(explainMeal({ goal: null }), null);
  assert.equal(explainMeal({ goal: { goalType: "fit", activity: "low" } }), null);
  assert.equal(explainMeal({ goal: { calc: { calorieTarget: 2000 } } }), null);
});
test("explainMeal: BMR/TDEE/গুণক/কম খাওয়া/টার্গেট/নোট থাকে", () => {
  const t = explainMeal({ goal, age: 34, weightKg: 68, heightCm: 160, allergyTags: [] }).join("\n");
  assert.ok(t.includes("১,৫০০") && t.includes("২,৩২৫") && t.includes("২,০২০"));
  assert.ok(t.includes("১.৫৫"), "গুণক");
  assert.ok(t.includes("৩০৫") && t.includes("কম"), "৩০৫ কম");
  assert.ok(t.includes("নোট-১"));
  assert.ok(!t.includes("অ্যালার্জি"));
});
test("explainMeal: অ্যালার্জি-ট্যাগ থাকলে অ্যালার্জির লাইন; প্রোফাইল-ফিল্ড না থাকলে ভাঙে না", () => {
  const l = explainMeal({ goal, age: null, weightKg: null, heightCm: null, allergyTags: ["egg"] });
  assert.ok(l.join("\n").includes("অ্যালার্জি"));
  assert.ok(!l.some((x) => x.startsWith("প্রোফাইল:")));
});
test("explainMeal: gain-লক্ষ্যে 'বেশি'", () => {
  const l = explainMeal({ goal: { goalType: "gain", activity: "high", calc: { bmr: 1500, tdee: 2000, calorieTarget: 2200, notes: [] } } });
  assert.ok(l.join("\n").includes("২০০") && l.join("\n").includes("বেশি"));
});
test("explainExercise: null প্ল্যানে null; প্রাপ্তবয়স্কে WHO + ব্যান্ড; muscle-এ ৩ দিন", () => {
  assert.equal(explainExercise({ plan: null }), null);
  const fit = explainExercise({ plan: exercisePlan(34, "fit"), age: 34, goalType: "fit" }).join("\n");
  assert.ok(fit.includes("WHO") && fit.includes("প্রাপ্তবয়স্ক") && fit.includes("২ দিন"));
  assert.equal(fit.includes("উপরের সারাংশে"), false);
  const mus = explainExercise({ plan: exercisePlan(34, "muscle"), age: 34, goalType: "muscle" }).join("\n");
  assert.ok(mus.includes("৩ দিন"));
});
test("explainExercise: ৫-এর কম বয়সে রুটিন-লাইন নেই", () => {
  const l = explainExercise({ plan: exercisePlan(3, null), age: 3, goalType: null });
  assert.equal(l.length, 2);
});
