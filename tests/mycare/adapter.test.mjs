import test from "node:test";
import assert from "node:assert/strict";
import { buildOwnProfile, buildOtherProfile, prefsProgress, splitIngredients } from "../../src/health/mycare/careAdapter.js";
import { recommend } from "../../src/health/mycare/careEngine.js";

const dobYearsAgo = (y) => new Date(Date.now() - y * 365.25 * 864e5).toISOString().slice(0, 10);
const item = { id: "a", category: "skin", name: { bn: "ক্লিনজার", en: "Cleanser" }, how: { bn: "ক", en: "a" }, why: { bn: "খ", en: "b" }, evidenceLevel: 1, status: "verified", lastReviewed: "2026-11-01", sources: [{ org: "AAD" }], isCoreSafe: true, ingredientAliases: [], avoidIf: [] };

test("মূল সদস্য — অ্যালার্জি-রেকর্ড, কিডনি, লিভার, গর্ভাবস্থা পড়া", () => {
  const records = [
    { resourceType: "allergy", substance: "Lanolin" },
    { resourceType: "condition", name: "ক্রনিক কিডনি রোগ", status: "active" },
    { resourceType: "condition", name: "Fatty liver", status: "active" },
    { resourceType: "condition", name: "গর্ভাবস্থা / বুকের দুধ", status: "active" },
  ];
  const p = buildOwnProfile({ member: { dob: dobYearsAgo(30), sex: "female" }, records, recordsOk: true, prefs: { skinType: "dry" } });
  assert.deepEqual(p.allergies, ["Lanolin"]);
  assert.equal(p.kidney, true); assert.equal(p.liver, true); assert.equal(p.pregnant, true);
  assert.equal(p.skinType, "dry");
});

test("রেকর্ড পড়া ব্যর্থ → অ্যালার্জি/গর্ভাবস্থা অজানা → শুধু মূল সেট", () => {
  const p = buildOwnProfile({ member: { dob: dobYearsAgo(30), sex: "male" }, records: null, recordsOk: false, prefs: null });
  assert.equal(p.allergies, null);
  assert.equal(recommend(p, [item], { category: "skin" }).mode, "core-only");
});

test("নারী — গর্ভাবস্থা-রেকর্ড নেই = অজানা (নিশ্চিত না নয়); resolved = না; পুরুষ = না", () => {
  const m = { dob: dobYearsAgo(28), sex: "female" };
  assert.equal(buildOwnProfile({ member: m, records: [], recordsOk: true }).pregnant, null);
  const done = [{ resourceType: "condition", name: "গর্ভাবস্থা", status: "resolved" }];
  assert.equal(buildOwnProfile({ member: m, records: done, recordsOk: true }).pregnant, false);
  assert.equal(buildOwnProfile({ member: { dob: dobYearsAgo(28), sex: "male" }, records: [], recordsOk: true }).pregnant, false);
});

test("অন্যের জন্য — মূল সদস্যের তথ্য মেশে না; অ্যালার্জি ফাঁকা = অজানা", () => {
  const p = buildOtherProfile({ sex: "male", ageBand: "adult", skinType: "oily", allergyText: "", noAllergy: false });
  assert.equal(p.allergies, null); assert.equal(p.ageYears, 30); assert.equal(p.skinType, "oily");
  assert.equal(recommend(p, [item], { category: "skin" }).mode, "core-only");
  assert.deepEqual(buildOtherProfile({ sex: "male", ageBand: "adult", noAllergy: true }).allergies, []);
  assert.deepEqual(buildOtherProfile({ sex: "male", ageBand: "adult", allergyText: "Lanolin, নারকেল" }).allergies, ["Lanolin", "নারকেল"]);
});

test("অন্যের জন্য — ২ বছরের নিচে = রেফার; ১৮-র নিচে = মূল সেট; নারীর গর্ভবতী/দুগ্ধ = হ্যাঁ", () => {
  assert.equal(recommend(buildOtherProfile({ sex: "male", ageBand: "under2", noAllergy: true }), [item], { category: "skin" }).mode, "referral");
  assert.equal(recommend(buildOtherProfile({ sex: "male", ageBand: "teen", noAllergy: true }), [item], { category: "skin" }).mode, "core-only");
  const w = buildOtherProfile({ sex: "female", ageBand: "adult", noAllergy: true, pregnantOrNursing: true });
  assert.equal(w.pregnant, true); assert.equal(w.breastfeeding, true);
  assert.equal(buildOtherProfile({ sex: "female", ageBand: "adult", noAllergy: true }).pregnant, null);
});

test("অ্যালার্জির আইটেম অন্যের মোডেও কঠোর বাদ", () => {
  const it = { ...item, id: "b", ingredientAliases: ["lanolin"] };
  const p = buildOtherProfile({ sex: "male", ageBand: "adult", allergyText: "lanolin", skinType: "dry" });
  assert.equal(recommend(p, [it], { category: "skin" }).items.length, 0);
});

test("prefsProgress ও splitIngredients", () => {
  assert.deepEqual(prefsProgress(null), { percent: 0, complete: false });
  assert.deepEqual(prefsProgress({ skinType: "dry", hairType: "oily" }), { percent: 40, complete: true });
  assert.equal(splitIngredients("a, b;\nc,,").length, 3);
  assert.equal(splitIngredients(Array(40).fill("x").join(",")).length, 20);
});
