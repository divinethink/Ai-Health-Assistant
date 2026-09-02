// Family/Member identity — create/resume family, own-profile, admin-add-member
// (MemberCredential/key generate), Direct-Identify claim (FIFO/hash-verify)।
// app.js থেকে split (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।
//
// DailyTask-এর প্রমাণিত pattern reuse (memberData.js থেকে, adapt করে):
// - readable key generator (নাম+২-৩ digit) + bounded-retry duplicate-check
// - claim transaction: already-owner fast-path, owners<3 simple-add,
//   owners==3 FIFO-eviction (সবচেয়ে stale ownerActivity বাদ)
// keyIndex এখানে Health App-এর Confirmed schema অনুযায়ী **global +
// plaintext-key-doc-id** (Architecture Plan §3.0/firestore_rules_FINAL.md অনুযায়ী)।
// শুধু non-admin সদস্যের জন্য claim বাস্তবায়ন করা হয়েছে — admin-এর নিজের
// profile নতুন ডিভাইসে claim হলে family.adminUids sync এখনো owner-confirm
// না-হওয়া প্রশ্ন, তাই scope-এর বাইরে।

import { db } from "./firebaseConfig.js";

export const FAMILY_ID_STORAGE_KEY = "ha_family_id";
export const FAMILY_CODE_MIN_LENGTH = 6;
export const FAMILY_CODE_MAX_LENGTH = 30;
const FAMILY_CODE_CHARSET_PATTERN = /^(?!__.*__$)[A-Za-z0-9_-]+$/;
export const MEMBER_KEY_CHARSET_PATTERN = /^[A-Za-z0-9!@#$%&*+_-]+$/;

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

export async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Member-key generation (DailyTask readable-key pattern, adapt) ----

function randInt(maxExclusive) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % maxExclusive;
}
function generateReadableMemberKey(name) {
  const letters = (name || "").replace(/[^A-Za-z]/g, "").slice(0, 20); // rules-এর key max-length(64)-এর নিরাপদ margin
  const useFallback = letters.length < 3;
  const base = useFallback ? "Member" : letters[0].toUpperCase() + letters.slice(1).toLowerCase();
  let digitCount = useFallback ? 3 : 2 + randInt(2);
  let digits = "";
  for (let i = 0; i < digitCount; i++) digits += String(randInt(10));
  while ((base + digits).length < 6) digits += String(randInt(10));
  return base + digits;
}
function generateMemberKeyPlain() {
  const DIGITS = "23456789", UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ", LOWER = "abcdefghjkmnpqrstuvwxyz", SYMBOLS = "!@#$%&*+-_";
  const POOL = DIGITS + UPPER + LOWER + SYMBOLS;
  const randChar = (set) => set[randInt(set.length)];
  const len = 9 + randInt(4);
  const chars = [randChar(DIGITS), randChar(UPPER + LOWER), randChar(SYMBOLS)];
  for (let i = chars.length; i < len; i++) chars.push(randChar(POOL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
// Health App-এ keyIndex doc-id = plaintext key নিজেই (global, unique) —
// DailyTask-এর family-scoped hash-doc-id থেকে ভিন্ন। তাই duplicate-check
// এখানে সরাসরি keyIndex/{key} doc-এর existence দিয়ে হয়, hash দিয়ে না।
async function generateUniqueMemberKey(name) {
  const keyIndexColl = db.collection("keyIndex");
  for (let attempt = 0; attempt < 8; attempt++) {
    const key = generateReadableMemberKey(name);
    const snap = await keyIndexColl.doc(key).get();
    if (!snap.exists) return key;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateMemberKeyPlain();
    const snap = await keyIndexColl.doc(key).get();
    if (!snap.exists) return key;
  }
  throw new Error("Unique key generate করা যায়নি, আবার চেষ্টা করুন।");
}

// ---- Firestore action helpers (family/profile) ----

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

export async function resolveFamilyIdByCode(rawCode) {
  const normalized = normalizeCode(rawCode);
  if (!normalized) throw new Error("কোড লিখুন।");
  const snap = await db.collection("familyCodes").doc(normalized).get();
  if (!snap.exists) throw new Error("এই কোডের কোনো পরিবার পাওয়া যায়নি।");
  const familyId = snap.data().familyId;
  const famSnap = await db.collection("families").doc(familyId).get();
  if (!famSnap.exists) throw new Error("এই কোডের কোনো পরিবার পাওয়া যায়নি।");
  return familyId;
}

export async function createOwnMemberProfile(familyId, uid, { name, dob, sex }) {
  const memberRef = db.collection("families").doc(familyId).collection("members").doc();
  const memberId = memberRef.id;
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await memberRef.set({
    name, dob, sex, role: "admin",
    ownerUids: [uid],
    ownerActivity: { [uid]: now },
    createdAt: now, updatedAt: now,
  });
  await db.collection("families").doc(familyId).collection("uidMemberIndex").doc(uid).set({ memberId });
  return memberId;
}

// ---- Admin কর্তৃক সদস্য যোগ + key generate ----

export async function addMemberByAdmin(familyId, { name, dob, sex }) {
  const memberRef = db.collection("families").doc(familyId).collection("members").doc();
  const memberId = memberRef.id;
  const privateRef = memberRef.collection("private").doc("key");
  const key = await generateUniqueMemberKey(name);
  const hash = await sha256Hex(key);
  const keyIndexRef = db.collection("keyIndex").doc(key);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  // transaction — লেখার ঠিক আগমুহূর্তে global keyIndex/{key} আবার verify
  // করা হচ্ছে (bounded-retry pre-check + এই final authoritative check —
  // DailyTask-এর collision-safe pattern reuse)।
  await db.runTransaction(async (tx) => {
    const dupSnap = await tx.get(keyIndexRef);
    if (dupSnap.exists) throw new Error("key-collision");
    tx.set(memberRef, {
      name, dob, sex, role: "self-managing",
      ownerUids: [], ownerActivity: {},
      createdAt: now, updatedAt: now,
    });
    tx.set(privateRef, { key, keyHash: hash, createdBy: "admin", createdAt: now });
    tx.set(keyIndexRef, { familyId, memberId });
  });

  return { memberId, key };
}

// Health Profile UI (§6, checklist P2) — Member-এর static fields edit।
// rules-এর members/{memberId} update rule (firestore.rules L202-258) শুধু
// role/guardianMemberIds/relationshipLabel/ownerUids-কে বিশেষভাবে গার্ড করে —
// name/dob/sex/bloodGroup-এর জন্য কোনো নতুন rule/field-allowlist লাগে না,
// self (ownerUids-এ uid আছে) বা Admin যেই edit করুক ownerUids অপরিবর্তিত
// থাকলেই বিদ্যমান rule pass করে। height/weight ইচ্ছাকৃতভাবে এখানে নেই —
// Architecture Plan Part A §2/Part C §10.2 অনুযায়ী ওগুলো Observation
// health-record হিসেবেই থাকে (trend-tracking-যোগ্য বলে)।
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

export async function fetchMemberKey(familyId, memberId) {
  const snap = await db.collection("families").doc(familyId).collection("members").doc(memberId)
    .collection("private").doc("key").get();
  return snap.exists ? snap.data().key : null;
}

export async function listMembers(familyId) {
  const snap = await db.collection("families").doc(familyId).collection("members").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- Direct-Identify claim — global keyIndex দিয়ে key resolve করে, rules-এর
// members/{memberId} update branch-2 (claim/FIFO) অনুযায়ী transaction চালায়,
// তারপর claimKeyHashAttempt cleanup-write (§২.২ fix) এবং uidMemberIndex write করে।

export async function claimByKey(enteredKey, uid) {
  const trimmed = (enteredKey || "").trim();
  if (!trimmed) throw new Error("Key লিখুন।");
  if (!MEMBER_KEY_CHARSET_PATTERN.test(trimmed)) throw new Error("Key-এর ফরম্যাট সঠিক নয়।");

  const idxSnap = await db.collection("keyIndex").doc(trimmed).get();
  if (!idxSnap.exists) throw new Error("এই Key-এর কোনো সদস্য পাওয়া যায়নি।");
  const { familyId, memberId } = idxSnap.data();

  const memberRef = db.collection("families").doc(familyId).collection("members").doc(memberId);
  const hash = await sha256Hex(trimmed);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(memberRef);
      if (!snap.exists) throw new Error("সদস্য পাওয়া যায়নি।");
      const data = snap.data();
      const currentOwners = Array.isArray(data.ownerUids) ? data.ownerUids : [];
      const now = firebase.firestore.Timestamp.now();

      if (currentOwners.includes(uid)) {
        // আগে থেকেই owner — শুধু key-verify + activity stamp (rules-এর
        // "already-owner" branch, কোনো FIFO দরকার নেই)।
        tx.update(memberRef, {
          ownerUids: currentOwners,
          updatedAt: Date.now(),
          claimKeyHashAttempt: hash,
          [`ownerActivity.${uid}`]: now,
        });
        return;
      }

      let nextOwners, evictedUid = null;
      if (currentOwners.length < 3) {
        nextOwners = [...currentOwners, uid];
      } else {
        // FIFO eviction — সবচেয়ে stale ownerActivity বাদ (role:"admin"
        // এই claim-flow-এ কখনো হবে না — admin-add ফর্ম শুধু
        // role:"self-managing" তৈরি করে, তাই firstAdminUid-exclusion এখানে
        // প্রযোজ্য না)।
        const ownerActivity = data.ownerActivity || {};
        let staleUid = currentOwners[0];
        let staleTs = ownerActivity[staleUid] ? ownerActivity[staleUid].toMillis() : 0;
        for (const ou of currentOwners) {
          const ts = ownerActivity[ou] ? ownerActivity[ou].toMillis() : 0;
          if (ts < staleTs) { staleTs = ts; staleUid = ou; }
        }
        nextOwners = currentOwners.filter((u) => u !== staleUid).concat([uid]);
        evictedUid = staleUid;
      }

      const payload = {
        ownerUids: nextOwners,
        updatedAt: Date.now(),
        claimKeyHashAttempt: hash,
        [`ownerActivity.${uid}`]: now,
      };
      if (evictedUid) payload[`ownerActivity.${evictedUid}`] = firebase.firestore.FieldValue.delete();
      tx.update(memberRef, payload);
    });
  } catch (err) {
    throw new Error("Key যাচাই ব্যর্থ হয়েছে — সঠিক Key দিয়ে আবার চেষ্টা করুন।");
  }

  // cleanup-write (§২.২ ফিক্স) — claimKeyHashAttempt member doc-এ স্থায়ী
  // থাকবে না, কারণ open-roster সবাই পড়তে পারে।
  await memberRef.update({ claimKeyHashAttempt: firebase.firestore.FieldValue.delete() });

  // uidMemberIndex — read-time callerMemberId resolution-এর জন্য।
  await db.collection("families").doc(familyId).collection("uidMemberIndex").doc(uid).set({ memberId });

  return { familyId, memberId };
}
