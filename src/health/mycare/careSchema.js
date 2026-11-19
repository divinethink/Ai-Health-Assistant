// MyCare — আইটেমের schema ও লেখার নিয়ম (pure; UI/DB-মুক্ত)। বিস্তারিত: MyCare_Plan.md §৮।
import { SEASONS } from "./careSeason.js";
export const CATEGORIES = ["skin", "hair", "oral", "body", "seasonal", "natural"];
export const AVOID_KEYS = ["pregnancy", "breastfeeding", "under18", "under2", "kidney", "liver"];
export const STATUSES = ["draft", "verified"];

// প্রথম সংস্করণে নিষিদ্ধ সক্রিয়/শক্ত উপাদান (প্ল্যান §১); পরে আলাদা অনুমোদনে।
export const BANNED_ACTIVES = [
  "retinol", "retinoid", "tretinoin", "adapalene", "isotretinoin", "hydroquinone", "salicylic", "glycolic",
  "benzoyl", "peroxide", "steroid", "clobetasol", "betamethasone", "hydrocortisone", "bleach", "mercury",
  "kojic", "arbutin", "minoxidil", "finasteride",
  "রেটিনল", "রেটিনয়েড", "হাইড্রোকুইনোন", "স্টেরয়েড", "ব্লিচ", "পারদ",
];

// Evidence Level ২/৩-এ নিষিদ্ধ শব্দ (Remedy-র নিয়মের মতো)
const FORBIDDEN_EN = /\b(cure[sd]?|proven|effective|guaranteed|heals?|treats?|solution)\b/i;
const FORBIDDEN_BN = ["নিরাময়", "প্রমাণিত", "কার্যকর", "সমাধান", "সারিয়ে"];

export function norm(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

const isBL = (o) => o && typeof o.bn === "string" && o.bn.trim() && typeof o.en === "string" && o.en.trim();

export function hasBannedActive(item) {
  const hay = [item.name && item.name.en, item.name && item.name.bn, ...(item.ingredientAliases || [])].map(norm).join(" | ");
  return BANNED_ACTIVES.find((b) => hay.includes(norm(b))) || null;
}

export function validateItem(item) {
  const e = [];
  if (!item || typeof item !== "object") return ["item নেই"];
  if (!item.id || typeof item.id !== "string") e.push("id দরকার");
  if (!CATEGORIES.includes(item.category)) e.push("category ভুল");
  if (!isBL(item.name)) e.push("name {bn,en} দরকার");
  if (!isBL(item.how)) e.push("how {bn,en} দরকার");
  if (!isBL(item.why)) e.push("why {bn,en} দরকার");
  if (![1, 2, 3].includes(item.evidenceLevel)) e.push("evidenceLevel ১/২/৩ হতে হবে");
  if (!STATUSES.includes(item.status)) e.push("status draft/verified হতে হবে");
  if (!Array.isArray(item.sources) || item.sources.length === 0) e.push("sources দরকার");
  else if (item.sources.some((s) => !s || !s.org)) e.push("প্রতি source-এ org দরকার");
  if (item.status === "verified" && !item.lastReviewed) e.push("verified আইটেমে lastReviewed দরকার");
  for (const k of ["avoidIf", "ingredientAliases", "forTypes", "forConcerns", "warnings"]) {
    if (item[k] != null && !Array.isArray(item[k])) e.push(k + " তালিকা হতে হবে");
  }
  const bad = (item.avoidIf || []).filter((k) => !AVOID_KEYS.includes(k));
  if (bad.length) e.push("avoidIf-এ অচেনা মান: " + bad.join(","));
  if (item.seasons != null && (!Array.isArray(item.seasons) || item.seasons.some((x) => !SEASONS.includes(x)))) e.push("seasons-এ অচেনা ঋতু");
  if (item.category === "seasonal" && !(Array.isArray(item.seasons) && item.seasons.length)) e.push("ঋতুভিত্তিক আইটেমে seasons দরকার");
  const banned = hasBannedActive(item);
  if (banned) e.push("নিষিদ্ধ উপাদান: " + banned);
  if (item.isCoreSafe && (item.evidenceLevel !== 1 || item.herbal)) e.push("মূল-নিরাপদ আইটেম স্তর ১ ও non-herbal হতে হবে");
  if (item.herbal || item.category === "natural") {
    if (item.evidenceLevel !== 3) e.push("ভেষজ/প্রাকৃতিক আইটেম ডিফল্টে স্তর ৩");
    if (item.heavyMetalWarning !== true) e.push("ভেষজে heavyMetalWarning:true দরকার");
  }
  if (item.evidenceLevel >= 2) {
    const text = [item.name, item.how, item.why].filter(Boolean).map((o) => (o.en || "")).join(" ");
    const textBn = [item.name, item.how, item.why].filter(Boolean).map((o) => (o.bn || "")).join(" ");
    if (FORBIDDEN_EN.test(text) || FORBIDDEN_BN.some((w) => textBn.includes(w))) e.push("স্তর ২/৩-এ নিষিদ্ধ শব্দ (কার্যকর/নিরাময়/প্রমাণিত/সমাধান)");
  }
  return e;
}
