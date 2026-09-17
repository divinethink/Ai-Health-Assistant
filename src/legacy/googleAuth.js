// googleAuth.js — Google Sign-in Only identity layer (Architecture Part A
// §3.0, Roadmap §3.3 Amendment)। পুরনো familyIdentity.js-এর Member-Key/
// Direct-Identify/FIFO-eviction claim logic সম্পূর্ণ প্রতিস্থাপন করে।
//
// DailyTask app (dailytask-vite-migration/src/legacy/googleIdentity.js)-এর
// প্রমাণিত, production-স্থিতিশীল pattern থেকে adapt করা হয়েছে (Ground Rule ৫,
// Proven Pattern Reuse) — mechanism অপরিবর্তিত (users/{uid} fast-path,
// familyMemberEmails email-match auto-claim, Invite-Link self-join),
// শুধু Health App-এর schema-তে মাপ করা হয়েছে:
//   - DailyTask-এ member field "gender" → Health App-এ "dob"(বাধ্যতামূলক,
//     Architecture Part A §11.4)+"sex"
//   - DailyTask cross-family multi-tenant দুশ্চিন্তা এই single-family-per-
//     device app-এ প্রযোজ্য না বলে familyMemberEmails শুধু admin-add-member
//     (guardian-managed সদস্যের future self-claim email) পথেই লেখা হয় —
//     first-family-creation ও invite-link self-join-এ member সরাসরি claimed
//     অবস্থাতেই তৈরি হয় (কোনো unclaimed-email-period নেই), তাই সেই দুই পথে
//     familyMemberEmails write করার দরকার নেই (firestore.rules-এও সেই
//     অনুযায়ী create শুধু admin-only)।
//   - "সদস্য হোন" (presetKey/memberRequests) flow সম্পূর্ণ বাদ (Roadmap §3.3)।

import { db, auth } from "./firebaseConfig.js";
import { createFamily } from "./familyIdentity.js";

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function currentGoogleUid() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

function currentGoogleEmail() {
  return auth.currentUser ? (auth.currentUser.email || null) : null;
}

function triggerGoogleSignInPopup() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return auth.signInWithPopup(provider);
}

async function writeUserMapping(googleUid, familyId, memberId) {
  await db.collection("users").doc(googleUid).set({ familyId, memberId });
}

async function loadUserMapping(googleUid) {
  const snap = await db.collection("users").doc(googleUid).get();
  return snap.exists ? snap.data() : null;
}

function familyMemberEmailRef(normalizedEmail) {
  return db.collection("familyMemberEmails").doc(normalizedEmail);
}

async function lookupFamilyByEmail(email) {
  const key = normalizeEmail(email);
  const snap = await familyMemberEmailRef(key).get();
  return snap.exists ? { normalizedEmail: key, ...snap.data() } : null;
}

async function fetchMemberData(familyId, memberId) {
  const snap = await db.collection("families").doc(familyId)
    .collection("members").doc(memberId).get();
  return snap.exists ? snap.data() : null;
}

async function writeUidMemberIndex(familyId, uid, memberId) {
  await db.collection("families").doc(familyId).collection("uidMemberIndex").doc(uid).set({ memberId });
}

// ---- ধাপ ১: fast-path/email-match auto-claim (§৩.০) ----
//
// Precondition: Google Sign-in(signInWithPopup) আগেই সফল — auth.currentUser
// এই ফাংশন কলের সময় সেই Google user। কোনো mapping/lookup না মিললে
// { matched: false } — caller(UI) তখন নতুন-পরিবার তৈরির ফর্ম দেখাবে।
export async function signInExistingMemberByGoogle() {
  if (!auth.currentUser) return { matched: false, reason: "not-signed-in" };
  const uid = auth.currentUser.uid;

  // ধাপ ১ — fast path (আগে থেকে claimed, users/{uid} doc থাকলে)।
  const existingMapping = await loadUserMapping(uid);
  if (existingMapping && existingMapping.familyId && existingMapping.memberId) {
    let staleCheckData;
    try {
      staleCheckData = await fetchMemberData(existingMapping.familyId, existingMapping.memberId);
    } catch (err) {
      return { matched: false, reason: "error", error: err.message };
    }
    if (staleCheckData) {
      return { matched: true, familyId: existingMapping.familyId, memberId: existingMapping.memberId };
    }
    // stale mapping (admin আগে remove করেছেন) — নিজের doc cleanup করে ধাপ ২।
    try { await db.collection("users").doc(uid).delete(); } catch (e) { /* non-fatal */ }
  }

  // ধাপ ২ — প্রথমবার claim (email-match)।
  const email = currentGoogleEmail();
  if (!email) return { matched: false, reason: "no-email" };
  const lookup = await lookupFamilyByEmail(email);
  if (!lookup || !lookup.familyId || !lookup.memberId) return { matched: false, reason: "no-match" };

  let targetMemberData;
  try {
    targetMemberData = await fetchMemberData(lookup.familyId, lookup.memberId);
  } catch (err) {
    return { matched: false, reason: "claim-failed", error: err.message };
  }
  if (!targetMemberData) return { matched: false, reason: "no-match" }; // stale mapping
  if (targetMemberData.googleUid) {
    // ইতিমধ্যে claimed (অন্য বা এই uid দিয়ে) — অন্য uid হলে block।
    if (targetMemberData.googleUid === uid) {
      return { matched: true, familyId: lookup.familyId, memberId: lookup.memberId };
    }
    return { matched: false, reason: "already-claimed" };
  }

  const memberRef = db.collection("families").doc(lookup.familyId).collection("members").doc(lookup.memberId);
  try {
    // firestore.rules-এর claim-clause নিজেই নিশ্চিত করে request.auth.token.email
    // resource-এ সংরক্ষিত member.email-এর সাথে মেলে — এখানে আলাদা pre-check
    // দরকার নেই (server-verified token-ই একমাত্র সত্যতা)।
    await memberRef.update({
      googleUid: uid,
      email: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await writeUserMapping(uid, lookup.familyId, lookup.memberId);
    await writeUidMemberIndex(lookup.familyId, uid, lookup.memberId);
    return { matched: true, familyId: lookup.familyId, memberId: lookup.memberId, firstClaim: true };
  } catch (err) {
    return { matched: false, reason: "claim-failed", error: err.message };
  }
}

// ---- ধাপ ৩ (no-match হলে): নতুন family + own admin-profile তৈরি ----
export async function createFamilyAndOwnProfile(rawCode, { name, dob, sex }) {
  if (!auth.currentUser) throw new Error("Google Sign-in সম্পন্ন না হয়েই কল হয়েছে।");
  if (!name || !name.trim()) throw new Error("নাম লিখুন।");
  if (!dob) throw new Error("জন্ম-তারিখ দিন।");
  const uid = auth.currentUser.uid;

  const familyId = await createFamily(rawCode, uid);
  const memberRef = db.collection("families").doc(familyId).collection("members").doc();
  const memberId = memberRef.id;
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await memberRef.set({
    name: name.trim(), dob, sex, role: "admin",
    googleUid: uid,
    createdAt: now, updatedAt: now,
  });
  await writeUserMapping(uid, familyId, memberId);
  await writeUidMemberIndex(familyId, uid, memberId);
  return { familyId, memberId };
}

// ---- Admin — guardian-managed (no-account) member তৈরি, email ঐচ্ছিক ----
// (Architecture Part A §3.0 — "ভবিষ্যতে সদস্য নিজে self-claim করতে চাইলে
// তার নিজস্ব, স্বতন্ত্র email member.email-এ বসাতে হবে")।
export async function addGuardianManagedMember(familyId, { name, dob, sex, email }) {
  if (!name || !name.trim()) throw new Error("নাম লিখুন।");
  if (!dob) throw new Error("জন্ম-তারিখ দিন।");
  const normalizedEmail = email ? normalizeEmail(email) : null;
  if (normalizedEmail && !normalizedEmail.includes("@")) {
    throw new Error("সঠিক ইমেইল ঠিকানা প্রয়োজন।");
  }
  if (normalizedEmail) {
    const existing = await lookupFamilyByEmail(normalizedEmail);
    if (existing) throw new Error("এই ইমেইল ইতিমধ্যে অন্য একজন সদস্যের সাথে যুক্ত আছে।");
  }
  const memberRef = db.collection("families").doc(familyId).collection("members").doc();
  const memberId = memberRef.id;
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(memberRef, {
    name: name.trim(), dob, sex, role: "guardian-managed",
    googleUid: null,
    email: normalizedEmail || null,
    createdAt: now, updatedAt: now,
  });
  if (normalizedEmail) {
    batch.set(familyMemberEmailRef(normalizedEmail), { familyId, memberId });
  }
  await batch.commit();
  return { memberId };
}

// ---- Invite-Link (§৩.০) ----
function generateInviteToken() {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const arr = new Uint32Array(26);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export async function rotateInviteLink(familyId) {
  const token = generateInviteToken();
  await db.collection("families").doc(familyId).update({
    activeInviteToken: { token, createdAt: Date.now(), revoked: false },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return token;
}

export async function revokeInviteLink(familyId, activeInviteToken) {
  await db.collection("families").doc(familyId).update({
    activeInviteToken: { ...activeInviteToken, revoked: true },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Invite-link click করে join (non-admin self-serve, নতুন সদস্য)।
// Precondition: Google Sign-in আগেই সফল।
export async function joinFamilyViaInviteLink(familyId, token, { name, dob, sex }) {
  if (!auth.currentUser) return { aborted: true, reason: "google-signin-required" };
  const uid = auth.currentUser.uid;

  // ইতিমধ্যে কোনো family-র সদস্য কিনা (fast-path mapping) — আগে চেক
  // (duplicate member এড়াতে, DailyTask-এর প্রমাণিত bug-fix pattern)।
  const existingMapping = await loadUserMapping(uid);
  if (existingMapping && existingMapping.familyId && existingMapping.memberId) {
    let existingMemberData;
    try {
      existingMemberData = await fetchMemberData(existingMapping.familyId, existingMapping.memberId);
    } catch (err) {
      return { aborted: true, reason: "error", error: err.message };
    }
    if (existingMemberData) {
      if (existingMapping.familyId === familyId) {
        return { success: true, familyId, memberId: existingMapping.memberId, alreadyMember: true };
      }
      return { aborted: true, reason: "already-member-elsewhere" };
    }
    try { await db.collection("users").doc(uid).delete(); } catch (e) { /* non-fatal */ }
  }

  const familyRef = db.collection("families").doc(familyId);
  let familySnap;
  try {
    familySnap = await familyRef.get();
  } catch (err) {
    return { aborted: true, reason: "error", error: err.message };
  }
  if (!familySnap.exists) return { aborted: true, reason: "family-not-found" };
  const fam = familySnap.data();
  const active = fam.activeInviteToken;
  if (!active || active.revoked || active.token !== token) {
    return { aborted: true, reason: "invalid-token" };
  }

  // পূর্ব-নিবন্ধিত email (Admin-added proxy member, rare edge-case) —
  // নতুন member তৈরি না করে বিদ্যমান unclaimed profile bind।
  const email = currentGoogleEmail();
  if (email) {
    const lookup = await lookupFamilyByEmail(email);
    if (lookup && lookup.familyId === familyId && lookup.memberId) {
      let targetMemberData;
      try {
        targetMemberData = await fetchMemberData(familyId, lookup.memberId);
      } catch (err) {
        return { aborted: true, reason: "error", error: err.message };
      }
      if (targetMemberData) {
        if (targetMemberData.googleUid) {
          if (targetMemberData.googleUid === uid) {
            return { success: true, familyId, memberId: lookup.memberId, alreadyMember: true };
          }
          return { aborted: true, reason: "email-already-member" };
        }
        const memberRef = familyRef.collection("members").doc(lookup.memberId);
        try {
          await memberRef.update({
            googleUid: uid,
            email: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          await writeUserMapping(uid, familyId, lookup.memberId);
          await writeUidMemberIndex(familyId, uid, lookup.memberId);
          return { success: true, familyId, memberId: lookup.memberId, bound: true };
        } catch (err) {
          return { aborted: true, reason: "error", error: err.message };
        }
      }
    }
  }

  // নতুন member — self-create (firestore.rules-এর invite-token clause,
  // role client পাঠাতে পারে শুধু "self-managing")।
  if (!name || !name.trim()) return { aborted: true, reason: "name-required" };
  if (!dob) return { aborted: true, reason: "dob-required" };
  const memberRef = familyRef.collection("members").doc();
  const memberId = memberRef.id;
  const now = firebase.firestore.FieldValue.serverTimestamp();
  try {
    await memberRef.set({
      name: name.trim(), dob, sex, role: "self-managing",
      googleUid: uid,
      inviteTokenAttempt: token,
      createdAt: now, updatedAt: now,
    });
    await writeUserMapping(uid, familyId, memberId);
    await writeUidMemberIndex(familyId, uid, memberId);
    return { success: true, familyId, memberId };
  } catch (err) {
    return { aborted: true, reason: "error", error: err.message };
  }
}

export {
  normalizeEmail,
  currentGoogleUid,
  currentGoogleEmail,
  triggerGoogleSignInPopup,
  loadUserMapping,
};
