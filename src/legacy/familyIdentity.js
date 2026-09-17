// Family Code লাইফসাইকেল (তৈরি/uniqueness) + generic member profile-edit/
// listing helper। Google Sign-in Amendment (Architecture Part A §3.0) — এই
// ফাইল থেকে Member-Key generation/Direct-Identify claim/FIFO-eviction
// (generateUniqueMemberKey, claimByKey, addMemberByAdmin, fetchMemberKey,
// sha256Hex, resolveFamilyIdByCode) সম্পূর্ণ বাদ দেওয়া হয়েছে — এখন কোনো
// real member/data না থাকায় migration ছাড়াই সরাসরি বাদ (owner-approved)।
// প্রতিস্থাপন: src/legacy/googleAuth.js (createFamilyAndOwnProfile,
// addGuardianManagedMember, signInExistingMemberByGoogle, Invite-Link)।

import { db } from "./firebaseConfig.js";

export const FAMILY_CODE_MIN_LENGTH = 6;
export const FAMILY_CODE_MAX_LENGTH = 30;
const FAMILY_CODE_CHARSET_PATTERN = /^(?!__.*__$)[A-Za-z0-9_-]+$/;

export function isFamilyCodeValid(code) {
  return (
    code.length >= FAMILY_CODE_MIN_LENGTH &&
    code.length <= FAMILY_CODE_MAX_LENGTH &&
    FAMILY_CODE_CHARSET_PATTERN.test(code)
  );
}
export function normalizeCode(code) {
  return (code || "").trim().toLowerCase();
}

// নতুন family তৈরি (§3.3 — শুধু নতুন family তৈরির সময়ই Family Code
// ব্যবহৃত হয়, বিদ্যমান family-তে join করার জন্য না, Invite-Link-ই একমাত্র
// পথ)। googleAuth.js-এর createFamilyAndOwnProfile() এই ফাংশন কল করে তারপর
// own admin-member profile তৈরি করে।
export async function createFamily(rawCode, uid) {
  const trimmed = (rawCode || "").trim();
  if (!isFamilyCodeValid(trimmed)) {
    throw new Error(
      `কোড ${FAMILY_CODE_MIN_LENGTH}-${FAMILY_CODE_MAX_LENGTH} ক্যারেক্টার এবং শুধু English অক্ষর/সংখ্যা/-/_ হতে হবে।`
    );
  }
  const normalized = normalizeCode(trimmed);
  const codeRef = db.collection("familyCodes").doc(normalized);
  const familyRef = db.collection("families").doc();
  const familyId = familyRef.id;
  const now = firebase.firestore.FieldValue.serverTimestamp();

  await familyRef.set({
    familyId,
    familyCodeDisplay: trimmed,
    createdBy: uid,
    createdAt: now,
    adminUids: [],
  });

  try {
    await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (codeSnap.exists) throw new Error("code-taken");
      tx.set(codeRef, { familyId, createdBy: uid, createdAt: now });
    });
  } catch (err) {
    if (err.message === "code-taken") {
      throw new Error("এই কোড আগে থেকেই ব্যবহৃত হয়েছে। অন্য কোড দিয়ে চেষ্টা করুন।");
    }
    throw err;
  }

  await familyRef.update({ adminUids: [uid], firstAdminUid: uid, updatedAt: now });
  return familyId;
}

// Health Profile UI (§6, checklist P2) — Member-এর static fields edit।
// অপরিবর্তিত — googleUid/email এই ফাংশনের payload-এ কখনো নেই, তাই
// firestore.rules-এর নতুন claim-guard (googleUid/email diff-block) এই
// profile-edit branch-কে প্রভাবিত করে না।
export async function updateMemberProfile(familyId, memberId, { name, dob, sex, bloodGroup }) {
  const ref = db.collection("families").doc(familyId).collection("members").doc(memberId);
  await ref.update({
    name: name.trim(),
    dob,
    sex,
    bloodGroup: bloodGroup || null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function listMembers(familyId) {
  const snap = await db.collection("families").doc(familyId).collection("members").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
