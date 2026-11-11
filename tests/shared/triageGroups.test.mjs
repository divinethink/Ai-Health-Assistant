import test from "node:test";
import assert from "node:assert/strict";
import { groupChecklistItems } from "../../src/health/triage/triageGroups.js";
import { getChecklistForAgeGroup, isPediatricAgeGroup } from "../../src/health/triage/triageEngine.js";

for (const ag of ["neonate", "infant", "child", "adult", "elderly"]) {
  test("প্রতিটি আইটেম ঠিক একবার গ্রুপে আসে — " + ag, () => {
    const items = getChecklistForAgeGroup(ag);
    const flat = groupChecklistItems(items, isPediatricAgeGroup(ag)).flatMap((g) => g.items.map((i) => i.id));
    assert.deepEqual([...flat].sort(), items.map((i) => i.id).sort());
  });
}
test("প্রাপ্তবয়স্কে ৩ গ্রুপ, শিশুতে ১", () => {
  assert.equal(groupChecklistItems(getChecklistForAgeGroup("adult"), false).length, 3);
  assert.equal(groupChecklistItems(getChecklistForAgeGroup("infant"), true).length, 1);
});
test("অজানা নতুন আইটেম হারায় না", () => {
  const items = [...getChecklistForAgeGroup("adult"), { id: "newSign", label: "x" }];
  const flat = groupChecklistItems(items, false).flatMap((g) => g.items.map((i) => i.id));
  assert.ok(flat.includes("newSign"));
});
