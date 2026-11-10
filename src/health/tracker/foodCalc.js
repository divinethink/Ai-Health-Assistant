// খাবারের পুষ্টি-হিসাব (ধাপ ১খ)। pure; UI/Firestore-মুক্ত। ডেটা: foodNutrition.js (প্রতি ১০০ গ্রামে)।
// মোট = (প্রতি ১০০ গ্রামের মান ÷ ১০০) × গ্রাম। রাউন্ডিং: kcal পূর্ণসংখ্যা, ম্যাক্রো ১ দশমিক।
// ডেটা না থাকলে null — কলার তখন আগের মতো শুধু কিলোক্যালরি (k) ব্যবহার করবে।

import { nutritionOf } from "./foodNutrition.js";
import { MAX_GRAMS } from "./planPrefs.js";

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
