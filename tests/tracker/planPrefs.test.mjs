// চালানো: node --test tests/tracker/planPrefs.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizePlanPrefs, sanitizeExtraFoods, sanitizeExerciseLog, mealOptions, exerciseOptions,
  applyMealPrefs, caloriesForDay, extraFoodsKcal, mealWarnings, applyExercisePrefs, exerciseLogMinutes, exerciseWarnings,
  setSlotPref, clearSlotPref, setDayPref, clearDayPref, draftFromSlotItems, addDraftFood, changeDraftQty, removeDraftAt, draftKcal,
  draftFromDayItems, addDraftExercise, changeDraftMin, reconcileExerciseDone, checkExtraFood, checkExerciseLog,
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
test("mealOptions: এলার্জির খাবার থাকে (allergy চিহ্ন); exerciseOptions: সব ধরন", () => {
  const keys = (t) => mealOptions(t).map((o) => o.key);
  assert.ok(keys([]).includes("egg") && keys([]).includes("fish"));
  assert.ok(keys(["egg"]).includes("egg") && keys(["fish"]).includes("fish") && keys(["wheat"]).includes("roti"));
  assert.equal(mealOptions(["egg"]).find((o) => o.key === "egg").allergy, true);
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
test("applyMealPrefs: এলার্জির খাবার prefs-এ থাকলে থাকে + সতর্কতা-নোট", () => {
  const plan = buildMealPlan(2000, ["egg"]);
  const r = applyMealPrefs(plan, { meal: { breakfast: [{ food: "egg", qty: 1 }, { food: "roti", qty: 2 }] } }, ["egg"]);
  const b = r.slots.find((s) => s.id === "breakfast");
  assert.deepEqual(b.items.map((i) => i.key), ["egg", "roti"]);
  assert.equal(b.items[0].allergy, true);
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

// ---------- ধাপ B-২ এডিট-হেল্পার ----------
test("setSlotPref/clearSlotPref: শুধু ওই বেলা বদলায়, অবৈধ স্লট উপেক্ষিত, mutate নয়", () => {
  const a = setSlotPref(undefined, "lunch", [{ food: "rice", qty: 1 }]);
  const frozen = JSON.stringify(a);
  const b = setSlotPref(a, "dinner", [{ food: "roti", qty: 2 }, { food: "bogus", qty: 1 }]);
  assert.deepEqual(Object.keys(b.meal).sort(), ["dinner", "lunch"]);
  assert.deepEqual(b.meal.dinner, [{ food: "roti", qty: 2 }]);
  assert.equal(JSON.stringify(a), frozen);
  assert.deepEqual(setSlotPref(a, "nope", [{ food: "rice", qty: 1 }]), a);
  const c = clearSlotPref(b, "lunch");
  assert.deepEqual(Object.keys(c.meal), ["dinner"]);
  assert.deepEqual(clearSlotPref(undefined, "lunch"), EMPTY);
});
test("setDayPref/clearDayPref: দিন ০–৬ ছাড়া উপেক্ষিত; খালি তালিকা = বিশ্রাম", () => {
  const a = setDayPref(undefined, 2, [{ type: "yoga", min: 20 }]);
  assert.deepEqual(a.exercise, { 2: [{ type: "yoga", min: 20 }] });
  assert.deepEqual(setDayPref(a, 7, [{ type: "walk", min: 30 }]), a);
  assert.deepEqual(setDayPref(a, 1.5, []), a);
  assert.deepEqual(setDayPref(a, 3, []).exercise[3], []);
  assert.deepEqual(clearDayPref(a, 2).exercise, {});
});
test("মিল-খসড়া: যোগ/পরিমাণ/মুছা সীমা মানে; একই খাবার দ্বিতীয়বার যোগ করলে পরিমাণ বাড়ে", () => {
  const plan = buildMealPlan(1800, []);
  const lunch = plan.slots.find((s) => s.id === "lunch");
  let d = draftFromSlotItems(lunch.items);
  assert.equal(draftKcal(d), lunch.kcal);
  d = addDraftFood(d, "rice");
  assert.equal(d.find((r) => r.food === "rice").qty, lunch.items.find((i) => i.key === "rice").qty + 0.5);
  assert.equal(addDraftFood(d, "bogus"), d);
  d = changeDraftQty(d, 0, -100);
  assert.equal(d[0].qty, 0.5);
  d = changeDraftQty(d, 0, 100);
  assert.equal(d[0].qty, 10);
  assert.equal(removeDraftAt(d, 0).length, d.length - 1);
  let many = [];
  Object.keys({ roti: 1, rice: 1, dal: 1, veg: 1, salad: 1, egg: 1, fish: 1, chicken: 1, banana: 1, muri: 1, tea: 1, greentea: 1 }).forEach((k) => { many = addDraftFood(many, k); });
  assert.equal(many.length, 12);
});
test("ব্যায়াম-খসড়া: বিদ্যমান আইটেম থেকে type চেনা; মিনিট ৫–৩০০ সীমায়; দিনে সর্বোচ্চ ৬", () => {
  const plan = exercisePlan(34, "fit");
  const d = draftFromDayItems(plan.routine[1]); // শক্তির ব্যায়াম + স্ট্রেচিং
  assert.deepEqual(d.map((x) => x.type), ["gym", "stretch"]);
  assert.deepEqual(draftFromDayItems(plan.routine[0]).map((x) => x.type), ["walk", "stretch"]);
  assert.equal(draftFromDayItems(exercisePlan(10, null).routine[0])[0].type, "sports");
  assert.equal(changeDraftMin([{ type: "walk", min: 30 }], 0, -100)[0].min, 5);
  assert.equal(changeDraftMin([{ type: "walk", min: 30 }], 0, 1000)[0].min, 300);
  let x = [];
  for (let i = 0; i < 10; i++) x = addDraftExercise(x, "walk");
  assert.equal(x.length, 6);
  assert.equal(addDraftExercise([], "bogus").length, 0);
});
test("reconcileExerciseDone: আজকের রুটিন বদলালে টিক ও মিনিটের মিল (counted-ই শুধু; হারানো key বাদ)", () => {
  const oldI = [{ key: "main", min: 30, counted: true }, { key: "stretch", min: 10, counted: false }];
  const same = reconcileExerciseDone(oldI, oldI, ["main", "stretch"]);
  assert.deepEqual(same, { done: ["main", "stretch"], deltaMin: 0 });
  const longer = reconcileExerciseDone(oldI, [{ key: "main", min: 45, counted: true }, { key: "stretch", min: 10, counted: false }], ["main"]);
  assert.deepEqual(longer, { done: ["main"], deltaMin: 15 });
  const dropped = reconcileExerciseDone(oldI, [{ key: "stretch", min: 10, counted: false }], ["main", "stretch"]);
  assert.deepEqual(dropped, { done: ["stretch"], deltaMin: -30 });
  assert.deepEqual(reconcileExerciseDone(oldI, [], undefined), { done: [], deltaMin: 0 });
});
test("checkExtraFood/checkExerciseLog: যাচাই ও সীমা", () => {
  assert.equal(checkExtraFood("ভাত", 200, 0), null);
  assert.ok(checkExtraFood("  ", 200, 0));
  assert.ok(checkExtraFood("x".repeat(41), 200, 0));
  assert.ok(checkExtraFood("ভাত", "", 0));
  assert.ok(checkExtraFood("ভাত", 3001, 0));
  assert.ok(checkExtraFood("ভাত", -1, 0));
  assert.ok(checkExtraFood("ভাত", 1.5, 0));
  assert.ok(checkExtraFood("ভাত", 100, 20));
  assert.equal(checkExerciseLog(30, 0), null);
  assert.ok(checkExerciseLog(0, 0));
  assert.ok(checkExerciseLog(301, 0));
  assert.ok(checkExerciseLog(30, 20));
});
