// MyCare — যত্ন-প্রোফাইলের enum ও sanitize (pure)। firestore.rules-এর carePrefsOk-এর সাথে মেলাতে হবে
// (tests/mycare/prefs.test.mjs মিল যাচাই করে)। গভীর যাচাই এখানে; rules-এ শুধু ধরন/সীমা।
export const ENUMS = {
  skinType: ["oily", "dry", "normal", "combination", "sensitive"],
  hairType: ["oily", "dry", "normal", "curly"],
  skinConcerns: ["acne", "scars", "dryness", "irritation", "itching"],
  hairConcerns: ["dandruff", "itching", "oiliness", "hairfall", "dryness"],
  oralConcerns: ["gums", "sensitivity", "bad-breath", "stains", "dry-mouth"],
  preferences: ["general", "herbal", "ayurvedic", "budget"],
};
export const LIMITS = { concerns: 5, preferences: 4, avoidIngredients: 20, ingredientLen: 40, region: 30 };

// সংরক্ষিত পরামর্শ (ধাপ C): শুধু আইটেম-ID; sanitizeCarePrefs-এর অংশ নয়, যাতে প্রোফাইল সেভ এটা মুছে না ফেলে।
export const SAVED_LIMIT = 20;
const SAVED_ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
export function sanitizeSavedIds(v) {
  return Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && SAVED_ID_RE.test(x)))].slice(0, SAVED_LIMIT) : [];
}
// তালিকা বদল: আছে = সরানো; নেই = সামনে যোগ (সীমা পূর্ণ হলে full:true, তালিকা অপরিবর্তিত)
export function toggleSaved(ids, id) {
  const cur = sanitizeSavedIds(ids);
  if (cur.includes(id)) return { ids: cur.filter((x) => x !== id), full: false };
  if (!SAVED_ID_RE.test(String(id))) return { ids: cur, full: false };
  if (cur.length >= SAVED_LIMIT) return { ids: cur, full: true };
  return { ids: [id, ...cur], full: false };
}

const pick1 = (v, allowed) => (allowed.includes(v) ? v : null);
const pickN = (v, allowed, max) => (Array.isArray(v) ? [...new Set(v.filter((x) => allowed.includes(x)))].slice(0, max) : []);

export function sanitizeCarePrefs(raw) {
  const r = raw || {};
  const ing = Array.isArray(r.avoidIngredients)
    ? [...new Set(r.avoidIngredients.map((x) => String(x == null ? "" : x).trim().slice(0, LIMITS.ingredientLen)).filter(Boolean))].slice(0, LIMITS.avoidIngredients)
    : [];
  const region = typeof r.region === "string" && r.region.trim() ? r.region.trim().slice(0, LIMITS.region) : null;
  return {
    v: 1,
    skinType: pick1(r.skinType, ENUMS.skinType),
    hairType: pick1(r.hairType, ENUMS.hairType),
    skinConcerns: pickN(r.skinConcerns, ENUMS.skinConcerns, LIMITS.concerns),
    hairConcerns: pickN(r.hairConcerns, ENUMS.hairConcerns, LIMITS.concerns),
    oralConcerns: pickN(r.oralConcerns, ENUMS.oralConcerns, LIMITS.concerns),
    avoidIngredients: ing,
    preferences: pickN(r.preferences, ENUMS.preferences, LIMITS.preferences),
    region,
    breastfeeding: r.breastfeeding === true ? true : r.breastfeeding === false ? false : null,
  };
}
