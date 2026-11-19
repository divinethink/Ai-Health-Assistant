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

const oral = ALL_ITEMS.filter((i) => i.category === "oral");
const adultOk = { ageYears: 30, sex: "male", allergies: [] };

test("Oral: আইটেম আছে, মূল সেটে শুধু ফ্লুরাইড-ব্রাশ, সব verified দেখায়", () => {
  assert.ok(oral.length >= 6);
  assert.deepEqual(oral.filter((i) => i.isCoreSafe).map((i) => i.id), ["oral-fluoride-brushing"]);
  const hiddenByDefault = recommend(adultOk, ALL_ITEMS, { category: "oral" });
  assert.equal(hiddenByDefault.items.length, oral.filter((i) => i.status === "verified").length);
  assert.ok(recommend(adultOk, ALL_ITEMS, { category: "oral", includeDraft: true }).items.length >= 6);
});

test("Oral: অজানা-তথ্যে শুধু মূল সেট; ২ বছরের নিচে রেফার; ফ্লুরাইড এড়ালে মূল আইটেম লুকায়", () => {
  const unk = recommend({ ageYears: 30, sex: "male", allergies: null }, ALL_ITEMS, { category: "oral", includeDraft: true });
  assert.deepEqual(unk.items.map((x) => x.item.id), ["oral-fluoride-brushing"]);
  assert.equal(recommend({ ageYears: 1, sex: "male", allergies: [] }, ALL_ITEMS, { category: "oral", includeDraft: true }).mode, "referral");
  const avoid = recommend({ ...adultOk, avoidIngredients: ["fluoride"] }, ALL_ITEMS, { category: "oral", includeDraft: true });
  assert.equal(avoid.items.some((x) => x.item.id === "oral-fluoride-brushing"), false);
});

test("Oral: সমস্যা-পিল অনুযায়ী মিল; মাড়ি-red-flag হলে তালিকা নয়, রেফার", () => {
  const gums = recommend(adultOk, ALL_ITEMS, { category: "oral", includeDraft: true, concern: "gums" }).items.map((x) => x.item.id);
  assert.ok(gums.includes("oral-gum-care") && !gums.includes("oral-dry-mouth-care"));
  const r = recommend(adultOk, ALL_ITEMS, { category: "oral", includeDraft: true, symptoms: ["gum-bleeding-recurrent"] });
  assert.equal(r.mode, "referral"); assert.equal(r.items.length, 0);
});

test("Oral: ব্র্যান্ড/ঔষধ/সংখ্যা-ঘনত্ব নেই (ppm, mg, %)", () => {
  for (const i of oral) {
    const t = JSON.stringify([i.name, i.how, i.why]);
    assert.equal(/ppm|\bmg\b|%|পিপিএম/i.test(t), false, i.id);
  }
});

const adult8 = { ageYears: 30, sex: "male", allergies: [] };
const ids8 = (r) => r.items.map((x) => x.item.id);
const inCat = (c) => ALL_ITEMS.filter((i) => i.category === c);

test("ধাপ ৮: Seasonal/Body/Natural আইটেম আছে ও schema-বৈধ", () => {
  assert.ok(inCat("seasonal").length >= 4 && inCat("body").length >= 1 && inCat("natural").length >= 2);
  assert.ok(inCat("natural").every((i) => i.evidenceLevel === 3 && i.herbal && i.heavyMetalWarning === true && !i.isCoreSafe));
});

test("Seasonal: শুধু বর্তমান ঋতুর আইটেম দেখায় (বর্ষা≠শীত); ঋতু ছাড়া আইটেম ঢোকে না", () => {
  const borsha = ids8(recommend(adult8, ALL_ITEMS, { category: "seasonal", includeDraft: true, season: "borsha" }));
  const shit = ids8(recommend(adult8, ALL_ITEMS, { category: "seasonal", includeDraft: true, season: "shit" }));
  assert.ok(borsha.includes("season-borsha-shoes-socks") && !borsha.includes("season-cool-dry-skin"));
  assert.ok(shit.includes("season-cool-dry-skin") && !shit.includes("season-borsha-shoes-socks") && !shit.includes("season-heat-fluids"));
  assert.ok(inCat("seasonal").every((i) => i.seasons.length > 0));
});

test("Seasonal: কিডনি-রোগীর জন্য 'বাড়তি তরল' লুকানো; অজানা-তথ্যে শুধু মূল সেট; লাল-পতাকা", () => {
  const kid = ids8(recommend({ ...adult8, kidney: true }, ALL_ITEMS, { category: "seasonal", includeDraft: true, season: "grishmo" }));
  assert.equal(kid.includes("season-heat-fluids"), false);
  const unk = ids8(recommend({ ageYears: 30, sex: "male", allergies: null }, ALL_ITEMS, { category: "seasonal", includeDraft: true, season: "grishmo" }));
  assert.deepEqual(unk, ["season-heat-shade"]);
  assert.equal(recommend(adult8, ALL_ITEMS, { category: "seasonal", includeDraft: true, season: "grishmo", symptoms: ["heat-illness"] }).mode, "referral");
});

test("Natural: গর্ভবতী/দুগ্ধদানকারীর অ্যালোভেরা লুকানো; অ্যালার্জিতে বাদ; ভারী-ধাতুর নোট থাকে; ১৮-র নিচে/অজানায় নেই", () => {
  const ok = recommend(adult8, ALL_ITEMS, { category: "natural", includeDraft: true });
  assert.ok(ids8(ok).includes("natural-aloe-gel") && ok.items.every((x) => x.notes.length === 1));
  assert.equal(ids8(recommend({ ageYears: 28, sex: "female", allergies: [], pregnant: true }, ALL_ITEMS, { category: "natural", includeDraft: true })).includes("natural-aloe-gel"), false);
  assert.equal(ids8(recommend({ ...adult8, allergies: ["aloe"] }, ALL_ITEMS, { category: "natural", includeDraft: true })).includes("natural-aloe-gel"), false);
  assert.equal(recommend({ ...adult8, ageYears: 15 }, ALL_ITEMS, { category: "natural", includeDraft: true }).items.length, 0);
  assert.equal(recommend({ ageYears: 30, sex: "male", allergies: null }, ALL_ITEMS, { category: "natural", includeDraft: true }).items.length, 0);
});

test("Natural/Seasonal/Body: নিষিদ্ধ শব্দ ও সংখ্যা-ঘনত্ব নেই; সব verified দেখায়", () => {
  for (const i of [...inCat("natural"), ...inCat("seasonal"), ...inCat("body")]) {
    assert.equal(/ppm|\bmg\b|%/i.test(JSON.stringify([i.name, i.how, i.why])), false, i.id);
  }
  assert.equal(recommend(adult8, ALL_ITEMS, { category: "natural" }).items.length, inCat("natural").length);
});

test("schema: seasonal আইটেমে seasons বাধ্যতামূলক; অচেনা ঋতু reject", () => {
  const base = inCat("seasonal")[0];
  assert.ok(validateItem({ ...base, seasons: [] }).length > 0);
  assert.ok(validateItem({ ...base, seasons: ["xyz"] }).length > 0);
  assert.deepEqual(validateItem(base), []);
});
