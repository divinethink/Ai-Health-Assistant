// Take-Access / AccessGrant — health-content read+write permission (Architecture
// Plan §11.1/§11.2, roadmap §3.5, firestore_rules_FINAL.md-এর accessGrants
// match-block অনুযায়ী)। Doc-ID deterministic: {granterId}_{granteeId}
// (granterId = যার প্রোফাইল/টার্গেট, granteeId = যিনি access চাচ্ছেন)।
//
// এই থ্রেডে যোগ হলো: Parent-Child(<18) structural grant create/cancel
// (Architecture Plan §3.1.1) ও ১৮+ revocable-flip check (roadmap §3.6)।
// rules-এ এই branch-গুলো আগে থেকেই ready ছিল, এখানে শুধু client-call।

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
// exported — health-record delete-notification (roadmap §3.4 Admin delete-override
// safeguard)-এও reuse হয় (Process ফাইল Rule ১১: duplicate notify-logic এড়ানো)
export async function notifyMember(familyId, memberId, type, message) {
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

// ---- Structural (Admin-triggered, Parent-Child<18) grant — Architecture Plan §3.1.1 ----
// granterId = childId (সন্তান, target member), granteeId = guardianId।
// rules-এ ইতিমধ্যে ready branches ব্যবহার করে: Admin create (approved+non-revocable),
// Admin cancel (approved->cancelled), Admin re-approve (cancelled->approved)।

export async function createStructuralGrant(familyId, childId, guardianId) {
  const ref = grantRef(familyId, childId, guardianId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      granterId: childId, granteeId: guardianId,
      scope: "read+write",
      relationshipType: "parent-child",
      status: "approved",
      revocable: false,
      grantedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } else if (snap.data().status === "cancelled" && snap.data().revocable === false) {
    // আগে guardian ছিলেন, সরানো হয়েছিল, আবার যোগ হচ্ছেন — same doc পুনরায় approved
    await ref.update({ status: "approved", grantedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
  // ইতিমধ্যে approved থাকলে কিছুই করার দরকার নেই (idempotent)
}

export async function cancelStructuralGrant(familyId, childId, guardianId, cancelledByMemberId) {
  const ref = grantRef(familyId, childId, guardianId);
  const snap = await ref.get();
  if (snap.exists && snap.data().status === "approved" && snap.data().revocable === false) {
    await ref.update({
      status: "cancelled",
      cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
      cancelledBy: cancelledByMemberId,
    });
  }
}

// ---- ১৮+ soft-notify transition (roadmap §3.6) ----
// প্রতিটা structural parent-child grant (granterId==member.id)-এর জন্য member-এর
// বয়স ≥18 হলে revocable:false -> true flip করে + এক-বারের informational
// notification (guardian ও child উভয়কে, যদি claim করা থাকে)। localStorage flag
// দিয়ে একই গ্রান্ট বারবার re-check/re-notify এড়ানো হয় (soft-notify, non-blocking)।

function calcAge(dob) {
  if (!dob) return null;
  const b = new Date(dob + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export async function checkAndFlip18Transition(familyId, members) {
  const flagKey = "hAssist18FlipDone_" + familyId;
  let done;
  try { done = JSON.parse(localStorage.getItem(flagKey) || "{}"); } catch (e) { done = {}; }
  let changed = false;

  for (const m of members) {
    const age = calcAge(m.dob);
    if (age === null || age < 18) continue;

    const snap = await db.collection("families").doc(familyId).collection("accessGrants")
      .where("granterId", "==", m.id)
      .where("relationshipType", "==", "parent-child")
      .get();

    for (const d of snap.docs) {
      const g = d.data();
      if (g.revocable === false && !done[d.id]) {
        await d.ref.update({ revocable: true });
        const msg = (m.name || "সন্তান") + " আইনগতভাবে প্রাপ্তবয়স্ক হয়েছে; পরিবার চাইলে profile-control transition বিবেচনা করতে পারে।";
        const [guardianUids, childUids] = await Promise.all([
          memberOwnerUids(familyId, g.granteeId),
          memberOwnerUids(familyId, g.granterId),
        ]);
        const targetUids = Array.from(new Set([...guardianUids, ...childUids]));
        await Promise.all(targetUids.map((uid) => createNotification(familyId, uid, "adult-transition-notice", msg)));
        done[d.id] = true;
        changed = true;
      }
    }
  }

  if (changed) {
    try { localStorage.setItem(flagKey, JSON.stringify(done)); } catch (e) { /* storage full/unavailable — ignore, non-critical */ }
  }
}
