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

// সিয়াম/ফাস্টিং-এর দিনের অতিরিক্ত বেলা — শুধু খাবার-লগে (extraFoods.slot); প্ল্যান/রিমাইন্ডারে নেই।
export const FAST_SLOTS = [
  { id: "sehri", label: "সেহরি", time: "04:00" },
  { id: "iftar", label: "ইফতার", time: "18:30" },
];
export const FAST_SLOT_IDS = FAST_SLOTS.map((s) => s.id);
// দিনের বেলার খাওয়া = সিয়াম রাখা হয়নি ধরা হয় (সেহরি/ইফতার/রাত নয়)
export const DAYTIME_SLOT_IDS = ["breakfast", "snack1", "lunch", "snack2"];

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

// ---------- সদস্য-ওয়াইজ খাবার-ওভাররাইড (ধাপ ৩) ----------
// goal.planPrefs.foods = { খাবারের-key: { k: এক ইউনিটের কিলোক্যালরি, note: নিজের লেখা গুণাগুণ } } — মূল ক্যাটালগ অপরিবর্তিত।
// buildMealPlan()/applyMealPrefs() প্রতিবার prefs থেকে এটা সেট করে (একটাই জায়গা), তাই সদস্য বদলালে পুরনো মান থাকে না।
export const MAX_FOOD_OVERRIDES = 40;
export const MAX_FOOD_KCAL = 1500;
export const MAX_FOOD_NOTE = 120;
export function cleanFoodOverrides(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const key of Object.keys(raw)) {
    if (!Object.prototype.hasOwnProperty.call(FOODS, key)) continue;
    if (Object.keys(out).length >= MAX_FOOD_OVERRIDES) break;
    const r = raw[key];
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    const e = {};
    const k = Number(r.k);
    if (r.k !== undefined && r.k !== null && r.k !== "" && Number.isFinite(k) && k >= 0 && k <= MAX_FOOD_KCAL) e.k = Math.round(k);
    const note = typeof r.note === "string" ? r.note.replace(/\s+/g, " ").trim().slice(0, MAX_FOOD_NOTE) : "";
    if (note) e.note = note;
    if (Object.keys(e).length) out[key] = e;
  }
  return out;
}
let OV = {};
export const setFoodOverrides = (raw) => { OV = cleanFoodOverrides(raw); };
export const hasFoodOverride = (key) => Object.prototype.hasOwnProperty.call(OV, key);
export const foodK = (key) => (hasFoodOverride(key) && OV[key].k !== undefined ? OV[key].k : FOODS[key].k);
export const foodNote = (key) => (hasFoodOverride(key) && OV[key].note ? OV[key].note : "");

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

// বেলা-ভিত্তিক বরাদ্দ = আজকের ক্যালরি-টার্গেটের নির্দিষ্ট শতাংশ (সকাল ৩০, স্ন্যাকস ১০, দুপুর ৩০, বিকাল ১০, রাত ২০ = ১০০%)।
// শেষ বেলা (রাত) = টার্গেট − বাকিগুলো, তাই যোগফল সবসময় টার্গেটের সমান। শুধু দেখানোর জন্য — কিছু সেভ হয় না।
export const SLOT_SHARES = { breakfast: 30, snack1: 10, lunch: 30, snack2: 10, dinner: 20 };
export function slotTargets(target) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return null;
  const ids = Object.keys(SLOT_SHARES);
  const out = {};
  let used = 0;
  ids.slice(0, -1).forEach((id) => { out[id] = Math.round((t * SLOT_SHARES[id]) / 100); used += out[id]; });
  out[ids[ids.length - 1]] = Math.round(t) - used;
  return out;
}

// বাড়ানো-কমানোর ধাপ: [স্লট, খাবার, ধাপ, ন্যূনতম, সর্বোচ্চ]। প্রতি বেলা নিজের বরাদ্দের (slotTargets) কাছাকাছি আনা হয়;
// প্রতি বেলায় মোটা ধাপ আগে, সূক্ষ্ম ধাপ পরে — তাই বেলার ত্রুটি ≈ সূক্ষ্মতম ধাপের অর্ধেকের মধ্যে।
const KNOBS = [
  ["breakfast", "roti", 1, 1, 6], ["breakfast", "veg", 0.5, 0.5, 3],
  ["snack1", "banana", 1, 1, 3],
  ["lunch", "rice", 0.5, 0.5, 3], ["lunch", "dal", 0.5, 0.5, 2], ["lunch", "veg", 0.5, 0.5, 3],
  ["snack2", "muri", 0.5, 0.5, 2.5],
  ["dinner", "roti", 1, 1, 6], ["dinner", "veg", 0.5, 0.5, 3], ["dinner", "salad", 0.5, 0.5, 3],
];
// প্রতি বেলার সর্বোচ্চ বরাদ্দ (যোগফল ২৫৬৫) — অতি-বড় টার্গেটেও প্ল্যান আগের সীমা (~২৬০০) পার করে না
const SLOT_CAP = { breakfast: 760, snack1: 270, lunch: 760, snack2: 255, dinner: 520 };

export const kcalOf = (key, qty) => foodK(key) * qty;
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

// calorieTarget → { slots, total, notes }। allergyTags: allergyTagsOf() এর ফল; prefs (ঐচ্ছিক): goal.planPrefs — শুধু `foods` ওভাররাইড পড়ে।
// রোগ-ভিত্তিক খাবার-বদল (স্থির নিয়ম; AI/ডোজ নেই): [রোগ-শর্ত, স্লট|"*", পুরনো খাবার, নতুন খাবার, নোট]। ক্যালরি প্রায় সমান রেখে পরিমাণ বদলায়।
// উচ্চ রক্তচাপ: বেস-প্ল্যানে আচার/শুঁটকি/প্রক্রিয়াজাত খাবার নেই, তাই শুধু লবণ-নোট (নিচে)।
const COND_SWAPS = [
  { when: (h) => h.flags && h.flags.diabetes, slot: "snack1", from: "banana", to: "guava", note: "ডায়াবেটিসের জন্য কলার বদলে পেয়ারা রাখা হয়েছে।" },
  { when: (h) => h.condKeys && h.condKeys.includes("gut"), slot: "snack2", from: "tea", to: "papaya", note: "পেটের সমস্যার জন্য চায়ের বদলে পেঁপে রাখা হয়েছে।" },
  { when: (h) => h.condKeys && h.condKeys.includes("gut"), slot: "dinner", from: "salad", to: "veg", note: "পেটের সমস্যার জন্য কাঁচা সালাদের বদলে রান্না-করা সবজি রাখা হয়েছে।" },
];

export function buildMealPlan(calorieTarget, allergyTags, prefs, health) {
  setFoodOverrides(prefs && prefs.foods);
  const tags = new Set(allergyTags || []);
  const rows = BASE.map((r) => [...r]);

  // প্রতি বেলাকে নিজের বরাদ্দের কাছাকাছি আনা (±ধাপের অর্ধেক পর্যন্ত)। বরাদ্দ = টার্গেটের ৩০/১০/৩০/১০/২০%।
  const tg = slotTargets(Math.max(Number(calorieTarget) || 0, 1100)) || {}; // ১১০০ = প্ল্যানের ন্যূনতম মোট (আগের সীমা)
  Object.keys(tg).forEach((k) => { tg[k] = Math.min(tg[k], SLOT_CAP[k]); });
  let guard = 0;
  let moved = true;
  while (moved && guard++ < 80) {
    moved = false;
    for (const [slot, key, step, min, max] of KNOBS) {
      const row = rows.find((r) => r[0] === slot && r[1] === key);
      if (!row || tg[slot] === undefined) continue;
      const diff = tg[slot] - totalOf(rows.filter((r) => r[0] === slot));
      const stepKcal = foodK(key) * step;
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
        notes.push(f.n + " বাদ দেওয়া হয়েছে (অ্যালার্জি)।");
        return;
      }
      notes.push(f.n + " এর বদলে " + alt.n + " রাখা হয়েছে (অ্যালার্জি)।");
      final.push([slot, altKey, qty * ratio, true]);
    } else final.push([slot, key, qty, false]);
  });

  // রোগ-ভিত্তিক বদল (এলার্জি-বদলের পরে); নতুন খাবার এলার্জিতে পড়লে বদল হয় না
  const h = health || {};
  COND_SWAPS.forEach((rule) => {
    if (!rule.when(h)) return;
    const row = final.find((r) => r[0] === rule.slot && r[1] === rule.from);
    const nf = FOODS[rule.to];
    if (!row || !nf || (nf.al && tags.has(nf.al))) return;
    const q = Math.max(0.5, Math.round((row[2] * foodK(rule.from) / Math.max(foodK(rule.to), 1)) * 2) / 2);
    const same = final.find((r) => r !== row && r[0] === rule.slot && r[1] === rule.to);
    if (same) { same[2] += q; final.splice(final.indexOf(row), 1); } else { row[1] = rule.to; row[2] = q; row[3] = true; }
    notes.push(rule.note);
  });
  if (h.condKeys && h.condKeys.includes("hypertension")) notes.push("উচ্চ রক্তচাপ: রান্নায় লবণ কম দিন; আচার, শুঁটকি ও প্যাকেটজাত খাবার এড়ান।");

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
