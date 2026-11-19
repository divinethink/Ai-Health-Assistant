// MyCare — ঋতুভিত্তিক (Seasonal) আইটেম, ব্যাচ ১। owner-রিভিউ শেষে status:"verified" (২০২৬-১১-১৯)।
// ঋতু আসে বর্তমান তারিখ থেকে (careSeason.js); আবহাওয়া API নয়। ব্র্যান্ড/ঔষধ/ঘনত্ব নয়। উৎস: NHS (প্রধান), AAD।
const S = {
  heat: { org: "NHS", ref: "Heatwave: how to cope in hot weather", url: "https://www.nhs.uk/live-well/seasonal-health/heatwave-how-to-cope-in-hot-weather/" },
  feet: { org: "NHS", ref: "Athlete's foot (prevention)", url: "https://www.nhs.uk/conditions/athletes-foot/" },
  dry: { org: "AAD", ref: "Dermatologists' top tips for relieving dry skin", url: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin" },
};
const base = { category: "seasonal", forConcerns: [], forTypes: [], ingredientAliases: [], avoidIf: [], sideEffectRank: 0, status: "verified", lastReviewed: "2026-11-19" };
const HEAT = ["grishmo", "borsha", "shorot", "boshonto"];

export const SEASONAL_ITEMS = [
  {
    ...base, id: "season-heat-shade", type: "habit", isCoreSafe: true, evidenceLevel: 1, seasons: HEAT,
    name: { bn: "গরমে ছায়া, হালকা পোশাক ও টুপি", en: "Shade, light clothes and a hat in hot weather" },
    how: { bn: "দুপুরের তীব্র রোদে সম্ভব হলে বাইরে না থাকুন; বের হলে ছায়ায় থাকুন। হালকা পোশাক ও টুপি বা ছাতা ব্যবহার করুন এবং বাইরে গেলে সানস্ক্রিন লাগান। গরম বাড়ায় এমন পরিশ্রম এড়ান।", en: "Stay out of the midday heat if you can, and keep to the shade when you go out. Wear light clothes and a hat or carry an umbrella, and use sunscreen outdoors. Avoid activity that makes you hotter." },
    why: { bn: "তীব্র গরম ও রোদে শরীর অস্বস্তিতে পড়ে এবং রোদে পোড়ার ঝুঁকি বাড়ে।", en: "Strong heat and sun make the body uncomfortable and raise the risk of sunburn." },
    warnings: [], redFlagNote: { bn: "গরমে অসুস্থ বোধ করলে ও জ্বর উঠলে heat exhaustion বা heatstroke হতে পারে — দ্রুত ডাক্তার দেখান।", en: "Feeling unwell with a high temperature in hot weather may be heat exhaustion or heatstroke — see a doctor promptly." },
    sources: [S.heat],
  },
  {
    ...base, id: "season-heat-fluids", type: "habit", isCoreSafe: false, evidenceLevel: 2, seasons: HEAT, avoidIf: ["kidney"],
    name: { bn: "গরমে নিয়মিত তরল পান", en: "Drink fluids regularly in hot weather" },
    how: { bn: "গরমে নিয়মিত বাড়তি তরল, বিশেষ করে পানি, পান করুন। অ্যালকোহল, ক্যাফেইন ও গরম পানীয় এড়ান।", en: "Drink extra fluids regularly in hot weather, especially water. Avoid alcohol, caffeine and hot drinks." },
    why: { bn: "গরমে ঘামের সাথে শরীরের পানি কমে যায়।", en: "In the heat the body loses water through sweat." },
    warnings: [{ bn: "চিকিৎসক তরল সীমিত রাখতে বলে থাকলে তাঁর পরামর্শই মানুন।", en: "If a doctor has told you to limit fluids, follow that advice." }],
    redFlagNote: null, sources: [S.heat],
  },
  {
    ...base, id: "season-heat-cool-down", type: "habit", isCoreSafe: false, evidenceLevel: 2, seasons: ["grishmo", "borsha", "shorot"],
    name: { bn: "গরমে শরীর ঠান্ডা রাখার উপায়", en: "Ways to keep cool in the heat" },
    how: { bn: "ঠান্ডা পানিতে গোসল করুন, বা ত্বকে ও কাপড়ে ঠান্ডা পানি দিন। ঠান্ডা খাবার খান। দিনে জানালা-পর্দা বন্ধ রাখুন, রাতে খুলে দিন।", en: "Have a cool shower, or put cool water on your skin and clothes. Eat cold food. Keep windows and curtains closed by day and open them at night." },
    why: { bn: "ঘর ও শরীর ঠান্ডা রাখলে গরমজনিত অস্বস্তি কমে।", en: "Keeping the home and body cool eases discomfort from heat." },
    warnings: [], redFlagNote: { bn: "গরমে অসুস্থ বোধ করলে ও জ্বর উঠলে heat exhaustion বা heatstroke হতে পারে — দ্রুত ডাক্তার দেখান।", en: "Feeling unwell with a high temperature in hot weather may be heat exhaustion or heatstroke — see a doctor promptly." },
    sources: [S.heat],
  },
  {
    ...base, id: "season-borsha-shoes-socks", type: "habit", isCoreSafe: false, evidenceLevel: 2, seasons: ["borsha"],
    name: { bn: "বর্ষায় জুতো-মোজা শুকনো ও পরিষ্কার রাখা", en: "Keep shoes and socks clean and dry in the rainy season" },
    how: { bn: "প্রতিদিন পরিষ্কার সুতির মোজা পরুন। একই জুতো পরপর দুই-তিন দিন পরবেন না, এবং পা গরম ও ঘেমে ওঠে এমন জুতো এড়ান। পা ধোয়ার পর আঙুলের ফাঁকসহ ভালো করে শুকিয়ে নিন।", en: "Wear clean cotton socks every day. Do not wear the same shoes two or three days in a row, and avoid shoes that make your feet hot and sweaty. After washing, dry your feet well, including between the toes." },
    why: { bn: "ভেজা বা ঘেমে থাকা পায়ে ছত্রাক-সংক্রমণ (athlete's foot) সহজে হতে পারে।", en: "Damp or sweaty feet can easily pick up fungal infection (athlete's foot)." },
    warnings: [], redFlagNote: { bn: "পা লাল, গরম ও ব্যথা হলে, বা ডায়াবেটিস থাকলে ডাক্তার দেখান।", en: "If a foot is red, hot and painful, or you have diabetes, see a doctor." },
    sources: [S.feet],
  },
  {
    ...base, id: "season-cool-dry-skin", type: "habit", isCoreSafe: false, evidenceLevel: 2, seasons: ["hemonto", "shit"],
    name: { bn: "শীত-হেমন্তে শুষ্ক ত্বকের যত্ন", en: "Dry-skin care in the cool, dry months" },
    how: { bn: "গোসল ৫–১০ মিনিটে শেষ করুন, কুসুম গরম পানি ব্যবহার করুন। আলতো করে মুছে সঙ্গে সঙ্গে ময়েশ্চারাইজার লাগান এবং শুষ্ক লাগলে আবার লাগান।", en: "Keep baths and showers to 5–10 minutes in warm water. Pat dry gently and moisturise straight away, and again whenever skin feels dry." },
    why: { bn: "শুষ্ক আবহাওয়ায় ত্বকের আর্দ্রতা দ্রুত কমে যায়।", en: "Skin loses moisture quickly in dry weather." },
    warnings: [{ bn: "নতুন পণ্য আগে অল্প জায়গায় লাগিয়ে দেখুন।", en: "Patch test any new product first." }],
    redFlagNote: { bn: "চুলকানি না কমলে বা র‍্যাশ ছড়ালে চর্মরোগ বিশেষজ্ঞ দেখান।", en: "If itch does not settle or a rash spreads, see a dermatologist." },
    sources: [S.dry],
  },
];
