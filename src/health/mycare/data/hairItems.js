// MyCare — চুল (Hair) আইটেম, ব্যাচ ১। owner-রিভিউ শেষে status:"verified" (২০২৬-১১-১৯)।
// ব্র্যান্ড নয়, সক্রিয় উপাদানের নাম নয় (ঔষধি শ্যাম্পুতে "লেবেল/ফার্মাসিস্ট")। উৎস: AAD, NHS (প্ল্যান §৮)।
const S = {
  damage: { org: "AAD", ref: "10 hair care habits that can damage your hair", url: "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/habits-that-damage-hair" },
  tips: { org: "AAD", ref: "Tips for healthy hair", url: "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips" },
  acneHair: { org: "AAD", ref: "Acne: Tips for managing (shampoo oily hair daily)", url: "https://www.aad.org/diseases/acne/acne-self-care" },
  dandruff: { org: "NHS", ref: "Dandruff", url: "https://www.nhs.uk/conditions/dandruff/" },
  pulling: { org: "NHS", ref: "Good hair care advice (Gloucestershire Hospitals)", url: "https://gloshospitals.nhs.uk/your-visit/patient-information-leaflets/good-hair-care-advice" },
};
const PATCH = { bn: "নতুন পণ্য আগে অল্প জায়গায় লাগিয়ে দেখুন।", en: "Patch test any new product first." };

export const HAIR_ITEMS = [
  {
    id: "hair-gentle-shampoo", category: "hair", type: "shampoo",
    name: { bn: "মৃদু শ্যাম্পু", en: "Gentle shampoo" },
    how: { bn: "শ্যাম্পু মাথার ত্বকে আলতো করে ম্যাসাজ করুন; চুলের দৈর্ঘ্যে ঘষবেন না — ধোয়ার পানিই ফেনা নিচে নামিয়ে নেবে।", en: "Massage shampoo gently into the scalp; do not rub it down the length of the hair — let the rinse water carry it through." },
    why: { bn: "মাথার ত্বক পরিষ্কার হয়, আর চুলের দৈর্ঘ্য ঘষায় রুক্ষ বা ভাঙা কম হয়।", en: "Cleans the scalp while causing less roughness and breakage along the hair lengths." },
    forConcerns: [], forTypes: [], ingredientAliases: ["sulfate", "সালফেট"], avoidIf: [],
    isCoreSafe: true, sideEffectRank: 0, evidenceLevel: 1, warnings: [PATCH], redFlagNote: null,
    sources: [S.damage], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "hair-wet-hair-gentle", category: "hair", type: "habit",
    name: { bn: "ভেজা চুলে আলতো আঁচড়ানো", en: "Combing wet hair gently" },
    how: { bn: "ভেজা চুল ব্রাশের বদলে চওড়া দাঁতের চিরুনিতে আলতো আঁচড়ান — আগে ডগা, তারপর ওপরের দিকে। দিনে ১০০ বার ব্রাশ করা লাগে না; শুধু সাজানোর জন্য আঁচড়ান।", en: "Detangle wet hair with a wide-tooth comb rather than a brush, starting at the ends and working up. Hair never needs 100 brush strokes a day; comb only to style." },
    why: { bn: "ভেজা চুল দুর্বল থাকে; টানাটানিতে ভেঙে যায়।", en: "Wet hair is fragile and breaks easily when pulled." },
    forConcerns: ["hairfall", "dryness"], forTypes: [], ingredientAliases: [], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [], redFlagNote: { bn: "হঠাৎ অনেক চুল পড়লে বা টাক-ছোপ দেখা দিলে ডাক্তার দেখান।", en: "Sudden heavy hair loss or bald patches: see a doctor." },
    sources: [S.tips, S.damage], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "hair-avoid-tight-styles", category: "hair", type: "habit",
    name: { bn: "টানটান হেয়ারস্টাইল এড়ানো", en: "Avoiding tight hairstyles" },
    how: { bn: "খুব টানটান বেণী, পনিটেইল বা চুল-টানা স্টাইল এড়ান; স্টাইল বদলে বদলে করুন। শোয়ার আগে টাইট ব্যান্ড খুলে নিন।", en: "Avoid very tight braids, ponytails and styles that pull on the hair; vary your styles. Take tight bands out before sleep." },
    why: { bn: "যা চুলকে টানে, দীর্ঘদিন করলে তা স্থায়ী চুল পড়ার কারণ হতে পারে।", en: "Anything that keeps pulling on hair can, over time, lead to permanent hair loss." },
    forConcerns: ["hairfall"], forTypes: [], ingredientAliases: [], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [], redFlagNote: { bn: "হঠাৎ অনেক চুল পড়লে বা টাক-ছোপ দেখা দিলে ডাক্তার দেখান।", en: "Sudden heavy hair loss or bald patches: see a doctor." },
    sources: [S.pulling, S.damage], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "hair-dandruff-shampoo", category: "hair", type: "shampoo",
    name: { bn: "খুশকির শ্যাম্পু (ফার্মেসি/সুপারশপ)", en: "Anti-dandruff shampoo (pharmacy/supermarket)" },
    how: { bn: "কী ধরনের শ্যাম্পু আপনার জন্য ঠিক, ফার্মাসিস্টকে জিজ্ঞেস করুন এবং প্যাকেটের নির্দেশ অনুযায়ী ব্যবহার করুন। প্রায় এক মাস ব্যবহার করে দেখুন; না কমলে অন্য ধরন চেষ্টা করা যেতে পারে।", en: "Ask a pharmacist which type suits you and follow the pack instructions. Try it for about a month; if it does not help, another type may be tried." },
    why: { bn: "খুশকির জন্য সাধারণ প্রথম ধাপ হলো এমন শ্যাম্পু।", en: "An anti-dandruff shampoo is the usual first step for dandruff." },
    forConcerns: ["dandruff"], forTypes: [], ingredientAliases: [], avoidIf: ["pregnancy", "breastfeeding"],
    isCoreSafe: false, sideEffectRank: 1, evidenceLevel: 1, warnings: [PATCH],
    redFlagNote: { bn: "এক মাস ব্যবহারেও না কমলে, অতিরিক্ত চুলকানি হলে, বা মাথার ত্বক লাল/ফোলা হলে ডাক্তার দেখান।", en: "See a doctor if no better after a month, if itch is severe, or if the scalp is red or swollen." },
    sources: [S.dandruff], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "hair-curly-wash", category: "hair", type: "habit",
    name: { bn: "কোঁকড়া চুলের ধোয়া ও কন্ডিশনার", en: "Washing and conditioning curly hair" },
    how: { bn: "ঘনঘন নয়, প্রয়োজন মনে হলে শ্যাম্পু করুন। ভেজা অবস্থায় চওড়া দাঁতের চিরুনি ব্যবহার করুন; কন্ডিশনার চুলের ডগায় বেশি লাগান।", en: "Shampoo when needed rather than very often. Detangle while damp with a wide-tooth comb and put conditioner mainly on the ends." },
    why: { bn: "ঘনঘন ধোয়া চুল ও মাথার ত্বক শুষ্ক করতে পারে; কোঁকড়া চুল সহজে ভাঙে।", en: "Washing too often can dry curly hair and scalp, and curly hair breaks easily." },
    forConcerns: [], forTypes: ["curly"], ingredientAliases: [], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [PATCH], redFlagNote: null,
    sources: [S.tips, S.damage], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "hair-oily-wash", category: "hair", type: "habit",
    name: { bn: "তৈলাক্ত চুলে নিয়মিত শ্যাম্পু", en: "Regular shampooing for oily hair" },
    how: { bn: "চুল তৈলাক্ত হলে প্রয়োজনে প্রতিদিন মৃদু শ্যাম্পু করা যায়।", en: "If hair is oily, a gentle shampoo can be used daily when needed." },
    why: { bn: "তেল ও ঘাম জমে থাকলে মাথার ত্বক ও ত্বকে ব্রণ বাড়তে পারে।", en: "Oil and sweat left on the scalp can aggravate scalp and skin breakouts." },
    forConcerns: ["oiliness"], forTypes: ["oily"], ingredientAliases: ["sulfate", "সালফেট"], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [PATCH], redFlagNote: null,
    sources: [S.acneHair], status: "verified", lastReviewed: "2026-11-19", seasons: ["grishmo", "borsha"],
  },
];
