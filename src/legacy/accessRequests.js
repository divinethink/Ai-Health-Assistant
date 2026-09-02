// Family Join-Request flow (accessRequests, Admin-approve)। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।
//
// DailyTask-এর accessRequests pattern reuse (FamilyManagement.jsx/AccessRequestsModal
// + app.js-এর boot-time gate) — কিন্তু Health App-এ rules self-create শুধু
// status:'pending'-এ allow করে (DailyTask-এর সাময়িক moderation-off/auto-approve
// এখানে প্রযোজ্য না, firestore_rules_FINAL.md-এর accessRequests create-rule দ্রষ্টব্য)।
// এটা member-profile claim (Key/Direct-Identify) থেকে আলাদা — শুধু family-level
// "isFamilyMember" gate (roster/accessGrants ইত্যাদির prerequisite)।
//
// নোট: এটা Take-Access/AccessGrant (health-data permission, Architecture Plan
// §11.1)-এর থেকে সম্পূর্ণ ভিন্ন mechanism — নাম-সাদৃশ্য থাকলেও গুলিয়ে ফেলা যাবে না।

import { db } from "./firebaseConfig.js";

export async function ensureAccessRequest(familyId, uid) {
  const ref = db.collection("families").doc(familyId).collection("accessRequests").doc(uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data();
  const data = { status: "pending", requestedAt: firebase.firestore.FieldValue.serverTimestamp() };
  await ref.set(data);
  return data;
}

export function listenAccessRequest(familyId, uid, cb) {
  return db.collection("families").doc(familyId).collection("accessRequests").doc(uid)
    .onSnapshot((snap) => cb(snap.exists ? snap.data() : null));
}

export async function listPendingAccessRequests(familyId) {
  const snap = await db.collection("families").doc(familyId).collection("accessRequests")
    .where("status", "==", "pending").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function decideAccessRequest(familyId, requesterUid, decision) {
  await db.collection("families").doc(familyId).collection("accessRequests").doc(requesterUid).update({
    status: decision, // "approved" | "denied"
    decidedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
