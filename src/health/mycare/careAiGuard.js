// MyCare — AI ব্যাখ্যা (ধাপ ৭): payload বানানো + উত্তর-যাচাই (pure; UI/SDK-মুক্ত)। পরিকল্পনা: MyCare_Plan.md §৯।
// নীতি: AI শুধু আইটেমের নিজের লেখা সহজ করে বলবে। নতুন সংখ্যা/ঘনত্ব, "নিরাময়/প্রমাণিত"-ধরনের শব্দ বা নিষিদ্ধ উপাদান এলে উত্তর ব্লক।
import { norm, BANNED_ACTIVES } from "./careSchema.js";

export const FALLBACK = {
  bn: "এই পরামর্শের সহজ ব্যাখ্যা এখন দেখানো যাচ্ছে না। উপরের বিস্তারিত অংশ দেখুন, প্রয়োজনে চিকিৎসকের পরামর্শ নিন।",
  en: "A simple explanation can't be shown right now. Please read the details above, and ask a doctor if needed.",
};

const FORBIDDEN = /(নিরাময়|প্রমাণিত|কার্যকর|সমাধান|সারিয়ে|সেরে\s*যা|\b(cure[sd]?|proven|effective|guaranteed|heals?|treats?|solution)\b)/i;
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const NUM_RE = /[0-9০-৯]+(?:[.,][0-9০-৯]+)?/g;
const UNIT_RE = /(?<![\p{L}\p{M}])(এক|দুই|দু|তিন|চার|পাঁচ|ছয়|সাত|আট|নয়|দশ)\s?(বার|বেলা|মিনিট|ঘণ্টা|ঘন্টা|দিন|সপ্তাহ|মাস|ফোঁটা|চামচ)|\b(one|two|three|four|five|six|seven|eight|nine|ten|twice|once)\s+(times?|minutes?|hours?|days?|weeks?|months?|drops?|spoons?)\b/giu;
const MAX_LEN = 1500;

const toLatin = (s) => String(s).replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
const numsOf = (s) => (toLatin(s).match(NUM_RE) || []).map((n) => n.replace(",", "."));
const textOf = (v) => (typeof v === "string" ? v : v && typeof v === "object" ? [v.bn, v.en].filter(Boolean).join(" ") : "");

// AI-কে শুধু এই আইটেমের লেখা যায়; নাম-পরিচয়, DOB, স্বাস্থ্য-রেকর্ড, প্রোফাইল কিছুই নয়।
export function buildExplainPayload(entry, lang) {
  const it = entry.item;
  const pick = (o) => (o ? (lang === "en" ? o.en : o.bn) || "" : "");
  const warnings = [...(it.warnings || []), ...(entry.notes || [])].map((w) => (typeof w === "string" ? w : pick(w))).filter(Boolean);
  return {
    kind: "mycare-explain",
    item: { name: pick(it.name), why: pick(it.why), how: pick(it.how), warnings, redFlagNote: it.redFlagNote ? (typeof it.redFlagNote === "string" ? it.redFlagNote : pick(it.redFlagNote)) : "" },
  };
}

export function buildExplainPrompt(lang) {
  return lang === "en"
    ? "Explain the care advice in the JSON (item) in very simple English, in 3-5 short sentences. Use ONLY what the item says. Do not add numbers, amounts, durations, product or brand names, medicines or new advice. Do not use words like cure, proven or effective. Do not end with a question."
    : "JSON-এর (item) যত্নের পরামর্শটি খুব সহজ বাংলায় ৩–৫টি ছোট বাক্যে বুঝিয়ে বলুন। শুধু আইটেমে যা লেখা আছে তা-ই বলুন। নতুন কোনো সংখ্যা, পরিমাণ, মেয়াদ, পণ্য/ব্র্যান্ডের নাম, ঔষধ বা নতুন পরামর্শ যোগ করবেন না। \"নিরাময়\", \"প্রমাণিত\", \"কার্যকর\"-ধরনের শব্দ নয়। শেষে কোনো প্রশ্ন করবেন না।";
}

// শেষের ফলো-আপ প্রশ্ন-লাইন ও বাড়তি ফাঁকা বাদ
export function cleanExplanation(text) {
  const lines = String(text == null ? "" : text).replace(/\r/g, "").split("\n").map((l) => l.trimEnd());
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length > 1 && /[?？]\s*$/.test(lines[lines.length - 1])) lines.pop();
  return lines.join("\n").trim();
}

// ফল: { ok:true, text } | { ok:false, reason }
export function validateExplanation(text, entry) {
  const out = cleanExplanation(text);
  if (!out) return { ok: false, reason: "empty" };
  if (out.length > MAX_LEN) return { ok: false, reason: "too-long" };
  if (FORBIDDEN.test(out)) return { ok: false, reason: "forbidden-word" };

  const it = entry.item;
  const src = [it.name, it.why, it.how, it.redFlagNote, ...(it.warnings || []), ...(entry.notes || [])].map(textOf).join(" ");
  const srcNums = new Set(numsOf(src));
  if (numsOf(out).some((n) => !srcNums.has(n))) return { ok: false, reason: "new-number" };

  const srcN = norm(src);
  const units = out.match(UNIT_RE) || [];
  if (units.some((u) => !srcN.includes(norm(u)))) return { ok: false, reason: "new-quantity" };

  const outN = norm(out);
  if (BANNED_ACTIVES.some((b) => outN.includes(norm(b)) && !srcN.includes(norm(b)))) return { ok: false, reason: "banned-active" };
  return { ok: true, text: out };
}

// ask = askAI-র মতো ফাংশন (UI থেকে দেওয়া — এখানে SDK নেই)। কখনো throw করে না।
// ফল: { ok:true, text } | { ok:false, reason: "blocked"|"unavailable"|<validator reason>, fallback }
export async function explainWith(ask, familyId, entry, lang, options = {}) {
  try {
    const data = await ask(familyId, buildExplainPayload(entry, lang), [{ role: "user", content: buildExplainPrompt(lang) }], options);
    if (!data || data.blocked) return { ok: false, reason: "blocked", fallback: FALLBACK };
    const v = validateExplanation(data.content, entry);
    return v.ok ? v : { ...v, fallback: FALLBACK };
  } catch (e) {
    return { ok: false, reason: "unavailable" };
  }
}
