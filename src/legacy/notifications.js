// Notification — Architecture Plan §3.4.2 (families/{familyId}/notifications/{notifId})
// ও firestore_rules_FINAL.md-এর notifications match-block অনুযায়ী। targetUid-ভিত্তিক
// (memberId না) — কারণ rules read/update/delete সরাসরি request.auth.uid দিয়ে verify করে।

import { db } from "./firebaseConfig.js";

export async function createNotification(familyId, targetUid, type, message) {
  const ref = db.collection("families").doc(familyId).collection("notifications").doc();
  await ref.set({
    targetUid, type, message,
    read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function listMyNotifications(familyId, uid) {
  const snap = await db.collection("families").doc(familyId).collection("notifications")
    .where("targetUid", "==", uid).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });
  return list;
}

export async function markNotificationRead(familyId, notifId) {
  await db.collection("families").doc(familyId).collection("notifications").doc(notifId).update({ read: true });
}

export async function deleteNotification(familyId, notifId) {
  await db.collection("families").doc(familyId).collection("notifications").doc(notifId).delete();
}
