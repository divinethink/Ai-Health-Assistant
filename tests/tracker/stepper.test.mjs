// চালানো: node --test tests/tracker/stepper.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { stepWeight, shiftTime } from "../../src/health/tracker/stepper.js";

test("stepWeight: ০.১ ধাপ ও floating-point ঠিক", () => {
  assert.equal(stepWeight("65.2", 0.1), "65.3");
  assert.equal(stepWeight("65.3", -0.1), "65.2");
  assert.equal(stepWeight("0.3", 0.1 + 0.2), "2");
});
test("stepWeight: খালি হলে fallback, তা না থাকলে ৬০", () => {
  assert.equal(stepWeight("", 0.1, 70), "70.1");
  assert.equal(stepWeight("", -0.1, null), "59.9");
  assert.equal(stepWeight("abc", 0.1, 0), "60.1");
});
test("stepWeight: সীমা ২–৪০০", () => {
  assert.equal(stepWeight("2", -0.1), "2");
  assert.equal(stepWeight("400", 0.1), "400");
});
test("shiftTime: মধ্যরাত পেরোনো", () => {
  assert.equal(shiftTime("23:50", 15, "22:00"), "00:05");
  assert.equal(shiftTime("00:05", -15, "22:00"), "23:50");
  assert.equal(shiftTime("06:00", 15, "06:00"), "06:15");
});
test("shiftTime: খালি/অবৈধ হলে fallback", () => {
  assert.equal(shiftTime("", 15, "22:00"), "22:15");
  assert.equal(shiftTime("25:99", -15, "06:00"), "05:45");
});
