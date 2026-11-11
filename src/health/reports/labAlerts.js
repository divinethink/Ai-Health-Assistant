// src/health/reports/labAlerts.js
//
// ধাপ ৫ — ল্যাব রিপোর্টে "লাল লাইন": সংরক্ষিত/যাচাই-করা মান testNameDictionary-র রেঞ্জের সাথে
// মিলিয়ে সতর্কতা বানায়। Pure logic — Firestore/DOM নেই, নতুন ডেটা সংরক্ষণ হয় না
// (সেভ-করা মান থেকে প্রতিবার হিসাব)। রোগনির্ণয়ের ভাষা নয়: "বেশি/কম — ডাক্তারকে দেখান"।
// শুধু dictionary-র পরিচিত টেস্টে কাজ করে; নাম বা একক না মিললে চুপ থাকে (ভুল সতর্কতার চেয়ে নীরবতা নিরাপদ)।

const BN = "০১২৩৪৫৬৭৮৯";
const toBn = (s) => String(s).replace(/[0-9]/g, (d) => BN[d]);
const toEn = (s) => String(s).replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

// একটা দিকই অর্থবহ এমন টেস্ট (উচ্চ HDL/eGFR ভালো — "বেশি" বলে ভয় দেখানো হবে না)
const ONE_SIDED = { hdl: "low", egfr: "low" };
// গ্লুকোজ mmol/L → mg/dL
const MMOL_GLUCOSE = 18.016;
const GLUCOSE_IDS = ["fbs", "rbs"];
// সমতুল্য একক (লোয়ারকেস, স্পেস ছাড়া)
const UNIT_GROUPS = [["miu/l", "µiu/ml", "uiu/ml"]];

const POSITIVE_RE = /^(weakly\s+)?(positive|reactive|detected|পজিটিভ|রিঅ্যাকটিভ)/i;
const NEGATED_RE = /^(non[\s-]*reactive|not\s+detected|undetected)/i;

const normUnit = (u) => String(u || "").toLowerCase().replace(/μ/g, "µ").replace(/\s+/g, "");

function sameUnit(a, b) {
  const x = normUnit(a), y = normUnit(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return UNIT_GROUPS.some((g) => g.includes(x) && g.includes(y));
}

export function parseLabNumber(v) {
  const m = toEn(v).trim().match(/^([0-9]+(?:[.,][0-9]+)?)$/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

const isQualitative = (e) => !e.referenceRange || /^qualitative/i.test(e.unit || "");

/** observation-এর type (নাম/synonym, বড়-ছোট হাত নির্বিশেষে হুবহু মিল) থেকে dictionary entry */
export function findDictEntry(type, dict) {
  const k = String(type || "").trim().toLowerCase();
  if (!k || !Array.isArray(dict)) return null;
  return dict.find((e) => [e.canonicalNameEn, e.canonicalName, ...(e.synonyms || [])]
    .some((n) => n && String(n).trim().toLowerCase() === k)) || null;
}

const shortName = (e) => (e.synonyms && e.synonyms[0]) || e.canonicalNameEn || e.id || "";

// ব্যবহারকারীর এককে রেঞ্জ ও মান: mmol/L গ্লুকোজ হলে mg/dL-এ নিয়ে তুলনা, দেখানো হয় মূল এককেই
function numericAlert(obs, e, n) {
  let ref = e.referenceRange, cmp = n, show = ref;
  if (!sameUnit(obs.unit, e.unit)) {
    const glucose = GLUCOSE_IDS.includes(e.id || e.testId) && normUnit(obs.unit) === "mmol/l";
    if (!glucose) return null;
    cmp = n * MMOL_GLUCOSE;
    show = { low: Math.round((ref.low / MMOL_GLUCOSE) * 10) / 10, high: Math.round((ref.high / MMOL_GLUCOSE) * 10) / 10 };
  }
  const side = ONE_SIDED[e.id || e.testId];
  let level = null;
  if (cmp < ref.low && side !== "high") level = "low";
  else if (cmp > ref.high && side !== "low") level = "high";
  return level ? { level, range: show } : null;
}

/**
 * একটা observation থেকে সতর্কতা (না থাকলে null)।
 * @returns {{testId, name, level: "high"|"low"|"positive", value: string, unit: string, range: object|null}|null}
 */
export function evaluateLabValue(obs, e) {
  if (!obs || !e) return null;
  const raw = String(obs.value == null ? "" : obs.value).trim();
  const base = { testId: e.id || e.testId, name: shortName(e), value: raw, unit: obs.unit || "", range: null };
  if (isQualitative(e)) {
    return POSITIVE_RE.test(raw) && !NEGATED_RE.test(raw) ? { ...base, level: "positive" } : null;
  }
  const n = parseLabNumber(raw);
  if (n === null) return null;
  const r = numericAlert(obs, e, n);
  return r ? { ...base, level: r.level, range: r.range } : null;
}

/** observation-তালিকা থেকে সব সতর্কতা (ইনপুটের ক্রম বজায় থাকে) */
export function buildLabAlerts(observations, dict) {
  return (observations || [])
    .map((o) => evaluateLabValue(o, findDictEntry(o.type, dict)))
    .filter(Boolean);
}

/** একই টেস্টের একাধিক সেভ-করা মান থাকলে শুধু সর্বশেষটা (items নতুন→পুরনো ধরে) */
export function alertForGroup(items, dict) {
  const latest = items && items[0];
  return latest ? evaluateLabValue(latest, findDictEntry(latest.type, dict)) : null;
}

export const LEVEL_WORD = { high: "বেশি", low: "কম", positive: "" };

const fmt = (x) => toBn(String(Math.round(x * 100) / 100));
export const bnCount = (n) => toBn(n);
// রেঞ্জের কোনো প্রান্ত দশমিক হলে দুটোই ১ দশমিকে (০.৪–৪.০), নইলে পূর্ণসংখ্যা (৯০–১২০)
const fmtRange = (r) => {
  const d = (x) => (Number.isInteger(r.low) && Number.isInteger(r.high) ? fmt(x) : toBn((Math.round(x * 10) / 10).toFixed(1)));
  return d(r.low) + "–" + d(r.high);
};

/** "TSH বেশি — ৮.২ (০.৪–৪.০)"; qualitative: "Dengue NS1 — Positive" */
export function alertLine(a) {
  const word = LEVEL_WORD[a.level];
  const head = a.name + (word ? " " + word : "");
  if (a.level === "positive") return head + " — " + a.value;
  const n = parseLabNumber(a.value);
  const rng = a.range ? " (" + fmtRange(a.range) + ")" : "";
  return head + " — " + (n === null ? a.value : fmt(n)) + rng;
}

/** সর্বোচ্চ `max` টা দেখানো, বাকিগুলো "আরও N টি" */
export function summarizeAlerts(alerts, max = 3) {
  const list = alerts || [];
  return { total: list.length, shown: list.slice(0, max), more: Math.max(0, list.length - max) };
}

/**
 * সেভ-করা মান → ট্র্যাফিক-লাইট সারাংশ। alerts = 🔴, ok = 🟢 (dictionary-তে পরিচিত + রেঞ্জের ভেতরে),
 * unchecked = dictionary-তে নেই/একক-মান না মেলায় যাচাই করা যায়নি (চুপ থাকে, "ঠিক" বলা হয় না)।
 */
export function summarizeSaved(observations, dict) {
  const alerts = [], ok = [];
  let unchecked = 0;
  for (const o of observations || []) {
    const e = findDictEntry(o.type, dict);
    if (!e) { unchecked++; continue; }
    const a = evaluateLabValue(o, e);
    if (a) { alerts.push(a); continue; }
    // রেঞ্জ-তুলনা সম্ভব ছিল কিনা: qualitative বা সংখ্যা + মেলা একক (বা গ্লুকোজ mmol)
    const comparable = isQualitative(e)
      ? !!String(o.value || "").trim()
      : parseLabNumber(o.value) !== null && (sameUnit(o.unit, e.unit) || (GLUCOSE_IDS.includes(e.id || e.testId) && normUnit(o.unit) === "mmol/l"));
    if (comparable) ok.push({ name: shortName(e), value: String(o.value).trim(), unit: o.unit || "" });
    else unchecked++;
  }
  return { alerts, ok, unchecked };
}
