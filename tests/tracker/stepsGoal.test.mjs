// দৈনিক হাঁটার লক্ষ্য: অটো সাজেশন + ওভাররাইড — চালানো: node --test tests/tracker/stepsGoal.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { stepsTarget, suggestedSteps, sanitizeStepsTarget, checkStepsTargetInput } from "../../src/health/tracker/trackerCalc.js";

test("অটো সাজেশন: সাধারণ ৭০০০, ওজন কমানো ৮০০০, BMI ≥৩০ বা ৬৫+ হলে ৬০০০", () => {
  assert.equal(suggestedSteps(34, { bmi: 25.2 }), 7000);
  assert.equal(suggestedSteps(34, { bmi: 25.2, goalType: "lose" }), 8000);
  assert.equal(suggestedSteps(34, { bmi: 31, goalType: "lose" }), 6000);
  assert.equal(suggestedSteps(70, { bmi: 22 }), 6000);
  assert.equal(suggestedSteps(34, {}), 7000);
  assert.equal(suggestedSteps(18), 7000);
});

test("১৮-র নিচে বা বয়স অজানা: লক্ষ্য নেই, ওভাররাইডও নয়", () => {
  assert.equal(suggestedSteps(17, {}), null);
  assert.equal(suggestedSteps(null, {}), null);
  assert.equal(stepsTarget(10, { override: 9000 }), null);
  assert.equal(stepsTarget(undefined), null);
});

test("ওভাররাইড: বৈধ হলে সেটা, অবৈধ হলে অটো; পুরনো কল stepsTarget(age) আগের মতো", () => {
  assert.equal(stepsTarget(34, { override: 10000, bmi: 25 }), 10000);
  assert.equal(stepsTarget(34, { override: 999 }), 7000);
  assert.equal(stepsTarget(34, { override: 7500.5 }), 7000);
  assert.equal(stepsTarget(34, { override: null }), 7000);
  assert.equal(stepsTarget(34), 7000);
  assert.equal(stepsTarget(70, { override: 4000 }), 4000);
});

test("যাচাই: খালি ঠিক; সীমার বাইরে বার্তা", () => {
  assert.equal(sanitizeStepsTarget("8000"), 8000);
  assert.equal(sanitizeStepsTarget(" "), null);
  assert.equal(checkStepsTargetInput(""), null);
  assert.equal(checkStepsTargetInput("8000"), null);
  assert.ok(checkStepsTargetInput("500"));
  assert.ok(checkStepsTargetInput("40000"));
  assert.ok(checkStepsTargetInput("7.5"));
});
