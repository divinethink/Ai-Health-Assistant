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
  coffee: "Coffee (milk, sugar)", tonedMilk: "Packaged liquid milk (pasteurised / UHT)", tokDoi100: "Plain yogurt (100 g)", goldenWater: "Turmeric water",
  gingerTea: "Ginger / tulsi tea", redTea: "Black tea (no sugar)", lemonWater: "Lemon water (no sugar)", mintGingerWater: "Ginger-mint water",
  burger: "Burger",
  sandwich: "Sandwich",
  nimki: "Nimki",
  laddu: "Laddu",
  semai: "Sweet semai",
  lacchaSemai: "Laccha semai",
  shawarma: "Shawarma",
  pizza: "Pizza",
  ghee: "Ghee",
  blackCoffee: "Black coffee",
  pasta: "Pasta (boiled)",
  bakorkhani: "Bakarkhani (layered bread)",
  puriHome: "Puri (homemade)",
  breadHome: "Bread (homemade)",
  shimBhaji: "Fried flat beans (Shim)",
  borbotiBhaji: "Fried yardlong beans (Borboti)",
  mulaBhaji: "Fried radish (Mula)",
  lauBhaji: "Fried bottle gourd (Lau)",
  chalKumraBhaji: "Fried ash gourd (Chal kumra)",
  kanchaKolaKabab: "Raw banana kabab",
  dalSobjiSoup: "Lentil-vegetable mix soup",
  cholaBhuna: "Chickpea bhuna",
  tikkaKabab: "Chicken tikka kabab",
  chickenGrill: "Grilled chicken",
  chickenRoast: "Chicken roast (quarter)",
  chickenBhuna: "Chicken bhuna",
  chickenBBQ: "Chicken barbecue (BBQ)",
  patiSapta: "Patishapta pitha",
  singaraHome: "Samosa (homemade)",
  cakeHome: "Cake (homemade)",
  puddingHome: "Pudding (homemade custard)",
  mixDryFood: "Mixed nuts & seeds",
  muriChanachur: "Muri-chanachur mix",
  chiraBhaja: "Fried flattened rice (Chira bhaja)",
  falooda: "Falooda (homemade)",
  sobjiPakora: "Vegetable pakora",
  turmericTea: "Turmeric tea",
  herbTea: "Herbal / masala tea (no sugar)",
  puliPitha: "Puli pitha (steamed, coconut-jaggery)",
  pakonPitha: "Pakon pitha (fried, syrup-soaked)",
  telPitha: "Tel pitha / Handesh (fried)",
  talerPitha: "Taler pitha (palm fritter)",
  chitoiPitha: "Chitoi pitha (rice crumpet)",
  dudhChitoi: "Dudh chitoi pitha (in milk)",
  chapraPitha: "Chapra / Chapti pitha (savory rice crepe)",
  sujiLadduHome: "Suji laddu (homemade)",
  besanLadduHome: "Besan laddu (homemade)",
  patolBhaji: "Fried pointed gourd",
  kumraBhaji: "Fried pumpkin",
  pepeBhaji: "Green papaya fry",
  fulkopi: "Cauliflower curry",
  patakopi: "Fried cabbage",
  kolaBhorta: "Banana bhorta",
  lebu: "Lemon",
  malta: "Malta (sweet orange)",
  amloki: "Indian gooseberry (Amla)",
  kathal: "Jackfruit",
  tomato: "Tomato",
  sorputi: "Sarputi (Puntius) curry",
  poa: "Poa fish curry",
  rupchanda: "Pomfret (Rupchanda) curry",
  boal: "Boal (Wallago) curry",
  tengra: "Tengra (small catfish) curry",
  guraMach: "Tiny fish (Gura mach)",
  haansMansho: "Duck meat curry",
};

// খাবারের key → বাড়তি সার্চ-শব্দ (বাংলিশ/সমার্থক); বাংলা নাম ও ইংলিশ নাম আলাদাভাবেই মেলে
export const FOOD_ALIAS = {
  rice: ["bhat", "vat", "chal", "ভাত"], roti: ["ruti", "chapati"], dal: ["daal", "lentil", "ডাল"], veg: ["sobji", "shobji", "vegetable", "তরকারি"],
  egg: ["dim", "ডিম"], fish: ["mach", "maach", "মাছ"], chicken: ["murgi", "মুরগি"], beef: ["goru", "গরু"], mutton: ["khashi", "খাসি"],
  banana: ["kola", "কলা"], mango: ["aam", "আম"], tea: ["cha", "চা"], milk: ["dudh", "দুধ"], tonedMilk: ["dudh", "দুধ", "packet", "প্যাকেট", "liquid", "লিকুইড", "milk vita", "aarong"], tokDoi: ["doi", "দই", "yogurt", "yoghurt", "curd"],
  muri: ["murmura", "মুড়ি"], pauruti: ["bread", "pauruti", "paurooti", "পাউরুটি"], khichuri: ["khichdi", "khichri"], hilshaBhaja: ["ilish", "hilsha", "ইলিশ"], hilshaJhol: ["ilish", "hilsha", "ইলিশ"],
  chingri: ["shrimp", "chingri", "চিংড়ি"], papaya: ["pepe", "পেঁপে"], guava: ["peyara", "পেয়ারা"], watermelon: ["tormuj", "তরমুজ"], dabWater: ["dab", "ডাব"],
  singara: ["samosa"], jilapi: ["jalebi", "jilebi"], haleem: ["halim"], chhola: ["chola", "chana", "ছোলা"], shak: ["saag", "spinach", "শাক"],
  pasta: ["pasta", "পাস্তা", "spaghetti", "macaroni"],
  bakorkhani: ["bakarkhani", "bakorkhani", "bakhorkhani", "বাকরখানি"],
  puriHome: ["puri", "poori", "পুরি", "লুচি"],
  breadHome: ["bread", "homemade bread", "ব্রেড", "রুটি"],
  shimBhaji: ["shim", "sheem", "শিম", "flat beans", "hyacinth bean"],
  borbotiBhaji: ["borboti", "barbati", "বরবটি", "yardlong bean", "long bean"],
  mulaBhaji: ["mula", "moola", "মুলা", "radish", "mooli"],
  lauBhaji: ["lau", "laau", "লাউ", "bottle gourd", "lauki"],
  chalKumraBhaji: ["chal kumra", "chalkumra", "চাল কুমড়া", "ash gourd", "wax gourd", "chalkumro"],
  kanchaKolaKabab: ["kacha kola kabab", "raw banana kabab", "কলার কাবাব", "কাচা কলার কাবাব"],
  dalSobjiSoup: ["dal sobji soup", "mix soup", "ডাল সবজি স্যুপ", "dal vegetable soup"],
  cholaBhuna: ["chola bhuna", "cholar bhuna", "ছোলা ভুনা", "ছোলা ভূনা", "chana masala"],
  tikkaKabab: ["tikka", "tikka kabab", "chicken tikka", "টিক্কা", "কাবাব"],
  chickenGrill: ["grill", "grilled chicken", "chicken grill", "গ্রিল", "মুরগীর গ্রিল"],
  chickenRoast: ["roast", "chicken roast", "মুরগির রোস্ট", "রোস্ট", "quarter"],
  chickenBhuna: ["bhuna", "chicken bhuna", "মুরগি ভুনা", "মুরগীর ভুনা", "ভুনা"],
  chickenBBQ: ["bbq", "barbecue", "barbeque", "চিকেন বার্বিকিউ", "বারবিকিউ", "বিবিকিউ"],
  patiSapta: ["patishapta", "pati shapta", "patisapta", "পাটিসাপটা", "পিঠা"],
  singaraHome: ["singara", "samosa", "homemade singara", "সিংগারা", "সমুচা"],
  cakeHome: ["cake", "homemade cake", "কেক", "sponge cake"],
  puddingHome: ["pudding", "caramel pudding", "custard", "flan", "পুডিং"],
  mixDryFood: ["mix dry food", "dry food", "mixed nuts", "trail mix", "nuts seeds", "মিক্স বাদাম", "ড্রাই ফুড"],
  muriChanachur: ["muri chanachur", "jhalmuri", "jhal muri", "মুড়ি চানাচুর", "ঝালমুড়ি", "chanachur"],
  chiraBhaja: ["chira bhaja", "chira vaja", "চিড়া ভাজা", "চিড়ার মোয়া", "fried poha"],
  falooda: ["falooda", "faluda", "ফালুদা"],
  sobjiPakora: ["pakora", "pakoda", "pakura", "পাকোড়া", "সবজি পাকোড়া", "vegetable fritters"],
};

// বাড়তি সার্চ-বানান (বিদ্যমান ও নতুন খাবার) — FOOD_ALIAS-এর সাথে মেশে
const FOOD_ALIAS_MORE = {
  singara: ["সিংগাড়া", "সামুচা", "সমুচা", "samucha", "shingara"], sandwich: ["স্যান্ডুইচ", "স্যান্ডইউচ", "sandwitch"], burger: ["বার্গার", "burgar"],
  greentea: ["গ্রীণ টি", "green tea", "গ্রিন টি"], veg: ["সবজির তরকারি", "vegetables curry"], eggFry: ["ডিম ভজি", "ডিম ভাজা"], lau: ["লাউ এর তরকারি", "লাউয়ের তরকারি"],
  kakrol: ["কাকরোল ভাজি"], begunBhaja: ["বেগুন ভাজি"], nimki: ["nimkee", "namakpara"], laddu: ["ladoo", "laddoo", "লাড্ডু", "লাড্ডু"],
  semai: ["সেমাই", "shemai", "vermicelli"], lacchaSemai: ["লাচ্ছা", "laccha", "lachcha"], shawarma: ["শরমা", "শাওয়ারমা", "shawarma", "sharma"], pizza: ["পিৎজা", "pizza"],
  ghee: ["ঘি", "ghi"], blackCoffee: ["black coffee", "কালো কফি", "ব্ল্যাক কফি", "ব্লাক কফি"], turmericTea: ["হলুদ চা", "halud cha"], herbTea: ["হার্ব টি", "herbal tea", "মশলা চা", "মসলা চা", "masala tea", "masala chai", "masala cha"],
  patolBhaji: ["পটল ভাজি", "potol"], kumraBhaji: ["কুমড়া ভাজি", "kumra", "pumpkin fry"], pepeBhaji: ["পেঁপে ভাজি", "পেপে ভাজি", "pepe"], fulkopi: ["ফুলকপি", "fulkopi", "cauliflower"],
  patakopi: ["পাতা কপি", "বাঁধাকপি", "bandhakopi", "cabbage"], kolaBhorta: ["কলা ভর্তা", "kola bharta"], lebu: ["লেবু", "lemon", "lime"], malta: ["মাল্টা", "malta"],
  amloki: ["আমলকি", "amla", "amloki"], kathal: ["কাঁঠাল", "kathal"], tomato: ["টমেটো", "tomato"], sorputi: ["সরপুঁটি", "sarputi", "punti", "পুঁটি"],
  poa: ["পোয়া", "poa"], rupchanda: ["রুপচাঁদা", "rupchanda", "pomfret", "পমফ্রেট"], boal: ["বোয়াল", "boal"], tengra: ["টেংড়া", "টেংরা", "tengra"],
  guraMach: ["গুড়া মাছ", "গুঁড়া মাছ", "gura mach"], haansMansho: ["হাঁসের গোশত", "হাঁসের মাংস", "hash", "duck"],
  puliPitha: ["puli", "pulli", "পুলি", "ভাপা পুলি", "bhapa puli"], pakonPitha: ["pakon", "pakan", "pakoan", "পাকন", "পাকান"],
  telPitha: ["tel pitha", "teler pitha", "handesh", "হান্দেশ", "তেলের পিঠা", "গুড়ের হান্দেশ"], talerPitha: ["tal pitha", "taler pitha", "taler bora", "তাল", "তালের বড়া", "পাম"],
  chitoiPitha: ["chitoi", "chitui", "chitai", "চিতই", "চিতুই"], dudhChitoi: ["dudh chitoi", "dudh chitui", "দুধ চিতই", "দুধ চিতুই", "দুধ-চিতই"],
  chapraPitha: ["chapra", "chapri", "chapti", "চাপড়ি", "চাপটি", "চাপটি পিঠা", "ঝাল পিঠা"],
  sujiLadduHome: ["suji laddu", "suji ladoo", "rava laddu", "rava ladoo", "semolina laddu", "সুজি লাড্ডু", "সুজির লাড্ডু"], besanLadduHome: ["besan laddu", "besan ladoo", "gram flour laddu", "বেসন লাড্ডু", "বেসনের লাড্ডু"],
};
for (const [k, v] of Object.entries(FOOD_ALIAS_MORE)) FOOD_ALIAS[k] = [...(FOOD_ALIAS[k] || []), ...v];

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
