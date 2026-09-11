// Wellness Guide (ব্লগ-স্টাইল স্বাস্থ্যকর জীবনযাপন নির্দেশিকা) data-layer।
// Global, family-independent collection (careEscalationDirectory-এর হুবহু একই
// pattern) — শুধু owner-run script (populateWellnessGuides.js) দিয়ে
// populate/edit হয়, client-write নেই (firestore.rules-এ allow write: if false)।

import { db } from "../../legacy/firebaseConfig.js";

export const WELLNESS_CATEGORIES = [
  ["general", "সাধারণ স্বাস্থ্য"],
  ["chronic-disease-prevention", "জটিল রোগ প্রতিরোধ"],
  ["child-care", "শিশুর যত্ন (১-১০ বছর)"],
  ["pregnancy", "গর্ভাবস্থা (মাসভিত্তিক)"],
  ["adult-age-range", "বয়সভিত্তিক (৩০+ )"],
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

// ইন-অ্যাপ Admin CRUD (২০২৬-০৯-১২ upgrade) — আগে শুধু owner-run script দিয়েই
// লেখা যেত, এখন firestore.rules-এ familyId-ভিত্তিক isAdminOfFamily() guard
// থাকায় Admin সরাসরি অ্যাপ থেকে পোস্ট যোগ/এডিট/ডিলিট করতে পারবেন।
export async function createWellnessGuide(familyId, fields) {
  const ref = db.collection("wellnessGuides").doc();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await ref.set({
    familyId,
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
