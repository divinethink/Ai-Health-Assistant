// Backup & Restore — Data Portability (Architecture Plan Part C §8, roadmap §13)।
//
// এই ধাপে (P8) শুধু Device-local JSON export/import — Google Drive backup
// DailyTask-প্যাটার্ন থেকে reuse-যোগ্য কিন্তু owner-side নতুন Google OAuth
// Client ID setup প্রয়োজন বলে আলাদা পরবর্তী ধাপ হিসেবে রাখা হলো (Process Rule ২,
// Minimal Change — এখন যা দরকার নেই তা যোগ করা হচ্ছে না)।
//
// BackupFile schema হুবহু §8.2 অনুযায়ী। Restore merge-logic §8.4 অনুযায়ী —
// latest-updatedAt-ভিত্তিক, schemaVersion+familyId guard, ২-ধাপ dry-run(plan)
// → commit। Identity/Ownership Isolation (§8.4): restore কখনো ownerUids/
// ownerActivity/role touch করে না — member-এ শুধু name/dob/sex/bloodGroup/
// relationshipLabel/guardianMemberIds merge:true দিয়ে আপডেট হয়, বাকি সব
// field (ownerUids ইত্যাদি) doc-এ অক্ষত থাকে (Firestore partial-merge)।

import { db } from "./firebaseConfig.js";
import { listMembers } from "./familyIdentity.js";

export const BACKUP_SCHEMA_VERSION = 1;

function toMillis(v) {
  if (v && typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}
function toTimestampOrNow(ms) {
  return typeof ms === "number"
    ? firebase.firestore.Timestamp.fromMillis(ms)
    : firebase.firestore.FieldValue.serverTimestamp();
}

// শুধু health-content/basic-profile field — identity/ownership (ownerUids/
// ownerActivity/role) কখনো এখানে অন্তর্ভুক্ত হয় না, তাই backup ফাইলেও কখনো
// যায় না (structurally enforced isolation, §8.4)।
function memberBackupFields(m) {
  return {
    name: m.name || null,
    dob: m.dob || null,
    sex: m.sex || null,
    bloodGroup: m.bloodGroup !== undefined ? m.bloodGroup : null,
    relationshipLabel: m.relationshipLabel || null,
    guardianMemberIds: Array.isArray(m.guardianMemberIds) ? m.guardianMemberIds : [],
  };
}

function serializeRecord(doc) {
  const { createdAt, updatedAt, ...rest } = doc;
  return { ...rest, createdAt: toMillis(createdAt), updatedAt: toMillis(updatedAt) };
}

async function fetchByMemberIds(colRef, memberIds) {
  const results = await Promise.all(memberIds.map((mid) => colRef.where("memberId", "==", mid).get()));
  const out = [];
  results.forEach((snap) => snap.docs.forEach((d) => out.push(serializeRecord({ id: d.id, ...d.data() }))));
  return out;
}

export function buildBackupFileName(scope, familyId, memberId) {
  return scope === "family" ? `${familyId}_family.json` : `${familyId}_${memberId}_personal.json`;
}

// scope: "personal" (শুধু callerMemberId) | "family" (Admin-only, সব সদস্য, §8.1)।
export async function buildBackupPayload(familyId, scope, callerMemberId) {
  const famRef = db.collection("families").doc(familyId);
  const allMembers = await listMembers(familyId);
  const relevantMembers = scope === "family" ? allMembers : allMembers.filter((m) => m.id === callerMemberId);
  const memberIds = relevantMembers.map((m) => m.id);

  const healthRecords = await fetchByMemberIds(famRef.collection("healthRecords"), memberIds);
  const allEpisodes = await fetchByMemberIds(famRef.collection("healthEpisodes"), memberIds);
  // শুধু archived episode backup-এ যায় — active এখনো চলমান (§8.2 Confirmed নোট)।
  const healthEpisodes = allEpisodes.filter((e) => e.status === "archived");

  const msgResults = await Promise.all(
    healthEpisodes.map((e) => famRef.collection("healthEpisodes").doc(e.id).collection("messages").get())
  );
  const episodeMessages = [];
  msgResults.forEach((snap) => snap.docs.forEach((d) => episodeMessages.push(serializeRecord({ id: d.id, ...d.data() }))));

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    exportedBy: callerMemberId,
    scope,
    familyId,
    data: {
      members: relevantMembers.map((m) => ({ id: m.id, ...memberBackupFields(m) })),
      healthRecords,
      healthEpisodes,
      episodeMessages,
    },
  };
}

// ---- Restore: dry-run "plan" (কোনো write না) → পরে "commit" (আসল write) ----
// দুই ধাপ একই diff-logic শেয়ার করে যাতে preview ও আসল write কখনো আলাদা কিছু
// না করে (§11.3 RestorePreviewModal নীতির ভিত্তি)।

async function planFlatCollection(colRef, items, { isMember } = {}) {
  const added = [];
  const updated = [];
  const skipped = [];
  for (const item of items) {
    const { id } = item;
    const snap = await colRef.doc(id).get();
    if (!snap.exists) {
      // Member-doc backup থেকে fabricate করা হয় না — identity/credential
      // ছাড়া অসম্পূর্ণ profile তৈরির ঝুঁকি এড়াতে (§8.4 Isolation নীতির
      // সম্প্রসারণ)। health-content-এর জন্য এই সীমাবদ্ধতা প্রযোজ্য না।
      if (isMember) { skipped.push(id); continue; }
      added.push(item);
      continue;
    }
    const existingUpdatedAt = toMillis(snap.data().updatedAt) || 0;
    const incomingUpdatedAt = item.updatedAt || 0;
    if (incomingUpdatedAt > existingUpdatedAt) updated.push(item);
    else skipped.push(id);
  }
  return { added, updated, skipped };
}

// EpisodeMessage §9 schema অনুযায়ী immutable (শুধু create) — তাই আগে থেকে
// থাকলে কখনো "updated" হয় না, শুধু added/skipped।
async function planEpisodeMessages(famRef, items) {
  const added = [];
  const skipped = [];
  const byEpisode = {};
  items.forEach((it) => { (byEpisode[it.episodeId] = byEpisode[it.episodeId] || []).push(it); });
  for (const episodeId of Object.keys(byEpisode)) {
    const col = famRef.collection("healthEpisodes").doc(episodeId).collection("messages");
    for (const item of byEpisode[episodeId]) {
      const snap = await col.doc(item.id).get();
      if (snap.exists) skipped.push(item.id); else added.push(item);
    }
  }
  return { added, updated: [], skipped };
}

// Step 0 Schema/Family Guard (§8.4) — schemaVersion অসামঞ্জস্য বা অন্য পরিবারের
// backup হলে সরাসরি reject, কোনো partial/best-effort চেষ্টা না।
export async function planRestore(familyId, backupFile) {
  if (!backupFile || typeof backupFile !== "object" || !backupFile.data) {
    throw new Error("এই ব্যাকআপ ফাইলের ফরম্যাট চেনা যাচ্ছে না।");
  }
  if (backupFile.schemaVersion && backupFile.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error("এই ব্যাকআপ ফাইলটি অ্যাপের নতুন ভার্সনে তৈরি হয়েছে — অনুগ্রহ করে আগে অ্যাপ আপডেট করুন, তারপর রিস্টোর করুন।");
  }
  if (backupFile.familyId && backupFile.familyId !== familyId) {
    throw new Error("এই ব্যাকআপ ফাইলটি অন্য পরিবারের — এই পরিবারে রিস্টোর করা যাবে না।");
  }
  const famRef = db.collection("families").doc(familyId);
  const [members, healthRecords, healthEpisodes, episodeMessages] = await Promise.all([
    planFlatCollection(famRef.collection("members"), backupFile.data.members || [], { isMember: true }),
    planFlatCollection(famRef.collection("healthRecords"), backupFile.data.healthRecords || []),
    planFlatCollection(famRef.collection("healthEpisodes"), backupFile.data.healthEpisodes || []),
    planEpisodeMessages(famRef, backupFile.data.episodeMessages || []),
  ]);
  return { members, healthRecords, healthEpisodes, episodeMessages };
}

export function summarizePlan(plan) {
  return {
    added: plan.healthRecords.added.length + plan.healthEpisodes.added.length + plan.episodeMessages.added.length,
    updated: plan.members.updated.length + plan.healthRecords.updated.length + plan.healthEpisodes.updated.length,
    skipped:
      plan.members.skipped.length +
      plan.healthRecords.skipped.length +
      plan.healthEpisodes.skipped.length +
      plan.episodeMessages.skipped.length,
  };
}

async function writeMember(famRef, item) {
  await famRef.collection("members").doc(item.id).set(
    {
      name: item.name,
      dob: item.dob,
      sex: item.sex,
      bloodGroup: item.bloodGroup,
      relationshipLabel: item.relationshipLabel,
      guardianMemberIds: item.guardianMemberIds || [],
    },
    { merge: true }
  );
}
async function writeRecord(colRef, item) {
  const { id, createdAt, updatedAt, ...fields } = item;
  await colRef.doc(id).set(
    { ...fields, createdAt: toTimestampOrNow(createdAt), updatedAt: toTimestampOrNow(updatedAt) },
    { merge: true }
  );
}

// planRestore()-এর output-ই এখানে input হিসেবে আসে — নতুন করে re-read/re-diff
// হয় না, তাই preview-তে যা দেখানো হয়েছিল ঠিক তা-ই write হয় (কোনো race-gap না)।
export async function commitRestore(familyId, plan) {
  const famRef = db.collection("families").doc(familyId);

  await Promise.all(plan.members.updated.map((m) => writeMember(famRef, m)));
  await Promise.all(
    [...plan.healthRecords.added, ...plan.healthRecords.updated].map((r) => writeRecord(famRef.collection("healthRecords"), r))
  );
  await Promise.all(
    [...plan.healthEpisodes.added, ...plan.healthEpisodes.updated].map((e) => writeRecord(famRef.collection("healthEpisodes"), e))
  );

  const msgsByEpisode = {};
  plan.episodeMessages.added.forEach((m) => { (msgsByEpisode[m.episodeId] = msgsByEpisode[m.episodeId] || []).push(m); });
  await Promise.all(
    Object.keys(msgsByEpisode).map((episodeId) => {
      const col = famRef.collection("healthEpisodes").doc(episodeId).collection("messages");
      return Promise.all(msgsByEpisode[episodeId].map((m) => writeRecord(col, m)));
    })
  );
}
