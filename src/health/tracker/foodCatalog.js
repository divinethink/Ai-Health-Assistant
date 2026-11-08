// খাবারের তালিকা (ধাপ D) — বাংলাদেশি খাবারের আনুমানিক ক্যালরি, গড় এক পরিবেশনে। pure data + সার্চ।
// ⚠ সংখ্যাগুলো সাধারণ খাদ্য-তালিকার গড় ধরে আনুমানিক; রান্না/পরিমাণে অনেক বদলায়। UI-তে সবসময় "আনুমানিক" লেখা।
// k = এক ইউনিটের কিলোক্যালরি; u = ইউনিট; g = গ্রুপ; al = এলার্জি-ট্যাগ (egg|fish|chicken|wheat|dairy)।
// swap নেই — এই খাবারগুলো বেস-প্ল্যানে নেই, শুধু "আমার প্ল্যান"/"আজ শুধু"-তে বাছা যায়; এলার্জি মিললে বাদ পড়ে।

export const FOOD_GROUPS = [
  ["rice", "ভাত-রুটি"], ["curry", "তরকারি-ডাল"], ["protein", "মাছ-মাংস-ডিম"],
  ["fruit", "ফল"], ["snack", "নাস্তা-মিষ্টি"], ["drink", "পানীয়"],
];

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
  // তরকারি-ডাল
  aluBhorta: { n: "আলু ভর্তা", u: "বাটি", k: 130, g: "curry" },
  aluBhaji: { n: "আলু ভাজি", u: "বাটি", k: 150, g: "curry" },
  shak: { n: "শাক", u: "বাটি", k: 60, g: "curry" },
  begunBhaja: { n: "বেগুন ভাজা", u: "টুকরা", k: 50, g: "curry" },
  korolaBhaji: { n: "করলা ভাজি", u: "বাটি", k: 90, g: "curry" },
  dherosBhaji: { n: "ঢেঁড়স ভাজি", u: "বাটি", k: 90, g: "curry" },
  chhola: { n: "ছোলা (সেদ্ধ/ঘুগনি)", u: "বাটি", k: 200, g: "curry" },
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
  // ফল
  mango: { n: "আম", u: "টি", k: 130, g: "fruit" },
  apple: { n: "আপেল", u: "টি", k: 95, g: "fruit" },
  guava: { n: "পেয়ারা", u: "টি", k: 70, g: "fruit" },
  papaya: { n: "পেঁপে", u: "বাটি", k: 60, g: "fruit" },
  watermelon: { n: "তরমুজ", u: "বাটি", k: 45, g: "fruit" },
  orange: { n: "কমলা", u: "টি", k: 60, g: "fruit" },
  grapes: { n: "আঙুর", u: "বাটি", k: 100, g: "fruit" },
  dates: { n: "খেজুর", u: "টি", k: 25, g: "fruit" },
  pineapple: { n: "আনারস", u: "বাটি", k: 80, g: "fruit" },
  cucumber: { n: "শসা", u: "টি", k: 20, g: "fruit" },
  carrot: { n: "গাজর", u: "টি", k: 25, g: "fruit" },
  // নাস্তা-মিষ্টি
  biscuit: { n: "বিস্কুট", u: "টি", k: 35, al: "wheat", g: "snack" },
  singara: { n: "সিঙ্গারা", u: "টি", k: 260, al: "wheat", g: "snack" },
  piyaju: { n: "পিয়াজু", u: "টি", k: 60, g: "snack" },
  beguni: { n: "বেগুনি", u: "টি", k: 80, g: "snack" },
  aluChop: { n: "আলুর চপ", u: "টি", k: 150, g: "snack" },
  fuchka: { n: "ফুচকা", u: "প্লেট", k: 200, al: "wheat", g: "snack" },
  chotpoti: { n: "চটপটি", u: "প্লেট", k: 250, g: "snack" },
  badam: { n: "ভাজা বাদাম", u: "মুঠো", k: 170, g: "snack" },
  pitha: { n: "ভাপা পিঠা", u: "টি", k: 150, g: "snack" },
  payesh: { n: "পায়েস", u: "বাটি", k: 250, al: "dairy", g: "snack" },
  roshogolla: { n: "রসগোল্লা", u: "টি", k: 120, al: "dairy", g: "snack" },
  sondesh: { n: "সন্দেশ", u: "টি", k: 80, al: "dairy", g: "snack" },
  jilapi: { n: "জিলাপি", u: "টি", k: 150, al: "wheat", g: "snack" },
  mishtiDoi: { n: "মিষ্টি দই", u: "বাটি", k: 150, al: "dairy", g: "snack" },
  cake: { n: "কেক", u: "টুকরা", k: 250, al: "wheat", g: "snack" },
  haleem: { n: "হালিম", u: "বাটি", k: 300, al: "wheat", g: "snack" },
  // পানীয়
  milkTea: { n: "দুধ চা (চিনিসহ)", u: "কাপ", k: 80, al: "dairy", g: "drink" },
  milk: { n: "গরুর দুধ", u: "গ্লাস", k: 150, al: "dairy", g: "drink" },
  tokDoi: { n: "টক দই", u: "বাটি", k: 100, al: "dairy", g: "drink" },
  dabWater: { n: "ডাবের পানি", u: "গ্লাস", k: 45, g: "drink" },
  sugarcane: { n: "আখের রস", u: "গ্লাস", k: 180, g: "drink" },
  lemonSharbat: { n: "লেবুর শরবত (চিনিসহ)", u: "গ্লাস", k: 100, g: "drink" },
  softDrink: { n: "কোমল পানীয়", u: "গ্লাস", k: 100, g: "drink" },
  juice: { n: "ফলের জুস (প্যাকেট)", u: "গ্লাস", k: 110, g: "drink" },
  lassi: { n: "লাচ্ছি", u: "গ্লাস", k: 200, al: "dairy", g: "drink" },
  coffee: { n: "কফি (দুধ-চিনি)", u: "কাপ", k: 70, al: "dairy", g: "drink" },
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
