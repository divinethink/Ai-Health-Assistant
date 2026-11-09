// src/health/prescriptions/prescriptionParsing.js
//
// ধাপ ৬ — প্রেসক্রিপশনের টেক্সট (PDF text / OCR) থেকে নিয়মভিত্তিক (AI ছাড়া) ওষুধ শনাক্ত।
// Pure logic — Firestore/DOM নেই। **নীতি:** প্রেসক্রিপশনে যা লেখা শুধু সেটাই নেওয়া হয়; ডোজ/সময়সূচি
// অ্যাপ নিজে বানায় না। কিছু অস্পষ্ট হলে flag করে (চুপচাপ ঠিক করে না); চূড়ান্ত সিদ্ধান্ত
// PrescriptionReviewForm-এ ব্যবহারকারীর অনুমোদনে।
//
// ধরে: Tab./Cap./Syp./Cream/Gel/Shampoo… নাম, শক্তি (mg/ml/%…), ১+০+১ / BD / TDS / "৩ বার",
// ক'দিন (দিন/সপ্তাহ/মাস, বাংলা-ইংরেজি), খাবারের আগে/পরে, "প্রয়োজনে"। বহুলাইনও (নাম এক লাইনে, ডোজ পরের লাইনে)।

import { findDoseConfusions } from "../reports/ocrQuality.js";

const BN = "০১২৩৪৫৬৭৮৯";
const toEn = (s) => String(s).replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
const toBn = (s) => String(s).replace(/[0-9]/g, (d) => BN[d]);

// ফর্ম-শব্দ → দেখানোর রূপ; oral=true হলে নামে আলাদা ফর্ম-প্রিফিক্স রাখা হয় না (Tab./Cap.)
const FORMS = {
  tab: { label: "Tab", oral: true }, tablet: { label: "Tab", oral: true }, "ট্যাব": { label: "Tab", oral: true },
  cap: { label: "Cap", oral: true }, capsule: { label: "Cap", oral: true }, "ক্যাপ": { label: "Cap", oral: true },
  syp: { label: "Syp" }, syrup: { label: "Syp" }, "সিরাপ": { label: "Syp" },
  susp: { label: "Susp" }, suspension: { label: "Susp" },
  inj: { label: "Inj" }, injection: { label: "Inj" },
  cream: { label: "Cream" }, oint: { label: "Oint" }, ointment: { label: "Oint" }, gel: { label: "Gel" },
  drop: { label: "Drop" }, drops: { label: "Drop" }, lotion: { label: "Lotion" }, shampoo: { label: "Shampoo" },
  sol: { label: "Sol" }, solution: { label: "Sol" }, sachet: { label: "Sachet" }, powder: { label: "Powder" },
  spray: { label: "Spray" }, inhaler: { label: "Inhaler" }, supp: { label: "Supp" }, suppository: { label: "Supp" },
};
const FORM_ALT = Object.keys(FORMS).sort((a, b) => b.length - a.length).join("|");
const NUM_PREFIX = "(?:[0-9০-৯]{1,2}\\s*[.)]\\s*)?";
const START_FORM_RE = new RegExp("^\\s*" + NUM_PREFIX + "(" + FORM_ALT + ")\\b\\.?[\\s,:-]*(.*)$", "i");
const START_NUM_RE = /^\s*[0-9০-৯]{1,2}\s*[.)]\s*([A-Za-zঀ-৿].*)$/;
// ওষুধ-তালিকার শেষ চিহ্ন (এরপরের লাইন আর ওষুধের অংশ নয়)
const STOP_RE = /^\s*(advice|follow[\s-]*up|diagnosis|chief|investigation|next|আমলে|নির্দেশ|পরামর্শ|পুনরায়|সাক্ষাৎ|ফলো)/i;
const MAX_BLOCK_LINES = 6;

const PATTERN_RE = /(?<![\d.+])(\d+(?:[./]\d+)?)\s*[+＋]\s*(\d+(?:[./]\d+)?)\s*[+＋]\s*(\d+(?:[./]\d+)?)(?!\s*[+＋]\s*\d)(?![\d./])/;
const STRENGTH_RE = /(\d+(?:\.\d+)?)\s*(mg|mcg|µg|μg|gm|g|ml|iu|unit|units|%)(?![A-Za-z])/i;
const DAYS_RE = /(\d+)\s*(?:দিন(?!ে)|days?\b|din\b)/i;
const WEEKS_RE = /(\d+)\s*(?:সপ্তাহ(?!ে)|weeks?\b|wks?\b)/i;
const MONTHS_RE = /(\d+)\s*(?:মাস|months?\b|mos?\b)/i;
const TIMES_RE = /(\d+)\s*(?:বার|times?\b|bar\b)/i;
const PRN_RE = /(প্রয়োজনে|দরকারে|\bSOS\b|\bPRN\b|if\s+needed|when\s+needed)/i;
const MEAL_BEFORE_RE = /(খাবারের|খাওয়ার|আহারের)\s*(আগে|পূর্বে)|before\s*(meal|food)|\bAC\b|empty\s*stomach|খালি\s*পেটে/i;
const MEAL_AFTER_RE = /(খাবারের|খাওয়ার|আহারের)\s*(পরে|পর)|after\s*(meal|food)|\bPC\b/i;
const FREQ_WORDS = [
  [/\b(BD|BID|twice\s+(a\s+)?daily)\b/i, 2], [/\b(TDS|TID|thrice\s+(a\s+)?daily|three\s+times\s+(a\s+)?day)\b/i, 3],
  [/\b(QDS|QID)\b/i, 4], [/\b(OD|QD|once\s+(a\s+)?daily|daily)\b/i, 1],
];
const SLOT_TIMES = { m: "08:00", d: "14:00", n: "20:00" };
const DEFAULT_TIMES = { 1: ["08:00"], 2: ["08:00", "20:00"], 3: ["08:00", "14:00", "20:00"], 4: ["08:00", "13:00", "18:00", "22:00"] };

const cleanName = (s) => String(s).replace(/\s+/g, " ").replace(/^[\s,.:;\-–—>]+|[\s,.:;\-–—>]+$/g, "").trim();

// নাম কোথায় শেষ — প্রথম লাইনে ডোজ/দিন/খাবার/ড্যাশ শুরুর আগ পর্যন্ত
function cutName(line, ...cutters) {
  const idx = cutters.map((re) => { const m = line.match(re); return m ? m.index : -1; }).filter((i) => i >= 0);
  const dash = line.search(/\s[—–-]{1,2}\s|—|–|->/);
  if (dash >= 0) idx.push(dash);
  return cleanName(idx.length ? line.slice(0, Math.min(...idx)) : line);
}

function blockStart(line) {
  const f = line.match(START_FORM_RE);
  if (f) return { form: FORMS[f[1].toLowerCase()] || FORMS[f[1]], rest: f[2], strong: true };
  const n = line.match(START_NUM_RE);
  return n ? { form: null, rest: n[1], strong: false } : null;
}

function splitBlocks(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (STOP_RE.test(line)) { cur = null; continue; }
    const st = blockStart(line);
    if (st) { cur = { ...st, lines: [line] }; blocks.push(cur); continue; }
    if (cur && cur.lines.length < MAX_BLOCK_LINES) cur.lines.push(line);
  }
  return blocks;
}

function parseDays(t) {
  t = t.replace(new RegExp(PATTERN_RE.source, "g"), " "); // ১+০+১ এর অঙ্ক যেন "দিন/সপ্তাহ"-এর সংখ্যা না হয়
  const w = t.match(WEEKS_RE), m = t.match(MONTHS_RE), d = t.match(DAYS_RE);
  const v = d ? Number(d[1]) : w ? Number(w[1]) * 7 : m ? Number(m[1]) * 30 : null;
  return v > 0 ? v : null;
}

function parseFrequency(t) {
  const p = toEn(t).match(PATTERN_RE);
  if (p) {
    const [m, d, n] = [p[1], p[2], p[3]];
    const on = [m, d, n].filter((x) => parseFloat(x) > 0).length;
    return { pattern: { m, d, n }, patternRaw: m + "+" + d + "+" + n, perDay: on, prn: false };
  }
  if (PRN_RE.test(t)) return { pattern: null, patternRaw: "প্রয়োজনে", perDay: null, prn: true };
  for (const [re, n] of FREQ_WORDS) {
    const m = t.match(re);
    if (m) return { pattern: null, patternRaw: m[0].toUpperCase(), perDay: n, prn: false };
  }
  const x = toEn(t).match(TIMES_RE); // (t ইতিমধ্যে ইংরেজি-অঙ্ক নয় — toEn নিরাপদ)
  if (x && Number(x[1]) >= 1 && Number(x[1]) <= 6) return { pattern: null, patternRaw: "দিনে " + x[1] + " বার", perDay: Number(x[1]), prn: false };
  return { pattern: null, patternRaw: null, perDay: null, prn: false };
}

const suspiciousName = (n) => !n || n.length < 3 || /[A-Za-z][0-9][A-Za-z]|[|{}\\^~_=<>]/.test(n);

function buildItem(b) {
  const raw = b.lines.join(" ");
  const nameCore = cutName(toEn(b.rest), PATTERN_RE, DAYS_RE, WEEKS_RE, MONTHS_RE, MEAL_BEFORE_RE, MEAL_AFTER_RE, PRN_RE, TIMES_RE, /দিনে/);
  const name = cleanName((b.form && !b.form.oral ? b.form.label + " " : "") + nameCore);
  const st = toEn(raw).match(STRENGTH_RE);
  const freq = parseFrequency(raw);
  const days = freq.prn ? null : parseDays(toEn(raw));
  const meal = MEAL_BEFORE_RE.test(raw) ? "before" : MEAL_AFTER_RE.test(raw) ? "after" : null;
  const confusions = findDoseConfusions(raw);
  const flags = [];
  if (!freq.patternRaw) flags.push("no-frequency");
  if (days === null && !freq.prn) flags.push("no-days");
  if (days !== null && days > 365) flags.push("days-too-long");
  if (confusions.length > 0) flags.push("ocr-confusable");
  if (suspiciousName(nameCore)) flags.push("name-suspicious");
  return {
    name, form: b.form ? b.form.label : null, strength: st ? st[1] + " " + st[2].toLowerCase() : null,
    ...freq, days, meal, raw, confusions, flags, clear: flags.length === 0,
    needsEvidence: !b.strong,
  };
}

/**
 * @returns {Array<{name, form, strength, pattern, patternRaw, perDay, prn, days, meal, raw, confusions, flags, clear}>}
 * শুধু-সংখ্যা-তালিকা-ভুক্তি ("1. Seborrhoic…") প্রমাণ (ডোজ/শক্তি/দিন) না পেলে বাদ।
 */
export function parsePrescriptionText(text) {
  return splitBlocks(text).map(buildItem)
    .filter((it) => it.name && (!it.needsEvidence || it.patternRaw || it.strength || it.days !== null))
    .map(({ needsEvidence, ...rest }) => rest);
}

/** এলার্জির সাথে নাম-মিল (ব্র্যান্ড-নামে ধরা না-ও পড়তে পারে)। মিললে এলার্জির substance, নইলে null */
export function matchAllergy(name, allergies) {
  const n = String(name || "").toLowerCase();
  const tokens = n.split(/[^a-zঀ-৿]+/).filter((w) => w.length >= 4);
  for (const a of allergies || []) {
    const s = String(a.substance || "").trim().toLowerCase();
    if (s.length < 3) continue;
    if (n.includes(s) || tokens.some((w) => s.includes(w))) return a.substance;
  }
  return null;
}

const baseName = (n) => String(n || "").toLowerCase().replace(/\s+/g, " ").trim();
/** একই সদস্যের এখনও-চলমান (মেয়াদ-শেষ নয়) ওষুধের সাথে একই নাম? */
export function findDuplicateMed(name, records, today) {
  const k = baseName(name);
  return (records || []).some((r) => r.resourceType === "medicationStatement" && baseName(r.genericName) === k && !(r.endDate && today > r.endDate));
}

/** রিমাইন্ডারের সময় — প্রেসক্রিপশনের ১+০+১ ধাঁচ থেকেই; প্যাটার্ন না থাকলে সংখ্যা-ভিত্তিক ডিফল্ট; প্রয়োজনে/অজানা হলে খালি */
export function reminderTimesFor(it) {
  if (it.prn) return [];
  if (it.pattern) return ["m", "d", "n"].filter((k) => parseFloat(it.pattern[k]) > 0).map((k) => SLOT_TIMES[k]);
  return it.perDay ? (DEFAULT_TIMES[it.perDay] || []) : [];
}

const MEAL_BN = { before: "খাবারের আগে", after: "খাবারের পরে" };
/** healthRecord-এর frequency টেক্সট: "১+০+১, খাবারের আগে" / "প্রয়োজনে" */
export function frequencyText(it) {
  const base = it.patternRaw ? toBn(it.patternRaw) : "";
  return [base, it.meal ? MEAL_BN[it.meal] : ""].filter(Boolean).join(", ") || null;
}

/** ব্যবহারকারীর সম্পাদিত প্যাটার্ন ("1+0+1") যাচাই; ঠিক না হলে null */
export function parsePatternInput(s) {
  const f = parseFrequency(String(s || ""));
  return f.pattern ? f : (f.perDay || f.prn ? f : null);
}

export const FLAG_LABELS_BN = {
  "no-frequency": "কয় বেলা পাওয়া যায়নি",
  "no-days": "কতদিন পাওয়া যায়নি",
  "days-too-long": "দিনের সংখ্যা অস্বাভাবিক — মিলিয়ে নিন",
  "ocr-confusable": "অক্ষর-ডিজিট গোলমাল হতে পারে",
  "name-suspicious": "নাম যাচাই করুন",
};
