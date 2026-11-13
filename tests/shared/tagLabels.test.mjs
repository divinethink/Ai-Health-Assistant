// চালানো: node --test tests/shared/tagLabels.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { tagLabel, sourceLabels } from "../../src/health/nutrition-fitness/tagLabels.js";

test("কাঁচা ট্যাগ বাংলা লেবেলে (বড়/ছোট হাতের অক্ষর নির্বিশেষে)", () => {
  assert.equal(tagLabel("overweight").text, "ওজন বেশি");
  assert.equal(tagLabel(" IBS ").text, "পেটের সমস্যা (IBS)");
  assert.equal(tagLabel("high cholesterol").text, "উচ্চ কোলেস্টেরল");
});
test("অজানা/বাংলা ট্যাগ যেমন আছে তেমনই; খালি/null নিরাপদ", () => {
  assert.equal(tagLabel("১ বছরের কম বয়স").text, "১ বছরের কম বয়স");
  assert.equal(tagLabel("something-new").text, "something-new");
  assert.equal(tagLabel(null).text, "");
  assert.equal(tagLabel(undefined).text, "");
});
test("DB-র লিস্টের সব ট্যাগের লেবেল আছে (ইংরেজি কাঁচা নাম বাকি নেই)", () => {
  const tags = ["anemia", "common cold", "constipation", "dengue", "diabetes", "diarrhea", "egg", "fatty liver", "fever", "gastritis", "gluten", "gout", "heart disease", "high cholesterol", "hypertension", "ibs", "jaundice", "kidney disease", "kidney stone", "migraine", "milk", "obese", "obesity", "osteoporosis", "overweight", "pcos", "peanut", "piles", "pregnancy", "shellfish", "thyroid", "typhoid", "underweight", "urinary tract infection"];
  tags.forEach((t) => assert.notEqual(tagLabel(t).text, t.trim(), t));
});
test("sourceLabels: ibs + কোড-নিয়মের শিরোনাম একই লেবেল → ডুপ্লিকেট নয়", () => {
  assert.deepEqual(sourceLabels(["পেটের সমস্যা (IBS/গ্যাস্ট্রিক ইত্যাদি)", "overweight", "ibs"]).map((x) => x.text), ["পেটের সমস্যা (IBS)", "ওজন বেশি"]);
});
test("sourceLabels: একটাই অনন্য উৎস হলে কিছু দেখায় না", () => {
  assert.deepEqual(sourceLabels(["ibs", "IBS"]), []);
  assert.deepEqual(sourceLabels(undefined), []);
});
