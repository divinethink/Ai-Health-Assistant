// Health Episode / Chat-Session Model (Architecture Plan Part C §9, roadmap §10.3)।
//
// firestore.rules-এ healthEpisodes/{episodeId}, .../triageResults/{triageId},
// .../messages/{messageId} — সব rules ইতিমধ্যে deploy করা আছে (hasAccess-gated,
// max-severity-wins triage-flow-এর সাথে সংযুক্ত)। এই ফাইল শুধু client CRUD —
// healthRecordsData.js-এর অভিন্ন pattern reuse (Process Rule ২, Minimal Change)।
//
// গুরুত্বপূর্ণ field-নোট (rules-verified, firestore.rules L443-471):
//   - healthEpisodes create/update rule → doc-এ `lastEditedByMemberId` থাকা আবশ্যক
//     (hasAccess()-verification-এর জন্য, content-edit audit-trail না — Architecture
//     Plan §2 নোট)।
//   - triageResults create rule → doc-এ `memberId` + `lastEditedByMemberId` দুটোই লাগে।
//   - messages create rule → parent episode-এর memberId + caller-এর
//     callerMemberIdOf(familyId) দিয়েই verify হয়, message doc-এ আলাদা কোনো
//     permission-field লাগে না।

import { db } from "../../legacy/firebaseConfig.js";

function serverNow() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

function episodesCol(familyId) {
  return db.collection("families").doc(familyId).collection("healthEpisodes");
}

export async function createEpisode(familyId, memberId, callerMemberId, chiefComplaintTag) {
  const ref = episodesCol(familyId).doc();
  const now = serverNow();
  await ref.set({
    memberId,
    chiefComplaintTag: chiefComplaintTag || "general",
    status: "active",
    triageResultId: null,
    linkedConditionIds: [],
    lastEditedByMemberId: callerMemberId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

// triageResults subcollection-এ পূর্ণ TriageResult (§4 schema) সংরক্ষণ + parent
// episode-এ triageResultId reference/updatedAt sync।
export async function saveTriageResult(familyId, episodeId, memberId, callerMemberId, triageResult) {
  const epRef = episodesCol(familyId).doc(episodeId);
  const triageRef = epRef.collection("triageResults").doc();
  await triageRef.set({
    memberId,
    lastEditedByMemberId: callerMemberId,
    ...triageResult,
    createdAt: serverNow(),
  });
  await epRef.update({
    triageResultId: triageRef.id,
    lastEditedByMemberId: callerMemberId,
    updatedAt: serverNow(),
  });
  return triageRef.id;
}

// EpisodeMessage (§9 schema)। turnIndex caller (UI-state counter) থেকে আসে —
// আলাদা read-then-increment করলে অপ্রয়োজনীয় extra read লাগত (Process Rule ৮)।
export async function addMessage(familyId, episodeId, { turnIndex, layer, role, inputMode = null, content, extractedEntities = null }) {
  const ref = episodesCol(familyId).doc(episodeId).collection("messages").doc();
  await ref.set({
    episodeId,
    turnIndex: turnIndex != null ? turnIndex : null,
    layer,
    role,
    inputMode,
    content,
    extractedEntities,
    createdAt: serverNow(),
  });
  return ref.id;
}

export async function listMessages(familyId, episodeId) {
  const snap = await episodesCol(familyId).doc(episodeId).collection("messages").get();
  const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  msgs.sort((a, b) => {
    const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return at - bt;
  });
  return msgs;
}

// Archive — data অক্ষত থাকে, পরে reopen সম্ভব (§9 Archive/Delete State Machine)।
// Delete (২-ধাপ confirm) এই ধাপে scope-এ নেই — শুধু Archive বাস্তবায়িত হলো।
export async function archiveEpisode(familyId, episodeId, callerMemberId) {
  const ref = episodesCol(familyId).doc(episodeId);
  await ref.update({
    status: "archived",
    archivedAt: serverNow(),
    archivedBy: callerMemberId,
    lastEditedByMemberId: callerMemberId,
    updatedAt: serverNow(),
  });
}
