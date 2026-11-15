// src/health/reports/builtinTests.js
//
// অ্যাপে-বিল্ট-ইন টেস্ট (Firestore testNameDictionary অপরিবর্তিত; fetch-এর পর মার্জ — testSynonyms.js-এর মতো
// additive, DB-তে আলাদা populate লাগে না)। এখন: প্রস্রাবের R/M/E (Urine Routine/Microscopic/Examination)।
//
// `kind`:
//   "numeric"      — সংখ্যা, এককহীন (S. Gravity 1.015, pH 6.0)
//   "count"        — মাইক্রোস্কোপির গণনা (4-5 /HPF, Nil); সতর্কতা = রেঞ্জের উপরের সীমা ছাড়ালে
//   "qualitative"  — Nil/Negative/Positive/Trace/+ ; Nil/Negative/Absent ছাড়া যেকোনো মান = সতর্কতা
// `context: "urine"` — রিপোর্টের লেখায় প্রস্রাব-রিপোর্টের চিহ্ন না থাকলে এই এন্ট্রি মেলানো হয় না
// (সাধারণ রক্ত-রিপোর্টের "Protein"/"Sugar"/"PH" ভুল ধরা ঠেকাতে)।
// `referenceRange`-এর `{0,0}` = প্রত্যাশিত "Nil"। ল্যাবের নিজের রেঞ্জ রিপোর্ট-লাইন থেকে পড়া হলে সেটাই আগে।

const u = (id, canonicalNameEn, canonicalName, kind, synonyms, extra = {}) => ({
  id, testId: id, canonicalNameEn, canonicalName, category: "urine", context: "urine", kind,
  synonyms, referenceRange: null, plausibleRange: null, unit: "", ...extra,
});

export const BUILTIN_TESTS = [
  u("urine-sg", "Urine Specific Gravity", "প্রস্রাবের আপেক্ষিক গুরুত্ব", "numeric", ["S. Gravity", "S.Gravity", "Specific Gravity", "Sp. Gravity", "Sp.Gr"],
    { shortName: "Urine S. Gravity", referenceRange: { low: 1.01, high: 1.03 }, plausibleRange: { low: 1.0, high: 1.06 }, rangeText: "1.010–1.030" }),
  u("urine-ph", "Urine pH", "প্রস্রাবের pH", "numeric", ["PH"],
    { shortName: "Urine pH", referenceRange: { low: 4.5, high: 8.0 }, plausibleRange: { low: 3.5, high: 9.5 } }),

  u("urine-protein", "Urine Protein", "প্রস্রাবে প্রোটিন", "qualitative", ["Urine Protein", "Protein", "Albumin"], { shortName: "Urine Protein" }),
  u("urine-sugar", "Urine Sugar", "প্রস্রাবে সুগার", "qualitative", ["Urine Sugar", "Sugar", "Glucose"], { shortName: "Urine Sugar" }),
  u("urine-ketone", "Urine Ketone", "প্রস্রাবে কিটোন", "qualitative", ["Ketone", "Ketones", "Ketone Bodies"], { shortName: "Urine Ketone" }),
  u("urine-bilirubin", "Urine Bilirubin", "প্রস্রাবে বিলিরুবিন", "qualitative", ["Bilirubin"], { shortName: "Urine Bilirubin" }),
  u("urine-urobilinogen", "Urine Urobilinogen", "প্রস্রাবে ইউরোবিলিনোজেন", "qualitative", ["Urobilinogen"], { shortName: "Urine Urobilinogen" }),
  u("urine-nitrite", "Urine Nitrite", "প্রস্রাবে নাইট্রাইট", "qualitative", ["Nitrite"], { shortName: "Urine Nitrite" }),
  u("urine-leukocytes", "Urine Leukocytes", "প্রস্রাবে লিউকোসাইট", "qualitative", ["Leukocytes", "Leucocytes", "Leukocyte Esterase"], { shortName: "Urine Leukocytes" }),

  u("urine-pus", "Urine Pus Cells (WBC)", "প্রস্রাবে পুঁজকোষ", "count", ["Pus Cells/WBC", "Pus Cells", "Pus Cell"],
    { unit: "/HPF", shortName: "Urine Pus Cells", referenceRange: { low: 0, high: 5 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-epithelial", "Urine Epithelial Cells", "প্রস্রাবে এপিথেলিয়াল কোষ", "count", ["Epithelial Cells", "Epithelial Cell"],
    { unit: "/HPF", shortName: "Urine Epithelial Cells", referenceRange: { low: 0, high: 5 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-rbc", "Urine RBC", "প্রস্রাবে লোহিত কণিকা", "count", ["RBC", "R.B.C"],
    { unit: "/HPF", shortName: "Urine RBC", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 }, excludeAfter: /^\s*(casts?|cells?)\b/i }),
  u("urine-cast-hyaline", "Urine Hyaline Cast", "প্রস্রাবে হায়ালিন কাস্ট", "count", ["Hyline Cast", "Hyaline Cast"],
    { unit: "/HPF", shortName: "Urine Hyaline Cast", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-cast-granular", "Urine Granular Cast", "প্রস্রাবে গ্রানুলার কাস্ট", "count", ["Granular Cast"],
    { unit: "/HPF", shortName: "Urine Granular Cast", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-cast-wbc", "Urine WBC Cast", "প্রস্রাবে WBC কাস্ট", "count", ["WBC Cast"],
    { unit: "/HPF", shortName: "Urine WBC Cast", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-cast-rbc", "Urine RBC Cast", "প্রস্রাবে RBC কাস্ট", "count", ["RBC Cast"],
    { unit: "/HPF", shortName: "Urine RBC Cast", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-triple-phosphate", "Urine Triple Phosphate", "প্রস্রাবে ট্রিপল ফসফেট", "count", ["Tripple Phosphate", "Triple Phosphate"],
    { unit: "/HPF", shortName: "Urine Triple Phosphate", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-amorphous", "Urine Amorphous Phosphate", "প্রস্রাবে অ্যামরফাস ফসফেট", "count", ["Amorphous Phos", "Amorphous Phosphate", "Amorphous Urate"],
    { unit: "/HPF", shortName: "Urine Amorphous Phosphate", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-calcium-oxalate", "Urine Calcium Oxalate", "প্রস্রাবে ক্যালসিয়াম অক্সালেট", "count", ["Calcium Oxalate"],
    { unit: "/HPF", shortName: "Urine Calcium Oxalate", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-uric-acid", "Urine Uric Acid Crystal", "প্রস্রাবে ইউরিক অ্যাসিড ক্রিস্টাল", "count", ["Uric Acid"],
    { unit: "/HPF", shortName: "Urine Uric Acid Crystal", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-yeast", "Urine Yeast", "প্রস্রাবে ইস্ট", "count", ["Yeast"],
    { unit: "/HPF", shortName: "Urine Yeast", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
  u("urine-bacteria", "Urine Bacteria", "প্রস্রাবে ব্যাকটেরিয়া", "count", ["Bacteria"],
    { unit: "/HPF", shortName: "Urine Bacteria", referenceRange: { low: 0, high: 0 }, plausibleRange: { low: 0, high: 1000 } }),
];

/** Firestore-এর entries-এর সাথে বিল্ট-ইন মেলানো — একই id Firestore-এ থাকলে Firestore-এরটাই থাকে (অবিচ্ছিন্ন, additive) */
export function withBuiltinTests(entries) {
  const base = entries || [];
  const have = new Set(base.map((e) => e.id || e.testId));
  return [...base, ...BUILTIN_TESTS.filter((b) => !have.has(b.id))];
}
