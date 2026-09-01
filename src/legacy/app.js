// Walking Skeleton — Step 4: Admin কর্তৃক সদস্য যোগ (MemberCredential/key generate)
// + Direct-Identify claim/login (key দিয়ে নতুন ডিভাইসে profile claim)।
//
// DailyTask-এর প্রমাণিত pattern reuse (memberData.js থেকে, adapt করে):
// - readable key generator (নাম+২-৩ digit) + bounded-retry duplicate-check
// - claim transaction: already-owner fast-path, owners<3 simple-add,
//   owners==3 FIFO-eviction (সবচেয়ে stale ownerActivity বাদ)
// তবে keyIndex এখানে Health App-এর Confirmed schema অনুযায়ী **global +
// plaintext-key-doc-id** (DailyTask-এর family-scoped + hash-doc-id থেকে ভিন্ন,
// Architecture Plan §3.0/firestore_rules_FINAL.md অনুযায়ী)। এই ধাপে শুধু
// non-admin সদস্যের জন্য claim বাস্তবায়ন করা হয়েছে (role:"admin" কখনো এই
// admin-add ফর্ম থেকে সেট হয় না) — admin-এর নিজের profile নতুন ডিভাইসে
// claim হলে family.adminUids sync একটা আলাদা, এখনো owner-confirm না-হওয়া
// প্রশ্ন, তাই ইচ্ছাকৃতভাবে এই ধাপের scope-এর বাইরে রাখা হলো।
import { db, auth, initError } from "./firebaseConfig.js";

const { useState, useEffect, useCallback } = React;

const FAMILY_ID_STORAGE_KEY = "ha_family_id";
const FAMILY_CODE_MIN_LENGTH = 6;
const FAMILY_CODE_MAX_LENGTH = 30;
const FAMILY_CODE_CHARSET_PATTERN = /^(?!__.*__$)[A-Za-z0-9_-]+$/;
const MEMBER_KEY_CHARSET_PATTERN = /^[A-Za-z0-9!@#$%&*+_-]+$/;

function isFamilyCodeValid(code) {
  return (
    code.length >= FAMILY_CODE_MIN_LENGTH &&
    code.length <= FAMILY_CODE_MAX_LENGTH &&
    FAMILY_CODE_CHARSET_PATTERN.test(code)
  );
}
function normalizeCode(code) {
  return (code || "").trim().toLowerCase();
}

async function sha256Hex(text) {
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

// ---- Firestore action helpers (family/profile — Step 3, অপরিবর্তিত) ----

async function createFamily(rawCode, uid) {
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

async function resolveFamilyIdByCode(rawCode) {
  const normalized = normalizeCode(rawCode);
  if (!normalized) throw new Error("কোড লিখুন।");
  const snap = await db.collection("familyCodes").doc(normalized).get();
  if (!snap.exists) throw new Error("এই কোডের কোনো পরিবার পাওয়া যায়নি।");
  const familyId = snap.data().familyId;
  const famSnap = await db.collection("families").doc(familyId).get();
  if (!famSnap.exists) throw new Error("এই কোডের কোনো পরিবার পাওয়া যায়নি।");
  return familyId;
}

async function createOwnMemberProfile(familyId, uid, { name, dob, sex }) {
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

// ---- নতুন (Step 4): Admin কর্তৃক সদস্য যোগ + key generate ----

async function addMemberByAdmin(familyId, { name, dob, sex }) {
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

async function fetchMemberKey(familyId, memberId) {
  const snap = await db.collection("families").doc(familyId).collection("members").doc(memberId)
    .collection("private").doc("key").get();
  return snap.exists ? snap.data().key : null;
}

async function listMembers(familyId) {
  const snap = await db.collection("families").doc(familyId).collection("members").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// নতুন (Step 4): Direct-Identify claim — global keyIndex দিয়ে key resolve
// করে, rules-এর members/{memberId} update branch-2 (claim/FIFO) অনুযায়ী
// transaction চালায়, তারপর claimKeyHashAttempt cleanup-write (§২.২ fix)
// এবং uidMemberIndex write করে।
async function claimByKey(enteredKey, uid) {
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

// ---- নতুন (Step 5): Family Join-Request flow (accessRequests, Admin-approve) ----
// DailyTask-এর accessRequests pattern reuse (FamilyManagement.jsx/AccessRequestsModal
// + app.js-এর boot-time gate) — কিন্তু Health App-এ rules self-create শুধু
// status:'pending'-এ allow করে (DailyTask-এর সাময়িক moderation-off/auto-approve
// এখানে প্রযোজ্য না, firestore_rules_FINAL.md-এর accessRequests create-rule দ্রষ্টব্য)।
// এটা member-profile claim (Key/Direct-Identify) থেকে আলাদা — শুধু family-level
// "isFamilyMember" gate (roster/accessGrants ইত্যাদির prerequisite)।

async function ensureAccessRequest(familyId, uid) {
  const ref = db.collection("families").doc(familyId).collection("accessRequests").doc(uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data();
  const data = { status: "pending", requestedAt: firebase.firestore.FieldValue.serverTimestamp() };
  await ref.set(data);
  return data;
}
function listenAccessRequest(familyId, uid, cb) {
  return db.collection("families").doc(familyId).collection("accessRequests").doc(uid)
    .onSnapshot((snap) => cb(snap.exists ? snap.data() : null));
}
async function listPendingAccessRequests(familyId) {
  const snap = await db.collection("families").doc(familyId).collection("accessRequests")
    .where("status", "==", "pending").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function decideAccessRequest(familyId, requesterUid, decision) {
  await db.collection("families").doc(familyId).collection("accessRequests").doc(requesterUid).update({
    status: decision, // "approved" | "denied"
    decidedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ---- নতুন (Step 6): Health Record CRUD (Condition/Observation/MedicationStatement/AllergyIntolerance) ----
// Architecture Plan §2 অনুযায়ী একত্রিত `healthRecords/{id}` collection, resourceType
// discriminator দিয়ে চারটা logical type আলাদা করা হয়। `firestore_rules_FINAL.md`-এর
// healthRecords match-block অনুযায়ী rules নিজেই এই ৪টা resourceType allow করে ও
// hasAccess(familyId, targetMemberId, callerMemberId) দিয়ে verify করে — তাই client-এর
// দায়িত্ব শুধু সঠিক memberId (কার record) ও lastEditedByMemberId (caller নিজে কে,
// permission-verification-only field, Architecture Plan §2 নোট অনুযায়ী — content-edit
// audit-trail না) পাঠানো।

const RESOURCE_TYPE_LABELS = {
  condition: "Condition (রোগ/সমস্যা)",
  observation: "Observation (পরিমাপ/টেস্ট)",
  medicationStatement: "Medication (ওষুধ)",
  allergy: "Allergy (এলার্জি)",
};

// resourceType-নির্দিষ্ট field-সেট আলাদা করা হলো (Architecture Plan §2 schema অনুযায়ী) —
// অপ্রাসঙ্গিক ফর্ম-ফিল্ড payload-এ যাতে না যায় (rules-এ allowlist নেই এই collection-এ,
// কিন্তু data-hygiene-এর জন্য এখানেই সীমিত রাখা হলো)।
function buildHealthRecordFields(resourceType, fields) {
  if (resourceType === "condition") {
    return { name: fields.name.trim(), category: fields.category, status: fields.status, onsetDate: fields.date || null };
  }
  if (resourceType === "observation") {
    return { type: fields.type.trim(), value: fields.value.trim(), unit: fields.unit.trim(), date: fields.date || null };
  }
  if (resourceType === "medicationStatement") {
    return { genericName: fields.name.trim(), tier: fields.tier, status: fields.status, startDate: fields.date || null };
  }
  if (resourceType === "allergy") {
    return { substance: fields.name.trim(), reaction: fields.reaction.trim(), severity: fields.severity };
  }
  throw new Error("অজানা resourceType: " + resourceType);
}

async function createHealthRecord(familyId, targetMemberId, callerMemberId, resourceType, fields) {
  const ref = db.collection("families").doc(familyId).collection("healthRecords").doc();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await ref.set({
    memberId: targetMemberId,
    resourceType,
    ...buildHealthRecordFields(resourceType, fields),
    lastEditedByMemberId: callerMemberId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

// শুধু equality filter (memberId ==) — orderBy যোগ করলে composite index লাগত, তাই
// client-side sort করা হচ্ছে (§3.4.5-এর memberId+resourceType composite index শুধু
// resourceType-ফিল্টার-সহ query-র জন্য প্রয়োজন হবে, এই মুহূর্তে সেই query নেই)।
async function listHealthRecords(familyId, targetMemberId) {
  const snap = await db.collection("families").doc(familyId).collection("healthRecords")
    .where("memberId", "==", targetMemberId).get();
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  records.sort((a, b) => {
    const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });
  return records;
}

function describeHealthRecord(r) {
  if (r.resourceType === "condition") {
    return r.name + " — " + (r.status || "") + " (Category " + (r.category || "?") + ")" + (r.onsetDate ? ", onset: " + r.onsetDate : "");
  }
  if (r.resourceType === "observation") {
    return r.type + ": " + r.value + (r.unit ? " " + r.unit : "") + (r.date ? " (" + r.date + ")" : "");
  }
  if (r.resourceType === "medicationStatement") {
    return r.genericName + " — " + (r.tier || "") + ", " + (r.status || "") + (r.startDate ? ", শুরু: " + r.startDate : "");
  }
  if (r.resourceType === "allergy") {
    return r.substance + " — " + (r.reaction || "") + " (" + (r.severity || "") + ")";
  }
  return "";
}

// ---- ছোট UI primitives (Step 3-এর মতোই) ----

function ErrorBox(msg) {
  return React.createElement("div", {
    style: { marginTop: "12px", padding: "10px", borderRadius: "8px", background: "#FDECEA", border: "1px solid #C0392B", color: "#7A1F14", fontSize: "13px" },
  }, msg);
}
function SuccessBox(children) {
  return React.createElement("div", {
    style: { marginTop: "12px", padding: "10px", borderRadius: "8px", background: "#E8F3EC", border: "1px solid #0E4B43", color: "#0E4B43", fontSize: "13px" },
  }, children);
}
function TextField(label, value, onChange, placeholder) {
  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, label),
    React.createElement("input", {
      type: "text", value, placeholder, onChange: (e) => onChange(e.target.value),
      style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
    })
  );
}
function PrimaryButton(label, onClick, busy) {
  return React.createElement("button", {
    onClick, disabled: busy,
    style: { marginTop: "14px", width: "100%", padding: "12px", border: "none", borderRadius: "8px", background: busy ? "#8FAFA9" : "#0E4B43", color: "#fff", fontSize: "15px", fontWeight: 600, cursor: busy ? "default" : "pointer" },
  }, busy ? "অপেক্ষা করুন..." : label);
}
function SecondaryButton(label, onClick, busy) {
  return React.createElement("button", {
    onClick, disabled: busy,
    style: { marginTop: "8px", width: "100%", padding: "10px", borderRadius: "8px", background: "#fff", color: "#0E4B43", fontSize: "14px", fontWeight: 600, border: "1px solid #0E4B43", cursor: busy ? "default" : "pointer" },
  }, label);
}
function Card(children) {
  return React.createElement("div", { style: { padding: "24px", maxWidth: "420px", margin: "40px auto", fontFamily: "'Hind Siliguri', sans-serif" } }, children);
}
// নতুন (Step 6): TextField/date-input-এর মতোই ছোট reusable primitive — dropdown ও
// date-picker-এর জন্য (Health Record ফর্মে বারবার লাগে)।
function SelectField(label, value, onChange, options) {
  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, label),
    React.createElement(
      "select", { value, onChange: (e) => onChange(e.target.value),
        style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" } },
      options.map(([v, l]) => React.createElement("option", { key: v, value: v }, l))
    )
  );
}
function DateField(label, value, onChange) {
  const todayISO = new Date().toISOString().slice(0, 10);
  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, label),
    React.createElement("input", {
      type: "date", max: todayISO, value, onChange: (e) => onChange(e.target.value),
      style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
    })
  );
}

// ---- Entry screen: family create / resume / Direct-Identify ----

function EntryScreen({ uid, onFamilyReady }) {
  const [mode, setMode] = useState("create"); // "create" | "resume" | "key"
  const [code, setCode] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submitFamily = useCallback(async () => {
    setErr(null); setBusy(true);
    try {
      const familyId = mode === "create" ? await createFamily(code, uid) : await resolveFamilyIdByCode(code);
      localStorage.setItem(FAMILY_ID_STORAGE_KEY, familyId);
      onFamilyReady(familyId);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [mode, code, uid, onFamilyReady]);

  const submitKey = useCallback(async () => {
    setErr(null); setBusy(true);
    try {
      const { familyId } = await claimByKey(key, uid);
      localStorage.setItem(FAMILY_ID_STORAGE_KEY, familyId);
      onFamilyReady(familyId);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [key, uid, onFamilyReady]);

  const tabs = [
    ["create", "নতুন পরিবার"],
    ["resume", "কোড দিয়ে লোড"],
    ["key", "Key দিয়ে লগইন"],
  ];

  return Card(
    React.createElement(
      React.Fragment, null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "Health Assistant"),
      React.createElement(
        "div", { style: { display: "flex", gap: "6px", marginTop: "12px" } },
        tabs.map(([m, label]) =>
          React.createElement("button", {
            key: m, onClick: () => setMode(m),
            style: {
              flex: 1, padding: "8px 4px", borderRadius: "6px", fontSize: "12px",
              border: mode === m ? "2px solid #0E4B43" : "1px solid #CBD5E1",
              background: mode === m ? "#E8F3EC" : "#fff", cursor: "pointer",
            },
          }, label)
        )
      ),
      mode !== "key"
        ? React.createElement(
            React.Fragment, null,
            React.createElement("p", { style: { color: "#555", fontSize: "13px", marginTop: "10px" } },
              mode === "create"
                ? "আপনার পরিবারের জন্য একটা ইউনিক কোড দিন (শুধু English অক্ষর/সংখ্যা/-/_ , ৬-৩০ ক্যারেক্টার)।"
                : "আগে তৈরি করা পরিবারের কোড দিয়ে এই ডিভাইসে পুনরায় সংযুক্ত করুন।"
            ),
            TextField(mode === "create" ? "পরিবারের কোড (আপনি ঠিক করুন)" : "পরিবারের কোড", code, setCode, "যেমন: rahman_family"),
            err && ErrorBox(err),
            PrimaryButton(mode === "create" ? "পরিবার তৈরি করুন" : "লোড করুন", submitFamily, busy)
          )
        : React.createElement(
            React.Fragment, null,
            React.createElement("p", { style: { color: "#555", fontSize: "13px", marginTop: "10px" } },
              "Admin আপনাকে যে Key দিয়েছেন সেটা লিখুন — এই ডিভাইসে আপনার প্রোফাইল claim হবে (পরিবারের কোড জানার দরকার নেই)।"
            ),
            TextField("আপনার Key", key, setKey, "যেমন: Karim42"),
            err && ErrorBox(err),
            PrimaryButton("লগইন করুন", submitKey, busy)
          )
    )
  );
}

function CreateOwnProfile({ familyId, uid, onProfileReady }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("male");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const todayISO = new Date().toISOString().slice(0, 10);

  const submit = useCallback(async () => {
    setErr(null);
    if (!name.trim()) { setErr("নাম লিখুন।"); return; }
    if (!dob) { setErr("জন্ম-তারিখ দিন।"); return; }
    setBusy(true);
    try {
      const memberId = await createOwnMemberProfile(familyId, uid, { name: name.trim(), dob, sex });
      onProfileReady(memberId);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [familyId, uid, name, dob, sex, onProfileReady]);

  return Card(
    React.createElement(
      React.Fragment, null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "আপনার প্রোফাইল"),
      React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "পরিবার তৈরি হয়েছে — এখন নিজের প্রোফাইল দিন (আপনি এই পরিবারের প্রথম Admin)।"),
      TextField("নাম", name, setName, "আপনার নাম"),
      React.createElement(
        "div", { style: { marginTop: "10px" } },
        React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "জন্ম-তারিখ"),
        React.createElement("input", {
          type: "date", min: "1960-01-01", max: todayISO, value: dob,
          onChange: (e) => setDob(e.target.value),
          style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
        })
      ),
      React.createElement(
        "div", { style: { marginTop: "10px" } },
        React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "লিঙ্গ"),
        React.createElement(
          "select", { value: sex, onChange: (e) => setSex(e.target.value),
            style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" } },
          React.createElement("option", { value: "male" }, "পুরুষ"),
          React.createElement("option", { value: "female" }, "মহিলা")
        )
      ),
      err && ErrorBox(err),
      PrimaryButton("প্রোফাইল তৈরি করুন", submit, busy)
    )
  );
}

// ---- নতুন (Step 4): Admin — সদস্য যোগ ফর্ম + সদস্য-তালিকা ----

function AddMemberForm({ familyId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("male");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null); // { name, key }
  const todayISO = new Date().toISOString().slice(0, 10);

  const submit = useCallback(async () => {
    setErr(null);
    if (!name.trim()) { setErr("নাম লিখুন।"); return; }
    if (!dob) { setErr("জন্ম-তারিখ দিন।"); return; }
    setBusy(true);
    try {
      const { key } = await addMemberByAdmin(familyId, { name: name.trim(), dob, sex });
      setResult({ name: name.trim(), key });
      setName(""); setDob(""); setSex("male");
      onAdded();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [familyId, name, dob, sex, onAdded]);

  if (!open) {
    return React.createElement(
      "div", { style: { marginTop: "16px" } },
      SecondaryButton("+ নতুন সদস্য যোগ করুন", () => { setOpen(true); setResult(null); }, false)
    );
  }

  return React.createElement(
    "div", { style: { marginTop: "16px", padding: "14px", border: "1px solid #CBD5E1", borderRadius: "8px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43", margin: 0 } }, "নতুন সদস্য"),
    TextField("নাম", name, setName, "সদস্যের নাম"),
    React.createElement(
      "div", { style: { marginTop: "10px" } },
      React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "জন্ম-তারিখ"),
      React.createElement("input", {
        type: "date", min: "1960-01-01", max: todayISO, value: dob,
        onChange: (e) => setDob(e.target.value),
        style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
      })
    ),
    React.createElement(
      "div", { style: { marginTop: "10px" } },
      React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "লিঙ্গ"),
      React.createElement(
        "select", { value: sex, onChange: (e) => setSex(e.target.value),
          style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" } },
        React.createElement("option", { value: "male" }, "পুরুষ"),
        React.createElement("option", { value: "female" }, "মহিলা")
      )
    ),
    err && ErrorBox(err),
    result && SuccessBox(
      React.createElement(
        React.Fragment, null,
        React.createElement("div", null, React.createElement("b", null, result.name), "-এর Key তৈরি হয়েছে:"),
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, marginTop: "4px", letterSpacing: "1px" } }, result.key),
        React.createElement("div", { style: { fontSize: "12px", marginTop: "4px" } }, "এই Key সদস্যকে দিন — তিনি নিজের ডিভাইসে \"Key দিয়ে লগইন\" থেকে claim করবেন। এই Key আর দেখানো হবে না (Admin পরে আবার দেখতে পারবেন)।")
      )
    ),
    PrimaryButton("সদস্য তৈরি করুন", submit, busy),
    SecondaryButton("বন্ধ করুন", () => setOpen(false), false)
  );
}

function MemberList({ familyId, isAdmin }) {
  const [members, setMembers] = useState(null);
  const [err, setErr] = useState(null);
  const [revealKey, setRevealKey] = useState({}); // memberId -> key|"loading"

  const reload = useCallback(() => {
    listMembers(familyId).then(setMembers).catch((e) => setErr(e.message || String(e)));
  }, [familyId]);

  useEffect(() => { reload(); }, [reload]);

  const onReveal = useCallback(async (memberId) => {
    setRevealKey((prev) => ({ ...prev, [memberId]: "loading" }));
    try {
      const key = await fetchMemberKey(familyId, memberId);
      setRevealKey((prev) => ({ ...prev, [memberId]: key || "(পাওয়া যায়নি)" }));
    } catch (e) {
      setRevealKey((prev) => ({ ...prev, [memberId]: "ত্রুটি: " + (e.message || e) }));
    }
  }, [familyId]);

  if (err) return ErrorBox(err);
  if (!members) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "পরিবারের সদস্য"),
    members.map((m) =>
      React.createElement(
        "div", { key: m.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px" } },
        React.createElement("div", null,
          React.createElement("b", null, m.name),
          " — ", m.role === "admin" ? "Admin" : (m.role || "self-managing"),
          " — ", (m.ownerUids && m.ownerUids.length > 0) ? "claim হয়েছে" : "claim বাকি"
        ),
        isAdmin && m.role !== "admin" && React.createElement(
          "div", { style: { marginTop: "4px" } },
          revealKey[m.id]
            ? React.createElement("span", { style: { fontFamily: "monospace" } }, revealKey[m.id])
            : React.createElement(
                "button", {
                  onClick: () => onReveal(m.id),
                  style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #0E4B43", background: "#fff", color: "#0E4B43", cursor: "pointer" },
                },
                "Key দেখান"
              )
        )
      )
    )
  );
}

// নতুন (Step 5): family-level join-request gate — member-profile না থাকা,
// non-admin uid-এর জন্য। Live listener দিয়ে status বদলালে সাথে সাথে UI আপডেট হয়।
function JoinRequestGate({ familyId, uid }) {
  const [reqData, setReqData] = useState(undefined); // undefined=লোড হচ্ছে, null=নেই
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => listenAccessRequest(familyId, uid, setReqData), [familyId, uid]);

  const send = useCallback(async () => {
    setErr(null); setBusy(true);
    try { await ensureAccessRequest(familyId, uid); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }, [familyId, uid]);

  if (reqData === undefined) return Card("লোড হচ্ছে...");

  if (reqData === null) {
    return Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "এই পরিবারে যোগ দিন"),
        React.createElement("p", { style: { color: "#555", fontSize: "13px" } },
          "আপনার এখনো এই পরিবারে কোনো প্রোফাইল নেই। যদি Admin আপনাকে একটা Key দিয়ে থাকেন, তাহলে ফিরে গিয়ে \"Key দিয়ে লগইন\" ব্যবহার করুন। Key না থাকলে, নিচের বাটনে যোগদানের অনুরোধ পাঠান — Admin অনুমোদন করলে আপনি পরিবারের অংশ হবেন।"
        ),
        err && ErrorBox(err),
        PrimaryButton("যোগদানের অনুরোধ পাঠান", send, busy)
      )
    );
  }

  if (reqData.status === "pending") {
    return Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "অনুমোদনের অপেক্ষায়"),
        React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "আপনার যোগদানের অনুরোধ Admin-এর কাছে পাঠানো হয়েছে। অনুমোদন হলে এই পাতা নিজে থেকেই আপডেট হবে।")
      )
    );
  }

  if (reqData.status === "denied") {
    return Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "অনুরোধ প্রত্যাখ্যাত"),
        React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "আপনার যোগদানের অনুরোধ Admin প্রত্যাখ্যান করেছেন। প্রশ্ন থাকলে Admin-এর সাথে সরাসরি যোগাযোগ করুন।")
      )
    );
  }

  // status === "approved": family-level সদস্য হয়েছেন, কিন্তু এখনো নিজের
  // Member profile/Key নেই — সেটা Admin-কে যোগ করতে হবে (আগের ধাপের ফিচার)।
  return Card(
    React.createElement(
      React.Fragment, null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "যোগদান অনুমোদিত ✓"),
      React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "আপনি এখন এই পরিবারের অংশ। আপনার নিজের প্রোফাইল/Key-এর জন্য Admin-কে বলুন — Key পেলে \"Key দিয়ে লগইন\" থেকে claim করবেন।")
    )
  );
}

// নতুন (Step 5): Admin-only — pending join-request approve/deny panel।
function AccessRequestsPanel({ familyId }) {
  const [requests, setRequests] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(() => {
    listPendingAccessRequests(familyId).then(setRequests).catch((e) => setErr(e.message || String(e)));
  }, [familyId]);
  useEffect(() => { reload(); }, [reload]);

  const decide = useCallback(async (requesterUid, decision) => {
    setBusyId(requesterUid);
    try { await decideAccessRequest(familyId, requesterUid, decision); reload(); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusyId(null); }
  }, [familyId, reload]);

  if (err) return ErrorBox(err);
  if (!requests) return null;

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "যোগদানের অনুরোধ"),
    requests.length === 0
      ? React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "কোনো পেন্ডিং অনুরোধ নেই।")
      : requests.map((r) =>
          React.createElement(
            "div", { key: r.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
            React.createElement("span", null, "uid: " + r.id.slice(0, 10) + "…"),
            React.createElement(
              "div", { style: { display: "flex", gap: "6px" } },
              React.createElement("button", {
                onClick: () => decide(r.id, "approved"), disabled: busyId === r.id,
                style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #0E4B43", background: "#0E4B43", color: "#fff", cursor: "pointer" },
              }, "অনুমোদন"),
              React.createElement("button", {
                onClick: () => decide(r.id, "denied"), disabled: busyId === r.id,
                style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", cursor: "pointer" },
              }, "প্রত্যাখ্যান")
            )
          )
        )
  );
}

// ---- নতুন (Step 6): Health Record CRUD UI ----
// resourceType অনুযায়ী form-field বদলায়, কিন্তু state/submit-logic একটাই component-এ
// (§11-এর presentational-pattern-এর সাথে সংগতিপূর্ণ ছোট scope — আলাদা state/logic
// module এখনো দরকার নেই, Walking Skeleton পর্যায়ে single-file-ই যথেষ্ট)।

function HealthRecordForm({ familyId, targetMemberId, callerMemberId, onAdded }) {
  const [resourceType, setResourceType] = useState("condition");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("A");
  const [status, setStatus] = useState("active");
  const [obsType, setObsType] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [tier, setTier] = useState("otc-self-care");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const resetFields = useCallback(() => {
    setName(""); setObsType(""); setValue(""); setUnit(""); setReaction(""); setDate("");
  }, []);

  const changeResourceType = useCallback((v) => {
    setResourceType(v); resetFields(); setErr(null);
  }, [resetFields]);

  const submit = useCallback(async () => {
    setErr(null);
    if (resourceType === "condition" && !name.trim()) { setErr("Condition-এর নাম লিখুন।"); return; }
    if (resourceType === "observation" && (!obsType.trim() || !value.trim())) { setErr("Observation-এর ধরন ও মান লিখুন।"); return; }
    if (resourceType === "medicationStatement" && !name.trim()) { setErr("ওষুধের নাম লিখুন।"); return; }
    if (resourceType === "allergy" && !name.trim()) { setErr("Allergy-র substance লিখুন।"); return; }
    setBusy(true);
    try {
      await createHealthRecord(familyId, targetMemberId, callerMemberId, resourceType, {
        name, category, status, type: obsType, value, unit, tier, reaction, severity, date,
      });
      resetFields();
      onAdded();
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? "এই সদস্যের জন্য Health Record যোগ করার অনুমতি আপনার নেই।"
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, resourceType, name, category, status, obsType, value, unit, tier, reaction, severity, date, onAdded, resetFields]);

  const typeFields = [];
  if (resourceType === "condition") {
    typeFields.push(TextField("নাম", name, setName, "যেমন: জ্বর"));
    typeFields.push(SelectField("Category", category, setCategory, [["A", "A"], ["B", "B"], ["C", "C"]]));
    typeFields.push(SelectField("Status", status, setStatus, [["active", "active"], ["resolved", "resolved"], ["chronic", "chronic"]]));
    typeFields.push(DateField("Onset তারিখ (ঐচ্ছিক)", date, setDate));
  } else if (resourceType === "observation") {
    typeFields.push(TextField("ধরন", obsType, setObsType, "যেমন: Blood Sugar"));
    typeFields.push(TextField("মান", value, setValue, "যেমন: 110"));
    typeFields.push(TextField("একক", unit, setUnit, "যেমন: mg/dL"));
    typeFields.push(DateField("তারিখ (ঐচ্ছিক)", date, setDate));
  } else if (resourceType === "medicationStatement") {
    typeFields.push(TextField("ওষুধের নাম", name, setName, "যেমন: Paracetamol"));
    typeFields.push(SelectField("Tier", tier, setTier, [["otc-self-care", "otc-self-care"], ["requires-consult", "requires-consult"]]));
    typeFields.push(SelectField("Status", status, setStatus, [["active", "active"], ["stopped", "stopped"]]));
    typeFields.push(DateField("শুরুর তারিখ (ঐচ্ছিক)", date, setDate));
  } else if (resourceType === "allergy") {
    typeFields.push(TextField("Substance", name, setName, "যেমন: Penicillin"));
    typeFields.push(TextField("Reaction", reaction, setReaction, "যেমন: র‍্যাশ"));
    typeFields.push(SelectField("Severity", severity, setSeverity, [["mild", "mild"], ["moderate", "moderate"], ["severe", "severe"]]));
  }

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #CBD5E1", borderRadius: "8px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "নতুন Health Record যোগ করুন"),
    SelectField("ধরন", resourceType, changeResourceType, [
      ["condition", "Condition"], ["observation", "Observation"],
      ["medicationStatement", "Medication"], ["allergy", "Allergy"],
    ]),
    ...typeFields,
    err && ErrorBox(err),
    PrimaryButton("Save করুন", submit, busy)
  );
}

function HealthRecordList({ familyId, targetMemberId, refreshTick }) {
  const [records, setRecords] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setRecords(null);
    setErr(null);
    listHealthRecords(familyId, targetMemberId)
      .then(setRecords)
      .catch((e) => setErr(e.code === "permission-denied"
        ? "এই সদস্যের Health Record দেখার অনুমতি আপনার নেই (Take-Access grant ছাড়া অন্য সদস্যের data দেখা যায় না)।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId, refreshTick]);

  if (err) return ErrorBox(err);
  if (!records) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "লোড হচ্ছে...");
  if (records.length === 0) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "কোনো record নেই।");

  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    records.map((r) =>
      React.createElement(
        "div", { key: r.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px" } },
        React.createElement("div", null, React.createElement("b", null, RESOURCE_TYPE_LABELS[r.resourceType] || r.resourceType)),
        React.createElement("div", { style: { color: "#555" } }, describeHealthRecord(r))
      )
    )
  );
}

// Member-picker + form + list — কোন সদস্যের record দেখা/যোগ করা হচ্ছে তা বেছে নেওয়া
// যায় (open roster থেকে, §3.1 অনুযায়ী)। Permission actual enforcement সবসময়
// server-side rules করে — এই picker শুধু UI-convenience, security boundary না
// (Process ফাইল Rule ৪-এর সাথে সংগতিপূর্ণ)। তাই non-admin/non-grant সদস্য বেছে নিলে
// read/write উভয়েই permission-denied আসবে, যা Walking Skeleton-এর permission
// smoke-test-এর জন্যই প্রয়োজনীয়।
function HealthRecordsSection({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        setTargetMemberId((prev) => prev || callerMemberId || (list[0] && list[0].id) || null);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId, callerMemberId]);

  if (loadErr) return ErrorBox(loadErr);
  if (!members || !targetMemberId) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");
  }

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "Health Records"),
    SelectField("সদস্য বাছাই করুন", targetMemberId, setTargetMemberId, members.map((m) => [m.id, m.name])),
    React.createElement(HealthRecordForm, {
      key: "form-" + targetMemberId,
      familyId, targetMemberId, callerMemberId,
      onAdded: () => setRefreshTick((t) => t + 1),
    }),
    React.createElement(HealthRecordList, {
      key: "list-" + targetMemberId, familyId, targetMemberId, refreshTick,
    })
  );
}

function Dashboard({ familyId, familyDoc, memberId, memberDoc, isAdmin }) {
  const [refreshTick, setRefreshTick] = useState(0);
  return Card(
    React.createElement(
      React.Fragment, null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "স্বাগতম, " + memberDoc.name),
      React.createElement(
        "div", { style: { background: "#F5F5F0", padding: "12px", borderRadius: "8px", marginTop: "12px", fontSize: "14px" } },
        React.createElement("div", null, "পরিবারের কোড: ", React.createElement("b", null, familyDoc.familyCodeDisplay)),
        React.createElement("div", null, "আপনার ভূমিকা: ", React.createElement("b", null, memberDoc.role === "admin" ? "Admin" : memberDoc.role))
      ),
      isAdmin && React.createElement(AddMemberForm, { familyId, onAdded: () => setRefreshTick((t) => t + 1) }),
      isAdmin && React.createElement(MemberList, { key: "ml" + refreshTick, familyId, isAdmin }),
      isAdmin && React.createElement(AccessRequestsPanel, { key: "ar" + refreshTick, familyId }),
      React.createElement(HealthRecordsSection, { key: "hr" + refreshTick, familyId, callerMemberId: memberId }),
      React.createElement(
        "p", { style: { color: "#888", fontSize: "12px", marginTop: "16px" } },
        "Walking Skeleton ধাপ ৬ সম্পন্ন — পরের ধাপ: permission smoke-test (Admin অন্য সদস্যের data দেখতে পারা vs non-admin non-grant না পারা) ও Firebase Emulator rules unit-test।"
      )
    )
  );
}

function App() {
  const [uid, setUid] = useState(null);
  const [authState, setAuthState] = useState("checking");
  const [familyId, setFamilyId] = useState(null);
  const [familyDoc, setFamilyDoc] = useState(null);
  const [memberId, setMemberId] = useState(undefined);
  const [memberDoc, setMemberDoc] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    if (!auth) { setAuthState("unavailable"); return; }
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) { setUid(user.uid); setAuthState("connected"); }
      else {
        setAuthState("signing in...");
        auth.signInAnonymously().catch((err) => setAuthState("sign-in error: " + err.message));
      }
    }, (err) => setAuthState("error: " + err.message));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const stored = localStorage.getItem(FAMILY_ID_STORAGE_KEY);
    if (stored) setFamilyId(stored);
  }, [uid]);

  const loadFamilyAndMember = useCallback(async (fid, u) => {
    setLoadErr(null);
    try {
      const famSnap = await db.collection("families").doc(fid).get();
      if (!famSnap.exists) {
        localStorage.removeItem(FAMILY_ID_STORAGE_KEY);
        setFamilyId(null);
        return;
      }
      setFamilyDoc(famSnap.data());
      const idxSnap = await db.collection("families").doc(fid).collection("uidMemberIndex").doc(u).get();
      if (idxSnap.exists) {
        const mId = idxSnap.data().memberId;
        const mSnap = await db.collection("families").doc(fid).collection("members").doc(mId).get();
        setMemberId(mId);
        setMemberDoc(mSnap.exists ? mSnap.data() : null);
      } else {
        setMemberId(null);
      }
    } catch (e) {
      setLoadErr(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    if (familyId && uid) loadFamilyAndMember(familyId, uid);
  }, [familyId, uid, loadFamilyAndMember]);

  if (!uid) {
    return Card(
      React.createElement(
        React.Fragment, null,
        React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "Health Assistant"),
        React.createElement("div", { style: { background: "#F5F5F0", padding: "12px", borderRadius: "8px", marginTop: "12px" } },
          React.createElement("div", null, "Auth status: ", React.createElement("b", null, authState))
        ),
        initError && ErrorBox("Firebase init error: " + initError)
      )
    );
  }

  if (!familyId) {
    return React.createElement(EntryScreen, { uid, onFamilyReady: setFamilyId });
  }

  if (loadErr) return Card(ErrorBox(loadErr));
  if (!familyDoc || memberId === undefined) return Card("লোড হচ্ছে...");

  const isAdmin = (familyDoc.adminUids || []).includes(uid);

  if (memberId === null) {
    if (isAdmin) {
      return React.createElement(CreateOwnProfile, { familyId, uid, onProfileReady: () => loadFamilyAndMember(familyId, uid) });
    }
    return React.createElement(JoinRequestGate, { familyId, uid });
  }

  if (!memberDoc) return Card("লোড হচ্ছে...");

  return React.createElement(Dashboard, { familyId, familyDoc, memberId, memberDoc, isAdmin });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
