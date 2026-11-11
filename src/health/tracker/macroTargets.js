// ম্যাক্রো টার্গেট/সীমা — ক্যালরি-টার্গেট থেকে হিসাব (pure; নতুন কিছু সেভ হয় না, AI জড়িত নয়)।
// সাধারণ ১৮+ : প্রোটিন ২০% · কার্ব ৫০% · ফ্যাট ৩০% (IOM AMDR-এর ভেতরে); ডায়াবেটিস: কার্ব ৪৫%, ফ্যাট ৩৫%।
// ফাইবার: ১০০০ কিলোক্যালরিতে ১৪ গ্রাম (IOM)।
// <১৮, গর্ভাবস্থা/দুগ্ধদান, কিডনি রোগ: "সর্বোচ্চ সীমা" (max) — একাধিক প্রযোজ্য হলে প্রতিটার ছোটটাই।
//   <১৮: IOM AMDR-এর উপরসীমা (৪–১৮: প্রোটিন ৩০/কার্ব ৬৫/ফ্যাট ৩৫%; ১–৩: ২০/৬৫/৪০%)।
//   গর্ভাবস্থা: AMDR উপরসীমা (প্রোটিন ৩৫/কার্ব ৬৫/ফ্যাট ৩৫%)।
//   কিডনি (ডায়ালাইসিস ছাড়া CKD): প্রোটিন ≤ ০.৮ গ্রাম/কেজি/দিন (KDIGO 2024); ওজন না থাকলে প্রোটিন-সীমা দেখানো হয় না।
// সাধারণ গাইড; ডাক্তারের নির্দেশ আলাদা।

export const FIBER_PER_1000_KCAL = 14;
export const KIDNEY_PROTEIN_G_PER_KG = 0.8;
const KCAL_PER_G = { p: 4, c: 4, f: 9 };

const grams = (kcal, pct, key) => Math.round((kcal * pct / 100) / KCAL_PER_G[key]);
const minOf = (a, b) => (a === null ? b : b === null ? a : Math.min(a, b));

export function macroTargets({ kcal, age, weightKg, flags }) {
  if (!kcal || kcal <= 0 || age === null || age === undefined) return null;
  const f = flags || {};
  const fiber = Math.round((kcal / 1000) * FIBER_PER_1000_KCAL);

  const caps = []; // প্রতিটা: { p?, c?, f? } = কিলোক্যালরির %, pKg? = গ্রাম/কেজি
  if (age < 18) caps.push(age < 4 ? { p: 20, c: 65, f: 40 } : { p: 30, c: 65, f: 35 });
  if (f.pregnant) caps.push({ p: 35, c: 65, f: 35 });
  if (f.kidney) caps.push({ c: 65, f: 35, pKg: KIDNEY_PROTEIN_G_PER_KG });

  if (caps.length) {
    if (f.diabetes) caps.push({ c: 45, f: 35 });
    const out = { p: null, c: null, f: null };
    caps.forEach((cap) => {
      ["p", "c", "f"].forEach((k) => { if (cap[k] !== undefined) out[k] = minOf(out[k], grams(kcal, cap[k], k)); });
      if (cap.pKg && weightKg > 0) out.p = minOf(out.p, Math.round(cap.pKg * weightKg));
    });
    // কিডনিতে ওজন অজানা হলে প্রোটিনের কোনো নিরাপদ উপরসীমা নেই — দেখানো হয় না
    if (f.kidney && !(weightKg > 0)) out.p = null;
    return { mode: "max", ...out, fiber, note: "সর্বোচ্চ সীমা — আন্তর্জাতিক গাইড (WHO/IOM/KDIGO)। ডাক্তারের নির্দেশ আলাদা।" };
  }
  const split = f.diabetes ? { p: 20, c: 45, f: 35 } : { p: 20, c: 50, f: 30 };
  return { mode: "target", p: grams(kcal, split.p, "p"), c: grams(kcal, split.c, "c"), f: grams(kcal, split.f, "f"), fiber, note: "সাধারণ গাইড, ডাক্তারের নির্দেশ আলাদা।" };
}
