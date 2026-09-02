// Walking Skeleton — top-level App()/Dashboard wiring।
//
// Component-Split (অংশ A, owner-approved): এই ফাইল আগে family/member/claim/
// join-request/health-record — সব logic+UI একাই বহন করত (একক-ফাইল Walking
// Skeleton প্যাটার্ন, `1_2_1_Health_Assistant_File_Structure.md` অংশ ২-এ
// নথিভুক্ত কারণসহ)। এখন সেই কোড File Structure ডকুমেন্টের পরিকল্পনা অনুযায়ী
// `src/shared/`, `src/components/`, `src/health/records/`, ও
// `src/legacy/familyIdentity.js`/`accessRequests.js`-এ ভাগ হয়েছে — এই ফাইলে
// এখন শুধু top-level App() state/wiring ও Dashboard composition থাকে (Process
// ফাইল Rule ১১: state/business-logic core-layer-এ, UI presentational)।
// কোনো functional পরিবর্তন হয়নি — শুধু re-organize।

import { db, auth, initError } from "./firebaseConfig.js";
import { Card, ErrorBox } from "../shared/ui.js";
import { FAMILY_ID_STORAGE_KEY } from "./familyIdentity.js";
import { EntryScreen } from "../components/EntryScreen.js";
import { CreateOwnProfile } from "../components/CreateOwnProfile.js";
import { AddMemberForm } from "../components/AddMemberForm.js";
import { MemberList } from "../components/MemberList.js";
import { JoinRequestGate } from "../components/JoinRequestGate.js";
import { AccessRequestsPanel } from "../components/AccessRequestsPanel.js";
import { HealthRecordsSection } from "../health/records/HealthRecordsSection.js";

const { useState, useEffect, useCallback } = React;

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
