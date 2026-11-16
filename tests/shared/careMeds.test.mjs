// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { emptyMed, isMedBlank, filledMeds, validateCareMeds, medSummary, toBn, diseaseNames } from "../../src/health/commonCare/careMeds.js";

const med = (o) => ({ ...emptyMed(), ...o });

test("emptyMed: প্রতিবার আলাদা key; ফাঁকা", () => {
  const a = emptyMed(), b = emptyMed();
  assert.notEqual(a.key, b.key);
  assert.ok(isMedBlank(a));
});
test("অসুখের নাম ছাড়া ও ওষুধ ছাড়া আটকায়", () => {
  assert.equal(validateCareMeds(" ", [med({ brand: "Napa" })]).msg, "অসুখের নাম লিখুন।");
  assert.equal(validateCareMeds("জ্বর", [emptyMed()]).msg, "অন্তত একটি ওষুধ লিখুন।");
});
test("ফাঁকা অতিরিক্ত কার্ড বাদ; ঠিক ফর্ম পাস", () => {
  const ms = [med({ brand: "Napa" }), emptyMed()];
  assert.equal(filledMeds(ms).length, 1);
  assert.equal(validateCareMeds("জ্বর", ms), null);
});
test("ডোজ আছে কিন্তু নাম নেই → ওই কার্ডের key সহ ত্রুটি", () => {
  const bad = med({ dose: "500 mg" });
  const r = validateCareMeds("জ্বর", [med({ brand: "Napa" }), bad]);
  assert.equal(r.key, bad.key);
  assert.match(r.msg, /ওষুধ 2/);
});
test("একই ওষুধ দুইবার (বড়-ছোট হাত নির্বিশেষে) আটকায়", () => {
  const r = validateCareMeds("জ্বর", [med({ brand: "Napa" }), med({ brand: " napa " })]);
  assert.match(r.msg, /দুইবার/);
});
test("সারাংশ, বাংলা সংখ্যা, সাজেশন", () => {
  assert.equal(medSummary(med({ brand: "Napa", generic: "Paracetamol", dose: "500 mg", frequency: "দিনে ৪ বার" })), "Napa (Paracetamol) · 500 mg · দিনে ৪ বার");
  assert.equal(toBn(12), "১২");
  assert.deepEqual(diseaseNames([["জ্বর", []], ["অন্যান্য", []]]), ["জ্বর"]);
});

test("Homeopathy/Herbal: শুধু নাম লাগে (জেনেরিক নয়); নাম ছাড়া আটকায়", () => {
  assert.equal(validateCareMeds("সর্দি", [med({ brand: "Arnica montana", potency: "30C" })], "homeopathy"), null);
  assert.equal(validateCareMeds("সর্দি", [med({ brand: "তুলসী পাতা", prep: "রস" })], "herbal"), null);
  assert.match(validateCareMeds("সর্দি", [med({ brand: "x" }), med({ potency: "30C" })], "homeopathy").msg, /ওষুধ 2: নাম লিখুন/);
  assert.match(validateCareMeds("সর্দি", [emptyMed()], "herbal").msg, /অন্তত একটি ভেষজ/);
});
test("হোমিও: একই নামে ভিন্ন পটেন্সি আলাদা; একই পটেন্সি দুইবার আটকায়", () => {
  assert.equal(validateCareMeds("ব্যথা", [med({ brand: "Arnica", potency: "30C" }), med({ brand: "Arnica", potency: "200C" })], "homeopathy"), null);
  assert.match(validateCareMeds("ব্যথা", [med({ brand: "Arnica", potency: "30C" }), med({ brand: "arnica", potency: "30c" })], "homeopathy").msg, /দুইবার/);
});
test("সারাংশে পটেন্সি/ব্যবহারের ধরন আসে; allopathy-র সারাংশ অপরিবর্তিত", () => {
  assert.equal(medSummary(med({ brand: "Arnica", potency: "30C", dose: "৪ ফোঁটা" })), "Arnica · 30C · ৪ ফোঁটা");
  assert.equal(medSummary(med({ brand: "তুলসী", prep: "রস", frequency: "দিনে ২ বার" })), "তুলসী · রস · দিনে ২ বার");
});
