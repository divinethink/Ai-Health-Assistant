import test from "node:test";
import assert from "node:assert/strict";
import { suggestConditionNames } from "../../src/health/records/conditionNames.js";

test("consti → Constipation প্রথমে", () => {
  assert.equal(suggestConditionNames("consti")[0], "Constipation");
});
test("বাংলা লিখলেও মেলে", () => {
  assert.equal(suggestConditionNames("কোষ্ঠ")[0], "Constipation");
  assert.ok(suggestConditionNames("থাইরয়েড").includes("Thyroid"));
});
test("খালি লেখায় কিছু নয়; হুবহু মিলে সাজেশন নয়", () => {
  assert.deepEqual(suggestConditionNames(""), []);
  assert.deepEqual(suggestConditionNames("Constipation"), []);
});
test("আগের রেকর্ডের নাম আগে আসে, ডুপ্লিকেট নয়", () => {
  const r = suggestConditionNames("thy", ["Thyroid (Hypo)"]);
  assert.equal(r[0], "Thyroid (Hypo)");
  assert.equal(new Set(r.map((x) => x.toLowerCase())).size, r.length);
});
test("সীমা মানে", () => {
  assert.ok(suggestConditionNames("a", [], 3).length <= 3);
});
