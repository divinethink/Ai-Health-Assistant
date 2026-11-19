// MyCare — দাঁত ও মুখ (Oral) আইটেম, ব্যাচ ১ (draft)। owner-রিভিউয়ের পরই status:"verified" হবে (প্ল্যান §৮, ধাপ ৬)।
// ব্র্যান্ড নয়, ঘনত্ব/ppm নয়, ঔষধ নয়। উৎস: NHS (প্রধান), NIH/NIDCR। শিশুর টুথপেস্ট-পরিমাণ এখানে নেই — রিভিউয়ের পর আলাদা।
const S = {
  clean: { org: "NHS", ref: "How to keep your teeth clean", url: "https://www.nhs.uk/live-well/healthy-teeth-and-gums/how-to-keep-your-teeth-clean/" },
  breath: { org: "NHS", ref: "Bad breath", url: "https://www.nhs.uk/conditions/bad-breath/" },
  gums: { org: "NHS", ref: "Gum disease", url: "https://www.nhs.uk/conditions/gum-disease/" },
  dry: { org: "NIH", ref: "NIDCR: Dry mouth", url: "https://www.nidcr.nih.gov/health-info/dry-mouth" },
  sens: { org: "Oral Health Foundation (UK)", ref: "Sensitive teeth", url: "https://dentalhealth.org/sensitive-teeth" },
};
const MOUTH_WARN = { bn: "নতুন পণ্যে মুখে জ্বালা, ফোলা বা র‍্যাশ হলে ব্যবহার বন্ধ করে পরামর্শ নিন।", en: "If a new product causes mouth irritation, swelling or rash, stop it and seek advice." };
const DENTIST = (bn, en) => ({ bn, en });
const base = { category: "oral", avoidIf: [], sideEffectRank: 0, status: "draft", lastReviewed: "2026-11-19", seasons: [], forTypes: [] };

export const ORAL_ITEMS = [
  {
    ...base, id: "oral-fluoride-brushing", type: "habit", isCoreSafe: true, evidenceLevel: 1,
    name: { bn: "ফ্লুরাইড টুথপেস্টে নিয়মিত ব্রাশ", en: "Brush regularly with fluoride toothpaste" },
    how: { bn: "দিনে দুবার, প্রায় ২ মিনিট ব্রাশ করুন; রাতে ঘুমানোর আগের ব্রাশ বাদ দেবেন না। টুথপেস্টের লেবেলে \"fluoride\" আছে কিনা দেখে নিন। ব্রাশের পর বাড়তি পেস্ট ফেলে দিন, কুলকুচি করে ধুয়ে ফেলবেন না। শিশুর জন্য পেস্টের পরিমাণ ও ব্রাশ করানোর নিয়ম দন্তচিকিৎসকের কাছ থেকে জেনে নিন।", en: "Brush twice a day for about 2 minutes, never skipping the last brush before bed. Check the label says \"fluoride\". Spit out excess toothpaste and do not rinse with water afterwards. For children, ask a dentist about the right amount of toothpaste and supervision." },
    why: { bn: "ফ্লুরাইড দাঁতের ক্ষয় ঠেকাতে সাহায্য করে; কুলকুচি না করলে ফ্লুরাইড দাঁতে বেশিক্ষণ থাকে।", en: "Fluoride helps protect teeth from decay, and not rinsing leaves the fluoride on the teeth for longer." },
    forConcerns: [], ingredientAliases: ["fluoride", "ফ্লুরাইড"], warnings: [MOUTH_WARN], redFlagNote: null,
    sources: [S.clean],
  },
  {
    ...base, id: "oral-clean-between-teeth", type: "habit", isCoreSafe: false, evidenceLevel: 2,
    name: { bn: "দাঁতের ফাঁক প্রতিদিন পরিষ্কার", en: "Clean between your teeth daily" },
    how: { bn: "প্রতিদিন ফ্লস বা ইন্টারডেন্টাল ব্রাশ দিয়ে দাঁতের ফাঁক পরিষ্কার করুন; ব্রাশের আগে ফ্লস করা ভালো। কাঠের টুথপিক মাড়ির ক্ষতি করতে পারে, তাই এড়ান।", en: "Clean between teeth every day with floss or interdental brushes, ideally before brushing. Avoid wooden toothpicks, which can damage gums." },
    why: { bn: "ব্রাশ দাঁতের ফাঁকে পৌঁছায় না; সেখানকার প্লাক জমলে মাড়ির সমস্যা ও মুখের গন্ধ হতে পারে।", en: "A toothbrush cannot reach between teeth, where plaque can build up and lead to gum problems and bad breath." },
    forConcerns: ["gums", "bad-breath"], ingredientAliases: [], warnings: [{ bn: "আলতো করে করুন; জোরে টানলে মাড়ি কেটে যেতে পারে।", en: "Be gentle; forcing floss can cut the gums." }],
    redFlagNote: DENTIST("মাড়ি থেকে বারবার রক্ত পড়লে বা ব্যথা-ফোলা থাকলে দন্তচিকিৎসক দেখান।", "If gums bleed repeatedly or are painful or swollen, see a dentist."),
    sources: [S.clean, S.gums],
  },
  {
    ...base, id: "oral-gum-care", type: "habit", isCoreSafe: false, evidenceLevel: 2,
    name: { bn: "মাড়ির যত্নের অভ্যাস", en: "Everyday gum care" },
    how: { bn: "দিনে দুবার ফ্লুরাইড টুথপেস্টে ব্রাশ করুন, কিন্তু জোরে ঘষবেন না। প্রতিদিন দাঁতের ফাঁক পরিষ্কার করুন, ধূমপান এড়ান এবং নিয়মিত দন্তচিকিৎসকের কাছে পরীক্ষা করান।", en: "Brush twice a day with fluoride toothpaste without scrubbing hard. Clean between teeth daily, avoid smoking and keep up regular dental check-ups." },
    why: { bn: "প্লাক ঠিকমতো পরিষ্কার না হলে মাড়ি ফুলে যেতে ও রক্ত পড়তে পারে; ধূমপান এই ঝুঁকি বাড়ায়।", en: "If plaque is not cleaned well, gums can become swollen and bleed; smoking raises that risk." },
    forConcerns: ["gums"], ingredientAliases: ["fluoride", "ফ্লুরাইড"], warnings: [],
    redFlagNote: DENTIST("মাড়ি ব্যথাযুক্ত, ফোলা বা বারবার রক্ত পড়লে দন্তচিকিৎসক দেখান। দাঁত নড়লে দ্রুত দেখান।", "If gums are painful, swollen or bleed repeatedly, see a dentist. See one soon if teeth feel loose."),
    sources: [S.gums, S.clean],
  },
  {
    ...base, id: "oral-tongue-cleaning", type: "habit", isCoreSafe: false, evidenceLevel: 2,
    name: { bn: "জিভ আলতো করে পরিষ্কার", en: "Gently clean your tongue" },
    how: { bn: "দিনে একবার টাং-ক্লিনার বা স্ক্র্যাপার দিয়ে জিভ আলতো করে পরিষ্কার করুন। এত জোরে ঘষবেন না যাতে জিভ বা মাড়ি থেকে রক্ত বের হয়।", en: "Once a day, gently clean your tongue with a tongue cleaner or scraper. Do not press so hard that your tongue or gums bleed." },
    why: { bn: "জিভের ওপর জমা ময়লা মুখের গন্ধের একটি কারণ হতে পারে।", en: "Coating on the tongue can be one cause of bad breath." },
    forConcerns: ["bad-breath"], ingredientAliases: [], warnings: [],
    redFlagNote: DENTIST("কয়েক সপ্তাহ যত্নের পরও গন্ধ থাকলে দন্তচিকিৎসক দেখান।", "If bad breath continues after a few weeks of care, see a dentist."),
    sources: [S.breath],
  },
  {
    ...base, id: "oral-bad-breath-habits", type: "habit", isCoreSafe: false, evidenceLevel: 2,
    name: { bn: "মুখের গন্ধ কমানোর অভ্যাস", en: "Habits for fresher breath" },
    how: { bn: "ঝাল-গন্ধযুক্ত খাবারের পর চিনিমুক্ত মিন্ট বা চুইংগাম নিতে পারেন। ধূমপান, অতিরিক্ত মদ্যপান এবং মিষ্টি খাবার-পানীয় কমান। নকল দাঁত থাকলে পরিষ্কার রাখুন ও রাতে খুলে রাখুন। ব্রাশের পরপরই পানিতে কুলকুচি করবেন না।", en: "After strong-smelling food, sugar-free mints or gum can help. Cut down on smoking, heavy drinking and sugary food and drinks. Keep dentures clean and take them out at night. Do not rinse with water straight after brushing." },
    why: { bn: "খাবারের গন্ধ, শুকনো মুখ, মাড়ির সমস্যা ও দাঁতের ময়লা — এসব থেকে মুখে গন্ধ হতে পারে।", en: "Food odours, a dry mouth, gum problems and plaque can all cause bad breath." },
    forConcerns: ["bad-breath"], ingredientAliases: ["mint", "পুদিনা"], warnings: [],
    redFlagNote: DENTIST("কয়েক সপ্তাহেও না কমলে, বা মাড়ি/দাঁতে ব্যথা থাকলে দন্তচিকিৎসক দেখান।", "If it does not improve in a few weeks, or gums or teeth hurt, see a dentist."),
    sources: [S.breath],
  },
  {
    ...base, id: "oral-sensitive-teeth", type: "habit", isCoreSafe: false, evidenceLevel: 2,
    name: { bn: "সংবেদনশীল দাঁতের মৃদু যত্ন", en: "Gentle care for sensitive teeth" },
    how: { bn: "নরম ব্রিসলের ব্রাশ ও ছোট গোল গোল আলতো টানে ব্রাশ করুন। \"সংবেদনশীল দাঁতের\" লেবেলের টুথপেস্ট নিয়মিত ব্যবহার করুন। টক বা অম্লীয় খাবার-পানীয়ের অন্তত এক ঘণ্টা পর ব্রাশ করুন, আর অম্লীয় ও মিষ্টি পানীয় কমান।", en: "Use a soft toothbrush with small, gentle circles. Use a toothpaste labelled for sensitive teeth regularly. Wait at least an hour after acidic food or drink before brushing, and cut down on acidic and sugary drinks." },
    why: { bn: "ক্ষয়ে যাওয়া দাঁত বা মাড়ি সরে গেলে ঠান্ডা, গরম বা টকে ঝিনঝিন করতে পারে; মৃদু অভ্যাসে এই অস্বস্তি কমতে সাহায্য করে।", en: "Worn enamel or receding gums can make teeth tingle with cold, heat or acid; gentle habits can help ease the discomfort." },
    forConcerns: ["sensitivity"], ingredientAliases: [], warnings: [MOUTH_WARN],
    redFlagNote: DENTIST("ব্যথা তীব্র হলে, হঠাৎ শুরু হলে, একটি মাত্র দাঁতে থাকলে বা কয়েক সপ্তাহের বেশি থাকলে দন্তচিকিৎসক দেখান।", "If pain is severe, sudden, in just one tooth, or lasts more than a few weeks, see a dentist."),
    sources: [S.sens],
  },
  {
    ...base, id: "oral-dry-mouth-care", type: "habit", isCoreSafe: false, evidenceLevel: 2,
    name: { bn: "শুকনো মুখে আরামের অভ্যাস", en: "Comfort habits for a dry mouth" },
    how: { bn: "পর্যাপ্ত পানি পান করুন এবং খাবারের সময় অল্প অল্প পানি চুমুক দিন। চিনিমুক্ত চুইংগাম বা চিনিমুক্ত লজেন্স লালা বাড়াতে সাহায্য করে। চা-কফি কমান; তামাক ও মদ্যপান এড়ান। রাতে ঘরে আর্দ্রতা বাড়াতে পারেন। ঔষধ নিজে থেকে বদলাবেন না।", en: "Drink enough water and sip water with meals. Sugar-free gum or sugar-free sweets can help produce saliva. Cut down on tea and coffee; avoid tobacco and alcohol. A humidifier at night may help. Do not change your medicines on your own." },
    why: { bn: "লালা কম হলে মুখ অস্বস্তিকর হয়, দাঁতের ক্ষয় ও মুখের গন্ধের ঝুঁকিও বাড়ে।", en: "Less saliva makes the mouth uncomfortable and raises the risk of tooth decay and bad breath." },
    forConcerns: ["dry-mouth"], ingredientAliases: [], warnings: [],
    redFlagNote: DENTIST("মুখ শুকনো থাকতে থাকলে, চিবাতে-গিলতে কষ্ট হলে বা মুখে ঘা হলে ডাক্তার/দন্তচিকিৎসক দেখান।", "If dryness persists, or you have trouble chewing or swallowing or mouth sores, see a doctor or dentist."),
    sources: [S.dry],
  },
];
