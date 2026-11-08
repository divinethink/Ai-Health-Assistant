// খাবারের তালিকা (ধাপ D) — বাংলাদেশি খাবারের আনুমানিক ক্যালরি, গড় এক পরিবেশনে। pure data + সার্চ।
// ⚠ সংখ্যাগুলো সাধারণ খাদ্য-তালিকার গড় ধরে আনুমানিক; রান্না/পরিমাণে অনেক বদলায়। UI-তে সবসময় "আনুমানিক" লেখা।
// k = এক ইউনিটের কিলোক্যালরি; u = ইউনিট; g = গ্রুপ; al = এলার্জি-ট্যাগ (egg|fish|chicken|wheat|dairy)।
// tg = ঐচ্ছিক সতর্কতা-ট্যাগ (নিচের TAGS) — শুধু তথ্য-চিপ, কিছু ব্লক করে না; ব্লক শুধু al (এলার্জি)।
// swap নেই — এই খাবারগুলো বেস-প্ল্যানে নেই, শুধু "আমার প্ল্যান"/"আজ শুধু"-তে বাছা যায়; এলার্জি মিললে বাদ পড়ে।

export const FOOD_GROUPS = [
  ["rice", "ভাত-রুটি"], ["curry", "তরকারি-ডাল"], ["protein", "মাছ-মাংস-ডিম"],
  ["fruit", "ফল"], ["snack", "নাস্তা-মিষ্টি"], ["drink", "পানীয়"],
];


// সতর্কতা-ট্যাগ: [ছোট লেবেল, পূর্ণ বার্তা]। সাধারণ তথ্য — ব্যক্তিগত চিকিৎসা-পরামর্শ নয়; ডাক্তার/ডায়েটিশিয়ানের নির্দেশ প্রাধান্য পায়।
export const TAGS = {
  gut: ["পেট", "পেট-সংবেদনশীলতা (IBS/গ্যাস) থাকলে সীমিত রাখুন বা ডাক্তারের পরামর্শ নিন"],
  medgap: ["ব্যবধান", "থাইরয়েড/আয়রন-জাতীয় ওষুধ চললে ডাক্তারের নির্দেশমতো ২–৪ ঘণ্টা ব্যবধান রাখুন"],
  choke: ["গলায় আটকায়", "ছোট শিশুর (৫ বছরের নিচে) গলায় আটকাতে পারে — গুঁড়া/বাদ দিন"],
  caffeine: ["ক্যাফেইন", "ক্যাফেইন আছে — শিশুদের জন্য এড়িয়ে চলা ভালো"],
  sugar: ["চিনি", "চিনি বেশি — পরিমাণ সীমিত রাখুন"],
};

export function tagsOf(f) {
  return ((f && f.tg) || []).filter((t) => TAGS[t]);
}

export const CATALOG_FOODS = {
  // ভাত-রুটি
  porota: { n: "পরোটা", u: "টি", k: 230, al: "wheat", g: "rice" },
  pauruti: { n: "পাউরুটি", u: "স্লাইস", k: 70, al: "wheat", g: "rice" },
  khichuri: { n: "খিচুড়ি", u: "বাটি", k: 250, g: "rice" },
  polao: { n: "পোলাও", u: "কাপ", k: 250, g: "rice" },
  biryaniChicken: { n: "মুরগির বিরিয়ানি", u: "প্লেট", k: 500, al: "chicken", g: "rice" },
  tehari: { n: "তেহারি/কাচ্চি", u: "প্লেট", k: 550, g: "rice" },
  noodles: { n: "নুডলস", u: "বাটি", k: 250, al: "wheat", g: "rice" },
  chira: { n: "চিড়া (ভেজানো)", u: "বাটি", k: 150, g: "rice" },
  oats: { n: "ওটস", u: "বাটি", k: 150, g: "rice" },
  redRice: { n: "লাল চালের ভাত", u: "কাপ", k: 190, g: "rice" },
  redRoti: { n: "লাল আটার রুটি", u: "টি", k: 75, al: "wheat", g: "rice" },
  redChira: { n: "লাল চিড়া (ভেজানো)", u: "বাটি", k: 140, g: "rice" },
  sujiHalua: { n: "সুজির হালুয়া", u: "বাটি", k: 200, al: "wheat", g: "rice" },
  muriMakha: { n: "মুড়ি মাখা (কম তেল)", u: "বাটি", k: 120, g: "rice" },
  vegKhichuri: { n: "পাতলা সবজি খিচুড়ি", u: "বাটি", k: 200, g: "rice" },
  oatsVegKhichuri: { n: "ওটস-সবজি খিচুড়ি", u: "বাটি", k: 180, g: "rice" },
  ataPancake: { n: "আটা-সবজি প্যানকেক", u: "টি", k: 150, al: "wheat", g: "rice" },
  // তরকারি-ডাল
  aluBhorta: { n: "আলু ভর্তা", u: "বাটি", k: 130, g: "curry" },
  aluBhaji: { n: "আলু ভাজি", u: "বাটি", k: 150, g: "curry" },
  shak: { n: "শাক", u: "বাটি", k: 60, g: "curry" },
  begunBhaja: { n: "বেগুন ভাজা", u: "টুকরা", k: 50, g: "curry" },
  korolaBhaji: { n: "করলা ভাজি", u: "বাটি", k: 90, g: "curry" },
  dherosBhaji: { n: "ঢেঁড়স ভাজি", u: "বাটি", k: 90, g: "curry" },
  chhola: { n: "ছোলা (সেদ্ধ/ঘুগনি)", u: "বাটি", k: 200, g: "curry" },
  mugDal: { n: "পাতলা মুগ ডাল", u: "বাটি", k: 100, g: "curry" },
  lau: { n: "লাউ (হালকা রান্না)", u: "বাটি", k: 45, g: "curry" },
  patol: { n: "পটল (হালকা রান্না)", u: "বাটি", k: 50, g: "curry" },
  mishtiKumra: { n: "মিষ্টি কুমড়া", u: "বাটি", k: 60, g: "curry" },
  jhinge: { n: "ঝিঙে", u: "বাটি", k: 45, g: "curry" },
  palongShak: { n: "পালং শাক", u: "বাটি", k: 40, g: "curry" },
  kakrol: { n: "কাকরোল", u: "বাটি", k: 50, g: "curry" },
  kanchaKola: { n: "কাঁচা কলা", u: "বাটি", k: 100, g: "curry" },
  kochu: { n: "কচু", u: "বাটি", k: 90, g: "curry" },
  vegSoup: { n: "সবজি স্যুপ", u: "বাটি", k: 60, g: "curry" },
  daalSoup: { n: "ডাল স্যুপ", u: "বাটি", k: 90, g: "curry" },
  sprouts: { n: "স্প্রাউট (১০০ গ্রাম)", u: "বাটি", k: 30, g: "curry" },
  // মাছ-মাংস-ডিম
  hilshaBhaja: { n: "ইলিশ ভাজা", u: "টুকরা", k: 200, al: "fish", g: "protein" },
  hilshaJhol: { n: "ইলিশ ঝোল", u: "টুকরা", k: 170, al: "fish", g: "protein" },
  ruiJhol: { n: "রুই মাছ ঝোল", u: "টুকরা", k: 150, al: "fish", g: "protein" },
  chotoMach: { n: "ছোট মাছ", u: "বাটি", k: 150, al: "fish", g: "protein" },
  chingri: { n: "চিংড়ি", u: "বাটি", k: 180, al: "fish", g: "protein" },
  beef: { n: "গরুর মাংস", u: "টুকরা", k: 180, g: "protein" },
  mutton: { n: "খাসির মাংস", u: "টুকরা", k: 200, g: "protein" },
  eggFry: { n: "ডিম ভাজি", u: "টি", k: 120, al: "egg", g: "protein" },
  omelette: { n: "অমলেট", u: "টি", k: 150, al: "egg", g: "protein" },
  eggCurry: { n: "ডিমের তরকারি", u: "টি", k: 150, al: "egg", g: "protein" },
  eggWhite: { n: "ডিমের সাদা অংশ", u: "টি", k: 17, al: "egg", g: "protein" },
  eggYolk: { n: "ডিমের কুসুম", u: "টি", k: 55, al: "egg", g: "protein" },
  eggVegBhuna: { n: "ডিম-সবজি ভুনা", u: "বাটি", k: 160, al: "egg", g: "protein" },
  chickenJhol: { n: "মুরগির পাতলা ঝোল", u: "বাটি", k: 140, al: "chicken", g: "protein" },
  chickenSoup: { n: "মুরগির স্যুপ", u: "বাটি", k: 100, al: "chicken", g: "protein" },
  seaFishJhol: { n: "সামুদ্রিক মাছ ঝোল", u: "টুকরা", k: 140, al: "fish", g: "protein" },
  tofu: { n: "টফু (৩০ গ্রাম)", u: "পরিবেশন", k: 25, g: "protein", tg: ["medgap"] },
  // ফল
  mango: { n: "আম", u: "টি", k: 130, g: "fruit" },
  apple: { n: "আপেল", u: "টি", k: 95, g: "fruit", tg: ["gut"] },
  guava: { n: "পেয়ারা", u: "টি", k: 70, g: "fruit" },
  papaya: { n: "পেঁপে", u: "বাটি", k: 60, g: "fruit" },
  watermelon: { n: "তরমুজ", u: "বাটি", k: 45, g: "fruit", tg: ["gut"] },
  orange: { n: "কমলা", u: "টি", k: 60, g: "fruit" },
  grapes: { n: "আঙুর", u: "বাটি", k: 100, g: "fruit" },
  dates: { n: "খেজুর", u: "টি", k: 25, g: "fruit" },
  pineapple: { n: "আনারস", u: "বাটি", k: 80, g: "fruit" },
  cucumber: { n: "শসা", u: "টি", k: 20, g: "fruit" },
  carrot: { n: "গাজর", u: "টি", k: 25, g: "fruit" },
  pomegranate: { n: "ডালিম", u: "বাটি", k: 80, g: "fruit" },
  jam: { n: "জাম", u: "বাটি", k: 60, g: "fruit" },
  nashpati: { n: "নাশপাতি", u: "টি", k: 100, g: "fruit", tg: ["gut"] },
  // নাস্তা-মিষ্টি
  biscuit: { n: "বিস্কুট", u: "টি", k: 35, al: "wheat", g: "snack" },
  singara: { n: "সিঙ্গারা", u: "টি", k: 260, al: "wheat", g: "snack", tg: ["gut"] },
  piyaju: { n: "পিয়াজু", u: "টি", k: 60, g: "snack", tg: ["gut"] },
  beguni: { n: "বেগুনি", u: "টি", k: 80, g: "snack", tg: ["gut"] },
  aluChop: { n: "আলুর চপ", u: "টি", k: 150, g: "snack", tg: ["gut"] },
  fuchka: { n: "ফুচকা", u: "প্লেট", k: 200, al: "wheat", g: "snack" },
  chotpoti: { n: "চটপটি", u: "প্লেট", k: 250, g: "snack" },
  badam: { n: "ভাজা বাদাম", u: "মুঠো", k: 170, g: "snack", tg: ["choke"] },
  pitha: { n: "ভাপা পিঠা", u: "টি", k: 150, g: "snack" },
  payesh: { n: "পায়েস", u: "বাটি", k: 250, al: "dairy", g: "snack", tg: ["sugar"] },
  roshogolla: { n: "রসগোল্লা", u: "টি", k: 120, al: "dairy", g: "snack", tg: ["sugar"] },
  sondesh: { n: "সন্দেশ", u: "টি", k: 80, al: "dairy", g: "snack", tg: ["sugar"] },
  jilapi: { n: "জিলাপি", u: "টি", k: 150, al: "wheat", g: "snack", tg: ["sugar"] },
  mishtiDoi: { n: "মিষ্টি দই", u: "বাটি", k: 150, al: "dairy", g: "snack", tg: ["gut", "sugar"] },
  cake: { n: "কেক", u: "টুকরা", k: 250, al: "wheat", g: "snack", tg: ["sugar"] },
  haleem: { n: "হালিম", u: "বাটি", k: 300, al: "wheat", g: "snack" },
  kathBadam: { n: "কাঠবাদাম", u: "টি", k: 8, g: "snack", tg: ["choke"] },
  akhrot: { n: "আখরোট", u: "টি", k: 25, g: "snack", tg: ["choke"] },
  kajuBadam: { n: "কাজুবাদাম", u: "টি", k: 15, g: "snack", tg: ["choke"] },
  kumraBeej: { n: "মিষ্টি কুমড়ার বীজ", u: "চা-চামচ", k: 30, g: "snack", tg: ["choke"] },
  tishi: { n: "তিসি (ফ্ল্যাক্সসিড)", u: "চা-চামচ", k: 25, g: "snack" },
  isabgol: { n: "ইসবগুলের ভুসি", u: "চা-চামচ", k: 15, g: "snack", tg: ["medgap"] },
  oatsBiscuit: { n: "ওটস বিস্কুট", u: "টি", k: 50, al: "wheat", g: "snack", tg: ["sugar"] },
  honey: { n: "মধু", u: "চা-চামচ", k: 20, g: "snack", tg: ["sugar"] },
  // পানীয়
  milkTea: { n: "দুধ চা (চিনিসহ)", u: "কাপ", k: 80, al: "dairy", g: "drink", tg: ["caffeine", "sugar"] },
  milk: { n: "গরুর দুধ", u: "গ্লাস", k: 150, al: "dairy", g: "drink", tg: ["gut", "medgap"] },
  tokDoi: { n: "টক দই", u: "বাটি", k: 100, al: "dairy", g: "drink", tg: ["medgap"] },
  dabWater: { n: "ডাবের পানি", u: "গ্লাস", k: 45, g: "drink" },
  sugarcane: { n: "আখের রস", u: "গ্লাস", k: 180, g: "drink", tg: ["sugar"] },
  lemonSharbat: { n: "লেবুর শরবত (চিনিসহ)", u: "গ্লাস", k: 100, g: "drink", tg: ["sugar"] },
  softDrink: { n: "কোমল পানীয়", u: "গ্লাস", k: 100, g: "drink", tg: ["caffeine", "sugar"] },
  juice: { n: "ফলের জুস (প্যাকেট)", u: "গ্লাস", k: 110, g: "drink", tg: ["sugar"] },
  lassi: { n: "লাচ্ছি", u: "গ্লাস", k: 200, al: "dairy", g: "drink", tg: ["gut", "sugar"] },
  coffee: { n: "কফি (দুধ-চিনি)", u: "কাপ", k: 70, al: "dairy", g: "drink", tg: ["caffeine"] },
  tonedMilk: { n: "টোনড/স্কিম দুধ", u: "গ্লাস", k: 100, al: "dairy", g: "drink", tg: ["gut", "medgap"] },
  tokDoi100: { n: "টক দই (১০০ গ্রাম)", u: "পরিবেশন", k: 60, al: "dairy", g: "drink", tg: ["medgap"] },
  goldenWater: { n: "গোল্ডেন ওয়াটার (হলুদ-পানি)", u: "গ্লাস", k: 25, g: "drink" },
  gingerTea: { n: "আদা/তুলসী চা (চিনি ছাড়া)", u: "কাপ", k: 0, g: "drink" },
  redTea: { n: "লাল চা (চিনি ছাড়া)", u: "কাপ", k: 0, g: "drink", tg: ["caffeine"] },
  lemonWater: { n: "লেবু পানি (চিনি ছাড়া)", u: "গ্লাস", k: 5, g: "drink" },
  mintGingerWater: { n: "আদা-পুদিনা পানি", u: "গ্লাস", k: 5, g: "drink" },
};

// foods: FOODS-এর মতো অবজেক্ট। ফল: [{ key, f }] — এলার্জি-মেলা বাদ, নাম-সার্চ ও গ্রুপ-ফিল্টার, সীমা limit।
export function searchFoods(foods, { query = "", group = "", allergyTags = [], limit = 40 } = {}) {
  const q = String(query).trim().toLowerCase();
  const tags = new Set(allergyTags);
  const out = [];
  for (const [key, f] of Object.entries(foods)) {
    if (f.al && tags.has(f.al)) continue;
    if (group && f.g !== group) continue;
    if (q && !f.n.toLowerCase().includes(q)) continue;
    out.push({ key, f });
    if (out.length >= limit) break;
  }
  return out;
}
