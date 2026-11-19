// MyCare — ত্বক (Skin) আইটেম, ব্যাচ ১। owner-রিভিউ শেষে status:"verified" (২০২৬-১১-১৯)।
// ব্র্যান্ড নয়, সক্রিয় উপাদান (retinoid/অ্যাসিড/ব্লিচ) নয়, ঘনত্ব/ডোজ নয়। উৎস: AAD (প্ল্যান §৮)।
// দ্রষ্টব্য: name-এ "সুগন্ধি/fragrance" শব্দ রাখা হয়নি — অ্যালার্জি-মেলানো name-ও দেখে, তাই "সুগন্ধিমুক্ত" নামের আইটেম ভুল করে লুকাত।
const U = (path) => "https://www.aad.org" + path;
const S = {
  sunscreen: { org: "AAD", ref: "How to select a sunscreen", url: U("/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-select-sunscreen") },
  dry: { org: "AAD", ref: "Dermatologists' top tips for relieving dry skin", url: U("/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin") },
  acne: { org: "AAD", ref: "Acne: Tips for managing", url: U("/diseases/acne/acne-self-care") },
  acneHabits: { org: "AAD", ref: "10 skin care habits that can worsen acne", url: U("/public/diseases/acne-and-rosacea/skin-care-habits-that-worsen-acne") },
  eczema: { org: "AAD", ref: "Atopic dermatitis skin care (fragrance-free advice)", url: "https://aad.org/public/diseases/eczema/types/atopic-dermatitis/atopic-dermatitis-coping" },
};
const PATCH = { bn: "নতুন পণ্য আগে অল্প জায়গায় লাগিয়ে দেখুন।", en: "Patch test any new product first." };

export const SKIN_ITEMS = [
  {
    id: "skin-gentle-cleanser", category: "skin", type: "cleanser",
    name: { bn: "মৃদু ক্লিনজার", en: "Gentle cleanser" },
    how: { bn: "সকাল ও রাতে (বা ঘামের পর) কুসুম গরম পানি ও আঙুলের ডগা দিয়ে আলতো করে ধুয়ে নিন; ঘষবেন না।", en: "Wash gently with lukewarm water and fingertips in the morning and at night (or after sweating). Do not scrub." },
    why: { bn: "কড়া ক্লিনজার ও ঘষাঘষি ত্বক শুষ্ক বা জ্বালাময় করতে পারে; মৃদু পণ্যে ত্বকের সুরক্ষা-স্তর কম নষ্ট হয়।", en: "Harsh cleansers and scrubbing can dry or irritate skin; mild products disturb the skin barrier less." },
    forConcerns: [], forTypes: [], ingredientAliases: ["soap", "sulfate", "সালফেট"], avoidIf: [],
    isCoreSafe: true, sideEffectRank: 0, evidenceLevel: 1, warnings: [PATCH], redFlagNote: null,
    sources: [S.dry, S.acne], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "skin-moisturizer", category: "skin", type: "moisturizer",
    name: { bn: "ময়েশ্চারাইজার", en: "Moisturizer" },
    how: { bn: "গোসলের পর ত্বক সামান্য ভেজা থাকতেই এবং শুষ্ক লাগলে লাগান। শুষ্ক ত্বকে লোশনের চেয়ে ক্রিম বা মলম সাধারণত ভালো। সুগন্ধিমুক্ত লেবেল দেখে নিন।", en: "Apply right after bathing while skin is still damp, and whenever skin feels dry. Creams and ointments tend to work better than lotions for dry skin. Look for a fragrance-free label." },
    why: { bn: "ত্বকের আর্দ্রতা ধরে রাখে এবং শুষ্কতা ও চুলকানি কমাতে সাহায্য করে।", en: "Helps keep water in the skin and eases dryness and itch." },
    forConcerns: [], forTypes: [], ingredientAliases: ["lanolin", "ল্যানোলিন", "paraben", "প্যারাবেন"], avoidIf: [],
    isCoreSafe: true, sideEffectRank: 0, evidenceLevel: 1, warnings: [PATCH], redFlagNote: null,
    sources: [S.dry], status: "verified", lastReviewed: "2026-11-19", seasons: ["shit", "hemonto"],
  },
  {
    id: "skin-sunscreen", category: "skin", type: "sunscreen",
    name: { bn: "SPF 30+ সানস্ক্রিন", en: "SPF 30+ sunscreen" },
    how: { bn: "বাইরে যাওয়ার আগে খোলা ত্বকে লাগান। বাইরে থাকলে প্রতি ২ ঘণ্টা পরপর, আর সাঁতার বা বেশি ঘামের পর আবার লাগান। লেবেলে \"broad spectrum\" (UVA+UVB), SPF 30 বা বেশি ও \"water resistant\" দেখে নিন।", en: "Apply to exposed skin before going out; reapply about every 2 hours outdoors and after swimming or heavy sweating. Check the label: broad spectrum (UVA+UVB), SPF 30 or higher, water resistant." },
    why: { bn: "রোদে পোড়া, ত্বকের অকালবার্ধক্য ও কালচে দাগ কমাতে এবং ত্বকের ক্যানসারের ঝুঁকি কমাতে সাহায্য করে।", en: "Helps reduce sunburn, early skin ageing and dark marks, and lowers skin cancer risk." },
    forConcerns: [], forTypes: [], ingredientAliases: [], avoidIf: [],
    isCoreSafe: true, sideEffectRank: 0, evidenceLevel: 1,
    warnings: [PATCH, { bn: "তৈলাক্ত বা ব্রণপ্রবণ ত্বকে \"non-comedogenic\" লেবেল দেখুন।", en: "For oily or acne-prone skin look for a non-comedogenic label." }], redFlagNote: null,
    sources: [S.sunscreen], status: "verified", lastReviewed: "2026-11-19", seasons: ["grishmo", "borsha", "shorot"],
  },
  {
    id: "skin-noncomedogenic", category: "skin", type: "product-choice",
    name: { bn: "ছিদ্র বন্ধ করে না — এমন লেবেলের পণ্য", en: "Products labelled non-comedogenic" },
    how: { bn: "ময়েশ্চারাইজার, সানস্ক্রিন, মেকআপ ও চুলের পণ্যে \"non-comedogenic\" বা \"won't clog pores\" লেবেল দেখে বাছুন। ঘুমানোর আগে মেকআপ তুলে ফেলুন।", en: "Choose moisturisers, sunscreen, makeup and hair products labelled non-comedogenic or \"won't clog pores\". Remove makeup before bed." },
    why: { bn: "এমন লেবেলের পণ্যে বেশিরভাগ মানুষের ব্রণ বাড়ে না।", en: "Such products do not cause breakouts for most people." },
    forConcerns: ["acne"], forTypes: [], ingredientAliases: [], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [PATCH], redFlagNote: null,
    sources: [S.acneHabits], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "skin-acne-no-picking", category: "skin", type: "habit",
    name: { bn: "ব্রণ খোঁটা/চাপ না দেওয়া", en: "Do not pick or squeeze pimples" },
    how: { bn: "ব্রণ খোঁটা বা চাপ দেওয়া থেকে বিরত থাকুন, মুখে হাত কম দিন। যেকোনো পণ্যকে কয়েক সপ্তাহ সময় দিন; ঘনঘন পণ্য বদলাবেন না।", en: "Resist picking or squeezing pimples and avoid touching your face. Give any product a few weeks before judging it; avoid switching products often." },
    why: { bn: "খোঁটালে ব্রণ সারতে দেরি হয় এবং দাগ ও কালচে ছোপের ঝুঁকি বাড়ে।", en: "Picking makes breakouts last longer and raises the risk of scars and dark spots." },
    forConcerns: ["acne", "scars"], forTypes: [], ingredientAliases: [], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [], redFlagNote: { bn: "গভীর বা ব্যথাযুক্ত ব্রণ হলে চর্মরোগ বিশেষজ্ঞ দেখান।", en: "For deep or painful acne, see a dermatologist." },
    sources: [S.acne, S.acneHabits], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "skin-acne-gentle-wash", category: "skin", type: "habit",
    name: { bn: "ব্রণপ্রবণ ত্বকে আলতো পরিষ্কার", en: "Gentle washing for acne-prone skin" },
    how: { bn: "দিনে সর্বোচ্চ দুবার এবং ঘামের পর মুখ ধুয়ে নিন। আঙুলের ডগা ব্যবহার করুন; কাপড়, স্পঞ্জ বা স্ক্রাবে ঘষবেন না। টোনার, অ্যাস্ট্রিনজেন্ট বা এক্সফোলিয়েন্ট এড়ান।", en: "Wash up to twice a day and after sweating, using fingertips. Do not scrub with cloths or sponges. Avoid astringents, toners and exfoliants." },
    why: { bn: "ঘষাঘষি ও কড়া পণ্যে ত্বক জ্বলে ব্রণ আরও বাড়তে পারে।", en: "Scrubbing and harsh products can irritate skin and make breakouts worse." },
    forConcerns: ["acne"], forTypes: [], ingredientAliases: [], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [PATCH], redFlagNote: null,
    sources: [S.acne], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
  {
    id: "skin-dry-bathing", category: "skin", type: "habit",
    name: { bn: "শুষ্ক ত্বকে গোসলের অভ্যাস", en: "Bathing habits for dry skin" },
    how: { bn: "গোসল ৫–১০ মিনিটে শেষ করুন, কুসুম গরম পানি ব্যবহার করুন (গরম নয়)। তোয়ালে দিয়ে আলতো চেপে মুছুন, ঘষবেন না; তারপর সঙ্গে সঙ্গে ময়েশ্চারাইজার লাগান।", en: "Keep baths and showers to 5–10 minutes in warm (not hot) water. Pat dry gently rather than rubbing, then moisturise straight away." },
    why: { bn: "গরম পানি ও দীর্ঘ গোসল শুষ্কতা বাড়াতে পারে।", en: "Hot water and long baths tend to worsen dry skin." },
    forConcerns: ["dryness"], forTypes: [], ingredientAliases: [], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [], redFlagNote: null,
    sources: [S.dry], status: "verified", lastReviewed: "2026-11-19", seasons: ["shit", "hemonto"],
  },
  {
    id: "skin-mild-products-irritation", category: "skin", type: "product-choice",
    name: { bn: "জ্বালা/চুলকানিতে মৃদু পণ্য বাছাই", en: "Choosing mild products for irritated or itchy skin" },
    how: { bn: "লেবেলে \"fragrance free\" দেখে নিন; \"unscented\" লেখা থাকলেও গন্ধ ঢাকা থাকতে পারে, তাই সেটি এড়ান। ডিওডোরেন্ট সাবান ও অ্যালকোহলযুক্ত পণ্য কম ব্যবহার করুন। নতুন পণ্য আগে অল্প জায়গায় পরীক্ষা করুন।", en: "Look for a \"fragrance free\" label; \"unscented\" products may still contain masked fragrance. Limit deodorant soaps and alcohol-containing products. Test new products on a small area first." },
    why: { bn: "সুগন্ধি ও কড়া উপাদান সংবেদনশীল ত্বকে জ্বালা বা চুলকানি বাড়াতে পারে।", en: "Fragrance and harsh ingredients can aggravate irritated or sensitive skin." },
    forConcerns: ["irritation", "itching"], forTypes: [], ingredientAliases: [], avoidIf: [],
    isCoreSafe: false, sideEffectRank: 0, evidenceLevel: 2, warnings: [PATCH],
    redFlagNote: { bn: "র‍্যাশ ছড়িয়ে পড়লে বা চুলকানি না কমলে চর্মরোগ বিশেষজ্ঞ দেখান।", en: "If a rash spreads or itch does not settle, see a dermatologist." },
    sources: [S.eczema, S.dry], status: "verified", lastReviewed: "2026-11-19", seasons: [],
  },
];
