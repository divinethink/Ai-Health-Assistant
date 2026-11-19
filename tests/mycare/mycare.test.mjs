import test from "node:test";
import assert from "node:assert/strict";
import { recommend } from "../../src/health/mycare/careEngine.js";
import { validateItem } from "../../src/health/mycare/careSchema.js";
import { detectRedFlags } from "../../src/health/mycare/careRedFlags.js";
import { seasonOf } from "../../src/health/mycare/careSeason.js";

const mk = (id, o = {}) => ({
  id, category: "skin", name: { bn: id + " নাম", en: id }, how: { bn: "সকালে লাগান", en: "Apply in the morning" },
  why: { bn: "ত্বক নরম রাখে", en: "Keeps skin soft" }, evidenceLevel: 1, status: "verified", lastReviewed: "2026-11-01",
  sources: [{ org: "AAD" }], isCoreSafe: true, ingredientAliases: [], avoidIf: [], ...o,
});
const adult = { ageYears: 30, sex: "male", allergies: [], skinType: "dry" };
const ids = (r) => r.items.map((x) => x.item.id);

test("draft আইটেম ডিফল্টে লুকানো, includeDraft-এ দেখায়", () => {
  const items = [mk("a"), mk("b", { status: "draft" })];
  assert.deepEqual(ids(recommend(adult, items, { category: "skin" })), ["a"]);
  assert.deepEqual(ids(recommend(adult, items, { category: "skin", includeDraft: true })).sort(), ["a", "b"]);
  assert.equal(recommend(adult, items, { category: "skin" }).hidden.draft, 1);
});

test("অ্যালার্জি — ইংরেজি/বাংলা/alias সবই কঠোর বাদ", () => {
  const items = [mk("a", { ingredientAliases: ["lanolin", "ল্যানোলিন"] }), mk("b")];
  for (const al of ["Lanolin", "ল্যানোলিন", "lanolin cream"]) {
    assert.deepEqual(ids(recommend({ ...adult, allergies: [al] }, items, { category: "skin" })), ["b"], al);
  }
  assert.deepEqual(ids(recommend({ ...adult, allergies: [], avoidIngredients: ["lanolin"] }, items, { category: "skin" })), ["b"]);
});

test("অ্যালার্জি অজানা (null) → শুধু মূল সেট + প্যাচ-টেস্ট নোট", () => {
  const items = [mk("core"), mk("extra", { isCoreSafe: false })];
  const r = recommend({ ...adult, allergies: null }, items, { category: "skin" });
  assert.equal(r.mode, "core-only");
  assert.deepEqual(ids(r), ["core"]);
  assert.ok(r.notices.some((n) => n.id === "allergy-unknown"));
});

test("বয়স অজানা → মূল সেট", () => {
  const r = recommend({ ...adult, ageYears: null }, [mk("core"), mk("x", { isCoreSafe: false })], { category: "skin" });
  assert.equal(r.mode, "core-only"); assert.deepEqual(ids(r), ["core"]);
});

test("নারী ১২–৫০, গর্ভাবস্থা অজানা → মূল সেট; জানা হলে স্বাভাবিক", () => {
  const f = { ...adult, sex: "female" };
  const items = [mk("core"), mk("x", { isCoreSafe: false })];
  assert.equal(recommend(f, items, { category: "skin" }).mode, "core-only");
  const r = recommend({ ...f, pregnant: false }, items, { category: "skin" });
  assert.equal(r.mode, "normal"); assert.equal(r.items.length, 2);
});

test("গর্ভবতী/দুগ্ধদান/কিডনি/লিভার — avoidIf আইটেম বাদ", () => {
  const items = [mk("a", { avoidIf: ["pregnancy"] }), mk("b", { avoidIf: ["breastfeeding"] }), mk("c", { avoidIf: ["kidney"] }), mk("d", { avoidIf: ["liver"] }), mk("e")];
  const base = { ...adult, sex: "female", pregnant: false };
  assert.deepEqual(ids(recommend({ ...base, pregnant: true }, items, { category: "skin" })).sort(), ["b", "c", "d", "e"]);
  assert.deepEqual(ids(recommend({ ...base, breastfeeding: true }, items, { category: "skin" })).sort(), ["a", "c", "d", "e"]);
  assert.deepEqual(ids(recommend({ ...base, kidney: true }, items, { category: "skin" })).sort(), ["a", "b", "d", "e"]);
  assert.deepEqual(ids(recommend({ ...base, liver: true }, items, { category: "skin" })).sort(), ["a", "b", "c", "e"]);
});

test("১৮-র নিচে → শুধু মূল সেট; ২-র নিচে → রেফার, তালিকা নেই", () => {
  const items = [mk("core"), mk("x", { isCoreSafe: false })];
  const t = recommend({ ...adult, ageYears: 15 }, items, { category: "skin" });
  assert.equal(t.mode, "core-only"); assert.deepEqual(ids(t), ["core"]);
  const b = recommend({ ...adult, ageYears: 1 }, items, { category: "skin" });
  assert.equal(b.mode, "referral"); assert.equal(b.items.length, 0);
  assert.ok(b.notices.some((n) => n.id === "under2"));
});

test("red flag থাকলে তালিকা নেই, emergency আগে", () => {
  const r = recommend(adult, [mk("a")], { category: "skin", symptoms: ["blistering", "face-swelling-breathing"] });
  assert.equal(r.mode, "referral"); assert.equal(r.items.length, 0);
  assert.equal(r.redFlags[0].id, "face-swelling-breathing");
});

test("red flag বিভাগ-নির্ভর", () => {
  assert.equal(detectRedFlags(["mouth-ulcer-2w"], "skin").length, 0);
  assert.equal(detectRedFlags(["mouth-ulcer-2w"], "oral").length, 1);
  assert.equal(detectRedFlags(["rash-with-fever"], "hair").length, 1);
});

test("ক্রম: স্তর ১ আগে; পছন্দ/ঋতু প্রমাণ-স্তর ডিঙায় না", () => {
  const items = [
    mk("herbal3", { evidenceLevel: 3, herbal: true, heavyMetalWarning: true, isCoreSafe: false, seasons: ["shit"] }),
    mk("l2", { evidenceLevel: 2, isCoreSafe: false }),
    mk("l1", { isCoreSafe: false }),
  ];
  const r = recommend({ ...adult, preferences: ["herbal"] }, items, { category: "skin", season: "shit" });
  assert.deepEqual(ids(r), ["l1", "l2", "herbal3"]);
  assert.ok(r.items[2].notes.length === 1); // ভারী ধাতুর সতর্কতা
});

test("একই স্তরে কম পার্শ্বপ্রতিক্রিয়া আগে, তারপর ঋতু tie-break", () => {
  const items = [mk("a", { sideEffectRank: 3 }), mk("b", { sideEffectRank: 1 }), mk("c", { sideEffectRank: 1, seasons: ["shit"] })];
  assert.deepEqual(ids(recommend(adult, items, { category: "skin", season: "shit" })), ["c", "b", "a"]);
});

test("ত্বকের ধরন মিল; ধরন অজানা হলে শুধু সর্বজনীন", () => {
  const items = [mk("oilyOnly", { forTypes: ["oily"] }), mk("any")];
  assert.deepEqual(ids(recommend({ ...adult, skinType: "oily" }, items, { category: "skin" })).sort(), ["any", "oilyOnly"]);
  assert.deepEqual(ids(recommend({ ...adult, skinType: "dry" }, items, { category: "skin" })), ["any"]);
  assert.deepEqual(ids(recommend({ ...adult, skinType: null }, items, { category: "skin" })), ["any"]);
});

test("সমস্যা-ফিল্টার (concern)", () => {
  const items = [mk("acne", { forConcerns: ["acne"] }), mk("dry", { forConcerns: ["dryness"] }), mk("all")];
  assert.deepEqual(ids(recommend(adult, items, { category: "skin", concern: "acne" })).sort(), ["acne", "all"]);
});

test("প্রতি ফলে নিরাপত্তা-লাইন আছে", () => {
  const r = recommend(adult, [mk("a")], { category: "skin" });
  assert.ok(r.safetyLine.bn.includes("প্যাচ") || r.safetyLine.bn.includes("অল্প জায়গায়"));
});

test("schema — ভালো আইটেম পাস, খারাপ ধরা পড়ে", () => {
  assert.deepEqual(validateItem(mk("ok")), []);
  assert.ok(validateItem(mk("x", { evidenceLevel: 4 })).length);
  assert.ok(validateItem(mk("x", { sources: [] })).length);
  assert.ok(validateItem(mk("x", { status: "verified", lastReviewed: null })).length);
  assert.ok(validateItem(mk("x", { avoidIf: ["moon"] })).length);
});

test("schema — নিষিদ্ধ সক্রিয় উপাদান বাতিল", () => {
  assert.ok(validateItem(mk("x", { ingredientAliases: ["Salicylic acid"] })).some((m) => m.includes("নিষিদ্ধ উপাদান")));
  assert.ok(validateItem(mk("x", { name: { bn: "হাইড্রোকুইনোন ক্রিম", en: "Cream" } })).some((m) => m.includes("নিষিদ্ধ উপাদান")));
});

test("schema — স্তর ২/৩-এ নিষিদ্ধ শব্দ; স্তর ১-এ সীমাবদ্ধতা নেই", () => {
  const l3 = { evidenceLevel: 3, isCoreSafe: false, herbal: true, heavyMetalWarning: true };
  assert.ok(validateItem(mk("x", { ...l3, why: { bn: "ত্বক নিরাময় করে", en: "ok" } })).length);
  assert.ok(validateItem(mk("x", { ...l3, why: { bn: "ঠিক আছে", en: "This cures acne" } })).length);
  assert.deepEqual(validateItem(mk("x", { ...l3, why: { bn: "ঐতিহ্যগতভাবে ব্যবহৃত হয়", en: "Traditionally used" } })), []);
  assert.deepEqual(validateItem(mk("x", { why: { bn: "কার্যকর সুরক্ষা", en: "Effective protection" } })), []);
});

test("schema — ভেষজ: স্তর ৩ ও heavyMetalWarning বাধ্যতামূলক; মূল-নিরাপদ ভেষজ নয়", () => {
  assert.ok(validateItem(mk("x", { herbal: true, isCoreSafe: false })).length);
  assert.ok(validateItem(mk("x", { herbal: true, evidenceLevel: 3, isCoreSafe: true, heavyMetalWarning: true })).length);
  assert.ok(validateItem(mk("x", { category: "natural", evidenceLevel: 3, isCoreSafe: false })).length);
});

test("ঋতু — স্থানীয় তারিখ, সীমা-দিন", () => {
  assert.equal(seasonOf(new Date(2026, 3, 13)), "boshonto");
  assert.equal(seasonOf(new Date(2026, 3, 14)), "grishmo");
  assert.equal(seasonOf(new Date(2026, 5, 15)), "borsha");
  assert.equal(seasonOf(new Date(2026, 7, 15)), "shorot");
  assert.equal(seasonOf(new Date(2026, 9, 15)), "hemonto");
  assert.equal(seasonOf(new Date(2026, 11, 15)), "shit");
  assert.equal(seasonOf(new Date(2026, 0, 10)), "shit");
  assert.equal(seasonOf(new Date(2026, 1, 14)), "boshonto");
});
