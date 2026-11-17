// "সাধারণ চিকিৎসা" ফর্মের pure সহায়ক — এক অসুখে একাধিক ওষুধ (UI/SDK ছাড়া; টেস্টযোগ্য)।
// প্রতিটি ওষুধ আলাদা রেকর্ড হয়ে সেভ হয় (বিদ্যমান স্কিমা অপরিবর্তিত)।
export const MAX_MEDS = 10;

// তিন ধারা: Allopathy (আগের মতো), Homeopathy, Herbal। রেকর্ডে ঐচ্ছিক `mode`; না থাকলে allopathy।
export const CARE_MODES = [["allopathy", "Allopathy"], ["homeopathy", "Homeopathy"], ["herbal", "Herbal"]];
export const MODE_NOUN = { allopathy: "ওষুধ", homeopathy: "ওষুধ", herbal: "ভেষজ" };
// ফর্মের ঘর: [ফিল্ড, লেবেল, উদাহরণ]
export const MODE_FIELDS = {
  allopathy: [["brand", "ওষুধের ব্র্যান্ড নাম", "যেমন: Napa"], ["generic", "জেনেরিক নাম", "যেমন: Paracetamol"], ["dose", "ডোজ (ডাক্তারের লেখা)", "যেমন: 500 mg"], ["note", "নোট (ঐচ্ছিক)", "যেমন: শিশুর জন্য, ১০ কেজি"]],
  homeopathy: [["brand", "ওষুধের নাম", "যেমন: Arnica montana"], ["potency", "পটেন্সি", "যেমন: 30C, 200C, 6X"], ["dose", "মাত্রা (ডাক্তারের লেখা)", "যেমন: ৪ ফোঁটা বা ৫টি বড়ি"], ["note", "নোট (ঐচ্ছিক)", "যেমন: খাবারের আধা ঘণ্টা আগে"]],
  herbal: [["brand", "ভেষজের নাম", "যেমন: তুলসী পাতা"], ["prep", "ব্যবহারের ধরন", "যেমন: রস, কাথ, চা বা গুঁড়া"], ["dose", "পরিমাণ", "যেমন: ১ চা-চামচ"], ["note", "নোট (ঐচ্ছিক)", "যেমন: মধু মিশিয়ে"]],
};
const FIELDS = ["brand", "generic", "dose", "frequency", "note", "potency", "prep"]; // "blank কার্ড" চেনার জন্য শুধু লেখা-ঘর; চিপ নয়
let seq = 0;

export function emptyMed() {
  return { key: "m" + Date.now().toString(36) + (seq++), brand: "", generic: "", dose: "", frequency: "", note: "", potency: "", prep: "", pattern: [0, 0, 0], meal: "", days: null, asNeeded: false, ageGroup: "" };
}
const t = (v) => (v || "").trim();
export const isMedBlank = (m) => !FIELDS.some((k) => t(m[k]));
export const filledMeds = (meds) => meds.filter((m) => !isMedBlank(m));
export const medTitle = (m) => [t(m.brand), t(m.generic) && (t(m.brand) ? "(" + t(m.generic) + ")" : t(m.generic))].filter(Boolean).join(" ");
export const medSummary = (m) => [medTitle(m), m.ageGroup === "adult" ? "এডাল্ট" : m.ageGroup === "child" ? "শিশু" : "", t(m.potency), t(m.prep), t(m.dose), t(m.frequency)].filter(Boolean).join(" · ");
// একই নামে ভিন্ন পটেন্সি (হোমিও) আলাদা ধরা হয়; অন্য ক্ষেত্রে potency ফাঁকা থাকায় আচরণ আগের মতোই
const sameKey = (m) => (t(m.brand) || t(m.generic)).toLowerCase() + "|" + t(m.potency).toLowerCase() + "|" + (m.ageGroup || ""); // একই ওষুধ এডাল্ট ও শিশুর জন্য আলাদা ডোজে থাকতে পারে

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

// ── মানসম্মত মাত্রা (সকাল+দুপুর+রাত, খাবারের আগে/পরে, কতদিন) — pure; রেকর্ডে ঐচ্ছিক ফিল্ড pattern/meal/days, আর `frequency` এখান থেকে অটো-তৈরি ──
export const PATTERN_LABELS = { 3: ["সকাল", "দুপুর", "রাত"], 4: ["সকাল", "দুপুর", "বিকাল", "রাত"] }; // ৩ বেলা (ডিফল্ট) বা ৪ বেলা (১+১+১+১)
// ৩↔৪ বেলা বদলে "রাত" শেষেই থাকে; ৪-এ বিকাল (index 2) নতুন, ০ দিয়ে শুরু
export const togglePattern4 = (p) => (p.length === 4 ? [p[0], p[1], p[3]] : [p[0], p[1], 0, p[2]]);
export const PATTERN_COUNTS = [0, 1, 2, 3];
export const MEAL_TEXT = { before: "খাবারের আগে", after: "খাবারের পরে", any: "যেকোনো সময়" };
export const patternText = (p) => (Array.isArray(p) ? p : [0, 0, 0]).map((n) => toBn(n)).join("+");
export const patternFromString = (s) => (/^\d(\+\d){2,3}$/.test(s || "") ? s.split("+").map(Number) : [0, 0, 0]);
export const hasPattern = (p) => Array.isArray(p) && p.some((n) => n > 0);
// → "১+০+১ · খাবারের পরে · ৫ দিন" | "প্রয়োজনে · খাবারের পরে" | ""
export function composeFrequency(m) {
  const parts = [];
  if (m.asNeeded) parts.push("প্রয়োজনে");
  else if (hasPattern(m.pattern)) parts.push(patternText(m.pattern));
  if (m.meal && MEAL_TEXT[m.meal] && (m.asNeeded || hasPattern(m.pattern))) parts.push(MEAL_TEXT[m.meal]);
  if (!m.asNeeded && Number.isInteger(m.days)) parts.push(m.days === 0 ? "চলবে (নিয়মিত)" : toBn(m.days) + " দিন");
  return parts.join(" · ");
}

// বয়সগ্রুপ: একই অসুখে এডাল্ট ও শিশুর ডোজ আলাদা রাখতে। ""= সবার/অনির্দিষ্ট (পুরনো রেকর্ডও এটাই)
export const AGE_GROUPS = [["", "সবার"], ["adult", "👤 এডাল্ট"], ["child", "🧒 শিশু"]];
export const AGE_LABEL = { adult: "👤 এডাল্ট", child: "🧒 শিশু", "": "সবার" };
// অসুখের সারিগুলো বয়সগ্রুপ-অনুযায়ী: [[group, rows]] (এডাল্ট → শিশু → সবার); কোনো সারিতে বয়সগ্রুপ না থাকলে একটাই গ্রুপ (আগের মতো)
export function splitByAge(rows) {
  if (!rows.some((r) => r.ageGroup === "adult" || r.ageGroup === "child")) return [["", rows]];
  return ["adult", "child", ""].map((g) => [g, rows.filter((r) => (r.ageGroup === "adult" || r.ageGroup === "child" ? r.ageGroup : "") === g)]).filter(([, rs]) => rs.length);
}
