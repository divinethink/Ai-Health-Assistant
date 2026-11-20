// অসুখের নাম-সাজেশন (pure; React/Firestore নেই)। ফর্মে "অসুখের নাম" লিখতে গেলে ট্যাপযোগ্য চিপ।
// সংরক্ষিত নাম = ইংরেজি নাম (বিদ্যমান রেকর্ড, খাদ্য-নিয়ম ও গাইডের সাথে একই); বাংলা/বিকল্প নাম শুধু খোঁজার জন্য।
// তালিকা শুধু নামের সাজেশন — কোনো রোগনির্ণয় বা পরামর্শ নেই।

// [ইংরেজি নাম, বাংলা নাম, ...বিকল্প]
const LIST = [
  ["Fever", "জ্বর"], ["Common cold", "সর্দি-কাশি", "cold", "cough", "কাশি", "সর্দি"], ["Headache", "মাথাব্যথা"],
  ["Migraine", "মাইগ্রেন"], ["Constipation", "কোষ্ঠকাঠিন্য", "কোষ্ঠ"], ["Diarrhea", "ডায়রিয়া", "পাতলা পায়খানা", "diarrhoea"],
  ["Gastritis", "গ্যাস্ট্রিক", "অম্বল", "gastric", "acidity", "বুকজ্বালা"], ["IBS", "আইবিএস", "irritable bowel syndrome"],
  ["GERD", "গ্যাস্ট্রিক রিফ্লাক্স", "acid reflux"], ["Peptic ulcer", "পেপটিক আলসার", "আলসার", "ulcer"],
  ["Piles", "পাইলস", "অর্শ", "hemorrhoids"], ["Diabetes", "ডায়াবেটিস", "sugar", "চিনির রোগ"],
  ["Hypertension", "উচ্চ রক্তচাপ", "high blood pressure", "প্রেশার", "bp"], ["High cholesterol", "উচ্চ কোলেস্টেরল", "cholesterol"],
  ["Heart disease", "হৃদরোগ", "হার্টের রোগ"], ["Thyroid", "থাইরয়েড", "hypothyroidism", "hyperthyroidism"],
  ["Hypothyroidism", "হাইপোথাইরয়েডিজম"], ["Asthma", "হাঁপানি", "এজমা"], ["Allergic rhinitis", "এলার্জিক সর্দি", "allergy"],
  ["Anemia", "রক্তস্বল্পতা", "anaemia"], ["PCOS", "পিসিওএস", "polycystic ovary"], ["Urinary tract infection", "মূত্রনালির সংক্রমণ", "uti"],
  ["Kidney stone", "কিডনিতে পাথর"], ["Kidney disease", "কিডনি রোগ"], ["Fatty liver", "ফ্যাটি লিভার"], ["Jaundice", "জন্ডিস"],
  ["Typhoid", "টাইফয়েড"], ["Dengue", "ডেঙ্গু"], ["Gout", "গাউট"], ["Arthritis", "বাত", "আর্থ্রাইটিস"], ["Osteoporosis", "হাড়ক্ষয়"],
  ["Back pain", "কোমর ব্যথা", "পিঠে ব্যথা", "backache"], ["Knee pain", "হাঁটুর ব্যথা"], ["Obesity", "স্থূলতা", "মোটা"],
  ["Pregnancy", "গর্ভাবস্থা"], ["Acne", "ব্রণ", "পিম্পল", "pimple"], ["Melasma", "মেছতা"], ["Hair fall", "চুল পড়া"],
  ["Insomnia", "অনিদ্রা", "ঘুমের সমস্যা"], ["Depression", "বিষণ্নতা"], ["Anxiety", "দুশ্চিন্তা", "উদ্বেগ"],
  ["Tonsillitis", "টনসিলাইটিস"], ["Sinusitis", "সাইনাসাইটিস", "sinus"], ["Pneumonia", "নিউমোনিয়া"], ["Eczema", "একজিমা"],
  ["Vitamin D deficiency", "ভিটামিন ডি-র ঘাটতি"], ["Dysmenorrhea", "মাসিকের ব্যথা", "period pain"], ["Mouth ulcer", "মুখের ঘা"],
];

const norm = (s) => String(s == null ? "" : s).toLowerCase().trim();

// query (ফর্মে লেখা), pastNames (এই সদস্যের আগের অসুখের নাম), limit → [নাম] (সংরক্ষণযোগ্য ইংরেজি/আগের নাম)
// খালি query-তে কিছু দেয় না; লেখা নামের সাথে হুবহু মিললে সাজেশন লাগে না।
export function suggestConditionNames(query, pastNames = [], limit = 6) {
  const q = norm(query);
  if (!q) return [];
  const rows = [];
  const seen = new Set();
  const push = (name, rank) => { const k = norm(name); if (!k || seen.has(k)) return; seen.add(k); rows.push({ name, rank }); };
  const score = (terms) => {
    let best = 9;
    terms.forEach((t) => { const n = norm(t); if (!n) return; if (n === q) best = Math.min(best, 0); else if (n.startsWith(q)) best = Math.min(best, 1); else if (n.split(/[\s/-]+/).some((w) => w.startsWith(q))) best = Math.min(best, 2); else if (q.length >= 3 && n.includes(q)) best = Math.min(best, 3); });
    return best;
  };
  (pastNames || []).forEach((n) => { const s = score([n]); if (s < 9) push(String(n).trim(), s - 0.5); });
  LIST.forEach(([en, ...rest]) => { const s = score([en, ...rest]); if (s < 9) push(en, s); });
  rows.sort((a, b) => a.rank - b.rank);
  const out = rows.map((r) => r.name);
  // লেখা নাম নিজেই পূর্ণ মিল হলে (শুধু সেটাই বাকি) সাজেশন দেখানোর দরকার নেই
  if (out.length === 1 && norm(out[0]) === q) return [];
  return out.slice(0, limit);
}
