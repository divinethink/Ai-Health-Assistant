// খাবারের পুষ্টি-হিসাব (ধাপ ১খ)। pure; UI/Firestore-মুক্ত। ডেটা: foodNutrition.js (প্রতি ১০০ গ্রামে)।
// মোট = (প্রতি ১০০ গ্রামের মান ÷ ১০০) × গ্রাম। রাউন্ডিং: kcal পূর্ণসংখ্যা, ম্যাক্রো ১ দশমিক।
// ডেটা না থাকলে null — কলার তখন আগের মতো শুধু কিলোক্যালরি (k) ব্যবহার করবে।

import { nutritionOf } from "./foodNutrition.js";
import { bnNum } from "../../shared/dates.js";
import { MAX_GRAMS, MAX_KCAL, MAX_MACRO, MAX_QTY } from "./planPrefs.js";
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

// খাবারের মাপ-তালিকা [{id,label,g}] — না থাকলে খালি।
export function measuresOf(foodKey) {
  const n = nutritionOf(foodKey);
  return n ? n.measures.map((m) => ({ ...m })) : [];
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
  const m = n.measures.find((x) => x.id === measureId);
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
  return e.qty && Object.prototype.hasOwnProperty.call(FOODS, e.key) ? bnNum(e.qty) + " " + FOODS[e.key].u : "";
}
