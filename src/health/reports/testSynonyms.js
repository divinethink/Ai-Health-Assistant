// src/health/reports/testSynonyms.js
//
// বাংলাদেশি ল্যাবে প্রচলিত অতিরিক্ত টেস্ট-নাম (যেমন "F-T4")। Firestore testNameDictionary অপরিবর্তিত —
// fetch-এর পর এখানকার synonym মার্জ হয় (additive; DB-তে আলাদা populate/--force লাগে না)।
// Pure logic।

export const EXTRA_SYNONYMS = {
  ft4: ["F-T4", "F.T4", "FT-4", "Free T-4"],
  ft3: ["F-T3", "F.T3", "FT-3", "Free T-3"],
};

export function withExtraSynonyms(entries) {
  return (entries || []).map((e) => {
    const extra = EXTRA_SYNONYMS[e.id || e.testId];
    return extra ? { ...e, synonyms: [...new Set([...(e.synonyms || []), ...extra])] } : e;
  });
}
