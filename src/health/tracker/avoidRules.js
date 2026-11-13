// ধাপ ৫ — রোগ+বয়স অনুযায়ী "সতর্কতা: এড়িয়ে চলুন/সীমিত রাখুন" (খাবার ও ব্যায়াম)। স্থির ডেটা + pure ফাংশন।
// AI নেই, verify-ধাপ নেই, কিছু ব্লক করে না; শুধু তথ্য-কার্ড। প্রতি নিয়মে সূত্র-লেবেল (সাধারণ নির্দেশিকা-সংস্থা)।
// ⚠ সাধারণ তথ্য; ডাক্তারের নির্দেশ প্রাধান্য পায়। কোনো ডোজ/ওষুধ-পরামর্শ নেই (bright-line)।
// নতুন নিয়ম যোগ: RULES-এ একটা অবজেক্ট; শর্ত `when` = { cond: [..] } বা { ageMax } বা { ageMin }।

// ঘটনা-শনাক্তকরণ (সক্রিয় Condition-এর নাম থেকে; regex-মেলা, রোগনির্ণয় নয়)
const COND_PATTERNS = {
  hypertension: /hypertens|high blood pressure|উচ্চ রক্তচাপ|প্রেশার|রক্তচাপ/i,
  heart: /heart|cardiac|coronary|হার্ট|হৃদ|হৃৎ/i,
  asthma: /asthma|হাঁপানি|এজমা/i,
  cholesterol: /cholesterol|lipid|কোলেস্টেরল/i,
  // পেটের সমস্যা: IBS, গ্যাস্ট্রিক/অম্বল/আলসার, GERD, কোষ্ঠকাঠিন্য, ডায়রিয়া, কোলাইটিস
  gut: /\bibs\b|irritable|আইবিএস|gastr|gerd|reflux|ulcer|colitis|bowel|constipat|diarrh|dyspep|গ্যাস|অম্বল|বুকজ্বালা|আলসার|কোষ্ঠ|ডায়রিয়া|পাতলা পায়খানা|পেটের/i,
  // ব্যায়াম-গাইডের জন্য (শুধু ব্যায়াম-সতর্কতা): কোমর/পিঠ, হাঁটু/গিঁট, হার্নিয়া
  back: /back pain|backache|slip(ped)? disc|\bdisc\b|spondyl|sciatica|lumbar|কোমর|পিঠ(ে)? ?ব্যথা|ডিস্ক|স্পন্ডিলাইসিস|সায়াটিকা/i,
  joint: /knee|arthrit|osteoarth|joint pain|হাঁটু|আর্থ্রাইটিস|অস্টিওআর্থ|গিঁট|গাঁটে|জয়েন্ট/i,
  hernia: /hernia|হার্নিয়া/i,
};

// records: healthRecords; ফল: ["hypertension", ...] (diabetes/kidney/pregnant flags আলাদা — trackerCalc থেকে আসে)
export function conditionKeysOf(records) {
  const out = new Set();
  (records || []).forEach((r) => {
    if (!r || r.resourceType !== "condition" || r.status === "resolved") return;
    const n = String(r.name || "");
    Object.entries(COND_PATTERNS).forEach(([k, re]) => { if (re.test(n)) out.add(k); });
  });
  return [...out];
}

const SRC = {
  who: "WHO", nhs: "NHS", ada: "ADA", aha: "AHA", kdigo: "KDIGO/NKF", acog: "ACOG",
};

// domain: "food" | "exercise"; items = ছোট বাক্য (সীমিত/এড়ান); কোনো সংখ্যা-দাবি নেই
export const RULES = [
  { id: "diabetes-food", domain: "food", title: "ডায়াবেটিস", when: { flag: "diabetes" }, src: [SRC.ada, SRC.who],
    items: ["চিনি, মিষ্টি ও চিনিযুক্ত পানীয়/জুস সীমিত রাখুন", "সাদা ভাত, ময়দা ও মিষ্টি ফল একবারে বেশি পরিমাণে এড়ান"] },
  { id: "hypertension-food", domain: "food", title: "উচ্চ রক্তচাপ", when: { cond: "hypertension" }, src: [SRC.who, SRC.aha],
    items: ["বেশি লবণ, আচার, শুঁটকি ও প্যাকেটজাত/প্রক্রিয়াজাত খাবার সীমিত রাখুন", "পাতে বাড়তি লবণ নেওয়া এড়ান"] },
  { id: "heart-food", domain: "food", title: "হৃদরোগ/কোলেস্টেরল", when: { cond: ["heart", "cholesterol"] }, src: [SRC.aha, SRC.who],
    items: ["ভাজাপোড়া, ডালডা/বনস্পতি ও বেশি ঘি-তেল সীমিত রাখুন", "লাল মাংসের চর্বি ও প্রক্রিয়াজাত মাংস সীমিত রাখুন"] },
  { id: "kidney-food", domain: "food", title: "কিডনি রোগ", when: { flag: "kidney" }, src: [SRC.kdigo],
    items: ["বেশি লবণ ও প্রক্রিয়াজাত খাবার সীমিত রাখুন", "প্রোটিন, কলা/আলুর মতো পটাশিয়ামযুক্ত খাবার ও পানির পরিমাণ — ডাক্তারের নির্দেশ ছাড়া নিজে বদলাবেন না"] },
  { id: "pregnant-food", domain: "food", title: "গর্ভাবস্থা", when: { flag: "pregnant" }, src: [SRC.who, SRC.nhs],
    items: ["কাঁচা/আধা-সেদ্ধ মাংস, মাছ ও ডিম এড়ান", "না-ফোটানো (অপাস্তুরিত) দুধ ও তার তৈরি খাবার এড়ান", "চা-কফির ক্যাফেইন সীমিত রাখুন"] },
  { id: "infant-food", domain: "food", title: "১ বছরের কম বয়স", when: { ageMax: 0.999 }, src: [SRC.nhs, SRC.who],
    items: ["মধু দেবেন না", "চিনি, লবণ ও গরুর দুধ (মূল পানীয় হিসেবে) এড়ান — ডাক্তার/স্বাস্থ্যকর্মীর পরামর্শ নিন"] },
  { id: "young-food", domain: "food", title: "৫ বছরের কম বয়স", when: { ageMax: 4.999 }, src: [SRC.nhs],
    items: ["গোটা বাদাম, শক্ত/গোল খাবার গলায় আটকাতে পারে — গুঁড়া বা ছোট করে দিন", "চিনিযুক্ত পানীয় ও চা-কফি এড়ান"] },

  { id: "gut-food", domain: "food", title: "পেটের সমস্যা (IBS/গ্যাস্ট্রিক ইত্যাদি)", when: { cond: "gut" }, src: [SRC.nhs],
    items: ["ভাজাপোড়া, বেশি তেল-ঝাল-মসলা ও ফাস্টফুড সীমিত রাখুন", "চা-কফি, কার্বনেটেড/চিনিযুক্ত পানীয় সীমিত রাখুন", "যে খাবারে আপনার উপসর্গ বাড়ে তা লিখে রাখুন ও এড়ান; ডাক্তার/ডায়েটিশিয়ানের সাথে আলোচনা করুন"] },
  { id: "child-food", domain: "food", title: "১৩ বছরের কম বয়স", when: { ageMax: 12.999 }, src: [SRC.nhs, SRC.who],
    items: ["চিনিযুক্ত পানীয়, এনার্জি ড্রিংক ও চা-কফি এড়ান", "প্যাকেটজাত স্ন্যাকস ও মিষ্টি সীমিত রাখুন"] },

  { id: "diabetes-ex", domain: "exercise", title: "ডায়াবেটিস", when: { flag: "diabetes" }, src: [SRC.ada],
    items: ["ঘাম, কাঁপুনি বা ঝিমুনি শুরু হলে সাথে সাথে থামুন", "ওষুধ/ইনসুলিন চললে ব্যায়ামের সময়-পরিকল্পনা ডাক্তারের সাথে ঠিক করুন"] },
  { id: "hypertension-ex", domain: "exercise", title: "উচ্চ রক্তচাপ", when: { cond: "hypertension" }, src: [SRC.aha, SRC.who],
    items: ["ভারী ওজন তোলা ও দম আটকে রেখে জোর দেওয়া এড়ান", "হঠাৎ তীব্র ব্যায়াম নয় — ধীরে শুরু করুন"] },
  { id: "heart-ex", domain: "exercise", title: "হৃদরোগ", when: { cond: "heart" }, src: [SRC.aha],
    items: ["তীব্র ব্যায়ামের আগে ডাক্তারের অনুমতি নিন", "বুকে চাপ/ব্যথা বা শ্বাসকষ্টে সাথে সাথে থামুন"] },
  { id: "asthma-ex", domain: "exercise", title: "হাঁপানি", when: { cond: "asthma" }, src: [SRC.who],
    items: ["ধুলো, ধোঁয়া বা খুব ঠান্ডা বাতাসে তীব্র ব্যায়াম এড়ান", "শ্বাসকষ্ট শুরু হলে থামুন"] },
  { id: "gut-ex", domain: "exercise", title: "পেটের সমস্যা (IBS/গ্যাস্ট্রিক ইত্যাদি)", when: { cond: "gut" }, src: [SRC.nhs],
    items: ["খাওয়ার ঠিক পরে তীব্র ব্যায়াম এড়ান", "হাঁটা/স্ট্রেচিংয়ের মতো হালকা-মাঝারি ব্যায়াম বেছে নিন; পেটে চাপ পড়া ব্যায়ামে অস্বস্তি হলে থামুন"] },
  { id: "back-ex", domain: "exercise", title: "কোমর/পিঠ/ডিস্কের সমস্যা", when: { cond: "back" }, src: [SRC.nhs],
    items: ["ব্যথা বাড়ালে সাথে সাথে থামুন; ভারী ওজন তোলা ও সামনে ঝুঁকে জোর দেওয়া এড়ান", "কোন ব্যায়াম নিরাপদ তা ডাক্তার/ফিজিওথেরাপিস্টের সাথে ঠিক করুন"] },
  { id: "joint-ex", domain: "exercise", title: "হাঁটু/গিঁটের সমস্যা", when: { cond: "joint" }, src: [SRC.nhs],
    items: ["লাফ-ঝাঁপ ও গভীর বসার ব্যায়াম এড়ান; হাঁটা/সাইকেল/সাঁতারের মতো নরম ব্যায়াম বেছে নিন", "গিঁটে ব্যথা বা ফোলা বাড়লে থামুন"] },
  { id: "hernia-ex", domain: "exercise", title: "হার্নিয়া", when: { cond: "hernia" }, src: [SRC.nhs],
    items: ["পেটে চাপ পড়া ব্যায়াম (সিট-আপ, ক্রাঞ্চ, লেগ রেইজ) ও ভারী ওজন তোলা এড়ান", "ডাক্তারের অনুমতি ছাড়া কোর-ব্যায়াম নয়"] },
  { id: "kidney-ex", domain: "exercise", title: "কিডনি রোগ", when: { flag: "kidney" }, src: [SRC.kdigo],
    items: ["তীব্র বা দীর্ঘ ব্যায়ামের আগে ডাক্তারের পরামর্শ নিন"] },
  { id: "pregnant-ex", domain: "exercise", title: "গর্ভাবস্থা", when: { flag: "pregnant" }, src: [SRC.acog, SRC.who],
    items: ["সংঘর্ষের খেলা ও পড়ে যাওয়ার ঝুঁকির কাজ এড়ান", "অতিরিক্ত গরমে ব্যায়াম নয়; দীর্ঘক্ষণ চিত হয়ে শুয়ে থাকা এড়ান", "মাথা ঘোরা, রক্তপাত বা পেটে ব্যথায় থামুন ও ডাক্তার দেখান"] },
  { id: "child-ex", domain: "exercise", title: "১৮ বছরের কম বয়স", when: { ageMax: 17.999 }, src: [SRC.who],
    items: ["ভারী ওজন তোলা বড়দের তত্ত্বাবধান ছাড়া নয়"] },
  { id: "elder-ex", domain: "exercise", title: "৬৫+ বয়স", when: { ageMin: 65 }, src: [SRC.who],
    items: ["পড়ে যাওয়ার ঝুঁকি আছে এমন জায়গা/কাজ এড়ান; ভারসাম্যের ব্যায়াম যোগ করুন", "লাফ-ঝাঁপের মতো আঘাতপ্রবণ ব্যায়াম এড়ান"] },
];

function matches(when, { age, flags, condKeys }) {
  const f = flags || {};
  const ck = new Set(condKeys || []);
  if (when.flag) return !!f[when.flag];
  if (when.cond) return [].concat(when.cond).some((c) => ck.has(c));
  if (when.ageMax != null) return typeof age === "number" && age <= when.ageMax;
  if (when.ageMin != null) return typeof age === "number" && age >= when.ageMin;
  return false;
}

// age: বছর (দশমিক চলবে; শিশুর জন্য ১ বছরের কম হলে ০.x) বা null; ফল: [{ id, title, items, src }]
export function avoidFor(domain, { age = null, flags = {}, condKeys = [] } = {}) {
  return RULES.filter((r) => r.domain === domain && matches(r.when, { age, flags, condKeys }))
    .map((r) => ({ id: r.id, title: r.title, items: r.items, src: r.src.join(" / ") }));
}

// ধাপ ৬ — খাবারের সতর্কতা-ট্যাগ (foodCatalog TAGS) রোগ/বয়স মিললে "লাল" (কারণসহ); না মিললে ট্যাগ হলুদই থাকে।
// ctx: { age, flags, condKeys }। কিছু ব্লক করে না — শুধু রঙ/কারণ।
export function tagAvoidReason(tag, ctx = {}) {
  const { age = null, flags = {}, condKeys = [] } = ctx;
  if (tag === "gut" && condKeys.includes("gut")) return "পেটের সমস্যায় (IBS/গ্যাস্ট্রিক) এড়িয়ে চলুন";
  if (tag === "sugar" && flags.diabetes) return "ডায়াবেটিসে চিনি-জাতীয় খাবার এড়িয়ে চলুন";
  if (tag === "choke" && typeof age === "number" && age <= 4) return "৫ বছরের কম বয়সে গলায় আটকাতে পারে";
  if (tag === "caffeine" && typeof age === "number" && age <= 12) return "শিশুদের জন্য ক্যাফেইন এড়িয়ে চলুন";
  return null;
}
