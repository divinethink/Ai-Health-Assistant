// src/health/doc-ai/aiAdapters.js
//
// ধাপ ৪-ঘ — AI-ফলকে তিন প্যানেলের বিদ্যমান ফর্ম-আকারে আনা + কখন AI ডাকা হবে তার নিয়ম।
// Pure logic (DOM/নেটওয়ার্ক নেই)। নীতি: বিদ্যমান ভুক্তি/ঘর কখনো বদলায় না; AI শুধু নতুন ভুক্তি যোগ
// বা খালি ঘর ভরে, আর প্রতিটির গায়ে source:"ai"/aiFilled চিহ্ন থাকে (UI-তে হলুদ ট্যাগ)।
// AI-ভুক্তি ডিফল্টে টিক-ছাড়া — ব্যবহারকারী যাচাই করে টিক দেবেন; কিছুই নিজে সেভ হয় না।

import { findDoseConfusions } from "../reports/ocrQuality.js";
import { parseAndValidateReportText } from "../reports/reportParsing.js";
import { mergeList, medicineKey, labKey } from "./mergeFill.js";

export const LAB_MIN_KNOWN = 3;   // এর কম চেনা মান পেলে AI চেষ্টা
export const CARD_MIN_FOUND = 3;  // এর কম ঘর পেলে AI চেষ্টা
const MIN_TEXT = 20;

/**
 * @param {"prescription"|"lab-report"|"visiting-card"} docType
 * @param {{ text?: string, itemsCount?: number, knownCount?: number, found?: number, suspectHandwriting?: boolean, lowConfidence?: boolean }} m
 */
export function shouldTryAi(docType, m = {}) {
  if (String(m.text || "").replace(/\s/g, "").length < MIN_TEXT) return false;
  if (docType === "prescription") return (m.itemsCount || 0) === 0 || !!m.suspectHandwriting;
  if (docType === "lab-report") return (m.knownCount || 0) < LAB_MIN_KNOWN || !!m.suspectHandwriting;
  if (docType === "visiting-card") return (m.found || 0) < CARD_MIN_FOUND || !!m.lowConfidence;
  return false;
}

const normName = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, "");

/** OCR-টেক্সটে ওষুধের নাম আছে এমন লাইন (যাচাইয়ের সময় ব্যবহারকারীকে মূল লেখা দেখাতে) */
function lineFor(name, ocrText) {
  const first = String(name || "").toLowerCase().split(/[^a-z0-9ঀ-৿]+/).find((w) => w.length >= 3 && !/^(tab|cap|syp|inj)$/.test(w));
  if (!first) return "";
  const line = String(ocrText || "").split(/\r?\n/).find((l) => l.toLowerCase().includes(first));
  return line ? line.trim() : "";
}

/** validatePrescriptionAi().items → PrescriptionReviewForm-এর item-আকার */
export function aiMedicinesToItems(aiItems, ocrText) {
  return (aiItems || []).map((a) => {
    const raw = lineFor(a.name, ocrText) || a.name;
    return {
      name: a.name, form: null, strength: a.strength || null, pattern: null,
      patternRaw: a.patternRaw || null, perDay: null, prn: false,
      days: a.days || null, meal: a.meal || null, raw,
      confusions: findDoseConfusions(raw), flags: [], clear: false, source: "ai",
    };
  });
}

/** বিদ্যমান (নিয়মভিত্তিক) ওষুধ-তালিকার সাথে AI-ভুক্তি মেশানো — বিদ্যমান অক্ষত */
export function mergeMedicines(existing, aiItems, ocrText) {
  const ex = existing || [];
  const exKeys = ex.map(medicineKey);
  const incoming = aiMedicinesToItems(aiItems, ocrText).map((it) => {
    const k = medicineKey(it);
    // একই ওষুধ ভিন্ন বানানে ("Napa" / "Napa Extra") — একটা অন্যটির অংশ হলে ধরা হয় বিদ্যমান
    const hit = exKeys.find((e) => e && k && (e === k || (Math.min(e.length, k.length) >= 4 && (e.includes(k) || k.includes(e)))));
    return hit ? { ...it, _k: hit } : it;
  });
  const r = mergeList(ex, incoming, (x) => x._k || medicineKey(x), ["patternRaw", "days"]);
  return { items: r.items.map(({ _k, ...rest }) => rest), added: r.added, filledCells: r.filledCells };
}

/**
 * ল্যাব: AI-মান → ডিকশনারি-মিলিয়ে যাচাই (parseAndValidateReportText পুনর্ব্যবহার) → বিদ্যমান candidate-এ যোগ।
 * ডিকশনারিতে না-মেলা AI-মান বাদ (অজানা টেস্ট চুপচাপ ঢোকে না)।
 */
export function mergeLabCandidates(existing, aiItems, dictEntries) {
  const ex = existing || [];
  const lines = (aiItems || []).map((a) => `${a.name} ${a.value}${a.unit ? " " + a.unit : ""}`).join("\n");
  const fromAi = lines ? parseAndValidateReportText(lines, dictEntries || []) : [];
  const seen = new Set(ex.map((c) => String(c.testId)));
  const added = [];
  for (const c of fromAi) {
    if (seen.has(String(c.testId))) continue;
    seen.add(String(c.testId));
    added.push({ ...c, source: "ai" });
  }
  return { candidates: [...ex, ...added], added: added.length };
}

/** ডাক্তার-কার্ড: AI-র specialty লেখা → DOCTOR_CATEGORIES-এর বৈধ key (না মিললে "") */
export function pickCategoryKey(value, categories) {
  const v = normName(value);
  if (!v) return "";
  for (const [k, label] of categories || []) if (normName(k) === v || normName(label) === v) return k;
  return "";
}

/** AI-র কার্ড-ফল থেকে শুধু ফর্মের খালি ঘরের জন্য patch (specialty বৈধ key হলেই) */
export function cardAiPatch(aiFields, isEmptyKey, categories, allowKeys) {
  const patch = {};
  for (const k of allowKeys) {
    let v = aiFields?.[k] || "";
    if (k === "specialtyCategory") v = pickCategoryKey(v, categories);
    if (v && isEmptyKey(k)) patch[k] = v;
  }
  return patch;
}
export { labKey };
