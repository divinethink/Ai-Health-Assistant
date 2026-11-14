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
  const n = String(u || "").toLowerCase().replace(/μ/g, "µ").replace(/[^a-z0-9µ]/g, "");
  return n === "µiuml" || n === "uiuml" ? "miul" : n; // µIU/mL ≡ mIU/L (TSH-র দুই প্রচলিত একক)
}

function indexOfWord(lowerLine, needle) {
  const isWord = (ch) => !!ch && /[a-z0-9\u0980-\u09FF]/i.test(ch);
  let from = 0;
  for (;;) {
    const i = lowerLine.indexOf(needle, from);
    if (i < 0) return -1;
    const before = lowerLine[i - 1], after = lowerLine[i + needle.length];
    const startsWord = isWord(needle[0]), endsWord = isWord(needle[needle.length - 1]);
    if (!(startsWord && isWord(before)) && !(endsWord && isWord(after))) return i;
    from = i + 1;
  }
}

// "cumm" জাতীয় সরাসরি-সংখ্যার একক (৭৫৬০ /cumm) ও ×10³/µL-এককের ডিকশনারি-এন্ট্রি চেনা
const COUNT_UNITS = new Set(["cumm", "cmm", "mm3", "mm³", "µl", "ul"]);
const isCountUnit = (u) => !!u && COUNT_UNITS.has(String(u).toLowerCase().replace(/μ/g, "µ").replace(/[^a-z0-9µ³]/g, ""));
const isGlucoseEntry = (e) => ["fbs", "rbs"].includes(e.id || e.testId) && normalizeUnit(e.unit) === "mgdl";
const isThousandDictUnit = (u) => { const n = normalizeUnit(u); return /^10/.test(n) && /µl$/.test(n); };

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
      // পূর্ণ-শব্দ মিল (HUMASTAR-এর ভেতরের "AST" টেস্ট নয়)
      let idx = -1;
      const matchedSynonym = sortedSynonyms.find((s) => { idx = indexOfWord(lowerLine, s.toLowerCase()); return idx >= 0; });
      if (!matchedSynonym) continue;

      const afterText = line.slice(idx + matchedSynonym.length);
      const numMatch = afterText.match(NUMBER_PATTERN);
      if (!numMatch) continue;
      // নাম ও সংখ্যার মাঝে ":" বা বেশি দূরত্ব থাকলে ওটা অন্য ঘরের সংখ্যা (হেডার-লাইন: "Test Name : …(RBS) Sample : Serum Lab ID : 2026…")
      const gap = afterText.slice(0, numMatch.index);
      if (gap.includes(":") || gap.length > 40) continue;

      const rawValue = numMatch[1];
      // তারিখ/আইডি নয়: ৬+ অঙ্কের পূর্ণসংখ্যা, বা সংখ্যার পরেই -/ও অঙ্ক (21-07-2026, 20260721-90066)
      const tail = afterText.slice(numMatch.index + numMatch[0].length);
      if (/^[0-9০-৯]{6,}$/.test(rawValue) || /^\s?[-\/][0-9০-৯]/.test(tail)) continue;
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

  // একক-রূপান্তর (সংখ্যা সরাসরি → ×10³/µL): রিপোর্টে "7560 cumm" থাকলে অ্যাপের একক ×10³/µL-এ ১০০০ দিয়ে ভাগ।
  // এটা দশমিক-ভুল সংশোধন নয়, নির্দিষ্ট একক-রূপান্তর — তবু flag + mandatory review (rawValue/originalOcrValue অক্ষত)।
  let value = candidate.value;
  let converted = false;
  // গ্লুকোজ mmol/L (রিপোর্টে 5.8 mmol/l): মূল এককেই রাখা হয় (labAlerts mmol→mg/dL মিলিয়ে দেখে); mg/dL-এর plausible-range-এর জন্য শুধু যাচাইয়ে রূপান্তর
  const mmol = isGlucoseEntry(dictEntry) && /^mmol\/?l$/.test(String(candidate.capturedUnit || "").toLowerCase().replace(/[^a-z\/]/g, ""));
  if (mmol) {
    const mg = value * 18.016;
    const flagsM = [];
    if (mg < dictEntry.plausibleRange.low || mg > dictEntry.plausibleRange.high) flagsM.push("outside-plausible-range");
    return { status: flagsM.length ? "needs-review" : "ok", flags: flagsM, value, unit: "mmol/L", referenceRange: dictEntry.referenceRange || null };
  }
  if (isCountUnit(candidate.capturedUnit) && isThousandDictUnit(dictEntry.unit)) {
    value = Math.round(value) / 1000;
    converted = true;
    flags.push("unit-converted-cumm");
  }

  const { low, high } = dictEntry.plausibleRange;
  if (value < low || value > high) {
    flags.push("outside-plausible-range");

    // Decimal-shift heuristic — OCR-এ প্রায়ই দশমিক-বিন্দু miss/extra হয়;
    // ×10/÷10 করলে plausible-range-এ পড়ে কিনা শুধু নোট করা হয়, auto-correct না।
    const shiftedUp = value * 10;
    const shiftedDown = value / 10;
    if (shiftedUp >= low && shiftedUp <= high) flags.push("possible-decimal-shift(×10)");
    if (shiftedDown >= low && shiftedDown <= high) flags.push("possible-decimal-shift(÷10)");
  }

  // Unit whitelist — captured unit dictionary-এর নির্ধারিত unit-এর সাথে
  // (loose-normalize করে) না মিললে flag। কিছু জটিল unit (যেমন ×10³/µL) OCR-এ
  // নির্ভরযোগ্যভাবে capture নাও হতে পারে — সেক্ষেত্রে safe-default অনুযায়ী
  // review-এর জন্য flag হয় (silently accept করা হয় না)।
  if (!candidate.capturedUnit) {
    flags.push("unit-unconfirmed");
  } else if (!converted && normalizeUnit(candidate.capturedUnit) !== normalizeUnit(dictEntry.unit)) {
    flags.push("unit-mismatch");
  }

  return {
    status: flags.length > 0 ? "needs-review" : "ok",
    flags,
    value,
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
  const all = candidates.map((c) => {
    const dictEntry = dictById.get(c.testId);
    const validation = dictEntry ? validateCandidate(c, dictEntry) : { status: "needs-review", flags: ["dictionary-entry-not-found"], value: c.value, unit: null, referenceRange: null };
    return { ...c, ...validation };
  });
  // একই টেস্টের একাধিক সম্ভাব্য মান → সবচেয়ে ভরসাযোগ্য একটা (একক পাওয়া > ok-status > আগে আসা); ক্রম বজায় থাকে
  const score = (c) => (c.capturedUnit ? 2 : 0) + (c.status === "ok" ? 1 : 0);
  const best = new Map();
  for (const c of all) { const b = best.get(c.testId); if (!b || score(c) > score(b)) best.set(c.testId, c); }
  return all.filter((c) => best.get(c.testId) === c);
}
