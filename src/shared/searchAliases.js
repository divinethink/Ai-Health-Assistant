// দুই-ভাষার সার্চ (বাংলা/ইংলিশ/ব্র্যান্ড) — ফল সবসময় ইংলিশ নামে। pure data + ছোট helper; কোনো schema/rules বদল নেই।
// ⚠ ব্র্যান্ড→জেনেরিক তালিকা শুরুর সংস্করণ; সংরক্ষিত নাম সবসময় জেনেরিক (ডোজ-সেফটি জেনেরিকের ওপর চলে)।

const norm = (s) => String(s || "").trim().toLowerCase();

// ---------- খাবার ----------
// খাবারের key → ইংলিশ নাম
export const FOOD_EN = {
  roti: "Roti", rice: "Rice", dal: "Lentil soup (Dal)", veg: "Mixed vegetables", salad: "Salad", egg: "Boiled egg",
  fish: "Fish", chicken: "Chicken", banana: "Banana", muri: "Puffed rice (Muri)", tea: "Tea (no sugar)", greentea: "Green tea",
  porota: "Porota", pauruti: "Bread", khichuri: "Khichuri", polao: "Polao", biryaniChicken: "Chicken biryani", tehari: "Tehari / Kacchi",
  noodles: "Noodles", chira: "Flattened rice (soaked)", oats: "Oats", redRice: "Red rice", redRoti: "Whole-wheat roti", redChira: "Red flattened rice (soaked)",
  sujiHalua: "Semolina halwa", muriMakha: "Muri mix (low oil)", vegKhichuri: "Light vegetable khichuri", oatsVegKhichuri: "Oats-vegetable khichuri", ataPancake: "Wheat-veg pancake",
  aluBhorta: "Mashed potato (Alu bhorta)", aluBhaji: "Fried potato", shak: "Leafy greens (Shak)", begunBhaja: "Fried eggplant", korolaBhaji: "Bitter gourd fry",
  dherosBhaji: "Okra fry", chhola: "Chickpeas", mugDal: "Light moong dal", lau: "Bottle gourd", patol: "Pointed gourd", mishtiKumra: "Pumpkin",
  jhinge: "Ridge gourd", palongShak: "Spinach", kakrol: "Spiny gourd", kanchaKola: "Green banana", kochu: "Taro (Kochu)", vegSoup: "Vegetable soup",
  daalSoup: "Lentil soup", sprouts: "Sprouts", hilshaBhaja: "Fried hilsa", hilshaJhol: "Hilsa curry", ruiJhol: "Rohu fish curry", chotoMach: "Small fish",
  chingri: "Prawn", beef: "Beef", mutton: "Mutton", eggFry: "Fried egg", omelette: "Omelette", eggCurry: "Egg curry", eggWhite: "Egg white", eggYolk: "Egg yolk",
  eggVegBhuna: "Egg-vegetable bhuna", chickenJhol: "Light chicken curry", chickenSoup: "Chicken soup", seaFishJhol: "Sea fish curry", tofu: "Tofu",
  mango: "Mango", apple: "Apple", guava: "Guava", papaya: "Papaya", watermelon: "Watermelon", orange: "Orange", grapes: "Grapes", dates: "Dates",
  pineapple: "Pineapple", cucumber: "Cucumber", carrot: "Carrot", pomegranate: "Pomegranate", jam: "Java plum (Jam)", nashpati: "Pear",
  biscuit: "Biscuit", singara: "Samosa", piyaju: "Piyaju", beguni: "Beguni", aluChop: "Potato chop", fuchka: "Fuchka", chotpoti: "Chotpoti", badam: "Roasted peanuts",
  pitha: "Steamed pitha", payesh: "Payesh (rice pudding)", roshogolla: "Roshogolla", sondesh: "Sondesh", jilapi: "Jalebi", mishtiDoi: "Sweet yogurt", cake: "Cake",
  haleem: "Haleem", kathBadam: "Almond", akhrot: "Walnut", kajuBadam: "Cashew", kumraBeej: "Pumpkin seeds", tishi: "Flaxseed", isabgol: "Psyllium husk",
  oatsBiscuit: "Oats biscuit", honey: "Honey", milkTea: "Milk tea (with sugar)", milk: "Cow's milk", tokDoi: "Plain yogurt", dabWater: "Coconut water",
  sugarcane: "Sugarcane juice", lemonSharbat: "Lemonade (with sugar)", softDrink: "Soft drink", juice: "Packaged fruit juice", lassi: "Lassi",
  coffee: "Coffee (milk, sugar)", tonedMilk: "Toned / skim milk", tokDoi100: "Plain yogurt (100 g)", goldenWater: "Turmeric water",
  gingerTea: "Ginger / tulsi tea", redTea: "Black tea (no sugar)", lemonWater: "Lemon water (no sugar)", mintGingerWater: "Ginger-mint water",
};

// খাবারের key → বাড়তি সার্চ-শব্দ (বাংলিশ/সমার্থক); বাংলা নাম ও ইংলিশ নাম আলাদাভাবেই মেলে
export const FOOD_ALIAS = {
  rice: ["bhat", "vat", "chal", "ভাত"], roti: ["ruti", "chapati"], dal: ["daal", "lentil", "ডাল"], veg: ["sobji", "shobji", "vegetable", "তরকারি"],
  egg: ["dim", "ডিম"], fish: ["mach", "maach", "মাছ"], chicken: ["murgi", "মুরগি"], beef: ["goru", "গরু"], mutton: ["khashi", "খাসি"],
  banana: ["kola", "কলা"], mango: ["aam", "আম"], tea: ["cha", "চা"], milk: ["dudh", "দুধ"], tokDoi: ["doi", "দই", "yogurt", "yoghurt", "curd"],
  muri: ["murmura", "মুড়ি"], pauruti: ["bread", "pauruti", "paurooti", "পাউরুটি"], khichuri: ["khichdi", "khichri"], hilshaBhaja: ["ilish", "hilsha", "ইলিশ"], hilshaJhol: ["ilish", "hilsha", "ইলিশ"],
  chingri: ["shrimp", "chingri", "চিংড়ি"], papaya: ["pepe", "পেঁপে"], guava: ["peyara", "পেয়ারা"], watermelon: ["tormuj", "তরমুজ"], dabWater: ["dab", "ডাব"],
  singara: ["samosa"], jilapi: ["jalebi", "jilebi"], haleem: ["halim"], chhola: ["chola", "chana", "ছোলা"], shak: ["saag", "spinach", "শাক"],
};

// ---------- ওষুধ ----------
// জেনেরিক (COMMON_MEDS-এর হুবহু নাম) → [ব্র্যান্ড/বাংলা/বাংলিশ সার্চ-শব্দ]
export const MED_ALIAS = {
  "Paracetamol": ["Napa", "Napa Extra", "Ace", "Fast", "Reset", "নাপা", "প্যারাসিটামল", "paracetamol", "panadol"],
  "Ibuprofen": ["Brufen", "ইবুপ্রোফেন", "ব্রুফেন"],
  "Diclofenac": ["Voltaren", "ডাইক্লোফেনাক"],
  "Aspirin": ["Ecosprin", "অ্যাসপিরিন", "এসপিরিন"],
  "Esomeprazole": ["Sergel", "Maxpro", "সার্জেল", "ইসোমিপ্রাজল"],
  "Omeprazole": ["Seclo", "Losectil", "সেক্লো", "ওমিপ্রাজল"],
  "Pantoprazole": ["Pantonix", "প্যান্টোপ্রাজল"],
  "Domperidone": ["Motigut", "ডমপেরিডন"],
  "Ondansetron": ["Emistat", "অনডানসেট্রন"],
  "Antacid": ["Alu-mag", "অ্যান্টাসিড", "এন্টাসিড"],
  "Cetirizine": ["Alatrol", "সিটিরিজিন", "অ্যালাট্রল"],
  "Fexofenadine": ["Fexo", "Telfast", "ফেক্সো"],
  "Montelukast": ["Montair", "মন্টেয়ার"],
  "Salbutamol": ["Ventolin", "Windel", "সালবিউটামল"],
  "Azithromycin": ["Zimax", "Azithrocin", "জিম্যাক্স", "অ্যাজিথ্রোমাইসিন"],
  "Amoxicillin": ["Moxacil", "Amoxil", "মক্সাসিল", "অ্যামোক্সিসিলিন"],
  "Cefixime": ["Cef-3", "সেফিক্সিম"],
  "Ciprofloxacin": ["Ciprocin", "সিপ্রোফ্লক্সাসিন"],
  "Metronidazole": ["Flagyl", "Filmet", "ফিলমেট", "মেট্রোনিডাজল"],
  "Vitamin D3": ["ভিটামিন ডি", "vitamin d", "cholecalciferol"],
  "Vitamin C": ["ভিটামিন সি", "vitamin c", "ascorbic acid"],
  "Calcium": ["Ostocal", "ক্যালসিয়াম"],
  "Iron + Folic Acid": ["আয়রন", "iron", "ফলিক অ্যাসিড", "folic acid"],
  "Vitamin B Complex": ["Neuro-B", "ভিটামিন বি"],
  "Zinc Sulfate": ["জিংক", "zinc", "জিঙ্ক"],
  "ORS": ["ORSaline-N", "Saline", "স্যালাইন", "ওআরএস", "খাবার স্যালাইন"],
  "Metformin": ["Comet", "Glucophage", "মেটফরমিন"],
  "Insulin": ["ইনসুলিন"],
  "Amlodipine": ["Norvasc", "Amlo", "অ্যামলোডিপিন"],
  "Losartan": ["Angilock", "লোসার্টান"],
  "Atorvastatin": ["Atova", "Lipitor", "অ্যাটোরভাস্টাটিন"],
  "Levothyroxine": ["থাইরক্স", "levo thyroxine"],
  "Thyrox": ["থাইরক্স"],
  "Isabgol (Psyllium Husk)": ["ইসবগুল", "isabgol", "psyllium"],
  "Loperamide": ["Imodium", "লোপেরামাইড"],
  "Lactulose": ["ল্যাকটুলোজ"],
};

// ওষুধ-সাজেশন: q (ইনপুট) → [{ label, value }]; value সবসময় জেনেরিক। ব্র্যান্ড মিললে label = "Napa → Paracetamol"
// pool: জেনেরিক নামের তালিকা (knownNames + COMMON_MEDS)
export function suggestMedicines(pool, query, limit = 6) {
  const q = norm(query);
  if (!q) return [];
  const out = [];
  const seen = new Set();
  const add = (label, value) => { const k = norm(value); if (seen.has(k) || norm(value) === q) return; seen.add(k); out.push({ label, value }); };
  const startsFirst = (a, b) => (norm(a).startsWith(q) ? 0 : 1) - (norm(b).startsWith(q) ? 0 : 1);
  pool.filter((n) => norm(n).includes(q)).sort(startsFirst).forEach((n) => add(n, n));
  for (const [generic, aliases] of Object.entries(MED_ALIAS)) {
    if (!pool.some((n) => norm(n) === norm(generic))) continue;
    const hit = aliases.filter((a) => norm(a).includes(q)).sort(startsFirst)[0];
    if (hit) add(/^[\x00-\x7F]+$/.test(hit) ? hit + " → " + generic : generic, generic);
  }
  return out.slice(0, limit);
}

// ---------- খাবার ----------
export function foodEnglish(key, f) {
  return FOOD_EN[key] || (f && f.n) || key;
}

// খাবার মেলে কি না: বাংলা নাম, ইংলিশ নাম বা alias — যেকোনোটাতে
export function foodMatches(key, f, query) {
  const q = norm(query);
  if (!q) return true;
  if (norm(f.n).includes(q)) return true;
  if (norm(FOOD_EN[key]).includes(q)) return true;
  return (FOOD_ALIAS[key] || []).some((a) => norm(a).includes(q));
}
