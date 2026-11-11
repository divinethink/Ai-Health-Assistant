// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { shouldTryAi, aiMedicinesToItems, mergeMedicines, mergeLabCandidates, pickCategoryKey, cardAiPatch } from "../../src/health/doc-ai/aiAdapters.js";

const TXT = "Rx\n1. Tab. Napa 500 mg 1+0+1 5 days\n2. Cap. Omeprazole 20mg 1+0+1 7 days";

test("ট্রিগার: প্রেসক্রিপশন — ০টি বা হাতে-লেখা সন্দেহ হলে", () => {
  assert.equal(shouldTryAi("prescription", { text: TXT, itemsCount: 0 }), true);
  assert.equal(shouldTryAi("prescription", { text: TXT, itemsCount: 2 }), false);
  assert.equal(shouldTryAi("prescription", { text: TXT, itemsCount: 2, suspectHandwriting: true }), true);
});
test("ট্রিগার: ল্যাব ও কার্ড; ছোট লেখায় কখনো নয়", () => {
  assert.equal(shouldTryAi("lab-report", { text: TXT, knownCount: 2 }), true);
  assert.equal(shouldTryAi("lab-report", { text: TXT, knownCount: 5 }), false);
  assert.equal(shouldTryAi("visiting-card", { text: TXT, found: 2 }), true);
  assert.equal(shouldTryAi("visiting-card", { text: TXT, found: 4, lowConfidence: true }), true);
  assert.equal(shouldTryAi("visiting-card", { text: TXT, found: 4 }), false);
  assert.equal(shouldTryAi("prescription", { text: "abc", itemsCount: 0 }), false);
  assert.equal(shouldTryAi("imaging", { text: TXT }), false);
});

test("AI-ওষুধ → ফর্ম-আইটেম: source=ai, মূল OCR লাইন সংযুক্ত, টিক-যোগ্য আকার", () => {
  const [it] = aiMedicinesToItems([{ name: "Napa", strength: "500 mg", patternRaw: "1+0+1", days: 5, meal: null }], TXT);
  assert.equal(it.source, "ai"); assert.equal(it.clear, false);
  assert.ok(it.raw.includes("Napa 500 mg")); assert.deepEqual(it.flags, []); assert.deepEqual(it.confusions, []);
});
test("mergeMedicines: বিদ্যমান অক্ষত, নতুন যোগ, মিলে গেলে শুধু খালি ঘর", () => {
  const existing = [{ name: "Napa", patternRaw: null, days: null, raw: "x", flags: [], confusions: [] }];
  const ai = [{ name: "Napa Extra", strength: null, patternRaw: "1+0+1", days: 5, meal: null }, { name: "Omeprazole", strength: "20 mg", patternRaw: "1+0+1", days: 7, meal: null }];
  const r = mergeMedicines(existing, ai, TXT);
  assert.equal(r.items.length, 2); assert.equal(r.added, 1);
  assert.equal(r.items[0].name, "Napa"); assert.equal(r.items[0].patternRaw, "1+0+1"); assert.equal(r.items[0].days, 5);
  assert.deepEqual(r.items[0].aiFilled, ["patternRaw", "days"]);
  assert.equal(r.items[1].source, "ai");
  assert.equal(existing[0].patternRaw, null);
  assert.ok(!("_k" in r.items[1]));
});
test("mergeMedicines: বিদ্যমান মান AI বদলায় না", () => {
  const r = mergeMedicines([{ name: "Napa", patternRaw: "1+1+1", days: 3 }], [{ name: "Napa", patternRaw: "1+0+1", days: 5 }], TXT);
  assert.equal(r.items[0].patternRaw, "1+1+1"); assert.equal(r.items[0].days, 3); assert.equal(r.filledCells, 0);
});

const DICT = [
  { id: "hb", canonicalNameEn: "Hemoglobin", synonyms: ["Hemoglobin", "Hb"], unit: "g/dL", referenceRange: { low: 12, high: 17 }, plausibleRange: { low: 3, high: 25 } },
  { id: "creat", canonicalNameEn: "Creatinine", synonyms: ["Creatinine"], unit: "mg/dL", referenceRange: { low: 0.6, high: 1.2 }, plausibleRange: { low: 0.1, high: 20 } },
];
test("mergeLabCandidates: ডিকশনারি-মেলা AI-মান source=ai সহ যোগ; ডুপ্লিকেট/অজানা বাদ", () => {
  const existing = [{ testId: "hb", canonicalNameEn: "Hemoglobin", value: 12.5, status: "ok", flags: [] }];
  const r = mergeLabCandidates(existing, [{ name: "Hemoglobin", value: 9, unit: "g/dL" }, { name: "Creatinine", value: 0.9, unit: "mg/dL" }, { name: "Zorgon", value: 1 }], DICT);
  assert.equal(r.added, 1);
  assert.equal(r.candidates.length, 2);
  assert.equal(r.candidates[0].value, 12.5);
  assert.equal(r.candidates[1].testId, "creat"); assert.equal(r.candidates[1].source, "ai");
});
test("mergeLabCandidates: AI খালি হলে অপরিবর্তিত", () => {
  assert.deepEqual(mergeLabCandidates([{ testId: "a" }], [], DICT), { candidates: [{ testId: "a" }], added: 0 });
});

const CATS = [["medicine", "Medicine"], ["obgyn", "Obstetrics & Gynecology"]];
test("pickCategoryKey: key বা লেবেল মিললে key, নইলে খালি", () => {
  assert.equal(pickCategoryKey("Medicine", CATS), "medicine");
  assert.equal(pickCategoryKey("obstetrics & gynecology", CATS), "obgyn");
  assert.equal(pickCategoryKey("Astrology", CATS), "");
});
test("cardAiPatch: শুধু খালি ঘর, বৈধ specialty", () => {
  const empty = (k) => k !== "name";
  const p = cardAiPatch({ name: "Dr X", phone: "017", specialtyCategory: "Medicine", area: "" }, empty, CATS, ["name", "specialtyCategory", "phone", "area"]);
  assert.deepEqual(p, { specialtyCategory: "medicine", phone: "017" });
  assert.deepEqual(cardAiPatch({ specialtyCategory: "Nope" }, () => true, CATS, ["specialtyCategory"]), {});
});
