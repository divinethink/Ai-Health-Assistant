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
  const normalizedTags = (tagValues || []).map((t) => String(t).toLowerCase());
  const matched = allRules.filter((rule) => {
    const tagValue = String(rule?.linkedTag?.value || "").toLowerCase();
    return normalizedTags.some((t) => t.includes(tagValue) || tagValue.includes(t));
  });

  const avoidFoods = [...new Set(matched.flatMap((r) => r.avoidFoods || []))];
  const includeFoods = [...new Set(matched.flatMap((r) => r.includeFoods || []))];
  return { avoidFoods, includeFoods, matchedTags: matched.map((r) => r.linkedTag?.value) };
}
