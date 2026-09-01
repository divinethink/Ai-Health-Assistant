// Walking Skeleton — Step 3: Family create/resume + নিজের Member profile।
//
// DailyTask-এর প্রমাণিত pattern reuse (familyIdentity.js/memberData.js থেকে):
// - family-code charset validation (English-only, ৬-৩০ ক্যারেক্টার)
// - familyCodes doc atomic-uniqueness transaction (race-condition safe)
// - localStorage-এ familyId persist করে session bootstrap (এই ডিভাইসে)
// তবে Health App-এর ইতিমধ্যে-Confirmed schema/rules (Architecture Plan
// §3.4.2/§3.4.6, firestore_rules_FINAL.md) অনুযায়ী adapt করা হয়েছে —
// DailyTask-এর schema/collection-নাম হুবহু কপি না করে (যেমন keyIndex এখানে
// global+plaintext-key-doc-id, DailyTask-এর family-scoped+hash-doc-id থেকে ভিন্ন)।
import { db, auth, initError } from "./firebaseConfig.js";

const { useState, useEffect, useCallback } = React;

const FAMILY_ID_STORAGE_KEY = "ha_family_id";
const FAMILY_CODE_MIN_LENGTH = 6;
const FAMILY_CODE_MAX_LENGTH = 30;
// English-only, reserved "__..__" prefix বাদ — DailyTask charset-নীতি reuse
const FAMILY_CODE_CHARSET_PATTERN = /^(?!__.*__$)[A-Za-z0-9_-]+$/;

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

// ---- Firestore action helpers ----

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

  // ধাপ ১: family doc তৈরি (adminUids: [] — rules-এর create-clause অনুযায়ী বাধ্যতামূলক)
  await familyRef.set({
    familyId,
    familyCodeDisplay: trimmed,
    createdBy: uid,
    createdAt: now,
    adminUids: [],
  });

  // ধাপ ২: familyCode claim — transaction দিয়ে atomic uniqueness check
  // (DailyTask-এর createNewFamily()-এর race-fix pattern reuse)
  try {
    await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (codeSnap.exists) {
        throw new Error("code-taken");
      }
      tx.set(codeRef, { familyId, createdBy: uid, createdAt: now });
    });
  } catch (err) {
    // family doc আগেই তৈরি হয়ে গেছে কিন্তু code claim ব্যর্থ — orphaned family
    // থেকে যাবে (rare race), কিন্তু data-loss/corruption না। user নতুন কোড
    // দিয়ে আবার চেষ্টা করতে পারবেন।
    if (err.message === "code-taken") {
      throw new Error("এই কোড আগে থেকেই ব্যবহৃত হয়েছে। অন্য কোড দিয়ে চেষ্টা করুন।");
    }
    throw err;
  }

  // ধাপ ৩: প্রথম-admin claim (rules: adminUids.size()==0 অবস্থায়ই সম্ভব)
  await familyRef.update({
    adminUids: [uid],
    firstAdminUid: uid,
    updatedAt: now,
  });

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
    name,
    dob,
    sex,
    role: "admin",
    ownerUids: [uid],
    ownerActivity: { [uid]: now },
    createdAt: now,
    updatedAt: now,
  });
  await db
    .collection("families")
    .doc(familyId)
    .collection("uidMemberIndex")
    .doc(uid)
    .set({ memberId });
  return memberId;
}

// ---- UI ----

function ErrorBox(msg) {
  return React.createElement(
    "div",
    {
      style: {
        marginTop: "12px", padding: "10px", borderRadius: "8px",
        background: "#FDECEA", border: "1px solid #C0392B", color: "#7A1F14",
        fontSize: "13px",
      },
    },
    msg
  );
}

function TextField(label, value, onChange, placeholder) {
  return React.createElement(
    "div",
    { style: { marginTop: "10px" } },
    React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, label),
    React.createElement("input", {
      type: "text",
      value,
      placeholder,
      onChange: (e) => onChange(e.target.value),
      style: {
        width: "100%", boxSizing: "border-box", padding: "10px",
        border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px",
      },
    })
  );
}

function PrimaryButton(label, onClick, busy) {
  return React.createElement(
    "button",
    {
      onClick,
      disabled: busy,
      style: {
        marginTop: "14px", width: "100%", padding: "12px", border: "none",
        borderRadius: "8px", background: busy ? "#8FAFA9" : "#0E4B43",
        color: "#fff", fontSize: "15px", fontWeight: 600,
        cursor: busy ? "default" : "pointer",
      },
    },
    busy ? "অপেক্ষা করুন..." : label
  );
}

function Card(children) {
  return React.createElement(
    "div",
    { style: { padding: "24px", maxWidth: "420px", margin: "40px auto", fontFamily: "'Hind Siliguri', sans-serif" } },
    children
  );
}

function CreateOrResumeFamily({ uid, onFamilyReady }) {
  const [mode, setMode] = useState("create"); // "create" | "resume"
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = useCallback(async () => {
    setErr(null);
    setBusy(true);
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

  return Card(
    React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "Health Assistant"),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px", marginTop: "12px" } },
        React.createElement(
          "button",
          {
            onClick: () => setMode("create"),
            style: {
              flex: 1, padding: "8px", borderRadius: "6px", fontSize: "13px",
              border: mode === "create" ? "2px solid #0E4B43" : "1px solid #CBD5E1",
              background: mode === "create" ? "#E8F3EC" : "#fff", cursor: "pointer",
            },
          },
          "নতুন পরিবার তৈরি"
        ),
        React.createElement(
          "button",
          {
            onClick: () => setMode("resume"),
            style: {
              flex: 1, padding: "8px", borderRadius: "6px", fontSize: "13px",
              border: mode === "resume" ? "2px solid #0E4B43" : "1px solid #CBD5E1",
              background: mode === "resume" ? "#E8F3EC" : "#fff", cursor: "pointer",
            },
          },
          "বিদ্যমান কোড লোড"
        )
      ),
      React.createElement(
        "p",
        { style: { color: "#555", fontSize: "13px", marginTop: "10px" } },
        mode === "create"
          ? "আপনার পরিবারের জন্য একটা ইউনিক কোড দিন (শুধু English অক্ষর/সংখ্যা/-/_ , ৬-৩০ ক্যারেক্টার)।"
          : "আগে তৈরি করা পরিবারের কোড দিয়ে এই ডিভাইসে পুনরায় সংযুক্ত করুন (owner নিজের family resume করার জন্য)।"
      ),
      TextField(mode === "create" ? "পরিবারের কোড (আপনি ঠিক করুন)" : "পরিবারের কোড", code, setCode, "যেমন: rahman_family"),
      err && ErrorBox(err),
      PrimaryButton(mode === "create" ? "পরিবার তৈরি করুন" : "লোড করুন", submit, busy)
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
      React.Fragment,
      null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "আপনার প্রোফাইল"),
      React.createElement("p", { style: { color: "#555", fontSize: "13px" } }, "পরিবার তৈরি হয়েছে — এখন নিজের প্রোফাইল দিন (আপনি এই পরিবারের প্রথম Admin)।"),
      TextField("নাম", name, setName, "আপনার নাম"),
      React.createElement(
        "div",
        { style: { marginTop: "10px" } },
        React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "জন্ম-তারিখ"),
        React.createElement("input", {
          type: "date", min: "1960-01-01", max: todayISO, value: dob,
          onChange: (e) => setDob(e.target.value),
          style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
        })
      ),
      React.createElement(
        "div",
        { style: { marginTop: "10px" } },
        React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "লিঙ্গ"),
        React.createElement(
          "select",
          {
            value: sex, onChange: (e) => setSex(e.target.value),
            style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
          },
          React.createElement("option", { value: "male" }, "পুরুষ"),
          React.createElement("option", { value: "female" }, "মহিলা")
        )
      ),
      err && ErrorBox(err),
      PrimaryButton("প্রোফাইল তৈরি করুন", submit, busy)
    )
  );
}

function Dashboard({ familyDoc, memberDoc }) {
  return Card(
    React.createElement(
      React.Fragment,
      null,
      React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "স্বাগতম, " + memberDoc.name),
      React.createElement(
        "div",
        { style: { background: "#F5F5F0", padding: "12px", borderRadius: "8px", marginTop: "12px", fontSize: "14px" } },
        React.createElement("div", null, "পরিবারের কোড: ", React.createElement("b", null, familyDoc.familyCodeDisplay)),
        React.createElement("div", null, "আপনার ভূমিকা: ", React.createElement("b", null, memberDoc.role === "admin" ? "Admin" : memberDoc.role))
      ),
      React.createElement(
        "p",
        { style: { color: "#888", fontSize: "12px", marginTop: "16px" } },
        "Walking Skeleton ধাপ ৩ সম্পন্ন — পরের ধাপ: Member add, Direct-Identify claim/login।"
      )
    )
  );
}

function App() {
  const [uid, setUid] = useState(null);
  const [authState, setAuthState] = useState("checking");
  const [familyId, setFamilyId] = useState(null);
  const [familyDoc, setFamilyDoc] = useState(null);
  const [memberId, setMemberId] = useState(undefined); // undefined = অজানা, null = নেই
  const [memberDoc, setMemberDoc] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    if (!auth) { setAuthState("unavailable"); return; }
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setUid(user.uid);
        setAuthState("connected");
      } else {
        setAuthState("signing in...");
        auth.signInAnonymously().catch((err) => setAuthState("sign-in error: " + err.message));
      }
    }, (err) => setAuthState("error: " + err.message));
    return () => unsub();
  }, []);

  // familyId resolve (localStorage থেকে)
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
        React.Fragment,
        null,
        React.createElement("h1", { style: { color: "#0E4B43", fontSize: "20px" } }, "Health Assistant"),
        React.createElement(
          "div",
          { style: { background: "#F5F5F0", padding: "12px", borderRadius: "8px", marginTop: "12px" } },
          React.createElement("div", null, "Auth status: ", React.createElement("b", null, authState))
        ),
        initError && ErrorBox("Firebase init error: " + initError)
      )
    );
  }

  if (!familyId) {
    return React.createElement(CreateOrResumeFamily, { uid, onFamilyReady: setFamilyId });
  }

  if (loadErr) return Card(ErrorBox(loadErr));
  if (!familyDoc || memberId === undefined) return Card("লোড হচ্ছে...");

  const isAdmin = (familyDoc.adminUids || []).includes(uid);

  if (memberId === null) {
    if (isAdmin) {
      return React.createElement(CreateOwnProfile, {
        familyId, uid,
        onProfileReady: () => loadFamilyAndMember(familyId, uid),
      });
    }
    return Card(
      React.createElement(
        "p",
        { style: { color: "#555" } },
        "এই পরিবারে আপনার কোনো প্রোফাইল এখনো তৈরি হয়নি। Admin-কে যোগাযোগ করুন। (Join/Take-Access ফ্লো পরের ধাপে আসবে।)"
      )
    );
  }

  if (!memberDoc) return Card("লোড হচ্ছে...");

  return React.createElement(Dashboard, { familyDoc, memberDoc });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
