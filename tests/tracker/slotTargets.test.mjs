import test from "node:test";
import assert from "node:assert/strict";
import { slotTargets, slotBudgets, SLOT_SHARES } from "../../src/health/tracker/foodCalc.js";

test("শতাংশের যোগফল ১০০", () => {
  assert.equal(Object.values(SLOT_SHARES).reduce((a, b) => a + b, 0), 100);
});
test("২০৪০ → ৬১২/২০৪/৬১২/২০৪/৪০৮", () => {
  assert.deepEqual(slotTargets(2040), { breakfast: 612, snack1: 204, lunch: 612, snack2: 204, dinner: 408 });
});
test("যোগফল সবসময় টার্গেটের সমান (বিজোড় সংখ্যাতেও)", () => {
  [1210, 1333, 1777, 2355, 2999].forEach((t) => assert.equal(Object.values(slotTargets(t)).reduce((a, b) => a + b, 0), t));
});
test("অবৈধ টার্গেট → null", () => {
  assert.equal(slotTargets(0), null);
  assert.equal(slotTargets(null), null);
});
test("slotBudgets: target দিলে planned = বরাদ্দ, না দিলে প্ল্যানের মান", () => {
  const plan = { slots: [{ id: "breakfast", kcal: 395 }, { id: "dinner", kcal: 500 }] };
  const a = slotBudgets(plan, ["breakfast"], [{ slot: "dinner", kcal: 100 }], 2040);
  assert.deepEqual(a, { breakfast: { planned: 612, eaten: 395 }, dinner: { planned: 408, eaten: 100 } });
  assert.equal(slotBudgets(plan, [], [])["breakfast"].planned, 395);
});
