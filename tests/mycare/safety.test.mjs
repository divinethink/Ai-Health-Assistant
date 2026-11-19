// MyCare ধাপ ৯ — নিরাপত্তা-যাচাই: সব আইটেম × সব বিশেষ গ্রুপ, অ্যালার্জি, red-flag, অন্যের-মোডে তথ্য-ফাঁস নেই।
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ALL_ITEMS } from "../../src/health/mycare/data/index.js";
import { recommend } from "../../src/health/mycare/careEngine.js";
import { validateItem, CATEGORIES } from "../../src/health/mycare/careSchema.js";
import { RED_FLAGS } from "../../src/health/mycare/careRedFlags.js";
import { SEASONS } from "../../src/health/mycare/careSeason.js";

const read = (p) => fs.readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const adult = { ageYears: 30, sex: "male", allergies: [], skinType: "oily", hairType: "oily" };
const ids = (r) => r.items.map((x) => x.item.id);
// সব বিভাগ × সব ঋতু একসাথে দেখে (ঋতু-ফিল্টার ছাড়া seasonal পাওয়া যায় না)
function everything(profile, extra = {}) {
  const out = [];
  for (const category of CATEGORIES) for (const season of SEASONS) out.push({ category, season, res: recommend(profile, ALL_ITEMS, { category, season, ...extra }) });
  return out;
}

test("প্রতিটি আইটেম schema-বৈধ, দ্বিভাষিক, উৎসসহ; ভেষজ হলে স্তর ৩ + ভারী ধাতুর নোট", () => {
  for (const i of ALL_ITEMS) {
    assert.deepEqual(validateItem(i), [], i.id);
    assert.ok(i.name.bn && i.name.en && i.how.bn && i.how.en && i.why.bn && i.why.en, i.id);
    assert.ok(i.sources.every((s) => s.org && s.url), i.id + " উৎসে url নেই");
    assert.equal(/ppm|\bmg\b|%/i.test(JSON.stringify([i.name, i.how, i.why])), false, i.id);
  }
  const herbal = recommend(adult, ALL_ITEMS, { category: "natural" });
  assert.ok(herbal.items.length > 0 && herbal.items.every((x) => x.item.evidenceLevel === 3 && x.notes.length === 1));
});

test("অ্যালার্জি/এড়াতে-চাই: প্রতিটি আইটেমের প্রতিটি উপাদান-নাম দিলে সেই আইটেম কখনো আসে না (বাংলা/ইংরেজি)", () => {
  let checked = 0;
  for (const it of ALL_ITEMS) {
    const base = { ...adult, skinType: it.forTypes[0] || null, hairType: it.forTypes[0] || null };
    const opts = { category: it.category, season: (it.seasons || [])[0], concern: it.forConcerns[0] || null };
    assert.ok(ids(recommend(base, ALL_ITEMS, opts)).includes(it.id), "বেসলাইনে আইটেম নেই: " + it.id);
    for (const token of [...(it.ingredientAliases || []), it.name.bn, it.name.en]) {
      for (const field of ["allergies", "avoidIngredients"]) {
        assert.equal(ids(recommend({ ...base, [field]: [token] }, ALL_ITEMS, opts)).includes(it.id), false, it.id + " / " + field + " / " + token);
        checked++;
      }
    }
  }
  assert.ok(checked > 50);
});

test("বিশেষ গ্রুপ (গর্ভবতী, দুগ্ধদান, কিডনি, লিভার): avoidIf-যুক্ত আইটেম কোনো বিভাগে/ঋতুতে আসে না", () => {
  const groups = { pregnancy: { pregnant: true, sex: "female" }, breastfeeding: { breastfeeding: true, sex: "female" }, kidney: { kidney: true }, liver: { liver: true } };
  for (const [g, patch] of Object.entries(groups)) {
    const p = { ...adult, pregnant: false, breastfeeding: false, ...patch };
    for (const { res } of everything(p, { includeDraft: true })) {
      for (const x of res.items) assert.equal((x.item.avoidIf || []).includes(g), false, g + " → " + x.item.id);
    }
  }
});

test("১৮-র নিচে ও অজানা বয়স/অ্যালার্জি: শুধু মূল নিরাপদ সেট; ২ বছরের নিচে: শুধু রেফার", () => {
  const profiles = [{ ...adult, ageYears: 15 }, { ...adult, ageYears: 5 }, { ...adult, ageYears: null }, { ...adult, allergies: null }];
  for (const p of profiles) for (const { res } of everything(p)) {
    assert.ok(res.items.every((x) => x.item.isCoreSafe === true), JSON.stringify(p));
    assert.ok(res.items.every((x) => x.item.status === "verified"));
  }
  for (const { res } of everything({ ...adult, ageYears: 1 })) {
    assert.equal(res.mode, "referral"); assert.equal(res.items.length, 0);
    assert.ok(res.notices.some((n) => n.id === "under2"));
  }
  assert.equal(recommend({ ...adult, ageYears: 0.5 }, ALL_ITEMS, { category: "oral" }).mode, "referral");
});

test("মূল নিরাপদ সেট: skin/hair/oral/seasonal-এ আছে, প্রতিটি স্তর ১ ও non-herbal", () => {
  const core = ALL_ITEMS.filter((i) => i.isCoreSafe);
  for (const c of ["skin", "hair", "oral", "seasonal"]) assert.ok(core.some((i) => i.category === c), c);
  assert.ok(core.every((i) => i.evidenceLevel === 1 && !i.herbal));
  assert.equal(core.some((i) => i.category === "natural"), false);
});

test("প্রতিটি red-flag: প্রযোজ্য বিভাগে রেফার (তালিকা খালি), অপ্রযোজ্যে নয়; emergency আগে", () => {
  for (const f of RED_FLAGS) for (const category of CATEGORIES) {
    const r = recommend(adult, ALL_ITEMS, { category, symptoms: [f.id], season: "grishmo" });
    const applies = f.cats === "*" || f.cats.includes(category);
    assert.equal(r.mode === "referral", applies, f.id + "/" + category);
    if (applies) { assert.equal(r.items.length, 0); assert.equal(r.redFlags[0].id, f.id); }
  }
  const both = recommend(adult, ALL_ITEMS, { category: "skin", symptoms: ["rash-with-fever", "face-swelling-breathing"] });
  assert.equal(both.redFlags[0].level, "emergency");
  assert.ok(RED_FLAGS.every((f) => f.bn && f.en));
});

test("প্রতিটি ফলাফলে নিরাপত্তা-লাইন আছে; সব দেখানো আইটেম verified", () => {
  for (const { res } of everything(adult)) {
    assert.ok(res.safetyLine.bn && res.safetyLine.en);
    assert.ok(res.items.every((x) => x.item.status === "verified"));
  }
});

test("অন্যের-মোড: Firestore/localStorage/log/AI কোথাও তথ্য যায় না (সোর্স-যাচাই)", () => {
  const BAD = /localStorage|sessionStorage|console\.|firebase|firestore|askAI|aiClient|fetch\(|sendBeacon|indexedDB/;
  for (const f of ["CareProfileSheets.js", "careAdapter.js", "careEngine.js", "careGroups.js", "careRedFlags.js", "careSchema.js", "careAiGuard.js", "careLabels.js", "careSeason.js"]) {
    assert.equal(BAD.test(read("src/health/mycare/" + f).replace(/\/\/.*$/gm, "")), false, f);
  }
  const sec = read("src/health/mycare/MyCareSection.js");
  assert.ok(/OtherSheet, \{[^}]*onApply: setOther/.test(sec), "OtherSheet শুধু setOther-এ যায়");
  assert.ok(/canExplain: !other/.test(sec), "অন্যের-মোডে AI বাটন বন্ধ");
  assert.ok(/setOther\(null\)/.test(sec) && /useEffect\(\(\) => \{ setOther\(null\)/.test(sec), "সদস্য বদলালে রিসেট");
  assert.equal(/saveCarePrefs\([^)]*other/.test(sec), false, "other কখনো save-এ নয়");
  assert.equal(/console\./.test(read("src/health/mycare/MyCareCategory.js")), false);
});

test("pure ফাইল (ইঞ্জিন/গ্রুপ/স্কিমা/গার্ড) UI, React, Firebase ও AI-SDK import করে না", () => {
  for (const f of ["careEngine.js", "careGroups.js", "careRedFlags.js", "careSchema.js", "careSeason.js", "careAiGuard.js"]) {
    const imports = read("src/health/mycare/" + f).split("\n").filter((l) => /^import /.test(l)).join("\n");
    assert.equal(/react|firebase|aiClient|shared\/|legacy/i.test(imports), false, f);
  }
});

test("AI-র payload-এ শুধু আইটেমের লেখা — ALL_ITEMS জুড়ে কোনো প্রোফাইল-কী নেই", async () => {
  const { buildExplainPayload } = await import("../../src/health/mycare/careAiGuard.js");
  for (const item of ALL_ITEMS) for (const lang of ["bn", "en"]) {
    const p = buildExplainPayload({ item, notes: [] }, lang);
    assert.deepEqual(Object.keys(p.item).sort(), ["how", "name", "redFlagNote", "warnings", "why"]);
    assert.equal(/ageYears|allerg|memberId|familyId|dob|records/i.test(Object.keys(p).join()), false);
  }
});
