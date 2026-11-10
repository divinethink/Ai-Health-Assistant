// চালানো: node --test tests/tracker/dailyInputCalc.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { checkWeightInput, checkStepsInput, checkSleepInput } from "../../src/health/tracker/dailyInputCalc.js";

test("ওজন: বৈধ মান ও ১ দশমিকে রাউন্ড", () => {
  assert.deepEqual(checkWeightInput("62"), { value: 62 });
  assert.deepEqual(checkWeightInput(" 62.34 "), { value: 62.3 });
  assert.deepEqual(checkWeightInput("2"), { value: 2 });
  assert.deepEqual(checkWeightInput("400"), { value: 400 });
});
test("ওজন: খালি/অবৈধ/সীমার বাইরে", () => {
  for (const v of ["", "  ", "abc", "1.9", "400.1", "-5", "NaN", "Infinity", null, undefined]) assert.ok(checkWeightInput(v).error, String(v));
});
test("স্টেপ: পূর্ণসংখ্যা ০–১,০০,০০০", () => {
  assert.deepEqual(checkStepsInput("0"), { value: 0 });
  assert.deepEqual(checkStepsInput("2400"), { value: 2400 });
  assert.deepEqual(checkStepsInput("100000"), { value: 100000 });
});
test("স্টেপ: দশমিক/নেগেটিভ/বেশি/খালি অবৈধ", () => {
  for (const v of ["", "12.5", "-1", "100001", "abc", null]) assert.ok(checkStepsInput(v).error, String(v));
});
test("ঘুম: মধ্যরাত পেরোনো ও মান", () => {
  const r = checkSleepInput("23:30", "06:00", 4);
  assert.equal(r.value.sleepMinutes, 390);
  assert.deepEqual(r.value.sleep, { bed: "23:30", wake: "06:00", quality: 4 });
});
test("ঘুম: মান না দিলে/অবৈধ হলে null", () => {
  assert.equal(checkSleepInput("22:00", "06:00", 0).value.sleep.quality, null);
  assert.equal(checkSleepInput("22:00", "06:00", 9).value.sleep.quality, null);
  assert.equal(checkSleepInput("22:00", "06:00").value.sleep.quality, null);
});
test("ঘুম: সময় অনুপস্থিত/অবৈধ হলে ত্রুটি", () => {
  assert.ok(checkSleepInput("", "06:00", 3).error);
  assert.ok(checkSleepInput("22:00", "", 3).error);
  assert.ok(checkSleepInput("x", "y", 3).error);
});
