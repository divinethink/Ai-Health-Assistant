// Diet/Food Guidance — data-layer (amendment item ১,
// 1_1_1_1_Health_Assistant_Amendment_Plan_DRAFT.md)।
//
// `dietGuidanceRules` global collection medicineDatabase/careEscalationDirectory-এর
// একই read-only pattern অনুসরণ করে (§3.4.2 প্যাটার্ন reuse) — শুধু owner-run
// script populate করে (scripts/populateDietGuidanceRules.js)। ছোট (২০-৩০
// entry) collection বলে vector/full-text search লাগে না — পুরো verified-list
// একবারে fetch করে client-side tag-match করা হয় (§6.2 "structured query,
// vector-DB না" নীতির সাথে সংগতিপূর্ণ, নতুন composite-index এড়াতে)।

import { db } from "../../legacy/firebaseConfig.js";

// পুরো verified list — ছোট collection বলে ১ read-এই যথেষ্ট, বারবার আলাদা
// tag-ভিত্তিক query করার দরকার নেই।
export async function listVerifiedDietGuidanceRules() {
  const snap = await db.collection("dietGuidanceRules").where("status", "==", "verified").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Member-এর relevantConditions/relevantAllergies (healthContextEngine.js-এর
// buildHealthContext()-এ ইতিমধ্যে derive হওয়া tag-list, নতুন কিছু না) দিয়ে
// প্রাসঙ্গিক avoid/include food একত্রিত করে — case-insensitive substring-match
// (তালিকা ছোট বলে fuzzy-matching-এর জটিলতা এখনই দরকার নেই)।
export function matchDietGuidanceForTags(allRules, tagValues) {
  const normalizedTags = (tagValues || []).map((t) => String(t).toLowerCase().trim()).filter(Boolean);
  const tokensOf = (t) => t.split(/[^a-z0-9\u0980-\u09FF]+/).filter(Boolean);
  const matched = allRules.filter((rule) => {
    const main = String(rule?.linkedTag?.value || "").toLowerCase().trim();
    // optional `linkedTag.aliases` (সংক্ষিপ্ত/বাংলা/বিকল্প নাম: IBS, ডায়াবেটিস ইত্যাদি) — না থাকলে
    // আগের আচরণই। ≤৩ অক্ষরের alias (ibs/uti/flu…) শুধু পূর্ণ শব্দ হিসেবে মেলে, যাতে
    // "beauty"-র ভেতরের "uti"-র মতো accidental substring-match না হয়।
    const aliases = (Array.isArray(rule?.linkedTag?.aliases) ? rule.linkedTag.aliases : [])
      .map((v) => String(v || "").toLowerCase().trim()).filter(Boolean);
    return normalizedTags.some((t) => {
      if (main && (t.includes(main) || main.includes(t))) return true;
      return aliases.some((a) => (a.length <= 3 ? tokensOf(t).includes(a) : t.includes(a)));
    });
  });

  const avoidFoods = [...new Set(matched.flatMap((r) => r.avoidFoods || []))];
  const includeFoods = [...new Set(matched.flatMap((r) => r.includeFoods || []))];
  return { avoidFoods, includeFoods, matchedTags: matched.map((r) => r.linkedTag?.value) };
}
