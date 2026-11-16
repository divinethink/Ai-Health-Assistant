// "সাধারণ চিকিৎসা" ফর্মের pure সহায়ক — এক অসুখে একাধিক ওষুধ (UI/SDK ছাড়া; টেস্টযোগ্য)।
// প্রতিটি ওষুধ আলাদা রেকর্ড হয়ে সেভ হয় (বিদ্যমান স্কিমা অপরিবর্তিত)।
export const MAX_MEDS = 10;

// তিন ধারা: Allopathy (আগের মতো), Homeopathy, Herbal। রেকর্ডে ঐচ্ছিক `mode`; না থাকলে allopathy।
export const CARE_MODES = [["allopathy", "Allopathy"], ["homeopathy", "Homeopathy"], ["herbal", "Herbal"]];
export const MODE_NOUN = { allopathy: "ওষুধ", homeopathy: "ওষুধ", herbal: "ভেষজ" };
// ফর্মের ঘর: [ফিল্ড, লেবেল, উদাহরণ]
export const MODE_FIELDS = {
  allopathy: [["brand", "ওষুধের ব্র্যান্ড নাম", "যেমন: Napa"], ["generic", "জেনেরিক নাম", "যেমন: Paracetamol"], ["dose", "ডোজ (ডাক্তারের লেখা)", "যেমন: 500 mg"], ["frequency", "সেবনের মাত্রা", "যেমন: দিনে ৪ বার"], ["note", "নোট (ঐচ্ছিক)", "যেমন: শিশুর জন্য, ১০ কেজি"]],
  homeopathy: [["brand", "ওষুধের নাম", "যেমন: Arnica montana"], ["potency", "পটেন্সি", "যেমন: 30C, 200C, 6X"], ["dose", "মাত্রা (ডাক্তারের লেখা)", "যেমন: ৪ ফোঁটা বা ৫টি বড়ি"], ["frequency", "সেবনের নিয়ম", "যেমন: দিনে ২ বার, ৩ দিন"], ["note", "নোট (ঐচ্ছিক)", "যেমন: খাবারের আধা ঘণ্টা আগে"]],
  herbal: [["brand", "ভেষজের নাম", "যেমন: তুলসী পাতা"], ["prep", "ব্যবহারের ধরন", "যেমন: রস, কাথ, চা বা গুঁড়া"], ["dose", "পরিমাণ", "যেমন: ১ চা-চামচ"], ["frequency", "কতবার, কতদিন", "যেমন: দিনে ২ বার, ৫ দিন"], ["note", "নোট (ঐচ্ছিক)", "যেমন: মধু মিশিয়ে"]],
};
const FIELDS = ["brand", "generic", "dose", "frequency", "note", "potency", "prep"];
let seq = 0;

export function emptyMed() {
  return { key: "m" + Date.now().toString(36) + (seq++), brand: "", generic: "", dose: "", frequency: "", note: "", potency: "", prep: "" };
}
const t = (v) => (v || "").trim();
export const isMedBlank = (m) => !FIELDS.some((k) => t(m[k]));
export const filledMeds = (meds) => meds.filter((m) => !isMedBlank(m));
export const medTitle = (m) => [t(m.brand), t(m.generic) && (t(m.brand) ? "(" + t(m.generic) + ")" : t(m.generic))].filter(Boolean).join(" ");
export const medSummary = (m) => [medTitle(m), t(m.potency), t(m.prep), t(m.dose), t(m.frequency)].filter(Boolean).join(" · ");
// একই নামে ভিন্ন পটেন্সি (হোমিও) আলাদা ধরা হয়; অন্য ক্ষেত্রে potency ফাঁকা থাকায় আচরণ আগের মতোই
const sameKey = (m) => (t(m.brand) || t(m.generic)).toLowerCase() + "|" + t(m.potency).toLowerCase();

// → null (ঠিক আছে) | { msg, key } — key = যে ওষুধ-কার্ডে সমস্যা (কার্ড খুলে দেখানোর জন্য)
export function validateCareMeds(disease, meds, mode) {
  const noun = MODE_NOUN[mode] || "ওষুধ";
  const nameOnly = mode === "homeopathy" || mode === "herbal"; // এই দুই ধারায় জেনেরিক নেই; শুধু নাম
  if (!t(disease)) return { msg: "অসুখের নাম লিখুন।", key: null };
  const list = filledMeds(meds);
  if (list.length === 0) return { msg: "অন্তত একটি " + noun + " লিখুন।", key: meds[0] ? meds[0].key : null };
  for (const m of list) {
    if (nameOnly ? !t(m.brand) : (!t(m.brand) && !t(m.generic))) return { msg: noun + " " + (meds.indexOf(m) + 1) + (nameOnly ? ": নাম লিখুন।" : ": ব্র্যান্ড বা জেনেরিক নামের অন্তত একটা লিখুন।"), key: m.key };
  }
  const seen = new Set();
  for (const m of list) {
    const k = sameKey(m);
    if (seen.has(k)) return { msg: noun + " " + (meds.indexOf(m) + 1) + ": একই " + noun + " দুইবার আছে।", key: m.key };
    seen.add(k);
  }
  return null;
}

// আগে যোগ করা অসুখের নামের সাজেশন (ডুপ্লিকেট ছাড়া)
export function diseaseNames(groups) { return groups.map(([d]) => d).filter((d) => d !== "অন্যান্য"); }

export const toBn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
