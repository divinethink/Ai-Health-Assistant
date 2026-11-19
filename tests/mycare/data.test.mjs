import test from "node:test";
import assert from "node:assert/strict";
import { ALL_ITEMS } from "../../src/health/mycare/data/index.js";
import { validateItem } from "../../src/health/mycare/careSchema.js";
import { recommend } from "../../src/health/mycare/careEngine.js";

test("সব আইটেম schema-তে বৈধ ও id অনন্য", () => {
  const ids = new Set();
  for (const it of ALL_ITEMS) {
    assert.deepEqual(validateItem(it), [], it.id);
    assert.equal(ids.has(it.id), false, "ডুপ্লিকেট id " + it.id); ids.add(it.id);
  }
  assert.ok(ALL_ITEMS.length >= 10);
});

test("সব আইটেম verified ও lastReviewed সহ", () => {
  assert.ok(ALL_ITEMS.every((i) => i.status === "verified" && i.lastReviewed));
});

test("মূল-নিরাপদ সেট: ত্বকে ৩টি, চুলে ১টি", () => {
  assert.deepEqual(ALL_ITEMS.filter((i) => i.isCoreSafe && i.category === "skin").map((i) => i.id).sort(), ["skin-gentle-cleanser", "skin-moisturizer", "skin-sunscreen"]);
  assert.deepEqual(ALL_ITEMS.filter((i) => i.isCoreSafe && i.category === "hair").map((i) => i.id), ["hair-gentle-shampoo"]);
});

test("অজানা-তথ্যে শুধু মূল সেট দেখায় (verified আইটেম)", () => {
  const adult = { ageYears: 30, sex: "male", allergies: null };
  const ids = recommend(adult, ALL_ITEMS, { category: "skin" }).items.map((x) => x.item.id).sort();
  assert.deepEqual(ids, ["skin-gentle-cleanser", "skin-moisturizer", "skin-sunscreen"]);
});

test("পূর্ণ জানা প্রোফাইলে ব্রণ/শুষ্কতা অনুযায়ী মিল; গর্ভবতীর খুশকি-শ্যাম্পু বাদ", () => {
  const p = { ageYears: 30, sex: "male", allergies: [], skinType: "oily", hairType: "oily" };
  const acne = recommend(p, ALL_ITEMS, { category: "skin", includeDraft: true, concern: "acne" }).items.map((x) => x.item.id);
  assert.ok(acne.includes("skin-acne-no-picking") && !acne.includes("skin-dry-bathing"));
  const preg = { ageYears: 28, sex: "female", allergies: [], pregnant: true, breastfeeding: false, hairType: "oily" };
  assert.equal(recommend(preg, ALL_ITEMS, { category: "hair", includeDraft: true }).items.some((x) => x.item.id === "hair-dandruff-shampoo"), false);
});

test("অ্যালার্জি-শব্দ: 'সুগন্ধি/fragrance' এড়ানো ব্যবহারকারীর কাছে কোনো আইটেম ভুলে লুকায় না নাম-কারণে", () => {
  const p = { ageYears: 30, sex: "male", allergies: [], avoidIngredients: ["fragrance", "সুগন্ধি"], skinType: "dry" };
  const ids = recommend(p, ALL_ITEMS, { category: "skin", includeDraft: true }).items.map((x) => x.item.id);
  assert.ok(ids.includes("skin-gentle-cleanser"));
});

test("norm বাংলা যুক্তাক্ষর/মাত্রা ভাঙে না (ভুল 'ব্লিচ' মিল হয় না)", async () => {
  const { norm, hasBannedActive } = await import("../../src/health/mycare/careSchema.js");
  assert.equal(norm("জ্বালা/চুলকানি").includes("ব্লিচ"), false);
  assert.equal(norm("ল্যানোলিন"), "ল্যানোলিন");
  assert.equal(hasBannedActive({ name: { bn: "ব্লিচ ক্রিম", en: "x" } }), "ব্লিচ");
});
