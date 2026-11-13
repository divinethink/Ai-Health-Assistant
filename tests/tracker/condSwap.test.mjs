import test from "node:test";
import assert from "node:assert/strict";
import { buildMealPlan } from "../../src/health/tracker/mealPlanData.js";

const keys = (p) => p.slots.flatMap((s) => s.items.map((i) => s.id + ":" + i.key));

test("কোনো রোগ না থাকলে প্ল্যান আগের মতো", () => {
  const k = keys(buildMealPlan(1800, [], null, { flags: {}, condKeys: [] }));
  assert.ok(k.includes("snack1:banana") && k.includes("snack2:tea") && k.includes("dinner:salad"));
  assert.deepEqual(keys(buildMealPlan(1800, [], null)), k);
});
test("ডায়াবেটিসে কলা → পেয়ারা", () => {
  const k = keys(buildMealPlan(1800, [], null, { flags: { diabetes: true }, condKeys: [] }));
  assert.ok(k.includes("snack1:guava") && !k.includes("snack1:banana"));
});
test("পেটের সমস্যায় চা → পেঁপে, সালাদ → সবজি (মার্জ)", () => {
  const p = buildMealPlan(1800, [], null, { flags: {}, condKeys: ["gut"] });
  const k = keys(p);
  assert.ok(k.includes("snack2:papaya") && !k.includes("snack2:tea") && !k.includes("dinner:salad"));
  assert.equal(k.filter((x) => x === "dinner:veg").length, 1);
});
test("উচ্চ রক্তচাপে লবণ-নোট", () => {
  assert.ok(buildMealPlan(1800, [], null, { flags: {}, condKeys: ["hypertension"] }).notes.some((n) => n.includes("লবণ")));
});
