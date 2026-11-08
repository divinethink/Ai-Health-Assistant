// চালানো: node --test tests/tracker/planPrefs.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizePlanPrefs, sanitizeExtraFoods, sanitizeExerciseLog, mealOptions, exerciseOptions,
  applyMealPrefs, caloriesForDay, extraFoodsKcal, mealWarnings, applyExercisePrefs, exerciseLogMinutes, exerciseWarnings,
} from "../../src/health/tracker/planPrefs.js";
import { buildMealPlan, caloriesForEaten } from "../../src/health/tracker/mealPlanData.js";
import { exercisePlan, plannedWeeklyMinutes } from "../../src/health/tracker/exercisePlanData.js";

const EMPTY = { v: 1, meal: {}, exercise: {} };

test("sanitizePlanPrefs: ভুল/খালি ইনপুটে খালি prefs, কখনো throw নয়", () => {
  for (const x of [undefined, null, 5, "x", [], {}, { meal: 3, exercise: "a" }]) assert.deepEqual(sanitizePlanPrefs(x), EMPTY);
});
test("sanitizePlanPrefs: অবৈধ স্লট/খাবার/পরিমাণ/ধরন/মিনিট বাদ; আধা-ধাপে গোল; idempotent", () => {
  const raw = {
    v: 99, evil: 1,
    meal: { lunch: [{ food: "rice", qty: 1.3 }, { food: "bogus", qty: 1 }, { food: "dal", qty: -1 }, { food: "egg", qty: 11 }, null], nope: [{ food: "rice", qty: 1 }], dinner: [] },
    exercise: { 0: [{ type: "cycling", min: 40.4 }, { type: "bogus", min: 30 }, { type: "walk", min: 4 }, { type: "gym", min: 301 }], 7: [{ type: "walk", min: 30 }], 3: [] },
  };
  const c = sanitizePlanPrefs(raw);
  assert.deepEqual(c, { v: 1, meal: { lunch: [{ food: "rice", qty: 1.5 }], dinner: [] }, exercise: { 0: [{ type: "cycling", min: 40 }], 3: [] } });
  assert.deepEqual(sanitizePlanPrefs(c), c);
});
test("sanitizePlanPrefs: স্লট ১২টি ও দিনে ৬টির বেশি আইটেম কাটা", () => {
  const m = Array.from({ length: 30 }, () => ({ food: "rice", qty: 1 }));
  const e = Array.from({ length: 30 }, () => ({ type: "walk", min: 10 }));
  const c = sanitizePlanPrefs({ meal: { lunch: m }, exercise: { 1: e } });
  assert.equal(c.meal.lunch.length, 12);
  assert.equal(c.exercise["1"].length, 6);
});
test("sanitizeExtraFoods: নাম পরিষ্কার, kcal ০–৩০০০, বেলা বৈধ, সর্বোচ্চ ২০", () => {
  const c = sanitizeExtraFoods([
    { name: "  সিঙ্গারা\n\t ", kcal: 250.4, slot: "snack2" },
    { name: "", kcal: 100, slot: "lunch" }, { name: "x", kcal: -1, slot: "lunch" }, { name: "x", kcal: 3001, slot: "lunch" },
    { name: "x", kcal: 10, slot: "midnight" }, { name: 5, kcal: 10, slot: "lunch" },
  ]);
  assert.deepEqual(c, [{ name: "সিঙ্গারা", kcal: 250, slot: "snack2" }]);
  assert.equal(sanitizeExtraFoods(Array.from({ length: 50 }, () => ({ name: "a", kcal: 1, slot: "lunch" }))).length, 20);
  assert.equal(sanitizeExtraFoods("x").length, 0);
  assert.equal(sanitizeExtraFoods([{ name: "ক".repeat(100), kcal: 1, slot: "lunch" }])[0].name.length, 40);
});
test("sanitizeExerciseLog: ধরন বৈধ, মিনিট ১–৩০০", () => {
  assert.deepEqual(sanitizeExerciseLog([{ type: "swim", min: 45 }, { type: "bogus", min: 5 }, { type: "walk", min: 0 }, { type: "walk", min: 301 }]), [{ type: "swim", min: 45 }]);
});
test("mealOptions: এলার্জির খাবার বাদ; exerciseOptions: সব ধরন", () => {
  const keys = (t) => mealOptions(t).map((o) => o.key);
  assert.ok(keys([]).includes("egg") && keys([]).includes("fish"));
  assert.ok(!keys(["egg"]).includes("egg") && !keys(["fish"]).includes("fish") && !keys(["wheat"]).includes("roti"));
  assert.ok(exerciseOptions().some((o) => o.type === "stretch" && o.counted === false));
});
test("applyMealPrefs: prefs না থাকলে প্ল্যান হুবহু একই; স্লট বদলালে মোট পুনর্হিসাব; [] = বেলা বাদ", () => {
  const plan = buildMealPlan(2000, []);
  assert.deepEqual(applyMealPrefs(plan, undefined, []).slots, plan.slots);
  assert.equal(applyMealPrefs(plan, EMPTY, []).total, plan.total);
  const r = applyMealPrefs(plan, { meal: { lunch: [{ food: "rice", qty: 1 }, { food: "egg", qty: 2 }], snack1: [] } }, []);
  const lunch = r.slots.find((s) => s.id === "lunch");
  assert.equal(lunch.kcal, 200 + 150);
  assert.ok(lunch.items.every((i) => i.custom));
  assert.equal(r.slots.find((s) => s.id === "snack1").kcal, 0);
  assert.deepEqual(r.custom.sort(), ["lunch", "snack1"]);
  assert.equal(r.total, r.slots.reduce((a, s) => a + s.kcal, 0));
  assert.equal(plan.slots.find((s) => s.id === "lunch").items.length > 2, true, "মূল প্ল্যান mutate হয়নি");
});
test("applyMealPrefs: এলার্জির খাবার prefs-এ থাকলেও বাদ + নোট", () => {
  const plan = buildMealPlan(2000, ["egg"]);
  const r = applyMealPrefs(plan, { meal: { breakfast: [{ food: "egg", qty: 1 }, { food: "roti", qty: 2 }] } }, ["egg"]);
  const b = r.slots.find((s) => s.id === "breakfast");
  assert.deepEqual(b.items.map((i) => i.key), ["roti"]);
  assert.ok(r.notes.some((n) => n.includes("এলার্জি")));
});
test("caloriesForDay: টিক-করা বেলা + extraFoods; অবৈধ extra ধরা হয় না", () => {
  const plan = buildMealPlan(2000, []);
  const ids = ["breakfast", "lunch"];
  assert.equal(caloriesForDay(plan, ids, []), caloriesForEaten(plan, ids));
  assert.equal(caloriesForDay(plan, ids, [{ name: "সমুচা", kcal: 200, slot: "snack2" }, { name: "bad", kcal: -5, slot: "snack2" }]), caloriesForEaten(plan, ids) + 200);
  assert.equal(extraFoodsKcal(undefined), 0);
});
test("mealWarnings: ন্যূনতমের নিচে ও টার্গেটের চেয়ে বেশি; sex অজানা হলে ন্যূনতম-সতর্কতা নেই", () => {
  assert.equal(mealWarnings(1000, { sex: "female", target: 1000 }).length, 1);
  assert.equal(mealWarnings(1400, { sex: "male", target: 1400 }).length, 1);
  assert.equal(mealWarnings(1000, { target: 1000 }).length, 0);
  assert.equal(mealWarnings(2400, { sex: "male", target: 2000 }).length, 1);
  assert.equal(mealWarnings(2000, { sex: "male", target: 2000 }).length, 0);
});
test("applyExercisePrefs: prefs না থাকলে একই; দিন বদল; key-সামঞ্জস্য (main/stretch); বিশ্রাম; mutate নয়", () => {
  const plan = exercisePlan(34, "fit");
  assert.deepEqual(applyExercisePrefs(plan, undefined).routine, plan.routine);
  const before = JSON.stringify(plan.routine);
  const r = applyExercisePrefs(plan, { exercise: { 0: [{ type: "cycling", min: 45 }, { type: "stretch", min: 10 }, { type: "gym", min: 20 }], 2: [] } });
  assert.deepEqual(r.routine[0].map((x) => x.key), ["main", "stretch", "x2"]);
  assert.equal(r.routine[0][0].label, "সাইকেল");
  assert.equal(r.routine[0][1].counted, false);
  assert.deepEqual(r.routine[2], []);
  assert.deepEqual(r.routine[1], plan.routine[1]);
  assert.equal(JSON.stringify(plan.routine), before);
  assert.equal(plannedWeeklyMinutes(r), plannedWeeklyMinutes(plan) - 30 + 65 - 30 /* সোম বিশ্রাম (walk ৩০) */);
});
test("applyExercisePrefs: ৫ বছরের কম (routine নেই) ও null-এ অপরিবর্তিত", () => {
  const p = exercisePlan(3, null);
  assert.equal(applyExercisePrefs(p, { exercise: { 0: [{ type: "walk", min: 30 }] } }), p);
  assert.equal(applyExercisePrefs(null, {}), null);
});
test("exerciseLogMinutes: স্ট্রেচিং গোনা হয় না; exerciseWarnings: দিনে >১২০ ও সপ্তাহে >৩০০ (প্রাপ্তবয়স্ক)", () => {
  assert.equal(exerciseLogMinutes([{ type: "walk", min: 30 }, { type: "stretch", min: 10 }, { type: "bogus", min: 99 }]), 30);
  const plan = exercisePlan(34, "fit");
  assert.equal(exerciseWarnings(plan, plannedWeeklyMinutes(plan)).length, 0);
  const heavy = applyExercisePrefs(plan, { exercise: { 0: [{ type: "run", min: 130 }], 1: [{ type: "run", min: 120 }], 2: [{ type: "run", min: 100 }] } });
  assert.equal(exerciseWarnings(heavy, plannedWeeklyMinutes(heavy)).length, 2);
  assert.deepEqual(exerciseWarnings(exercisePlan(3, null), 0), []);
});
