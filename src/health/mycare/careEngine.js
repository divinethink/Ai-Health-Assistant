// MyCare — পরামর্শ ইঞ্জিন (pure; UI/DB/SDK-মুক্ত)। নিয়ম-ক্রম: MyCare_Plan.md §৭।
// recommend(profileRaw, items, { category, season, symptoms, concern, includeDraft }) →
//   { mode: "normal"|"core-only"|"referral", items:[{item, notes:[]}], notices:[], redFlags:[], hidden:{...}, safetyLine }
import { norm } from "./careSchema.js";
import { normalizeProfile, groupsOf, unknownsOf } from "./careGroups.js";
import { detectRedFlags } from "./careRedFlags.js";

export const SAFETY_LINE = {
  bn: "নতুন পণ্য আগে অল্প জায়গায় লাগিয়ে দেখুন। লালভাব, জ্বালা বা ফোস্কা হলে ব্যবহার বন্ধ করে পরামর্শ নিন।",
  en: "Patch test any new product first. Stop and seek advice if redness, burning or blisters appear.",
};
const N = {
  pediatric: { id: "under2", bn: "২ বছরের নিচের শিশুর যত্নে শিশু-চিকিৎসকের পরামর্শ নিন।", en: "For children under 2, ask a paediatrician." },
  coreOnly: { id: "core-only", bn: "কিছু তথ্য জানা নেই, তাই শুধু সবচেয়ে নিরাপদ সাধারণ পরামর্শ দেখানো হচ্ছে।", en: "Some details are unknown, so only the safest basic advice is shown." },
  under18: { id: "under18", bn: "১৮ বছরের নিচে শুধু মৃদু, সাধারণ পরামর্শ দেখানো হয়।", en: "Under 18: only gentle, basic advice is shown." },
  noAllergy: { id: "allergy-unknown", bn: "অ্যালার্জি জানা নেই — নতুন পণ্যে প্যাচ টেস্ট করুন।", en: "Allergies unknown — patch test new products." },
  herbal: { id: "heavy-metal", bn: "⚠ ভেষজ/আয়ুর্বেদিক পণ্যে ভারী ধাতু ও দূষণের ঝুঁকি থাকতে পারে; নিবন্ধিত উৎস থেকে নিন।", en: "⚠ Herbal/Ayurvedic products may contain heavy metals or contaminants; use registered sources." },
};

function allergyHit(profile, item) {
  const tokens = [...(profile.allergies || []), ...profile.avoidIngredients];
  if (!tokens.length) return false;
  const hay = [item.name && item.name.bn, item.name && item.name.en, ...(item.ingredientAliases || [])].map(norm).filter(Boolean);
  return tokens.some((t) => t.length >= 2 && hay.some((h) => h.includes(t) || (h.length >= 3 && t.includes(h))));
}

function typeOf(profile, category) {
  return category === "skin" ? profile.skinType : category === "hair" ? profile.hairType : null;
}

export function recommend(profileRaw, items, opts = {}) {
  const o = opts;
  const p = normalizeProfile(profileRaw);
  const hidden = { draft: 0, group: 0, allergy: 0, mismatch: 0 };
  const out = { mode: "normal", items: [], notices: [], redFlags: [], hidden, safetyLine: SAFETY_LINE };

  // ১. red flag সবার আগে
  out.redFlags = detectRedFlags(o.symptoms, o.category);
  if (out.redFlags.length) { out.mode = "referral"; return out; }

  // ২. ২ বছরের নিচে — শুধু রেফার
  const groups = groupsOf(p);
  if (groups.has("under2")) { out.mode = "referral"; out.notices.push(N.pediatric); return out; }

  let pool = (items || []).filter((i) => !o.category || i.category === o.category);

  // ৩. draft লুকানো
  if (!o.includeDraft) { const before = pool.length; pool = pool.filter((i) => i.status === "verified"); hidden.draft = before - pool.length; }

  // ৪. অজানা/১৮-র নিচে → শুধু মূল নিরাপদ সেট
  const unknown = unknownsOf(p);
  if (unknown.length || groups.has("under18")) {
    out.mode = "core-only";
    pool = pool.filter((i) => i.isCoreSafe === true);
    out.notices.push(groups.has("under18") ? N.under18 : N.coreOnly);
    if (unknown.includes("allergy")) out.notices.push(N.noAllergy);
  }

  // ৫. বিশেষ গ্রুপের নিষেধ
  let n = pool.length;
  pool = pool.filter((i) => !(i.avoidIf || []).some((k) => groups.has(k)));
  hidden.group = n - pool.length;

  // ৬. অ্যালার্জি/এড়াতে-চাই — কঠোর বাদ
  n = pool.length;
  pool = pool.filter((i) => !allergyHit(p, i));
  hidden.allergy = n - pool.length;

  // ৭. ধরন/সমস্যার সাথে মিল (ধরন অজানা হলে শুধু সর্বজনীন আইটেম)
  n = pool.length;
  const type = typeOf(p, o.category);
  pool = pool.filter((i) => {
    const ft = i.forTypes || [];
    if (ft.length && (!type || !ft.includes(type))) return false;
    if (o.category === "seasonal" && o.season && !(i.seasons || []).includes(o.season)) return false; // ঋতুভিত্তিক বিভাগে শুধু বর্তমান ঋতুর আইটেম
    const fc = i.forConcerns || [];
    if (o.concern && fc.length && !fc.includes(o.concern)) return false;
    return true;
  });
  hidden.mismatch = n - pool.length;

  // ৮. ক্রম: প্রমাণ-স্তর → কম পার্শ্বপ্রতিক্রিয়া → (পছন্দ/ঋতু শুধু tie-break)
  const bonus = (i) => (o.season && (i.seasons || []).includes(o.season) ? 1 : 0) + (p.preferences.includes("herbal") && i.herbal ? 1 : 0);
  pool.sort((a, b) =>
    a.evidenceLevel - b.evidenceLevel ||
    (a.sideEffectRank == null ? 2 : a.sideEffectRank) - (b.sideEffectRank == null ? 2 : b.sideEffectRank) ||
    bonus(b) - bonus(a) ||
    (a.id < b.id ? -1 : 1));

  out.items = pool.map((item) => ({ item, notes: item.herbal || item.heavyMetalWarning ? [N.herbal] : [] }));
  return out;
}
