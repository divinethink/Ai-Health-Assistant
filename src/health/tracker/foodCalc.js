// খাবারের পুষ্টি-হিসাব (ধাপ ১খ)। pure; UI/Firestore-মুক্ত। ডেটা: foodNutrition.js (প্রতি ১০০ গ্রামে)।
// মোট = (প্রতি ১০০ গ্রামের মান ÷ ১০০) × গ্রাম। রাউন্ডিং: kcal পূর্ণসংখ্যা, ম্যাক্রো ১ দশমিক।
// ডেটা না থাকলে null — কলার তখন আগের মতো শুধু কিলোক্যালরি (k) ব্যবহার করবে।

import { nutritionOf } from "./foodNutrition.js";
import { extraMeasuresFor } from "./foodMeasures.js";
import { bnNum } from "../../shared/dates.js";
import { MAX_GRAMS, MAX_KCAL, MAX_MACRO, MAX_QTY, sanitizeExtraFoods, checkExtraFood } from "./planPrefs.js";
import { FOODS, MEAL_SLOTS, foodK, hasFoodOverride } from "./mealPlanData.js";

export const MIN_GRAMS = 1;
export const MAX_MEASURE_QTY = 100;

const r1 = (x) => Math.round(x * 10) / 10;

function validGrams(g) {
  const n = Number(g);
  return Number.isFinite(n) && n >= MIN_GRAMS && n <= MAX_GRAMS ? n : null;
}

// প্রতি ১০০ গ্রামের মান (UI-র "প্রতি ১০০ গ্রামে" লাইন) — না থাকলে null।
export function per100Of(foodKey) {
  const n = nutritionOf(foodKey);
  return n ? { ...n.per100 } : null;
}

// খাবারের মাপ-তালিকা [{id,label,g}] — না থাকলে খালি। প্রথমটি ডিফল্ট; তরল খাবারে কাটোরি/কাপ/চামচ শেষে যোগ (foodMeasures.js)।
export function measuresOf(foodKey) {
  const n = nutritionOf(foodKey);
  if (!n) return [];
  const base = n.measures.map((m) => ({ ...m }));
  return [...base, ...extraMeasuresFor(foodKey, base)];
}

// গ্রাম → { kcal, p, c, f, fib }; ডেটা নেই বা গ্রাম অবৈধ (১–২০০০-এর বাইরে/NaN) হলে null।
export function scaleNutrition(foodKey, grams) {
  const n = nutritionOf(foodKey);
  const g = validGrams(grams);
  if (!n || g === null) return null;
  const k = g / 100;
  const { kcal, p, c, f, fib } = n.per100;
  return { kcal: Math.round(kcal * k), p: r1(p * k), c: r1(c * k), f: r1(f * k), fib: r1(fib * k) };
}

// মাপ × পরিমাণ → গ্রাম (১ দশমিক পর্যন্ত — বাদামের মতো ছোট মাপের জন্য); খাবার/মাপ অজানা, পরিমাণ অবৈধ বা ফল ১–২০০০-এর বাইরে হলে null।
export function measureToGrams(foodKey, measureId, qty) {
  const n = nutritionOf(foodKey);
  const q = Number(qty);
  if (!n || !Number.isFinite(q) || q <= 0 || q > MAX_MEASURE_QTY) return null;
  const m = measuresOf(foodKey).find((x) => x.id === measureId);
  if (!m) return null;
  return validGrams(Math.round(m.g * q * 10) / 10);
}

// sanitize-করা extraFoods এন্ট্রির যোগফল। kcal সব এন্ট্রির (পুরনো {name,kcal,slot} সহ);
// ম্যাক্রো শুধু যে এন্ট্রিতে আছে তাদের। withMacro < total হলে UI "আংশিক" বোঝাতে পারে।
export function sumNutrition(entries) {
  const s = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, total: 0, withMacro: 0 };
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (!e || typeof e !== "object" || !Number.isFinite(e.kcal)) return;
    s.total++;
    s.kcal += e.kcal;
    if ([e.p, e.c, e.f].every(Number.isFinite)) {
      s.withMacro++;
      s.p += e.p; s.c += e.c; s.f += e.f; s.fib += Number.isFinite(e.fib) ? e.fib : 0;
    }
  });
  return { kcal: Math.round(s.kcal), p: r1(s.p), c: r1(s.c), f: r1(s.f), fib: r1(s.fib), total: s.total, withMacro: s.withMacro };
}

// ম্যাক্রো দেখানোর স্ট্রিং: ১ দশমিক, বাংলা অঙ্ক, ".০" থাকে (যেমন ১১.২, ৪.০)।
export function fmtMacro(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  return r1(n).toLocaleString("bn-BD", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ---------- ধাপ ২: খাবার-লগের pure সহায়ক ----------
const SLOT_IDS = MEAL_SLOTS.map((s) => s.id);

// বর্তমান সময়ের ডিফল্ট বেলা (লোকাল সময়)।
export function slotForNow(now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 600) return "breakfast";
  if (m < 750) return "snack1";
  if (m < 930) return "lunch";
  if (m < 1110) return "snack2";
  return "dinner";
}

// বেলা-ভিত্তিক ক্যালরি (শুধু তথ্য, ব্লক নয়): planned = কার্যকর প্ল্যানের বেলা-ক্যালরি;
// eaten = ওই বেলার নিজে-যোগ-করা খাবার + (টিক থাকলে) প্ল্যানের বেলা — caloriesForDay-এর একই সূত্র।
export function slotBudgets(plan, eatenIds, extras) {
  const ticked = new Set(Array.isArray(eatenIds) ? eatenIds : []);
  const list = Array.isArray(extras) ? extras : [];
  const out = {};
  ((plan && plan.slots) || []).forEach((s) => {
    const mine = list.filter((x) => x && x.slot === s.id && Number.isFinite(x.kcal)).reduce((a, x) => a + x.kcal, 0);
    out[s.id] = { planned: Math.round(s.kcal), eaten: Math.round(mine + (ticked.has(s.id) ? s.kcal : 0)) };
  });
  return out;
}

// "সাম্প্রতিক খাবার" (১-ট্যাপ যোগ): গত `days` দিনের (আজসহ) দৈনিক ডক থেকে পূর্ণ এন্ট্রি (পরিমাণ/গ্রাম/ম্যাক্রোসহ)।
// একই নাম (ছোট-হাতের) = এক খাবার; সবচেয়ে সাম্প্রতিক এন্ট্রিটি থাকে; ক্রম = ফ্রিকোয়েন্সি, তারপর নতুন, তারপর নাম।
// pure; নতুন Firestore read নেই। কলার বেলা (slot) বদলে নেবে।
export function recentFoodEntries(dailyDocs, { now = new Date(), days = 7, limit = 6 } = {}) {
  const p2 = (n) => String(n).padStart(2, "0");
  const dates = new Set(Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  }));
  const seen = new Map();
  (Array.isArray(dailyDocs) ? dailyDocs : []).forEach((doc) => {
    if (!doc || typeof doc !== "object" || !dates.has(doc.date)) return;
    sanitizeExtraFoods(doc.extraFoods).forEach((x) => {
      const k = x.name.toLowerCase();
      const cur = seen.get(k);
      if (!cur) seen.set(k, { entry: x, count: 1, last: doc.date });
      else { cur.count++; if (doc.date >= cur.last) { cur.last = doc.date; cur.entry = x; } }
    });
  });
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0) || a.entry.name.localeCompare(b.entry.name))
    .slice(0, Math.max(0, limit))
    .map((v) => ({ ...v.entry }));
}

// খাবার + পরিমাণ → extraFoods-এন্ট্রি (sanitizeExtraFoods-সঙ্গত) বা null (অবৈধ/সীমার বাইরে)।
// opts: { measureId, qty } অথবা { measureId: "g", grams }।
// ডেটা না থাকলে বা সদস্য নিজে খাবারের মান বদলে থাকলে (override) আগের মতো ক্যাটালগ-ইউনিট × qty, ম্যাক্রো ছাড়া।
export function buildFoodEntry(foodKey, slot, opts = {}) {
  const f = Object.prototype.hasOwnProperty.call(FOODS, foodKey) ? FOODS[foodKey] : null;
  if (!f || !SLOT_IDS.includes(slot)) return null;
  const name = f.n.slice(0, 40);
  if (!nutritionOf(foodKey) || hasFoodOverride(foodKey)) {
    const q = Number(opts.qty);
    if (!Number.isFinite(q) || q <= 0 || q > MAX_QTY) return null;
    const kcal = Math.round(foodK(foodKey) * q);
    return kcal > MAX_KCAL ? null : { name, kcal, slot, key: foodKey, qty: Math.round(q * 100) / 100 };
  }
  const out = { name, slot, key: foodKey };
  let g;
  if (opts.measureId === "g") {
    g = validGrams(opts.grams);
    if (g !== null) g = Math.round(g * 10) / 10;
  } else {
    g = measureToGrams(foodKey, opts.measureId, opts.qty);
    out.measure = opts.measureId;
    out.qty = Math.round(Number(opts.qty) * 100) / 100;
  }
  if (g === null) return null;
  const s = scaleNutrition(foodKey, g);
  if (!s || s.kcal > MAX_KCAL || [s.p, s.c, s.f, s.fib].some((x) => x > MAX_MACRO)) return null;
  return { name, kcal: s.kcal, slot, key: foodKey, ...(out.measure ? { measure: out.measure, qty: out.qty } : {}), grams: g, p: s.p, c: s.c, f: s.f, fib: s.fib };
}

// লগ-তালিকার পরিমাণ-লেখা: "১ বাটি ≈ ১৮০ গ্রাম" / "১৫০ গ্রাম" / "২ টুকরা" / ""।
export function entryAmountText(e) {
  if (!e || typeof e !== "object") return "";
  if (e.grams) {
    const m = measuresOf(e.key).find((x) => x.id === e.measure);
    return (m && e.qty ? bnNum(e.qty) + " " + m.label + " ≈ " : "") + bnNum(e.grams) + " গ্রাম";
  }
  if (!e.qty || !Object.prototype.hasOwnProperty.call(FOODS, e.key)) return "";
  const u = FOODS[e.key].u;
  // পুরনো/ইউনিট-মোড এন্ট্রিতেও গ্রাম দেখানো: ইউনিটের নামে মাপ মিললে (এবং নিজের-মান override না থাকলে) আনুমানিক গ্রাম।
  const m = hasFoodOverride(e.key) ? null : measuresOf(e.key).find((x) => x.label === u);
  return bnNum(e.qty) + " " + u + (m ? " ≈ " + bnNum(Math.round(m.g * e.qty * 10) / 10) + " গ্রাম" : "");
}

// "নিজে যোগ করুন" (খাবার ডেটায় নেই): নাম + কিলোক্যালরি (বাধ্যতামূলক), ম্যাক্রো/গ্রাম ঐচ্ছিক।
// ম্যাক্রোর যেকোনো একটি দিলে ফাঁকা ঘর ০ ধরা হয় (যোগফলে ধরার জন্য); সব ফাঁকা হলে ম্যাক্রো থাকে না।
// ফল: { entry } অথবা { error } — entry sanitizeExtraFoods-সঙ্গত (নতুন schema/ফিল্ড নেই)।
export function buildOwnFoodEntry(slot, f, currentCount) {
  const name = String((f && f.name) || "").replace(/\s+/g, " ").trim();
  const err = checkExtraFood(name, f && f.kcal, currentCount);
  if (err) return { error: err };
  const raw = { name, kcal: Number(f.kcal), slot };
  const filled = ["p", "c", "f", "fib"].filter((k) => f[k] !== undefined && f[k] !== null && String(f[k]).trim() !== "");
  if (filled.length) {
    for (const k of ["p", "c", "f", "fib"]) {
      const v = filled.includes(k) ? Number(f[k]) : 0;
      if (!Number.isFinite(v) || v < 0 || v > MAX_MACRO) return { error: "ম্যাক্রো ০–" + bnNum(MAX_MACRO) + " গ্রামের মধ্যে দিন।" };
      raw[k] = v;
    }
  }
  if (f.grams !== undefined && String(f.grams).trim() !== "") {
    const g = validGrams(f.grams);
    if (g === null) return { error: "গ্রাম " + bnNum(MIN_GRAMS) + "–" + bnNum(MAX_GRAMS) + "-এর মধ্যে দিন।" };
    raw.grams = g;
  }
  const out = sanitizeExtraFoods([raw])[0];
  return out ? { entry: out } : { error: "খাবারের তথ্য সঠিক নয়।" };
}
