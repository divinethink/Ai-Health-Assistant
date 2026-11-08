// পার্ট ৯ — চালানো: node --test tests/tracker/medFoodNotes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { medFoodNotes, activeMedNames } from "../../src/health/tracker/medFoodNotes.js";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";

test("activeMedNames: শুধু সক্রিয় ওষুধ, নাম ট্রিম", () => {
  const recs = [
    { resourceType: "medicationStatement", status: "active", genericName: " Levothyroxine " },
    { resourceType: "medicationStatement", status: "stopped", genericName: "Iron" },
    { resourceType: "condition", status: "active", name: "x" },
    { resourceType: "medicationStatement", status: "active", genericName: "" },
    null,
  ];
  assert.deepEqual(activeMedNames(recs), ["Levothyroxine"]);
  assert.deepEqual(activeMedNames(null), []);
});
test("থাইরয়েড + medgap খাবার → ৪ ঘণ্টা-নোট; অন্য খাবারে নয়", () => {
  const n = medFoodNotes(["Levothyroxine 50mcg"], "milk");
  assert.equal(n.length, 1);
  assert.equal(n[0].rule, "thyroid");
  assert.ok(n[0].text.includes("৪ ঘণ্টা") && n[0].text.includes("ডাক্তার/ফার্মাসিস্টের নির্দেশমতো"));
  assert.equal(medFoodNotes(["Levothyroxine"], "rice").length, 0);
  assert.equal(medFoodNotes(["থাইরক্সিন"], "tofu").length, 1);
});
test("আয়রন + medgap খাবার → ২ ঘণ্টা-নোট; 'environment' জাতীয় শব্দে ভুল মিল নয়", () => {
  const n = medFoodNotes(["Iron + Folic Acid (combination)"], "tokDoi");
  assert.equal(n.length, 1);
  assert.equal(n[0].rule, "iron");
  assert.ok(n[0].text.includes("২ ঘণ্টা"));
  assert.equal(medFoodNotes(["environment"], "milk").length, 0);
});
test("Bisacodyl + দুগ্ধজাত খাবার; দুগ্ধজাত নয় এমন খাবারে নয়", () => {
  assert.equal(medFoodNotes(["Bisacodyl"], "payesh")[0].rule, "bisacodyl"); // payesh: al=dairy
  assert.equal(medFoodNotes(["Bisacodyl"], "milk").map((x) => x.rule).join(), "bisacodyl");
  assert.equal(medFoodNotes(["Bisacodyl"], "tofu").length, 0);
  assert.equal(medFoodNotes(["Bisacodyl"], "rice").length, 0);
});
test("একাধিক ওষুধ → একাধিক নোট; ডুপ্লিকেট নয়; অজানা ইনপুটে নিরাপদ", () => {
  const n = medFoodNotes(["Levothyroxine", "Iron", "Levothyroxine"], "milk");
  assert.deepEqual(n.map((x) => x.rule), ["thyroid", "iron"]);
  assert.deepEqual(medFoodNotes(["Paracetamol"], "milk"), []);
  assert.deepEqual(medFoodNotes([], "milk"), []);
  assert.deepEqual(medFoodNotes(undefined, "milk"), []);
  assert.deepEqual(medFoodNotes(["Iron", 5, null], "nope"), []);
  assert.deepEqual(medFoodNotes(["Iron", 5, null], "milk").map((x) => x.rule), ["iron"]);
});
test("কোনো বার্তায় ডোজ/বদলের কথা নেই", () => {
  const all = [];
  Object.keys(FOODS).forEach((k) => medFoodNotes(["Levothyroxine", "Iron", "Bisacodyl"], k).forEach((n) => all.push(n.text)));
  assert.ok(all.length > 0);
  all.forEach((t) => assert.ok(!/মিলিগ্রাম|mg|ডোজ|বন্ধ করুন|বাড়ান|কমান/.test(t), t));
});
