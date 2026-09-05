// src/health/reports/reportParsing.js
//
// P5 — Report Intelligence — Structured value parsing + rule-based validation
// (Roadmap §8 পাইপলাইন: "Structured values (rule-based parsing) → Validation →
// Confidence scoring")। Input: pdfTextExtraction.js/ocrExtraction.js থেকে পাওয়া
// raw text + testNameDictionary entries।
//
// **নীতি (roadmap §8, bright-line, অপরিবর্তিত):** এই module কখনো value
// auto-correct করে না — শুধু flag করে (`status: "needs-review"` + reason[])।
// চূড়ান্ত সিদ্ধান্ত সবসময় পরবর্তী mandatory user-verification ধাপে হবে।
//
// Pure logic — Firestore/DOM কিছুই এখানে নেই (Process Rule ১১: business-logic
// core-layer-এ, testable), medicineDb.js/doseEnforcement.js split-প্যাটার্নের
// সাথে সংগতিপূর্ণ। Firestore fetch আলাদা `testDictionaryData.js`-এ।

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const EN_DIGITS = "0123456789";

function bnToEnDigits(str) {
  return String(str).replace(/[০-৯]/g, (d) => EN_DIGITS[BN_DIGITS.indexOf(d)]);
}

const NUMBER_PATTERN = /([0-9০-৯]+(?:[.,][0-9০-৯]+)?)/;
// সংখ্যার ঠিক পরে থাকা unit-সদৃশ token (letters/%/µ/³/স্ল্যাশ) ধরার জন্য —
// ঐচ্ছিক match, না পেলে "unit-unconfirmed" flag হবে।
const UNIT_TOKEN_PATTERN = /^\s*([a-zA-Zµ%³][a-zA-Zµ%³0-9\/.]{0,15})/;

function normalizeUnit(u) {
  return String(u || "").toLowerCase().replace(/[^a-z0-9µ]/g, "");
}

/**
 * raw text-এর প্রতিটা line-এ dictionary-entry-র synonym খুঁজে, পাশে numeric
 * value থাকলে candidate হিসেবে বের করে।
 * @param {string} rawText
 * @param {Array<object>} testDictionaryEntries - testNameDictionary docs (id সহ)
 * @returns {Array<{ testId, canonicalNameEn, matchedSynonym, rawValue, value, capturedUnit, line }>}
 */
export function extractCandidateValues(rawText, testDictionaryEntries) {
  const lines = String(rawText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const candidates = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    for (const entry of testDictionaryEntries) {
      const synonyms = [entry.canonicalNameEn, entry.canonicalName, ...(entry.synonyms || [])].filter(Boolean);
      // দীর্ঘতম synonym আগে চেষ্টা করা হয় (যেমন "Free T3" যেন শুধু "T3"-এর
      // সাথে ভুলভাবে না মেলে) — length-descending sort।
      const sortedSynonyms = [...synonyms].sort((a, b) => b.length - a.length);
      const matchedSynonym = sortedSynonyms.find((s) => lowerLine.includes(s.toLowerCase()));
      if (!matchedSynonym) continue;

      const idx = lowerLine.indexOf(matchedSynonym.toLowerCase());
      const afterText = line.slice(idx + matchedSynonym.length);
      const numMatch = afterText.match(NUMBER_PATTERN);
      if (!numMatch) continue;

      const rawValue = numMatch[1];
      const normalized = bnToEnDigits(rawValue).replace(",", ".");
      const value = parseFloat(normalized);
      if (Number.isNaN(value)) continue;

      const afterNumberText = afterText.slice(numMatch.index + numMatch[0].length);
      const unitMatch = afterNumberText.match(UNIT_TOKEN_PATTERN);
      const capturedUnit = unitMatch ? unitMatch[1] : null;

      candidates.push({
        testId: entry.id || entry.testId,
        canonicalNameEn: entry.canonicalNameEn,
        matchedSynonym,
        rawValue,
        value,
        capturedUnit,
        line,
      });
    }
  }
  return candidates;
}

/**
 * একটা candidate-কে তার dictionary-entry-র বিরুদ্ধে rule-based validate করে —
 * unit whitelist + physiological plausibility (decimal-shift heuristic)।
 * কখনো auto-correct করে না, শুধু flag করে (safe-default: ambiguity → review)।
 * @param {{ value: number, capturedUnit: string|null }} candidate
 * @param {object} dictEntry - testNameDictionary entry (unit, plausibleRange, referenceRange)
 * @returns {{ status: "ok"|"needs-review", flags: string[], value: number, unit: string, referenceRange: object|null }}
 */
export function validateCandidate(candidate, dictEntry) {
  const flags = [];

  // qualitative test (যেমন Dengue NS1/IgM/IgG) — সংখ্যাসূচক value প্রত্যাশিত না।
  if (!dictEntry.plausibleRange) {
    return {
      status: "needs-review",
      flags: ["qualitative-test-numeric-value-unexpected"],
      value: candidate.value,
      unit: dictEntry.unit,
      referenceRange: dictEntry.referenceRange || null,
    };
  }

  const { low, high } = dictEntry.plausibleRange;
  if (candidate.value < low || candidate.value > high) {
    flags.push("outside-plausible-range");

    // Decimal-shift heuristic — OCR-এ প্রায়ই দশমিক-বিন্দু miss/extra হয়;
    // ×10/÷10 করলে plausible-range-এ পড়ে কিনা শুধু নোট করা হয়, auto-correct না।
    const shiftedUp = candidate.value * 10;
    const shiftedDown = candidate.value / 10;
    if (shiftedUp >= low && shiftedUp <= high) flags.push("possible-decimal-shift(×10)");
    if (shiftedDown >= low && shiftedDown <= high) flags.push("possible-decimal-shift(÷10)");
  }

  // Unit whitelist — captured unit dictionary-এর নির্ধারিত unit-এর সাথে
  // (loose-normalize করে) না মিললে flag। কিছু জটিল unit (যেমন ×10³/µL) OCR-এ
  // নির্ভরযোগ্যভাবে capture নাও হতে পারে — সেক্ষেত্রে safe-default অনুযায়ী
  // review-এর জন্য flag হয় (silently accept করা হয় না)।
  if (!candidate.capturedUnit) {
    flags.push("unit-unconfirmed");
  } else if (normalizeUnit(candidate.capturedUnit) !== normalizeUnit(dictEntry.unit)) {
    flags.push("unit-mismatch");
  }

  return {
    status: flags.length > 0 ? "needs-review" : "ok",
    flags,
    value: candidate.value,
    unit: dictEntry.unit,
    referenceRange: dictEntry.referenceRange || null,
  };
}

/**
 * পুরো pipeline-ধাপ একসাথে চালানোর সুবিধার্থে wrapper — extract + validate।
 * @param {string} rawText
 * @param {Array<object>} testDictionaryEntries
 * @returns {Array<object>} প্রতিটা candidate-এর সাথে validation-result merged
 */
export function parseAndValidateReportText(rawText, testDictionaryEntries) {
  const dictById = new Map(testDictionaryEntries.map((e) => [e.id || e.testId, e]));
  const candidates = extractCandidateValues(rawText, testDictionaryEntries);
  return candidates.map((c) => {
    const dictEntry = dictById.get(c.testId);
    const validation = dictEntry ? validateCandidate(c, dictEntry) : { status: "needs-review", flags: ["dictionary-entry-not-found"], value: c.value, unit: null, referenceRange: null };
    return { ...c, ...validation };
  });
}
