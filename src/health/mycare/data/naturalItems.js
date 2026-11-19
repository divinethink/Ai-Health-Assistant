// MyCare — প্রাকৃতিক/ভেষজ (Natural) আইটেম, ব্যাচ ১। owner-রিভিউ শেষে status:"verified" (২০২৬-১১-১৯)।
// ডিফল্ট Evidence Level ৩ + ভারী ধাতুর ⚠ + "ঐতিহ্যগতভাবে ব্যবহৃত"। ব্র্যান্ড/ঘনত্ব নয়। উৎস: NCCIH।
const S = {
  aloe: { org: "NCCIH", ref: "Aloe Vera", url: "https://www.nccih.nih.gov/health/aloe-vera" },
  ayur: { org: "NCCIH", ref: "Ayurvedic Medicine: In Depth", url: "https://www.nccih.nih.gov/health/ayurvedic-medicine-in-depth" },
};
const base = { category: "natural", herbal: true, heavyMetalWarning: true, evidenceLevel: 3, isCoreSafe: false, forConcerns: [], forTypes: [], sideEffectRank: 1, status: "verified", lastReviewed: "2026-11-19", seasons: [] };

export const NATURAL_ITEMS = [
  {
    ...base, id: "natural-aloe-gel", type: "traditional",
    name: { bn: "অ্যালোভেরা জেল (ঐতিহ্যগতভাবে ব্যবহৃত)", en: "Aloe vera gel (traditionally used)" },
    how: { bn: "আগে ত্বকের ছোট একটি জায়গায় লাগিয়ে দেখুন। সমস্যা না হলে শুষ্ক বা অস্বস্তিকর জায়গায় পাতলা করে লাগাতে পারেন। জ্বালা, চুলকানি বা র‍্যাশ হলে ব্যবহার বন্ধ করুন। শুধু ত্বকে লাগানোর কথা এখানে বলা হচ্ছে; খাওয়ার জন্য নয়।", en: "Test a small patch of skin first. If there is no reaction, a thin layer may be put on dry or uncomfortable areas. Stop if burning, itching or rash appears. This covers use on the skin only, not by mouth." },
    why: { bn: "ঐতিহ্যগতভাবে ত্বকের আরামে ব্যবহৃত হয়। কিছু ছোট গবেষণায় পোড়া ও ব্রণে সহায়ক ইঙ্গিত মিলেছে, তবে তথ্য সীমিত। ত্বকে লাগালে সাধারণত সহ্য হয়, তবে কারও কারও জ্বালা বা র‍্যাশ হয়েছে।", en: "Traditionally used for skin comfort. Some small studies hint at a benefit for burns and acne, but the evidence is limited. On the skin it is generally well tolerated, though some people have had burning or rash." },
    ingredientAliases: ["aloe", "aloe vera", "অ্যালো", "অ্যালোভেরা", "ঘৃতকুমারী"], avoidIf: ["pregnancy", "breastfeeding", "under2"],
    warnings: [{ bn: "নিয়মিত কোনো ঔষধ খেলে ব্যবহারের আগে চিকিৎসকের সঙ্গে কথা বলুন।", en: "If you take any medicine, talk to a doctor before using it." }],
    redFlagNote: { bn: "র‍্যাশ বাড়লে বা জ্বালা না কমলে ব্যবহার বন্ধ করে চিকিৎসক দেখান।", en: "If a rash worsens or irritation does not settle, stop and see a doctor." },
    sources: [S.aloe],
  },
  {
    ...base, id: "natural-herbal-product-caution", type: "caution",
    name: { bn: "ভেষজ/আয়ুর্বেদিক পণ্য বাছাইয়ের সতর্কতা", en: "Care when choosing herbal or Ayurvedic products" },
    how: { bn: "নিবন্ধিত ও পরিচিত উৎস থেকে পণ্য নিন; অজানা বা অনলাইনের নামহীন পণ্য এড়ান। কোনো রোগ থাকলে, গর্ভাবস্থা বা বুকের দুধ খাওয়ানোর সময়, বা শিশুর জন্য ব্যবহারের আগে চিকিৎসকের সঙ্গে কথা বলুন। ডাক্তার দেখানো পিছিয়ে দেওয়ার জন্য এগুলো ব্যবহার করবেন না।", en: "Buy from registered, known sources; avoid unlabelled or unknown online products. Talk to a doctor before use if you have a health condition, are pregnant or breastfeeding, or for a child. Do not use them to delay seeing a doctor." },
    why: { bn: "কিছু আয়ুর্বেদিক পণ্যে ক্ষতিকর মাত্রায় সিসার মতো ভারী ধাতু পাওয়া গেছে, তাই উৎস ও নিবন্ধন দেখা জরুরি।", en: "Some Ayurvedic products have been found to contain harmful amounts of heavy metals such as lead, so the source and registration matter." },
    ingredientAliases: [], avoidIf: [], warnings: [],
    redFlagNote: { bn: "ভেষজ পণ্য ব্যবহারের পর অসুস্থ বোধ করলে ব্যবহার বন্ধ করে ডাক্তার দেখান।", en: "If you feel unwell after using a herbal product, stop it and see a doctor." },
    sources: [S.ayur],
  },
];
