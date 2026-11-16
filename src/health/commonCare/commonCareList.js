// "সাধারণ চিকিৎসা" — সবার জন্য স্থির শুরুর তালিকা (কোডে আছে, Firestore-এ নয়)।
// নিয়ম: এখানে কোনো ডোজ/মাত্রা নেই — শুধু অসুখ, জেনেরিক নাম ও উদাহরণ-ব্র্যান্ড।
// ডোজ ও সেবনের মাত্রা সদস্য নিজে ডাক্তারের পরামর্শ থেকে লিখবেন (Roadmap §১২: অ্যাপ ডোজ বানায় না)।
// ব্র্যান্ড-নাম searchAliases.js-এর MED_ALIAS-এর সাথে মেলানো (MED_ALIAS-এ না থাকলে ব্র্যান্ড ফাঁকা)। ফার্মাসিস্ট রিভিউ হয়নি (draft)।
export const COMMON_CARE_DEFAULTS = [
  { key: "fever", disease: "জ্বর / গায়ে ব্যথা", generic: "Paracetamol", brands: ["Napa", "Ace", "Reset"], note: "৩ দিনের বেশি জ্বর থাকলে ডাক্তার দেখান। ডেঙ্গুর সন্দেহে Ibuprofen/Diclofenac জাতীয় ব্যথানাশক নয়।" },
  { key: "headache", disease: "মাথাব্যথা", generic: "Paracetamol", brands: ["Napa", "Ace"], note: "বারবার হলে বা তীব্র হলে ডাক্তার দেখান।" },
  { key: "cold-allergy", disease: "ঠান্ডা / এলার্জি / হাঁচি", generic: "Fexofenadine", brands: ["Fexo", "Telfast"], note: "বিকল্প: Cetirizine (Alatrol)। ঘুম ঘুম লাগতে পারে।" },
  { key: "gastric", disease: "গ্যাস্ট্রিক / বুক জ্বালা", generic: "Omeprazole", brands: ["Seclo", "Losectil"], note: "বিকল্প: Esomeprazole (Sergel, Maxpro)। দীর্ঘদিন নিজে নিজে নয়।" },
  { key: "nausea", disease: "বমি বমি ভাব", generic: "Domperidone", brands: ["Motigut"], note: "ডাক্তারের পরামর্শমতো ও অল্প সময়ের জন্য।" },
  { key: "diarrhoea", disease: "পাতলা পায়খানা", generic: "ORS", brands: ["ORSaline-N"], note: "আগে খাবার স্যালাইন। পায়খানায় রক্ত বা জ্বর থাকলে ডাক্তার। বিকল্প: Zinc।" },
  { key: "constipation", disease: "কোষ্ঠকাঠিন্য", generic: "Isabgol (Psyllium Husk)", brands: ["ইসবগুল"], note: "পানি ও আঁশযুক্ত খাবার আগে। বিকল্প: Lactulose।" },
  // ── নতুন ২০টি: প্রকল্পের Medicine DB-র Tier ১ (otc-self-care) থেকে; উৎস WHO-EML ও BNFC। সতর্কতা-নোট DB-র contraindications থেকে নেওয়া। ──
  { key: "acidity-mild", disease: "হালকা অম্বল / বুক জ্বালা", generic: "Antacid (Al(OH)3 + Mg(OH)2)", brands: ["Alu-mag"], note: "কিডনির গুরুতর সমস্যায় নয়। বুকে চাপ/ব্যথা হলে হৃদরোগের সম্ভাবনা ভেবে জরুরি সেবা।" },
  { key: "gas-bloating", disease: "গ্যাস / পেট ফাঁপা", generic: "Antacid + Simethicone", brands: [], note: "কিডনির গুরুতর সমস্যায় নয়। তীব্র ব্যথা, বমি বা পায়খানা বন্ধ হলে ডাক্তার।" },
  { key: "indigestion", disease: "বদহজম / পেট ভারী", generic: "Itopride", brands: [], note: "পেটে রক্তক্ষরণ, বাধা বা ছিদ্রের সন্দেহে নয়। বারবার হলে ডাক্তার।" },
  { key: "kid-diarrhoea-zinc", kid: true, disease: "শিশুর পাতলা পায়খানা (ORS-এর সাথে)", generic: "Zinc Sulfate", brands: [], note: "WHO-র নির্দেশনায় ORS-এর পাশে জিংক। মাত্রা শিশুর বয়স/ওজন অনুযায়ী ডাক্তার/ফার্মাসিস্টের কাছ থেকে নিন। রক্ত, জ্বর বা পানিশূন্যতায় ডাক্তার।" },
  { key: "diarrhoea-adult", disease: "পাতলা পায়খানা (প্রাপ্তবয়স্ক)", generic: "Loperamide", brands: ["Imodium"], note: "জ্বর বা রক্তমিশ্রিত পায়খানায় নয়। ১২ বছরের নিচে সাধারণত নয়। আগে ORS।" },
  { key: "constipation-lactulose", disease: "কোষ্ঠকাঠিন্য (আরেকটি বিকল্প)", generic: "Lactulose", brands: [], note: "পেটে বাধার সন্দেহে নয়। ৭ দিনের বেশি সমস্যা বা মলে রক্ত হলে ডাক্তার।" },
  { key: "piles", disease: "পাইলস / মলদ্বারে জ্বালা (বাহ্যিক ক্রিম)", generic: "Hydrocortisone + Local Anaesthetic (ক্রিম)", brands: [], note: "ত্বকে সংক্রমণ থাকলে নয়। ৪০+ বয়সে নতুন রক্তক্ষরণ হলে সবসময় ডাক্তার।" },
  { key: "dry-cough", disease: "শুকনো কাশি", generic: "Dextromethorphan", brands: [], note: "কফওয়ালা কাশিতে নয়। MAO-inhibitor জাতীয় ওষুধ চললে নয়। হাঁপানি/COPD-তে সতর্কতা; ডাক্তারের পরামর্শ ছাড়া শিশুকে নয়।" },
  { key: "wet-cough", disease: "কফওয়ালা কাশি", generic: "Ambroxol", brands: [], note: "ওষুধে এলার্জি থাকলে নয়। শ্বাসকষ্ট, জ্বর বা ২ সপ্তাহের বেশি কাশিতে ডাক্তার।" },
  { key: "throat-mouth-pain", disease: "গলা/মুখের ব্যথা (কুলকুচি বা জেল)", generic: "Benzydamine", brands: [], note: "অ্যাসপিরিন/NSAID-এ সংবেদনশীলতা থাকলে সতর্কতা। গিলতে বা শ্বাসে কষ্ট হলে ডাক্তার।" },
  { key: "mouth-ulcer", disease: "মুখের ঘা (ডেন্টাল পেস্ট)", generic: "Triamcinolone Acetonide (ডেন্টাল পেস্ট)", brands: [], note: "মুখে ছত্রাক/ভাইরাস সংক্রমণ থাকলে নয়। ২ সপ্তাহের বেশি বা ব্যথাহীন শক্ত দাগে ডাক্তার।" },
  { key: "muscle-joint-gel", disease: "পেশি / গাঁটের ব্যথা (বাহ্যিক জেল)", generic: "Diclofenac (জেল)", brands: ["Voltaren"], note: "কাটা/খোলা ত্বকে নয়। NSAID-এ এলার্জি বা গর্ভাবস্থার শেষ ৩ মাসে নয়।" },
  { key: "pain", disease: "ব্যথা / দাঁতব্যথা (সাময়িক)", generic: "Ibuprofen", brands: ["Brufen"], note: "ডেঙ্গুর সন্দেহে নয়। পেটে আলসার/রক্তক্ষরণ, গুরুতর কিডনি সমস্যা, হাঁপানিতে NSAID-সংবেদনশীলতা, গর্ভাবস্থার শেষ ৩ মাসে নয়। ৬ মাসের নিচে শিশুকে নয়।" },
  { key: "period-pain", disease: "মাসিকের ব্যথা", generic: "Mefenamic Acid", brands: [], note: "ডেঙ্গুর সন্দেহে নয়। পেটে আলসার/রক্তক্ষরণ, গুরুতর কিডনি/লিভার সমস্যা, গর্ভাবস্থার শেষ ৩ মাসে নয়।" },
  { key: "urticaria", disease: "ত্বকের চুলকানি / আমবাত", generic: "Cetirizine", brands: ["Alatrol"], note: "ঘুম ঘুম লাগতে পারে। গুরুতর কিডনি সমস্যায় সতর্কতা। মুখ-ঠোঁট ফোলা বা শ্বাসকষ্ট হলে জরুরি সেবা।" },
  { key: "fungal-skin", disease: "দাদ / ছত্রাকজনিত চুলকানি (ক্রিম)", generic: "Clotrimazole", brands: [], note: "খোলা ঘা-তে সতর্কতা। কয়েক সপ্তাহে না কমলে ডাক্তার।" },
  { key: "wound-antiseptic", disease: "সামান্য ক্ষত পরিষ্কার (জীবাণুনাশক)", generic: "Povidone-Iodine", brands: [], note: "আয়োডিন-এলার্জি বা থাইরয়েড রোগে বড় জায়গায়/দীর্ঘদিন নয়। নবজাতকের বড় জায়গায় সতর্কতা। গভীর ক্ষতে ডাক্তার।" },
  { key: "vit-d", disease: "ভিটামিন ডি-র ঘাটতি", generic: "Vitamin D3 (Cholecalciferol)", brands: [], note: "পরীক্ষায় ঘাটতি ধরা পড়লে। রক্তে ক্যালসিয়াম বেশি থাকলে নয়। মাত্রা ডাক্তার/ফার্মাসিস্ট ঠিক করবেন।" },
  { key: "calcium", disease: "ক্যালসিয়ামের ঘাটতি", generic: "Calcium (Carbonate/Citrate)", brands: ["Ostocal"], note: "রক্তে ক্যালসিয়াম বেশি, কিডনিতে পাথরের ইতিহাস বা গুরুতর কিডনি সমস্যায় সতর্কতা। থাইরক্সিনের সাথে ৪ ঘণ্টা ব্যবধান।" },
  { key: "anaemia", disease: "রক্তস্বল্পতা (আয়রন + ফলিক অ্যাসিড)", generic: "Iron + Folic Acid", brands: [], note: "রক্তপরীক্ষায় ধরা পড়লে। শরীরে আয়রন বেশি জমার রোগে নয়। ক্যালসিয়ামের সাথে ২ ঘণ্টা ব্যবধান।" },
];
