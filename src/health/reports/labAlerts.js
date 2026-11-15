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
// রিপোর্টে কোষ-সংখ্যা সরাসরি লেখা হয় (৭৫৬০ /cumm); ডিকশনারিতে ×10³/µL (৭.৫৬) — তুলনায় ১০০০ দিয়ে ভাগ
const SCALE_UNITS = ["/cumm", "cumm", "/cmm", "cmm", "/mm3", "mm3", "/mm³", "mm³", "/µl", "µl", "/ul", "ul"];
// পুরুষ/নারীর আলাদা রেঞ্জ (ল্যাব-রিপোর্টের প্রচলিত মান)। ডিকশনারি-ডকে referenceRangeMale/Female থাকলে সেটাই আগে।
const SEX_RANGES = {
  hb: { male: { low: 13, high: 18 }, female: { low: 11.5, high: 16.5 } },
  esr: { male: { low: 0, high: 10 }, female: { low: 0, high: 20 } },
};

const POSITIVE_RE = /^(weakly\s+)?(positive|reactive|detected|পজিটিভ|রিঅ্যাকটিভ)/i;
const NEGATED_RE = /^(non[\s-]*reactive|not\s+detected|undetected)/i;

const normUnit = (u) => String(u || "").toLowerCase().replace(/μ/g, "µ").replace(/\s+/g, "");

function sameUnit(a, b) {
  const x = normUnit(a), y = normUnit(b);
  if (!x && !y) return true; // দুটোই এককহীন (S. Gravity, pH)
  if (!x || !y) return false;
  if (x === y) return true;
  return UNIT_GROUPS.some((g) => g.includes(x) && g.includes(y));
}

export function parseLabNumber(v) {
  const m = toEn(v).trim().match(/^([0-9]+(?:[.,][0-9]+)?)$/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

const isQualitative = (e) => e.kind === "qualitative" || (!e.kind && (!e.referenceRange || /^qualitative/i.test(e.unit || "")));

// প্রস্রাব-জাতীয় সারি: Nil/Negative/Absent = স্বাভাবিক; বাকি (Positive, Trace, +, ++ …) = সতর্কতা
const NORMAL_QUAL_RE = /^(nil|negative|absent|normal|not\s+detected|none)\b/i;
const MANY_RE = /^(plenty|numerous|many|loaded|packed)/i;
/** গণনা-মান থেকে উপরের সীমা: "Nil"→0, "4-5"→5, "3"→3, "+"-জাতীয়/অজানা→null */
export function countMax(v) {
  const t = toEn(String(v == null ? "" : v)).trim();
  if (/^(nil|absent|none|negative)\b/i.test(t)) return 0;
  const m = t.match(/^([0-9]+(?:\.[0-9]+)?)(?:\s*[-–]\s*([0-9]+(?:\.[0-9]+)?))?$/);
  return m ? parseFloat(m[2] || m[1]) : null;
}

const isThousandUnit = (u) => /10(\^3|³)/.test(normUnit(u));

/** টেস্টের পুরুষ/নারী/সাধারণ রেঞ্জ। split = দুই লিঙ্গের রেঞ্জ আলাদা */
export function rangesOf(e) {
  const s = (e && SEX_RANGES[e.id || e.testId]) || {};
  const male = (e && e.referenceRangeMale) || s.male || null;
  const female = (e && e.referenceRangeFemale) || s.female || null;
  return { male, female, common: (e && e.referenceRange) || null, split: !!(male && female) };
}

/** সদস্যের লিঙ্গ ("male"/"female") অনুযায়ী রেঞ্জ; লিঙ্গ অজানা হলে দুটোর বিস্তৃত সীমা (ভুল সতর্কতার চেয়ে নীরবতা নিরাপদ) */
export function rangeForSex(e, sex) {
  const r = rangesOf(e);
  if (!r.split) return r.common;
  if (sex === "male") return r.male;
  if (sex === "female") return r.female;
  return { low: Math.min(r.male.low, r.female.low), high: Math.max(r.male.high, r.female.high) };
}

/** রেকর্ডে ব্যবহারকারীর নিজের বসানো রেঞ্জ (refLow/refHigh, রেকর্ডের নিজের এককে) — দুটোই সংখ্যা হলে */
export function customRange(obs) {
  const lo = parseLabNumber(obs && obs.refLow), hi = parseLabNumber(obs && obs.refHigh);
  return lo !== null && hi !== null && lo <= hi ? { low: lo, high: hi } : null;
}

// ×10³/µL এককের টেস্টে মান /cumm-স্কেলে থাকলে ১০০০; নইলে null।
// পুরনো ভুল সেভ (একক ×10³/µL কিন্তু মান ৭৫৬০) — সংখ্যা ≥১০০০ হলে একইভাবে ধরা হয়।
function scaleOf(obsUnit, e, n) {
  if (!isThousandUnit(e.unit)) return null;
  if (SCALE_UNITS.includes(normUnit(obsUnit))) return 1000;
  return sameUnit(obsUnit, e.unit) && n >= 1000 ? 1000 : null;
}

const isGlucoseMmol = (obs, e) => GLUCOSE_IDS.includes(e.id || e.testId) && normUnit(obs.unit) === "mmol/l";

/** observation-এর type (নাম/synonym, বড়-ছোট হাত নির্বিশেষে হুবহু মিল) থেকে dictionary entry */
export function findDictEntry(type, dict) {
  const k = String(type || "").trim().toLowerCase();
  if (!k || !Array.isArray(dict)) return null;
  return dict.find((e) => [e.canonicalNameEn, e.canonicalName, ...(e.synonyms || [])]
    .some((n) => n && String(n).trim().toLowerCase() === k)) || null;
}

const shortName = (e) => e.shortName || (e.synonyms && e.synonyms[0]) || e.canonicalNameEn || e.id || "";

// ব্যবহারকারীর এককে রেঞ্জ ও মান: mmol/L গ্লুকোজ হলে mg/dL-এ নিয়ে তুলনা, /cumm হলে ১০০০ দিয়ে ভাগ; দেখানো হয় মূল এককেই।
// রেকর্ডের নিজস্ব রেঞ্জ (refLow/refHigh) থাকলে সেটাই (রেকর্ডের এককে) — ডিকশনারি/লিঙ্গ-রেঞ্জ ধরা হয় না।
function numericAlert(obs, e, n, sex) {
  const own = customRange(obs);
  const ref = own || rangeForSex(e, sex);
  if (!ref) return null;
  let cmp = n, show = ref;
  if (!own) {
    const k = scaleOf(obs.unit, e, n);
    if (k) {
      cmp = n / k;
      show = { low: ref.low * k, high: ref.high * k };
    } else if (!sameUnit(obs.unit, e.unit)) {
      if (!isGlucoseMmol(obs, e)) return null;
      cmp = n * MMOL_GLUCOSE;
      show = { low: Math.round((ref.low / MMOL_GLUCOSE) * 10) / 10, high: Math.round((ref.high / MMOL_GLUCOSE) * 10) / 10 };
    }
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
export function evaluateLabValue(obs, e, sex) {
  if (!obs || !e) return null;
  const raw = String(obs.value == null ? "" : obs.value).trim();
  const base = {
    testId: e.id || e.testId, name: shortName(e), value: raw, unit: obs.unit || "", range: null,
    recordId: obs.id || null, sourceDocId: obs.sourceDocId || null, sourceDocName: obs.sourceDocName || null,
  };
  if (e.kind === "qualitative") {
    return raw && !NORMAL_QUAL_RE.test(raw) ? { ...base, level: "positive" } : null;
  }
  if (e.kind === "count") {
    const own = customRange(obs) || e.referenceRange;
    if (!own) return null;
    if (MANY_RE.test(raw)) return { ...base, level: "high", range: own };
    const mx = countMax(raw);
    return mx !== null && mx > own.high ? { ...base, level: "high", range: own } : null;
  }
  if (isQualitative(e)) {
    return POSITIVE_RE.test(raw) && !NEGATED_RE.test(raw) ? { ...base, level: "positive" } : null;
  }
  const n = parseLabNumber(raw);
  if (n === null) return null;
  const r = numericAlert(obs, e, n, sex);
  return r ? { ...base, level: r.level, range: r.range } : null;
}

/**
 * "সতর্কতা সরান" (alertAck): সরানোর মুহূর্তের মান+একক+রেঞ্জের স্বাক্ষর রেকর্ডে থাকে।
 * মান/একক/রেঞ্জ বদলালে স্বাক্ষর মেলে না → সতর্কতা নিজে থেকে আবার আসে। পরিমাপের লাল রং এতে প্রভাবিত নয়।
 */
export const alertSig = (o) => [o && o.value, o && o.unit, o && o.refLow, o && o.refHigh].map((v) => String(v == null ? "" : v).trim()).join("|");
export const isAlertAcked = (o) => !!(o && o.alertAck && o.alertAck === alertSig(o));

/** observation-তালিকা থেকে সব সতর্কতা (ইনপুটের ক্রম বজায় থাকে); সরানো সতর্কতা বাদ */
export function buildLabAlerts(observations, dict, sex) {
  return (observations || [])
    .filter((o) => !isAlertAcked(o))
    .map((o) => evaluateLabValue(o, findDictEntry(o.type, dict), sex))
    .filter(Boolean);
}

/** একই টেস্টের একাধিক সেভ-করা মান থাকলে শুধু সর্বশেষটা (items নতুন→পুরনো ধরে) */
export function alertForGroup(items, dict, sex) {
  const latest = items && items[0];
  return latest ? evaluateLabValue(latest, findDictEntry(latest.type, dict), sex) : null;
}

export const LEVEL_WORD = { high: "বেশি", low: "কম", positive: "" };

const fmt = (x) => toBn(String(Math.round(x * 100) / 100));
export const bnCount = (n) => toBn(n);
// রেঞ্জের কোনো প্রান্ত দশমিক হলে দুটোই ১ দশমিকে (০.৪–৪.০), নইলে পূর্ণসংখ্যা (৯০–১২০)
const decs = (x) => ((String(x).split(".")[1] || "").length);
const fmtRange = (r) => {
  const dp = Math.max(decs(r.low), decs(r.high)); // ২+ দশমিকের রেঞ্জ (১.০১–১.০৩) কেটে ফেলা হয় না
  const d = (x) => (Number.isInteger(r.low) && Number.isInteger(r.high) ? fmt(x) : dp > 1 ? toBn(x.toFixed(Math.min(dp, 3))) : toBn((Math.round(x * 10) / 10).toFixed(1)));
  return d(r.low) + "–" + d(r.high);
};

/** ফর্মে দেখানোর রেঞ্জ-লাইন: "পুরুষ ১৩–১৮ · নারী ১১.৫–১৬.৫ g/dL" বা "৪–১১ ×10³/µL" (রেঞ্জ না থাকলে "") */
export function describeRangeBn(e) {
  if (!e) return "";
  const r = rangesOf(e), u = e.unit && !/^qualitative/i.test(e.unit) ? " " + e.unit : "";
  if (e.rangeText) return toBn(e.rangeText) + u; // যেমন S. Gravity ১.০১০–১.০৩০ (৩ দশমিক)
  if (r.split) return "পুরুষ " + fmtRange(r.male) + " · নারী " + fmtRange(r.female) + u;
  return r.common ? fmtRange(r.common) + u : "";
}

/** "TSH বেশি — ৮.২ (০.৪–৪.০)"; qualitative: "Dengue NS1 — Positive" */
export function alertLine(a) {
  const word = LEVEL_WORD[a.level];
  const head = a.name + (word ? " " + word : "");
  if (a.level === "positive") return head + " — " + a.value;
  const n = parseLabNumber(a.value);
  const rng = a.range && !(a.range.low === 0 && a.range.high === 0) ? " (" + fmtRange(a.range) + ")" : ""; // "Nil" প্রত্যাশিত হলে "(০–০)" দেখানো হয় না
  return head + " — " + (n === null ? a.value : /\.\d{3,}/.test(toEn(a.value)) ? toBn(toEn(a.value)) : fmt(n)) + rng;
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
export function summarizeSaved(observations, dict, sex) {
  const alerts = [], ok = [];
  let unchecked = 0;
  for (const o of observations || []) {
    const e = findDictEntry(o.type, dict);
    if (!e) { unchecked++; continue; }
    const a = evaluateLabValue(o, e, sex);
    if (a) { alerts.push(a); continue; }
    // রেঞ্জ-তুলনা সম্ভব ছিল কিনা: qualitative বা সংখ্যা + মেলা একক (বা গ্লুকোজ mmol)
    const comparable = e.kind === "count"
      ? (countMax(o.value) !== null || MANY_RE.test(String(o.value || "").trim()))
      : isQualitative(e)
      ? !!String(o.value || "").trim()
      : parseLabNumber(o.value) !== null && (!!customRange(o) || sameUnit(o.unit, e.unit) || isGlucoseMmol(o, e) || !!scaleOf(o.unit, e, parseLabNumber(o.value)));
    if (comparable) ok.push({ name: shortName(e), value: String(o.value).trim(), unit: o.unit || "" });
    else unchecked++;
  }
  return { alerts, ok, unchecked };
}
