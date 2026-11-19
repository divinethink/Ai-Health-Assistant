// MyCare — শরীর (Body) আইটেম, ব্যাচ ১। owner-রিভিউ শেষে status:"verified" (২০২৬-১১-১৯)।
// ব্র্যান্ড/ঔষধ/ঘনত্ব নয় (ছত্রাকের ক্রিম-স্প্রে এখানে নেই — "ফার্মাসিস্টের পরামর্শ" মাত্র)। উৎস: NHS।
const S = { feet: { org: "NHS", ref: "Athlete's foot (prevention)", url: "https://www.nhs.uk/conditions/athletes-foot/" } };
const base = { category: "body", forConcerns: [], forTypes: [], avoidIf: [], sideEffectRank: 0, status: "verified", lastReviewed: "2026-11-19", seasons: [] };

export const BODY_ITEMS = [
  {
    ...base, id: "body-foot-care", type: "habit", isCoreSafe: false, evidenceLevel: 2, seasons: ["borsha"],
    name: { bn: "পায়ের যত্নের অভ্যাস", en: "Everyday foot care" },
    how: { bn: "পা ধোয়ার পর আঙুলের ফাঁকসহ ভালো করে শুকিয়ে নিন; মুছবেন না, আলতো চেপে শুকান। পায়ের জন্য আলাদা তোয়ালে রাখুন ও নিয়মিত ধুয়ে নিন। অন্যের তোয়ালে, মোজা বা জুতো ব্যবহার করবেন না; সাধারণ গোসলখানায় স্যান্ডেল পরুন।", en: "Dry your feet thoroughly after washing, including between the toes; dab rather than rub. Keep a separate towel for your feet and wash it regularly. Do not share towels, socks or shoes, and wear sandals in shared bathrooms." },
    why: { bn: "পা শুকনো ও পরিষ্কার থাকলে পায়ের ছত্রাক-সংক্রমণ (athlete's foot) হওয়ার ঝুঁকি কমে।", en: "Dry, clean feet lower the chance of fungal foot infection (athlete's foot)." },
    ingredientAliases: [], warnings: [],
    redFlagNote: { bn: "চুলকানি বা ফাটা ত্বক থাকলে ফার্মাসিস্টের পরামর্শ নিন। পা লাল, গরম ও ব্যথা হলে, ডায়াবেটিস বা রোগ-প্রতিরোধ কম থাকলে ডাক্তার দেখান।", en: "For itchy or cracked skin, ask a pharmacist. If a foot is red, hot and painful, or you have diabetes or a weak immune system, see a doctor." },
    sources: [S.feet],
  },
];
