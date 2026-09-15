// Wellness Guide (ব্লগ-স্টাইল স্বাস্থ্যকর জীবনযাপন নির্দেশিকা) data-layer।
// User-Owned Content model (amendment item ৩): যেকোনো family member লিখতে
// পারবেন (authorId = লেখকের memberId), শুধু নিজের লেখা edit করতে পারবেন,
// delete author বা Admin উভয়েই পারবেন (firestore.rules দ্রষ্টব্য)। পুরনো
// seed-content (scripts/populateWellnessGuides.js দিয়ে সরাসরি Admin-SDK-তে
// লেখা, familyId/authorId নেই) অপরিবর্তিত থাকে — সেগুলো শুধু script re-run
// দিয়েই edit হয়, আগের মতোই।

import { db } from "../../legacy/firebaseConfig.js";

export const WELLNESS_CATEGORIES = [
  ["general", "সাধারণ স্বাস্থ্য"],
  ["diet-fitness", "ডায়েট ও ফিটনেস"],
  ["child-care", "শিশু লালন-পালন"],
  ["women-health", "নারী স্বাস্থ্য"],
  ["elderly-care", "বয়স্কদের যত্ন"],
  ["chronic-disease-prevention", "জটিল রোগ প্রতিরোধ"],
  ["mental-health", "মানসিক স্বাস্থ্য"],
  ["skin-beauty", "ত্বক ও সৌন্দর্য"],
  ["sleep-lifestyle", "ঘুম ও জীবনযাত্রা"],
  ["first-aid-emergency", "প্রাথমিক চিকিৎসা ও জরুরি সচেতনতা"],
];

export async function listWellnessGuides(category) {
  let q = db.collection("wellnessGuides");
  if (category && category !== "all") q = q.where("category", "==", category);
  const snap = await q.get();
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // client-side sort (createdAt DESC) — composite index এড়াতে (existing
  // pattern, healthRecordsData.js-এর মতোই)।
  posts.sort((a, b) => {
    const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });
  return posts;
}

// ইন-অ্যাপ CRUD — যেকোনো family member পোস্ট যোগ করতে পারবেন, authorId নিজের
// memberId হিসেবে বসে (firestore.rules-এ enforce হয়)।
export async function createWellnessGuide(familyId, authorId, fields) {
  const ref = db.collection("wellnessGuides").doc();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await ref.set({
    familyId,
    authorId,
    category: fields.category,
    title: fields.title.trim(),
    summary: fields.summary ? fields.summary.trim() : "",
    body: fields.body.trim(),
    tags: fields.tags || [],
    ageRangeYears: fields.ageRangeYears || null,
    pregnancyMonthRange: fields.pregnancyMonthRange || null,
    sourceNote: fields.sourceNote ? fields.sourceNote.trim() : null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateWellnessGuide(guideId, fields) {
  await db.collection("wellnessGuides").doc(guideId).update({
    category: fields.category,
    title: fields.title.trim(),
    summary: fields.summary ? fields.summary.trim() : "",
    body: fields.body.trim(),
    tags: fields.tags || [],
    ageRangeYears: fields.ageRangeYears || null,
    pregnancyMonthRange: fields.pregnancyMonthRange || null,
    sourceNote: fields.sourceNote ? fields.sourceNote.trim() : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteWellnessGuide(guideId) {
  await db.collection("wellnessGuides").doc(guideId).delete();
}

export function formatAgeOrMonthRange(post) {
  if (post.ageRangeYears && post.ageRangeYears.length === 2) {
    return post.ageRangeYears[0] + "-" + post.ageRangeYears[1] + " বছর";
  }
  if (post.pregnancyMonthRange && post.pregnancyMonthRange.length === 2) {
    const [a, b] = post.pregnancyMonthRange;
    return a === b ? a + "ম মাস" : a + "-" + b + "ম মাস";
  }
  return null;
}
