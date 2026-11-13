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

import { mergeGuide, sanitizeGuideFields, checkGuideText } from "../../src/health/records/conditionGuideData.js";

test("mergeGuide: সংশোধন না থাকলে ডিফল্ট/খসড়া; থাকলে বসে ও verified", () => {
  const base = GUIDES.find((x) => x.id === "ibs");
  const d = mergeGuide(base, undefined);
  assert.equal(d.what, base.what); assert.equal(d.status, "draft"); assert.equal(d.edited, false);
  const m = mergeGuide(base, { what: "নতুন", causes: ["ক"], habits: [], food: ["খ", " "], caution: ["গ"], status: "verified" });
  assert.equal(m.what, "নতুন"); assert.deepEqual(m.causes, ["ক"]); assert.deepEqual(m.habits, []);
  assert.deepEqual(m.food, ["খ"]); assert.equal(m.status, "verified"); assert.equal(m.edited, true);
  assert.equal(mergeGuide(null, {}), null);
});
test("sanitizeGuideFields: লাইন ভাগ, ফাঁকা বাদ, সীমা", () => {
  const f = sanitizeGuideFields({ what: "  ক  ", causes: "a\n\n b \n", habits: Array(30).fill("x").join("\n"), food: "ক".repeat(500), caution: "" });
  assert.equal(f.what, "ক"); assert.deepEqual(f.causes, ["a", "b"]);
  assert.equal(f.habits.length, 12); assert.equal(f.food[0].length, 300); assert.deepEqual(f.caution, []);
});
test("checkGuideText: ডোজ/ফোন/খালি সতর্কতা; ভালো লেখায় নয়", () => {
  const ok = { what: "পরিচয়", causes: ["ক"], habits: ["খ"], food: ["গ"], caution: ["ঘ"] };
  assert.deepEqual(checkGuideText(ok), []);
  assert.ok(checkGuideText({ ...ok, habits: ["দিনে ৫০০ mg খান"] }).length > 0);
  assert.ok(checkGuideText({ ...ok, caution: ["ফোন 01712345678"] }).length > 0);
  assert.ok(checkGuideText({ ...ok, caution: ["ফোন করুন ৯৯৯"] }).length > 0);
  assert.ok(checkGuideText({ ...ok, what: "" }).length > 0);
  for (const g of GUIDES) assert.deepEqual(checkGuideText(g), [], g.id);
});
