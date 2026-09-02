// Take-Access / AccessGrant — health-content read+write permission (Architecture
// Plan §11.1/§11.2, roadmap §3.5, firestore_rules_FINAL.md-এর accessGrants
// match-block অনুযায়ী)। Doc-ID deterministic: {granterId}_{granteeId}
// (granterId = যার প্রোফাইল/টার্গেট, granteeId = যিনি access চাচ্ছেন)।
//
// এই ধাপে শুধু non-structural (normal member↔member) Take-Access flow কভার
// করা হয়েছে — Admin/Parent-Child(<18) structural grant (§3.1.1,
// guardianMemberIds) এখনো implement হয়নি, পরবর্তী ধাপে যাবে।

import { db } from "./firebaseConfig.js";
import { createNotification } from "./notifications.js";

function grantRef(familyId, granterId, granteeId) {
  return db.collection("families").doc(familyId).collection("accessGrants").doc(granterId + "_" + granteeId);
}

async function memberOwnerUids(familyId, memberId) {
  const snap = await db.collection("families").doc(familyId).collection("members").doc(memberId).get();
  if (!snap.exists) return [];
  const data = snap.data();
  return Array.isArray(data.ownerUids) ? data.ownerUids : [];
}

// একজন সদস্যের সব claimed device (ownerUids, max ৩টা)-এই notification পাঠানো হয়,
// কারণ member-এর notification target uid-ভিত্তিক (§3.5.2 schema অনুযায়ী)।
async function notifyMember(familyId, memberId, type, message) {
  const uids = await memberOwnerUids(familyId, memberId);
  await Promise.all(uids.map((uid) => createNotification(familyId, uid, type, message)));
}

// ---- Grantee-side: request / cancel-pending ----

export async function requestAccess(familyId, granterId, granteeId, granteeName) {
  const ref = grantRef(familyId, granterId, granteeId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      granterId, granteeId,
      scope: "read+write",
      relationshipType: "other",
      status: "pending",
      revocable: true, // non-structural grant — উভয় পক্ষ থেকেই সবসময় cancel-যোগ্য (§3.5)
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // denied/cancelled → পুনরায় pending (rules-এর re-request branch, নতুন create না)
    await ref.update({ status: "pending" });
  }
  await notifyMember(familyId, granterId, "access-grant-request",
    (granteeName || "একজন সদস্য") + " আপনার প্রোফাইলে read+write-access-এর জন্য অনুরোধ করেছেন");
}

export async function cancelPendingRequest(familyId, granterId, granteeId) {
  await grantRef(familyId, granterId, granteeId).update({
    status: "cancelled",
    cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
    cancelledBy: granteeId,
  });
}

// ---- Granter-side: approve / deny incoming request ----

export async function decideIncomingRequest(familyId, granterId, granteeId, decision, granterName) {
  const payload = { status: decision }; // decision: "approved" | "denied"
  if (decision === "approved") payload.grantedAt = firebase.firestore.FieldValue.serverTimestamp();
  await grantRef(familyId, granterId, granteeId).update(payload);
  const msg = decision === "approved"
    ? (granterName || "একজন সদস্য") + " আপনার অনুরোধ গ্রহণ করেছেন"
    : (granterName || "একজন সদস্য") + " আপনার অনুরোধ প্রত্যাখ্যান করেছেন";
  await notifyMember(familyId, granteeId, "access-grant-decided", msg);
}

// ---- Either side: cancel an approved grant ----

export async function cancelApprovedGrant(familyId, granterId, granteeId, cancelledByMemberId, cancellerName) {
  await grantRef(familyId, granterId, granteeId).update({
    status: "cancelled",
    cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
    cancelledBy: cancelledByMemberId,
  });
  const otherMemberId = cancelledByMemberId === granterId ? granteeId : granterId;
  await notifyMember(familyId, otherMemberId, "access-grant-cancelled",
    (cancellerName || "একজন সদস্য") + " access বাতিল করেছেন");
}

// ---- Queries ----

// আমি (granteeId) যাদের কাছে access চেয়েছি — targetMemberId(granterId) -> grant
export async function listOutgoingGrants(familyId, granteeId) {
  const snap = await db.collection("families").doc(familyId).collection("accessGrants")
    .where("granteeId", "==", granteeId).get();
  const map = {};
  snap.docs.forEach((d) => { map[d.data().granterId] = { id: d.id, ...d.data() }; });
  return map;
}

// আমার (granterId) প্রোফাইলে অন্যরা কী কী request/grant পাঠিয়েছে — সব status
export async function listGranterGrants(familyId, granterId) {
  const snap = await db.collection("families").doc(familyId).collection("accessGrants")
    .where("granterId", "==", granterId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
