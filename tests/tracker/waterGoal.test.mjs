// দৈনিক পানির লক্ষ্য: ওজন-ভিত্তিক ডিফল্ট + পানি-সীমার রোগে ডিফল্ট নেই — চালানো: node --test tests
import test from "node:test";
import assert from "node:assert/strict";
import { waterTargetFor, detectFlagsFromConditions } from "../../src/health/tracker/trackerCalc.js";

test("প্রাপ্তবয়স্ক: ওজন × ৩০ মিলি ÷ ২৫০, ৬–১২; ওজন না থাকলে ৮", () => {
  assert.equal(waterTargetFor(34, {}, undefined, 67.7), 8);
  assert.equal(waterTargetFor(34, {}, undefined, 40), 6);
  assert.equal(waterTargetFor(34, {}, undefined, 120), 12);
  assert.equal(waterTargetFor(34, {}, undefined, null), 8);
  assert.equal(waterTargetFor(34, {}, undefined, 5), 8); // অবাস্তব ওজন উপেক্ষা
});
test("৬৫+ সর্বোচ্চ ৮; শিশুদের বয়সভিত্তিক সীমা অপরিবর্তিত", () => {
  assert.equal(waterTargetFor(70, {}, undefined, 110), 8);
  assert.equal(waterTargetFor(10, {}, undefined, 80), 6);
  assert.equal(waterTargetFor(4, {}, undefined, 80), 4);
});
test("ইউজারের নিজের মান ডিফল্টের ওপরে", () => {
  assert.equal(waterTargetFor(34, {}, 10, 67.7), 10);
});
test("কিডনি/পানি-জমা: কোনো সংখ্যা নেই (পুরনো সেভ-করা মানও উপেক্ষা)", () => {
  assert.equal(waterTargetFor(34, { kidney: true }, undefined, 67.7), null);
  assert.equal(waterTargetFor(34, { fluid: true }, undefined, 67.7), null);
  assert.equal(waterTargetFor(34, { fluid: true }, 5, 67.7), null);
  assert.equal(waterTargetFor(34, { kidney: true }, 10, 67.7), null);
  assert.equal(waterTargetFor(1, {}, 5, 10), null);
});
test("প্রোফাইলের রোগ থেকে fluid ধরা", () => {
  const c = (name) => detectFlagsFromConditions([{ resourceType: "condition", name }]);
  ["Dialysis", "ডায়ালাইসিস", "Heart failure", "লিভার সিরোসিস", "শরীরে পানি জমা", "শোথ"].forEach((n) => assert.equal(c(n).fluid, true, n));
  assert.equal(c("IBS").fluid, false);
  assert.equal(c("Kidney stone").kidney, true);
});
