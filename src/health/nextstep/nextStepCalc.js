// src/health/nextstep/nextStepCalc.js
//
// ধাপ ১০ (গ২) — "এরপর কী করবেন?" প্রস্তাবের pure হিসাব (React/Firestore নেই — unit-testable)।
// নীতি: প্রস্তাব শুধু প্রস্তাব — এখানে কিছুই লেখা/সংরক্ষণ হয় না; লেখা হয় ব্যবহারকারী বাটন চাপলে (nextStepData.js)।
// তারিখ শুধু প্রেসক্রিপশনের টেক্সটে যা লেখা সেটাই; অস্পষ্ট হলে ব্যবহারকারী কার্ডেই তারিখ ঠিক করতে পারেন।
// কোনো ডোজ/রায়/রোগনির্ণয় নেই।

import { FOODS } from "../tracker/mealPlanData.js";
import { medFoodNotes } from "../tracker/medFoodNotes.js";
import { LEVEL_WORD } from "../reports/labAlerts.js";

const BN = "০১২৩৪৫৬৭৮৯";
const toEn = (s) => String(s).replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  "জানুয়ারি": 1, "জানুয়ারী": 1, "ফেব্রুয়ারি": 2, "ফেব্রুয়ারী": 2, "মার্চ": 3, "এপ্রিল": 4, "মে": 5, "জুন": 6,
  "জুলাই": 7, "আগস্ট": 8, "সেপ্টেম্বর": 9, "অক্টোবর": 10, "নভেম্বর": 11, "ডিসেম্বর": 12,
};
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const KEY_RE = /follow[\s-]*up|\bf\/u\b|next\s*(visit|appointment|review)|re-?visit|review\s*(after|on|date)|ফলো[\s-]*আপ|আবার\s*দেখা|পুনরায়\s*(সাক্ষাৎ|দেখা)|পরবর্তী\s*(সাক্ষাৎ|ভিজিট)|দেখা\s*করবেন|সাক্ষাৎ/i;

const pad = (n) => String(n).padStart(2, "0");
export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
const dayDiff = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

// বৈধ তারিখ হলে "YYYY-MM-DD", নইলে null (যেমন ৩১ নভেম্বর)
function validISO(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return y + "-" + pad(m) + "-" + pad(d);
}
const fullYear = (y) => (y < 100 ? 2000 + y : y);

// একটা লাইন থেকে পূর্ণ/আংশিক তারিখ (বছর না থাকলে null-year ফেরে)
function absoluteIn(line, today) {
  const s = toEn(line);
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const iso = validISO(+m[1], +m[2], +m[3]); if (iso) return { iso, raw: m[0] }; }
  m = s.match(/(?<![\d])(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})(?![\d])/);
  if (m) {
    const a = +m[1], b = +m[2], y = fullYear(+m[3]);
    // বাংলাদেশে সাধারণত দিন/মাস/বছর; দ্বিতীয় সংখ্যা ১২-র বেশি হলে (মাস/দিন) উল্টে নেওয়া
    const iso = b > 12 && a <= 12 ? validISO(y, a, b) : validISO(y, b, a);
    if (iso) return { iso, raw: m[0] };
  }
  const re = new RegExp("(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s*(" + MONTH_ALT + ")\\.?,?\\s*(\\d{4})?", "i");
  m = s.match(re);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()] || MONTHS[m[2]];
    let y = m[3] ? +m[3] : +today.slice(0, 4);
    let iso = validISO(y, mon, +m[1]);
    if (iso && !m[3] && iso < today) iso = validISO(y + 1, mon, +m[1]); // বছর লেখা নেই ও পেরিয়ে গেছে → আগামী বছর
    if (iso) return { iso, raw: m[0].trim() };
  }
  return null;
}

// "৭ দিন পর" / "after 2 weeks" → দিন-সংখ্যা
function relativeDays(line) {
  const s = toEn(line);
  const unit = (u) => (/^(দিন|day)/i.test(u) ? 1 : /^(সপ্তাহ|week|wk)/i.test(u) ? 7 : /^(মাস|month|mo)/i.test(u) ? 30 : 0);
  let m = s.match(/(\d+)\s*(দিন|সপ্তাহ|মাস|days?|weeks?|wks?|months?)\s*(?:পর(?:ে)?|later|after)/i) || s.match(/after\s*(\d+)\s*(days?|weeks?|wks?|months?)/i);
  if (!m) return null;
  const n = +m[1] * unit(m[2]);
  return n >= 1 && n <= 365 ? { days: n, raw: m[0].trim() } : null;
}

/**
 * প্রেসক্রিপশনের টেক্সটে ফলো-আপ তারিখ খোঁজে।
 * @returns {{date: string, raw: string, line: string, relative: boolean}|null}
 *   relative=true মানে "N দিন পর" — আজ থেকে গুনে ধরা হয়েছে (প্রেসক্রিপশনের তারিখ জানা নেই), ব্যবহারকারীকে মিলিয়ে নিতে বলা হয়।
 */
export function extractFollowUpDate(text, today) {
  const lines = String(text || "").split(/\r?\n/);
  const limit = addDays(today, 366);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!KEY_RE.test(line)) continue;
    const next = lines[i + 1] && lines[i + 1].trim().length <= 60 ? lines[i + 1] : "";
    const abs = absoluteIn(line, today) || absoluteIn(next, today);
    if (abs) {
      if (abs.iso >= today && abs.iso <= limit) return { date: abs.iso, raw: abs.raw, line: line.trim(), relative: false };
      continue; // পুরনো/অযৌক্তিক দূরের তারিখ (OCR-ভুল হতে পারে) — প্রস্তাব নয়
    }
    const rel = relativeDays(line) || relativeDays(next);
    if (rel) return { date: addDays(today, rel.days), raw: rel.raw, line: line.trim(), relative: true };
  }
  return null;
}

/**
 * সেভ হওয়া ওষুধের মধ্যে যেগুলোর কোর্স ≥৪ দিন — শেষের ২ দিন আগের তারিখ।
 * কোর্স-শেষ = আজ + (দিন − ১) (prescriptionData.endDateFor-এর সাথে একই)।
 * @param {Array<{name: string, days: number|null}>} finals - অনুমোদিত আইটেম
 * @param {string[]} savedNames - এই সেশনে আসলে সেভ হওয়া নাম
 */
export function courseEndPlan(finals, savedNames, today) {
  const saved = new Set(savedNames || []);
  const out = [];
  (finals || []).forEach((f) => {
    if (!f || !saved.has(f.name) || !(f.days >= 4)) return;
    const endDate = addDays(today, f.days - 1);
    const remindDate = addDays(endDate, -2);
    if (remindDate <= today) return;
    out.push({ name: f.name, days: f.days, endDate, remindDate });
  });
  return out;
}

/** সেভ হওয়া ওষুধের নামে বিদ্যমান খাবার–ওষুধ নোটের (medFoodNotes) যেগুলো খাটে: [{ med, rule, text }] — নতুন দাবি নেই */
export function foodMedNoteItems(names) {
  const out = [];
  (names || []).forEach((med) => {
    const seen = new Set();
    for (const key of Object.keys(FOODS)) {
      for (const n of medFoodNotes([med], key)) {
        if (!seen.has(n.rule)) { seen.add(n.rule); out.push({ med, rule: n.rule, text: n.text }); }
      }
      if (seen.size >= 3) break;
    }
  });
  return out;
}

/** রিপোর্টের সতর্কতা থেকে ডাক্তার-নোটের সারাংশ: { count, names } — শুধু টেস্টের নাম ও দিক, মান নয়। alerts না থাকলে null */
export function doctorNoteSummary(alerts) {
  const list = Array.isArray(alerts) ? alerts.filter((a) => a && a.name) : [];
  if (list.length === 0) return null;
  const names = list.slice(0, 5).map((a) => a.name + (LEVEL_WORD[a.level] ? " " + LEVEL_WORD[a.level] : (a.level === "positive" ? " (Positive)" : "")));
  return { count: list.length, names };
}

// ছোট স্থির হ্যাশ (নামে বাংলা/স্পেস থাকলেও doc-ID নিরাপদ রাখতে)
export function shortHash(s) {
  let h = 5381;
  const str = String(s || "").trim().toLowerCase();
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// নির্দিষ্ট doc-ID — একই প্রস্তাব দুইবার চাপলে/আবার চালালেও ডুপ্লিকেট ইভেন্ট হয় না
export const followUpEventId = (memberId, date) => "ns_fu_" + memberId + "_" + date;
export const courseEndEventId = (memberId, name, endDate) => "ns_end_" + memberId + "_" + shortHash(name) + "_" + endDate;
export const doctorVisitEventId = (memberId, date) => "ns_dr_" + memberId + "_" + date;

export { dayDiff };
