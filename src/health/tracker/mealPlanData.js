// মিল-প্ল্যান — pure functions (AI/Firestore/UI জড়িত নয়)। ধাপ ২।
// স্থির বাংলাদেশি খাবারের তালিকা; ক্যালরি আনুমানিক (গড় পরিবেশন)।
// প্ল্যান: বেস-টেমপ্লেট (~১৫৭০) থেকে ধাপে ধাপে ভাত/রুটি/ডাল ইত্যাদির পরিমাণ বাড়িয়ে-কমিয়ে
// ক্যালরি-টার্গেটের কাছাকাছি আনা হয়। এলার্জি মিললে খাবার বদলে দেওয়া হয়।
// স্লটের `time` ধাপ ৩ (রিমাইন্ডার) আবার ব্যবহার করবে।

import { CATALOG_FOODS } from "./foodCatalog.js";

export const MEAL_SLOTS = [
  { id: "breakfast", label: "সকাল", time: "08:00" },
  { id: "snack1", label: "স্ন্যাকস", time: "11:00" },
  { id: "lunch", label: "দুপুর", time: "13:30" },
  { id: "snack2", label: "বিকাল", time: "16:00" },
  { id: "dinner", label: "রাত", time: "20:00" },
];

// k = এক ইউনিটের আনুমানিক কিলোক্যালরি; al = এলার্জি-ট্যাগ; swap = [বিকল্প খাবার, অনুপাত]
const CORE_FOODS = {
  roti: { n: "রুটি", u: "টি", k: 80, al: "wheat", swap: ["rice", 0.5], g: "rice" },
  rice: { n: "ভাত", u: "কাপ", k: 200, g: "rice" },
  dal: { n: "ডাল", u: "বাটি", k: 110, g: "curry" },
  veg: { n: "সবজি", u: "বাটি", k: 80, g: "curry" },
  salad: { n: "সালাদ", u: "বাটি", k: 25, g: "curry" },
  egg: { n: "সেদ্ধ ডিম", u: "টি", k: 75, al: "egg", swap: ["dal", 0.5], g: "protein" },
  fish: { n: "মাছ", u: "টুকরা", k: 130, al: "fish", swap: ["chicken", 1], g: "protein" },
  chicken: { n: "মুরগি", u: "টুকরা", k: 160, al: "chicken", swap: ["fish", 1], g: "protein" },
  banana: { n: "কলা", u: "টি", k: 90, g: "fruit" },
  muri: { n: "মুড়ি", u: "বাটি", k: 90, g: "snack" },
  tea: { n: "চা (চিনি ছাড়া)", u: "কাপ", k: 30, al: "dairy", swap: ["greentea", 1], g: "drink", tg: ["caffeine"] },
  greentea: { n: "গ্রিন টি", u: "কাপ", k: 0, g: "drink", tg: ["caffeine"] },
};

export const FOODS = { ...CORE_FOODS, ...CATALOG_FOODS };

// এলার্জি-ট্যাগ ← প্রোফাইলের এলার্জি-লেখার কী-ওয়ার্ড (ছোট হাতের)
const ALLERGY_KEYWORDS = {
  egg: ["egg", "ডিম"],
  fish: ["fish", "মাছ"],
  chicken: ["chicken", "poultry", "মুরগি", "মুরগী"],
  wheat: ["wheat", "gluten", "গম", "আটা", "গ্লুটেন", "রুটি"],
  dairy: ["milk", "dairy", "lactose", "দুধ", "দুগ্ধ", "ল্যাকটোজ"],
};

export function allergyTagsOf(substances) {
  const text = (substances || []).map((s) => String(s || "").toLowerCase());
  return Object.keys(ALLERGY_KEYWORDS).filter((tag) => text.some((t) => ALLERGY_KEYWORDS[tag].some((kw) => t.includes(kw))));
}

// বেস-টেমপ্লেট: [স্লট, খাবার, পরিমাণ]
const BASE = [
  ["breakfast", "roti", 2], ["breakfast", "veg", 1], ["breakfast", "egg", 1],
  ["snack1", "banana", 1],
  ["lunch", "rice", 1.5], ["lunch", "dal", 1], ["lunch", "fish", 1], ["lunch", "veg", 1],
  ["snack2", "muri", 1], ["snack2", "tea", 1],
  ["dinner", "roti", 2], ["dinner", "veg", 1], ["dinner", "chicken", 1], ["dinner", "salad", 1],
];

// বাড়ানো-কমানোর ধাপ (ঘুরে ঘুরে): [স্লট, খাবার, ধাপ, ন্যূনতম, সর্বোচ্চ]
const KNOBS = [
  ["lunch", "rice", 0.5, 0.5, 3],
  ["dinner", "roti", 1, 1, 5],
  ["breakfast", "roti", 1, 1, 4],
  ["lunch", "dal", 0.5, 0.5, 2],
  ["snack1", "banana", 1, 1, 2],
  ["snack2", "muri", 1, 1, 2],
];

export const kcalOf = (key, qty) => FOODS[key].k * qty;
const totalOf = (rows) => rows.reduce((s, r) => s + kcalOf(r[1], r[2]), 0);

export function qtyText(qty) {
  const whole = Math.floor(qty);
  const half = qty - whole >= 0.5;
  const bn = (n) => Number(n).toLocaleString("bn-BD");
  if (!half) return bn(whole);
  return whole === 0 ? "আধা" : whole === 1 ? "দেড়" : bn(whole) + "½";
}

export function itemText(key, qty) {
  const f = FOODS[key];
  return qtyText(qty) + (f.u === "টি" ? "" : " ") + f.u + " " + f.n;
}

// calorieTarget → { slots, total, notes }। allergyTags: allergyTagsOf() এর ফল।
export function buildMealPlan(calorieTarget, allergyTags) {
  const tags = new Set(allergyTags || []);
  const rows = BASE.map((r) => [...r]);

  // টার্গেটের কাছাকাছি আনা (±ধাপের অর্ধেক পর্যন্ত)
  let guard = 0;
  let moved = true;
  while (moved && guard++ < 60) {
    moved = false;
    for (const [slot, key, step, min, max] of KNOBS) {
      const row = rows.find((r) => r[0] === slot && r[1] === key);
      const diff = calorieTarget - totalOf(rows);
      const stepKcal = FOODS[key].k * step;
      if (diff >= stepKcal / 2 && row[2] + step <= max) { row[2] += step; moved = true; }
      else if (diff <= -stepKcal / 2 && row[2] - step >= min) { row[2] -= step; moved = true; }
    }
  }

  // এলার্জি-বদল (একবারই; বিকল্পও এলার্জিতে পড়লে খাবারটি বাদ)
  const notes = [];
  const final = [];
  rows.forEach(([slot, key, qty]) => {
    const f = FOODS[key];
    if (f.al && tags.has(f.al)) {
      const [altKey, ratio] = f.swap;
      const alt = FOODS[altKey];
      if (alt.al && tags.has(alt.al)) {
        notes.push(f.n + " বাদ দেওয়া হয়েছে (এলার্জি)।");
        return;
      }
      notes.push(f.n + " এর বদলে " + alt.n + " রাখা হয়েছে (এলার্জি)।");
      final.push([slot, altKey, qty * ratio, true]);
    } else final.push([slot, key, qty, false]);
  });

  const slots = MEAL_SLOTS.map((s) => {
    const items = final.filter((r) => r[0] === s.id).map(([, key, qty, swapped]) => ({
      key, qty, swapped, text: itemText(key, qty), kcal: Math.round(kcalOf(key, qty)),
    }));
    return { ...s, items, kcal: items.reduce((a, i) => a + i.kcal, 0) };
  });
  return { slots, total: slots.reduce((a, s) => a + s.kcal, 0), notes };
}

// টিক-করা স্লট-আইডি থেকে মোট ক্যালরি (আজকের caloriesIn)
export function caloriesForEaten(plan, eatenIds) {
  const set = new Set(eatenIds || []);
  return plan.slots.filter((s) => set.has(s.id)).reduce((a, s) => a + s.kcal, 0);
}
