// "সাধারণ চিকিৎসা" — সবার জন্য স্থির শুরুর তালিকা (কোডে আছে, Firestore-এ নয়)।
// নিয়ম: এখানে কোনো ডোজ/মাত্রা নেই — শুধু অসুখ, জেনেরিক নাম ও উদাহরণ-ব্র্যান্ড।
// ডোজ ও সেবনের মাত্রা সদস্য নিজে ডাক্তারের পরামর্শ থেকে লিখবেন (Roadmap §১২: অ্যাপ ডোজ বানায় না)।
// ব্র্যান্ড-নাম searchAliases.js-এর MED_ALIAS-এর সাথে মেলানো। ফার্মাসিস্ট রিভিউ হয়নি (draft)।
export const COMMON_CARE_DEFAULTS = [
  { key: "fever", disease: "জ্বর / গায়ে ব্যথা", generic: "Paracetamol", brands: ["Napa", "Ace", "Reset"], note: "৩ দিনের বেশি জ্বর থাকলে ডাক্তার দেখান। ডেঙ্গুর সন্দেহে Ibuprofen/Diclofenac জাতীয় ব্যথানাশক নয়।" },
  { key: "headache", disease: "মাথাব্যথা", generic: "Paracetamol", brands: ["Napa", "Ace"], note: "বারবার হলে বা তীব্র হলে ডাক্তার দেখান।" },
  { key: "cold-allergy", disease: "ঠান্ডা / এলার্জি / হাঁচি", generic: "Fexofenadine", brands: ["Fexo", "Telfast"], note: "বিকল্প: Cetirizine (Alatrol)। ঘুম ঘুম লাগতে পারে।" },
  { key: "gastric", disease: "গ্যাস্ট্রিক / বুক জ্বালা", generic: "Omeprazole", brands: ["Seclo", "Losectil"], note: "বিকল্প: Esomeprazole (Sergel, Maxpro)। দীর্ঘদিন নিজে নিজে নয়।" },
  { key: "nausea", disease: "বমি বমি ভাব", generic: "Domperidone", brands: ["Motigut"], note: "ডাক্তারের পরামর্শমতো ও অল্প সময়ের জন্য।" },
  { key: "diarrhoea", disease: "পাতলা পায়খানা", generic: "ORS", brands: ["ORSaline-N"], note: "আগে খাবার স্যালাইন। পায়খানায় রক্ত বা জ্বর থাকলে ডাক্তার। বিকল্প: Zinc।" },
  { key: "constipation", disease: "কোষ্ঠকাঠিন্য", generic: "Isabgol (Psyllium Husk)", brands: ["ইসবগুল"], note: "পানি ও আঁশযুক্ত খাবার আগে। বিকল্প: Lactulose।" },
];
