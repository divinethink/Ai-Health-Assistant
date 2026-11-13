// চালানো: node --test tests/tracker/homeWorkout.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FOCUS_IDS, MAX_FOCUS, sanitizeFocusAreas, focusOptions, focusCtxOf, focusPlan, pickStrength, exerciseDetail, focusExplain } from "../../src/health/tracker/homeWorkout.js";
import { exercisePlan, plannedWeeklyMinutes } from "../../src/health/tracker/exercisePlanData.js";
import { EXERCISE_TYPES, applyExercisePrefs, reconcileExerciseDone } from "../../src/health/tracker/planPrefs.js";
import { explainExercise } from "../../src/health/tracker/planExplain.js";

const LOWER = ["squat", "lunges", "stepup", "glute", "chairstand", "wallsit"];

test("sanitizeFocusAreas: অজানা/ডুপ্লিকেট বাদ, সর্বোচ্চ ৩, বাট শুধু মহিলা", () => {
  assert.deepEqual(sanitizeFocusAreas(["belly", "belly", "x", 5, "chest", "arms", "legs"]), ["belly", "chest", "arms"]);
  assert.equal(MAX_FOCUS, 3);
  assert.deepEqual(sanitizeFocusAreas(["glute", "belly"], "male"), ["belly"]);
  assert.deepEqual(sanitizeFocusAreas(["glute", "belly"], "female"), ["glute", "belly"]);
  assert.deepEqual(sanitizeFocusAreas(["glute"]), ["glute"]); // সংরক্ষণ-স্তর: লিঙ্গ-ফিল্টার নেই
  assert.deepEqual(sanitizeFocusAreas("belly"), []);
  assert.deepEqual(sanitizeFocusAreas(null), []);
});
test("focusOptions: বাট শুধু মহিলায়", () => {
  assert.ok(focusOptions("female").some((o) => o.id === "glute"));
  assert.ok(!focusOptions("male").some((o) => o.id === "glute"));
  assert.ok(!focusOptions(undefined).some((o) => o.id === "glute"));
  assert.equal(focusOptions("female").length, FOCUS_IDS.length);
});
test("focusCtxOf: <১৮, গর্ভাবস্থা, বয়স-অজানা, টার্গেট-নেই → null; ৬৫+/হৃদরোগ/BP → lowImpact", () => {
  const goal = { focusAreas: ["belly"] };
  assert.equal(focusCtxOf({ goal, sex: "male", age: 17, flags: {}, condKeys: [] }), null);
  assert.equal(focusCtxOf({ goal, sex: "female", age: 30, flags: { pregnant: true }, condKeys: [] }), null);
  assert.equal(focusCtxOf({ goal, sex: "male", age: null, flags: {}, condKeys: [] }), null);
  assert.equal(focusCtxOf({ goal: {}, sex: "male", age: 30, flags: {}, condKeys: [] }), null);
  assert.equal(focusCtxOf({ goal, sex: "male", age: 30, flags: {}, condKeys: [] }).lowImpact, false);
  assert.equal(focusCtxOf({ goal, sex: "male", age: 66, flags: {}, condKeys: [] }).lowImpact, true);
  assert.equal(focusCtxOf({ goal, sex: "male", age: 40, flags: {}, condKeys: ["hypertension"] }).lowImpact, true);
  assert.equal(focusCtxOf({ goal, sex: "male", age: 40, flags: {}, condKeys: ["heart"] }).lowImpact, true);
});
test("exercisePlan: focus না দিলে আগের আচরণ অপরিবর্তিত; দিলে টার্গেট-প্ল্যান", () => {
  assert.equal(plannedWeeklyMinutes(exercisePlan(30, "fit")), 150);
  assert.equal(plannedWeeklyMinutes(exercisePlan(30, "muscle")), 150);
  assert.equal(exercisePlan(30, "fit", null).focus, undefined);
  const p = exercisePlan(30, "fit", { areas: ["chest"], lowImpact: false });
  assert.deepEqual(p.focus, ["chest"]);
  assert.equal(p.routine.length, 7);
});
test("প্ল্যান-কাঠামো: ৩ শক্তির দিন (শনি/সোম/বুধ), শুক্র বিশ্রাম, প্রতিদিন ≤৬ আইটেম, key অনন্য, টাইপ বৈধ, মিনিট ≥ লক্ষ্য", () => {
  for (const areas of [["muscle"], ["belly"], ["chest", "arms"], ["legs", "core", "posture"], ["belly", "chest", "muscle"]]) {
    for (const lowImpact of [false, true]) {
      const p = focusPlan({ areas, senior: false, lowImpact });
      assert.equal(p.routine.length, 7);
      assert.deepEqual(p.routine[6], []);
      [0, 2, 4].forEach((i) => assert.ok(p.routine[i].filter((x) => LOWER.includes(x.type)).length >= 1, "নিচের শরীর " + areas + i));
      p.routine.forEach((day) => {
        assert.ok(day.length <= 6);
        assert.equal(new Set(day.map((x) => x.key)).size, day.length);
        assert.equal(new Set(day.map((x) => x.type)).size, day.length, "একই দিনে একই ব্যায়াম দুবার নয়");
        day.forEach((x) => { assert.ok(EXERCISE_TYPES[x.type]); assert.ok(x.min >= 5 && x.min <= 300); });
      });
      assert.ok(plannedWeeklyMinutes(p) >= p.weeklyTargetMin, areas + " planned " + plannedWeeklyMinutes(p));
    }
  }
  assert.equal(focusPlan({ areas: ["belly"] }).weeklyTargetMin, 180);
  assert.equal(focusPlan({ areas: ["chest"] }).weeklyTargetMin, 150);
});
test("প্রতিটি টার্গেটের শক্তির দিনে সেই টার্গেটের অন্তত একটা ব্যায়াম আছে", () => {
  const has = { chest: ["pushup", "tricepdip", "plank", "mountain"], glute: ["glute", "squat", "lunges", "stepup", "birddog"], legs: ["squat", "lunges", "stepup", "wallsit", "glute"], posture: ["superman", "birddog", "glute", "plank"] };
  for (const [a, pool] of Object.entries(has)) {
    const p = focusPlan({ areas: [a] });
    [0, 2, 4].forEach((i) => assert.ok(p.routine[i].some((x) => pool.includes(x.type)), a + " দিন " + i));
  }
});
test("lowImpact/৬৫+: লাফ/তীব্র আইটেম নেই; ৬৫+ এ স্কোয়াট→চেয়ার-স্ট্যান্ড, ক্রাঞ্চ বাদ", () => {
  const banned = ["burpee", "hiit", "jacks", "highknee", "skipping", "mountain", "wallsit"];
  const p = focusPlan({ areas: ["belly", "chest", "legs"], senior: true, lowImpact: true });
  p.routine.flat().forEach((x) => { assert.ok(!banned.includes(x.type), x.type); assert.ok(!["squat", "lunges", "crunch", "bicycle", "legraise", "tricepdip"].includes(x.type), x.type); });
  assert.equal(p.band, "senior");
  const q = focusPlan({ areas: ["belly"], senior: false, lowImpact: false });
  assert.ok(q.routine[1].some((x) => x.type === "jacks"));
  const r = focusPlan({ areas: ["belly"], senior: false, lowImpact: true });
  assert.ok(!r.routine.flat().some((x) => banned.includes(x.type)));
});
test("সেশন ঘোরে: শনি/সোম/বুধে আলাদা তালিকা (একটি টার্গেটে)", () => {
  const a = pickStrength(["muscle"], 0, {}), b = pickStrength(["muscle"], 1, {}), c = pickStrength(["muscle"], 2, {});
  assert.notDeepEqual(a, b); assert.notDeepEqual(b, c);
  a.concat(b, c).forEach((t) => assert.ok(EXERCISE_TYPES[t]));
});
test("টিক-key ভাঙে না: base-এর key, applyExercisePrefs-এর সাথে মেলে; দিন বদলালে reconcile কাজ করে", () => {
  const p = exercisePlan(30, "fit", { areas: ["chest", "belly"] });
  const eff = applyExercisePrefs(p, { v: 1, meal: {}, exercise: { 1: [{ type: "walk", min: 30 }] } });
  assert.deepEqual(eff.custom, [1]);
  assert.deepEqual(eff.routine[0], p.routine[0]); // অন্য দিন অপরিবর্তিত
  const r = reconcileExerciseDone(p.routine[1], eff.routine[1], ["main", "x2"]);
  assert.ok(r.done.includes("main"));
});
test("exerciseDetail ও ব্যাখ্যা", () => {
  assert.match(exerciseDetail("squat").sets, /সেট/);
  assert.equal(exerciseDetail("walk"), null);
  assert.equal(exerciseDetail("constructor"), null);
  const lines = explainExercise({ plan: exercisePlan(30, "fit", { areas: ["belly"] }), age: 30, goalType: "fit" }).join("\n");
  assert.match(lines, /আলাদা করে কমানো যায় না/);
  assert.match(lines, /ACSM/);
  assert.deepEqual(focusExplain([]), []);
  assert.match(focusExplain(["glute"]).join("\n"), /গ্লুট/);
});

// ---- ওজন-লক্ষ্য + টার্গেট একসাথে (goalType-aware) ----
import { exerciseKind } from "../../src/health/tracker/exercisePlanData.js";
import { goalExerciseLine } from "../../src/health/tracker/homeWorkout.js";

test("goalType না দিলে/fit হলে প্ল্যান আগের মতোই", () => {
  const a = focusPlan({ areas: ["belly", "chest"] }), b = focusPlan({ areas: ["belly", "chest"], goalType: "fit" });
  assert.deepEqual(a, b);
  assert.equal(a.weeklyTargetMin, 180);
});
test("lose: কার্ডিও বেশি, শক্তির দিন ৩টাই থাকে, লক্ষ্য-মিনিট ≤ রুটিনের মোট", () => {
  for (const areas of [["belly"], ["chest"], ["belly", "chest"], ["posture"], ["legs", "core", "posture"]]) {
    for (const [senior, lowImpact] of [[false, false], [false, true], [true, true]]) {
      const base = focusPlan({ areas, senior, lowImpact });
      const p = focusPlan({ areas, senior, lowImpact, goalType: "lose" });
      assert.ok(plannedWeeklyMinutes(p) >= p.weeklyTargetMin, "lose " + areas + senior + lowImpact);
      assert.ok(p.weeklyTargetMin >= 150, "lose লক্ষ্য WHO-র নিচে নয়");
      assert.ok(plannedWeeklyMinutes(p) >= plannedWeeklyMinutes(base) - 1, "lose-এ কার্ডিও কমেনি");
      [0, 2, 4].forEach((i) => assert.ok(p.routine[i].some((x) => LOWER.includes(x.type)), "শক্তির দিন বহাল"));
      assert.deepEqual(p.routine[6], []);
    }
  }
  const noFocus = exercisePlan(30, "lose");
  assert.equal(noFocus.weeklyTargetMin, 180);
  assert.equal(plannedWeeklyMinutes(noFocus), 180);
});
test("gain/muscle: শক্তির সেশন দীর্ঘ, কার্ডিও হালকা, লক্ষ্য ≥ ১৫০ ও রুটিনে পূরণ", () => {
  for (const g of ["gain", "muscle"]) {
    const p = focusPlan({ areas: ["muscle", "chest"], goalType: g });
    const base = focusPlan({ areas: ["muscle", "chest"] });
    assert.ok(p.routine[0].reduce((a, x) => a + x.min, 0) > base.routine[0].reduce((a, x) => a + x.min, 0));
    assert.equal(p.routine[1][0].min, 20);
    assert.ok(plannedWeeklyMinutes(p) >= p.weeklyTargetMin && p.weeklyTargetMin >= 150);
  }
  assert.equal(plannedWeeklyMinutes(exercisePlan(30, "gain")), 150);
});
test("লক্ষ্যের ব্যাখ্যা-লাইন ও exerciseKind", () => {
  assert.match(goalExerciseLine("lose", 180), /ওজন কমানো/);
  assert.match(goalExerciseLine("lose", 180), /মিল-প্ল্যানের ক্যালরি/);
  assert.match(goalExerciseLine("muscle", 150), /প্রোটিন/);
  assert.equal(goalExerciseLine("fit", 150), null);
  assert.equal(exerciseKind({ type: "plank" }), "strength");
  assert.equal(exerciseKind({ type: "yoga" }), "flex");
  assert.equal(exerciseKind({ type: "jacks" }), "cardio");
  assert.equal(exerciseKind({ key: "stretch", label: "স্ট্রেচিং" }), "flex");
  assert.equal(exerciseKind({ key: "main", label: "শক্তির ব্যায়াম (…)" }), "strength");
  assert.equal(exerciseKind({ key: "main", label: "দ্রুত হাঁটা" }), "cardio");
  const lines = explainExercise({ plan: exercisePlan(30, "lose", { areas: ["belly"] }), age: 30, goalType: "lose" }).join("\n");
  assert.match(lines, /ওজন কমানো/);
});
