// "সাধারণ চিকিৎসা" ফর্মের pure সহায়ক — এক অসুখে একাধিক ওষুধ (UI/SDK ছাড়া; টেস্টযোগ্য)।
// প্রতিটি ওষুধ আলাদা রেকর্ড হয়ে সেভ হয় (বিদ্যমান স্কিমা অপরিবর্তিত)।
export const MAX_MEDS = 10;
const FIELDS = ["brand", "generic", "dose", "frequency", "note"];
let seq = 0;

export function emptyMed() {
  return { key: "m" + Date.now().toString(36) + (seq++), brand: "", generic: "", dose: "", frequency: "", note: "" };
}
const t = (v) => (v || "").trim();
export const isMedBlank = (m) => !FIELDS.some((k) => t(m[k]));
export const filledMeds = (meds) => meds.filter((m) => !isMedBlank(m));
export const medTitle = (m) => [t(m.brand), t(m.generic) && (t(m.brand) ? "(" + t(m.generic) + ")" : t(m.generic))].filter(Boolean).join(" ");
export const medSummary = (m) => [medTitle(m), t(m.dose), t(m.frequency)].filter(Boolean).join(" · ");
const sameKey = (m) => (t(m.brand) || t(m.generic)).toLowerCase();

// → null (ঠিক আছে) | { msg, key } — key = যে ওষুধ-কার্ডে সমস্যা (কার্ড খুলে দেখানোর জন্য)
export function validateCareMeds(disease, meds) {
  if (!t(disease)) return { msg: "অসুখের নাম লিখুন।", key: null };
  const list = filledMeds(meds);
  if (list.length === 0) return { msg: "অন্তত একটি ওষুধ লিখুন।", key: meds[0] ? meds[0].key : null };
  for (const m of list) {
    if (!t(m.brand) && !t(m.generic)) return { msg: "ওষুধ " + (meds.indexOf(m) + 1) + ": ব্র্যান্ড বা জেনেরিক নামের অন্তত একটা লিখুন।", key: m.key };
  }
  const seen = new Set();
  for (const m of list) {
    const k = sameKey(m);
    if (seen.has(k)) return { msg: "ওষুধ " + (meds.indexOf(m) + 1) + ": একই ওষুধ দুইবার আছে।", key: m.key };
    seen.add(k);
  }
  return null;
}

// আগে যোগ করা অসুখের নামের সাজেশন (ডুপ্লিকেট ছাড়া)
export function diseaseNames(groups) { return groups.map(([d]) => d).filter((d) => d !== "অন্যান্য"); }

export const toBn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
