import test from "node:test";
import assert from "node:assert/strict";
import { GUIDES, guideForCondition } from "../../src/health/records/conditionGuideData.js";

test("১৮টা গাইড, প্রতিটায় সব অংশ আছে", () => {
  assert.equal(GUIDES.length, 18);
  for (const g of GUIDES) {
    assert.ok(g.title && g.what && g.src.length, g.id);
    for (const k of ["causes", "habits", "food", "caution"]) assert.ok(g[k].length >= 1, g.id + "." + k);
  }
});
test("নাম-মিল", () => {
  const id = (n) => (guideForCondition(n) || {}).id;
  assert.equal(id("IBS"), "ibs");
  assert.equal(id("Type 2 Diabetes"), "diabetes");
  assert.equal(id("উচ্চ রক্তচাপ"), "hypertension");
  assert.equal(id("Fatty Liver"), "fatty-liver");
  assert.equal(id("কোমর ব্যথা"), "low-back");
  assert.equal(id("Heart Block"), "heart-block");
  assert.equal(id("Stroke"), "stroke");
  assert.equal(id("T4/T5 spine disc"), "spine-t4t5");
  assert.equal(id("মেরুদণ্ডের T4 T5"), "spine-t4t5");
  assert.equal(id("Hypothyroid (T4 low)"), "thyroid");
  assert.equal(id("Hepatitis B"), undefined);
  assert.equal(id(""), undefined);
});
test("লেখায় ডোজ/ফোন/জরুরি-নম্বর নেই", () => {
  const all = JSON.stringify(GUIDES);
  assert.ok(!/\d\s*(mg|ml|মিগ্রা|মিলি)/i.test(all));
  assert.ok(!/999|৯৯৯|১৬২৬৩|হটলাইন|ট্যাবলেট|ক্যাপসুল/.test(all));
});
