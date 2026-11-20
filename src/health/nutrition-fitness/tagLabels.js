// খাদ্য-নির্দেশিকার কাঁচা ট্যাগ (overweight, ibs…) → ইউজারকে দেখানোর বাংলা লেবেল + আইকন।
// শুধু display — DB-র মান/matching অপরিবর্তিত (matchDietGuidanceForTags আগের মতোই কাঁচা ট্যাগে মেলে)।
// pure (React/Firestore নেই), unit-testable।

const L = (icon, text) => ({ icon, text });

const LABELS = {
  "acute kidney injury": L("🫘", "আকস্মিক কিডনি বিকল"),
  arthritis: L("🦴", "বাত/আর্থ্রাইটিস"),
  bph: L("🚻", "প্রোস্টেট বড় হওয়া"),
  "breast lump": L("🎗️", "স্তনের অক্ষতিকর চাকা"),
  "erectile dysfunction": L("🩺", "পুরুষের যৌন দুর্বলতা"),
  glomerulonephritis: L("🫘", "গ্লোমেরুলোনেফ্রাইটিস"),
  hydronephrosis: L("🫘", "হাইড্রোনেফ্রোসিস"),
  "kidney cyst": L("🫘", "কিডনিতে সিস্ট/টিউমার"),
  "male infertility": L("🩺", "পুরুষের বন্ধ্যাত্ব"),
  "polycystic kidney": L("🫘", "পলিসিস্টিক কিডনি"),
  prostatitis: L("🚻", "প্রোস্টেটের প্রদাহ"),
  pyelonephritis: L("🫘", "কিডনির সংক্রমণ"),
  "urinary incontinence": L("💧", "প্রস্রাব ধরে রাখতে সমস্যা"),
  anemia: L("🩸", "রক্তস্বল্পতা"),
  "common cold": L("🤧", "সর্দি-কাশি"),
  constipation: L("🚽", "কোষ্ঠকাঠিন্য"),
  dengue: L("🦟", "ডেঙ্গু"),
  diabetes: L("🍬", "ডায়াবেটিস"),
  diarrhea: L("💧", "ডায়রিয়া"),
  egg: L("🥚", "ডিমে অ্যালার্জি"),
  "fatty liver": L("🫀", "ফ্যাটি লিভার"),
  fever: L("🌡️", "জ্বর"),
  gastritis: L("🔥", "গ্যাস্ট্রিক"),
  gluten: L("🌾", "গ্লুটেন অ্যালার্জি"),
  gout: L("🦶", "গাউট"),
  "heart disease": L("❤️", "হৃদরোগ"),
  "high cholesterol": L("🧈", "উচ্চ কোলেস্টেরল"),
  hypertension: L("💓", "উচ্চ রক্তচাপ"),
  ibs: L("🩺", "পেটের সমস্যা (IBS)"),
  jaundice: L("🟡", "জন্ডিস"),
  "kidney disease": L("🫘", "কিডনি রোগ"),
  "kidney stone": L("🪨", "কিডনিতে পাথর"),
  migraine: L("🤕", "মাইগ্রেন"),
  milk: L("🥛", "দুধে অ্যালার্জি"),
  obese: L("⚖️", "স্থূলতা"),
  obesity: L("⚖️", "স্থূলতা"),
  osteoporosis: L("🦴", "হাড়ক্ষয়"),
  overweight: L("⚖️", "ওজন বেশি"),
  pcos: L("🌸", "PCOS"),
  peanut: L("🥜", "চিনাবাদামে অ্যালার্জি"),
  piles: L("🩹", "পাইলস"),
  pregnancy: L("🤰", "গর্ভাবস্থা"),
  shellfish: L("🦐", "শেলফিশে অ্যালার্জি"),
  thyroid: L("🦋", "থাইরয়েড"),
  typhoid: L("🌡️", "টাইফয়েড"),
  underweight: L("⚖️", "ওজন কম"),
  "urinary tract infection": L("💧", "মূত্রনালির সংক্রমণ"),
  "মূত্রনালি/প্রোস্টেটের সমস্যা": L("💧", "মূত্রনালির সংক্রমণ"),
  "কিডনিতে পাথর": L("🪨", "কিডনিতে পাথর"),
  // avoidRules.js-এর কোড-নিয়মের শিরোনাম — কোষ্ঠকাঠিন্য/গ্যাস্ট্রিক/IBS সবার জন্য একই সাধারণ নাম (নির্দিষ্ট রোগের নাম নয়)
  "পেটের সমস্যা": L("🩺", "পেটের সমস্যা"),
};

// tag: কাঁচা ট্যাগ বা ইতিমধ্যে-বাংলা শিরোনাম → { icon, text }। অজানা ট্যাগ যেমন আছে তেমনই (আইকন 🩺)।
export function tagLabel(tag) {
  const raw = String(tag == null ? "" : tag).trim();
  const hit = LABELS[raw.toLowerCase()];
  return hit ? { ...hit } : { icon: "🩺", text: raw };
}

// একটা খাবারের উৎস-তালিকা → অনন্য লেবেল-তালিকা (একই লেবেল একবার)। ≤১টা হলে খালি, কারণ একটাই উৎস হলে ওপরের ট্যাগই যথেষ্ট।
export function sourceLabels(sources) {
  const seen = new Set();
  const out = [];
  (sources || []).forEach((s) => {
    const l = tagLabel(s);
    if (l.text && !seen.has(l.text)) { seen.add(l.text); out.push(l); }
  });
  return out.length > 1 ? out : [];
}
