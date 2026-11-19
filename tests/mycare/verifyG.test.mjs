// MyCare ধাপ G — যাচাই: "আজকের যত্ন"/চেকলিস্ট/প্যাচ/শেয়ার (ধাপ D–F)-এর নিরাপত্তা ও "অন্যের মোড"-এ তথ্য-সুরক্ষা।
// ধাপ ৯-এর safety.test.mjs ইঞ্জিন ও AI আগেই ঢেকেছে; এখানে নতুন পৃষ্ঠগুলো (careToday, careLog*, carePatch*, careShare, UI সংযোগ)।
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ALL_ITEMS } from "../../src/health/mycare/data/index.js";
import { pickTodayCare, isEmptyCare } from "../../src/health/mycare/careToday.js";
import { recommend } from "../../src/health/mycare/careEngine.js";
import { SEASONS } from "../../src/health/mycare/careSeason.js";
import { plannedKeys, sanitizeDays, sanitizeDay } from "../../src/health/mycare/careLogCore.js";
import { buildOtherProfile } from "../../src/health/mycare/careAdapter.js";

const read = (p) => fs.readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\/.*$/gm, "");
const adult = { ageYears: 30, sex: "male", allergies: [], pregnant: false, breastfeeding: false, kidney: false, liver: false, skinType: "normal", hairType: "normal", avoidIngredients: [], preferences: [] };
const DATES = [new Date(2026, 0, 3), new Date(2026, 4, 10), new Date(2026, 10, 19), new Date(2026, 11, 31)];
const shown = (c) => [...c.morning, ...c.night, ...c.anytime, ...(c.seasonTip ? [c.seasonTip] : [])];
const idsOf = (c) => shown(c).map((e) => e.item.id);
const run = (p) => SEASONS.flatMap((season) => DATES.map((date) => ({ season, c: pickTodayCare(p, ALL_ITEMS, { season, date }) })));

test("G1 অ্যালার্জি: প্রতিটি আইটেমের প্রতিটি উপাদান/নাম দিলে সেই আইটেম আজকের যত্নে কখনো আসে না", () => {
  for (const item of ALL_ITEMS) {
    const tokens = [...(item.ingredientAliases || []), item.name.bn, item.name.en].filter((t) => t && t.length >= 2);
    for (const t of tokens) for (const { c } of run({ ...adult, allergies: [t] })) assert.ok(!idsOf(c).includes(item.id), item.id + " ← " + t);
  }
});

test("G2 এড়াতে-চাওয়া উপাদানও একইভাবে বাদ", () => {
  for (const item of ALL_ITEMS) for (const t of (item.ingredientAliases || []).filter((x) => x.length >= 2))
    for (const { c } of run({ ...adult, avoidIngredients: [t] })) assert.ok(!idsOf(c).includes(item.id), item.id + " ← " + t);
});

test("G3 গর্ভাবস্থা/দুগ্ধদান/কিডনি/লিভার: avoidIf-যুক্ত আইটেম আসে না", () => {
  const cases = [["pregnant", { pregnant: true, sex: "female" }], ["breastfeeding", { breastfeeding: true, sex: "female" }], ["kidney", { kidney: true }], ["liver", { liver: true }]];
  for (const [group, patch] of cases) {
    const banned = new Set(ALL_ITEMS.filter((i) => (i.avoidIf || []).includes(group)).map((i) => i.id));
    for (const { c } of run({ ...adult, ...patch })) for (const id of idsOf(c)) assert.ok(!banned.has(id), group + ": " + id);
  }
});

test("G4 শিশু: ২ বছরের নিচে রেফার ও ফাঁকা; ১৮-র নিচে শুধু মূল নিরাপদ সেট", () => {
  for (const age of [0, 1, 1.9]) for (const { c } of run({ ...adult, ageYears: age })) { assert.equal(c.mode, "referral"); assert.equal(isEmptyCare(c), true); assert.deepEqual(plannedKeys(c), []); }
  for (const age of [2, 9, 15, 17.9]) for (const { c } of run({ ...adult, ageYears: age })) {
    assert.equal(c.mode, "core-only");
    for (const e of shown(c)) assert.equal(e.item.isCoreSafe, true, e.item.id);
  }
});

test("G5 অজানা তথ্য (বয়স/অ্যালার্জি/গর্ভাবস্থা) = শুধু মূল নিরাপদ সেট; শুধু verified আইটেম", () => {
  const unknowns = [{ ageYears: null }, { allergies: null }, { sex: "female", pregnant: null }];
  for (const u of unknowns) for (const { c } of run({ ...adult, ...u })) {
    assert.equal(c.mode, "core-only", JSON.stringify(u));
    for (const e of shown(c)) assert.equal(e.item.isCoreSafe, true);
  }
  for (const p of [adult, { ...adult, ageYears: 70 }]) for (const { c } of run(p)) for (const e of shown(c)) assert.equal(e.item.status, "verified", e.item.id);
});

test("G6 আজকের যত্ন ইঞ্জিনের ফলের উপসেট; সীমা মানা; চেকলিস্ট-key কেবল দেখানো ধাপের", () => {
  for (const { season, c } of run(adult)) {
    const allowed = new Set(["skin", "oral", "body", "seasonal"].flatMap((category) => recommend(adult, ALL_ITEMS, { category, season }).items.map((e) => e.item.id)));
    for (const id of idsOf(c)) assert.ok(allowed.has(id), id);
    assert.ok(c.morning.length <= 3 && c.night.length <= 3 && c.anytime.length <= 2);
    const keys = plannedKeys(c);
    assert.equal(keys.length, new Set(keys).size);
    assert.equal(keys.length, c.morning.length + c.night.length + c.anytime.length);
  }
});

test("G7 red-flag: কোনো সতর্ক লক্ষণ থাকলে ইঞ্জিন রেফার করে (আজকের যত্ন সেই লক্ষণ-ছাড়া চলে, তাই MyCare পেজে লক্ষণ বাছলে বিভাগ-ফল ফাঁকা)", () => {
  for (const category of ["skin", "hair", "oral", "body"]) {
    const r = recommend(adult, ALL_ITEMS, { category, symptoms: ["sudden-hair-loss", "severe-reaction", "mouth-swelling"] });
    if (r.redFlags.length) { assert.equal(r.mode, "referral"); assert.equal(r.items.length, 0); }
  }
  const r = recommend(adult, ALL_ITEMS, { category: "hair", symptoms: ["sudden-hair-loss"] });
  assert.equal(r.mode, "referral"); assert.equal(r.items.length, 0); assert.ok(r.redFlags.length > 0);
});

test("G8 অন্যের মোড: নতুন ফাইলে কোনো SDK/AI/লগ নেই; লেখার পথ শুধু নিজের তথ্যে বাঁধা", () => {
  const BAD = /firebase|firestore|askAI|aiClient|fetch\(|sendBeacon|indexedDB|console\.|analytics/i;
  for (const f of ["careLogCore.js", "carePatch.js", "careShare.js", "careToday.js", "PatchCheckCard.js"]) assert.equal(BAD.test(strip(read("src/health/mycare/" + f))), false, f);
  for (const f of ["useCareLog.js", "TodayCareCard.js", "carePatchStore.js", "careLogData.js"]) assert.equal(/console\.|analytics|askAI|aiClient/i.test(strip(read("src/health/mycare/" + f))), false, f);
  const sec = read("src/health/mycare/MyCareSection.js");
  assert.ok(/log: other \? null : careLog/.test(sec) && /patch: other \? null : patches/.test(sec));
  assert.ok(/!other && React\.createElement\(CareWeekCard/.test(sec) && /!other && React\.createElement\(PatchCheckCard/.test(sec));
  assert.ok(/useCareLog\(familyId, selectedMemberId, callerMemberId\)/.test(sec) && /usePatches\(selectedMemberId\)/.test(sec)); // other কখনো আর্গুমেন্ট নয়
  assert.equal(/(saveCareDay|saveCarePrefs|saveSavedIds|toggleSave)\([^)]*other/.test(sec), false);
  assert.ok(/onToggleSave: other \? null : toggleSave/.test(sec));
});

test("G9 অন্যের মোডের ফর্ম-তথ্য ডেটা-কী-তে ঢোকে না: careLog/প্যাচ sanitize শুধু তারিখ ও আইটেম-id রাখে", () => {
  const form = { ageBand: "child", sex: "female", allergyText: "peanut, dust", noAllergy: false, skinType: "dry", pregnantOrNursing: true };
  const prof = buildOtherProfile(form);
  const dirty = { "2026-11-19": ["skin-sunscreen/morning", "peanut", "Hasan", "a@b.com", JSON.stringify(prof), "all"], "peanut, dust": ["skin-sunscreen/night"], "2026-11-18": [{ allergies: ["peanut"] }] };
  const clean = sanitizeDays(dirty);
  assert.deepEqual(Object.keys(clean), ["2026-11-19"]);
  assert.deepEqual(clean["2026-11-19"], ["skin-sunscreen/morning", "all"]);
  assert.deepEqual(sanitizeDay(["x y/morning", "ইউজার/night"]), []);
});

test("G10 নিয়মের স্থিতি: careLog rules-এ শুধু অনুমোদিত ফিল্ড; careLog ডক-পথ শুধু memberId", () => {
  const rules = read("firestore.rules");
  assert.ok(/match \/careLog\/\{memberId\}/.test(rules));
  const i = rules.indexOf("match /careLog/{memberId}");
  const block = rules.slice(i, i + 700);
  assert.ok(block.includes("hasReadAccess") && block.includes("hasWriteAccess") && block.includes("hasDeleteAccess"));
  assert.ok(block.includes("request.resource.data.memberId == memberId") && block.includes("careLogOk"));
});

test("G11 ছোট-পর্দার টাচ-টার্গেট: নতুন UI-র প্রতিটি বাটনে ≥৪৪px উচ্চতা (সরাসরি বা শেয়ার্ড স্টাইলে)", () => {
  const OK = /(minHeight|height): "(4[4-9]|[5-9]\d)px"/;
  for (const f of ["TodayCareCard.js", "PatchCheckCard.js", "MyCareCategory.js"]) {
    const src = strip(read("src/health/mycare/" + f));
    const shared = new Set(["cardBox"]); // cardBox = পুরো-প্রস্থ কার্ড (প্যাডিং ১৪px + ৪০px আইকন ≥ ৬৮px)। শেয়ার্ড স্টাইল ভেরিয়েবল যেগুলোর সংজ্ঞায় ≥৪৪px আছে
    for (const m of src.matchAll(/const (\w+) = (\(?[^\n]*)\n?/g)) if (OK.test(m[2])) shared.add(m[1]);
    const lines = src.split("\n");
    lines.forEach((ln, idx) => {
      if (!/createElement\("button"/.test(ln)) return;
      const ctx = ln + (lines[idx + 1] || "");
      const good = OK.test(ctx) || [...shared].some((v) => new RegExp("style: (\\{ \\.\\.\\.)?" + v + "\\b|\\.\\.\\." + v + "\\b|style: " + v + "\\(").test(ctx)) || /width: "44px"/.test(ctx);
      assert.ok(good, f + ":" + (idx + 1));
    });
  }
});
