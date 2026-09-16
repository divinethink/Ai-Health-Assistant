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
//
// MemberList সবার জন্য visible (Member Roster open, §3.4.3), NotificationsPanel
// Dashboard-এ আছে। Owner-Controlled Profile Permission (amendment item ২) —
// আগের Take-Access request→approve UI (AccessGrantRequestsPanel) সরানো হয়েছে;
// এখন MemberList.js-এর ভেতরেই সরাসরি per-member Read/Write checkbox দিয়ে
// owner নিজে সরাসরি sharing নিয়ন্ত্রণ করেন।

import { db, auth, initError } from "./firebaseConfig.js";
import { Card, ErrorBox, CollapsibleSection } from "../shared/ui.js";
import { FAMILY_ID_STORAGE_KEY } from "./familyIdentity.js";
import { EntryScreen } from "../components/EntryScreen.js";
import { CreateOwnProfile } from "../components/CreateOwnProfile.js";
import { AddMemberForm } from "../components/AddMemberForm.js";
import { MemberList } from "../components/MemberList.js";
import { JoinRequestGate } from "../components/JoinRequestGate.js";
import { AccessRequestsPanel } from "../components/AccessRequestsPanel.js";
import { NotificationsPanel } from "../components/NotificationsPanel.js";
import { HealthRecordsPageSection } from "../health/records/HealthRecordsPageSection.js";
import { CareEscalationDirectory } from "../health/emergency/CareEscalationDirectory.js";
import { BackupRestoreSection } from "../health/backup/BackupRestoreSection.js";
import { GeneralChatSection } from "../health/general-chat/GeneralChatSection.js";
import { WellnessGuideSection } from "../health/wellness-guide/WellnessGuideSection.js";
import { DoctorDetailsSection } from "../health/doctor-details/DoctorDetailsSection.js";
import { AIChatSection } from "../health/ai-chat/AIChatSection.js";
import { DocumentsPageSection } from "../health/documents/DocumentsPageSection.js";

const { useState, useEffect, useCallback } = React;

// P11 — Bottom-Nav App-Shell (Roadmap §24, 1_5_..._Mockup.md §১) — Confirmed
// scope: presentation-layer পুনর্গঠন, কোনো নতুন schema/permission/rules/AI-
// behavior পরিবর্তন নেই। আগের flat-dashboard বাটন-লিস্ট এখন ৫-ট্যাব bottom-nav
// (হোম/AI চ্যাট/Health ব্লগ/Documents/Menu) + persistent top-bar (title +
// compact Profile-pill dropdown, mockup §১-এর সাথে সংগতিপূর্ণ)-এ ভাগ হলো।
// প্রতিটা ট্যাব-content (HealthRecordsPageSection/AIChatSection/
// WellnessGuideSection/DocumentsPageSection) আগে থেকেই নিজস্ব fixed-full-screen
// overlay ছিল — top-bar (44px) ও bottom-nav (56px)-এর জন্য জায়গা রাখতে সেই
// ফাইলগুলোতে top/bottom clearance যোগ হয়েছে (ওই ৪ ফাইলে কোনো logic-পরিবর্তন
// নেই)। Doctor Details ও General Chat আগের মতোই স্বতন্ত্র full-screen overlay
// (General Chat: Profile-pill dropdown থেকে trigger; Doctor Details: Menu-এর
// "নেভিগেশন" গ্রুপ থেকে) — bottom-nav-এর ট্যাব না, mockup §১-এর সাথে সংগতিপূর্ণ।

const BOTTOM_NAV_HEIGHT = 56;

const NAV_TABS = [
  ["home", "🏠", "হোম"],
  ["aichat", "🩺", "AI চ্যাট"],
  ["blog", "📚", "Health ব্লগ"],
  ["documents", "📁", "Documents"],
  ["menu", "☰", "Menu"],
];

function BottomNav({ active, onChange }) {
  return React.createElement(
    "div", {
      style: {
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45,
        display: "flex", background: "#fff", borderTop: "1px solid #E2E8F0",
        maxWidth: "480px", margin: "0 auto", height: BOTTOM_NAV_HEIGHT + "px",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
      },
    },
    NAV_TABS.map(([id, icon, label]) => {
      const isActive = id === active;
      return React.createElement(
        "button", {
          key: id, onClick: () => onChange(id),
          style: {
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: "2px", border: "none", background: "none",
            cursor: "pointer", color: isActive ? "#0E4B43" : "#8A9A96",
            fontWeight: isActive ? 700 : 500, padding: 0,
          },
        },
        React.createElement("span", { style: { fontSize: "18px", lineHeight: 1 } }, icon),
        React.createElement("span", { style: { fontSize: "10px", lineHeight: 1 } }, label)
      );
    })
  );
}

function TopBar({ memberDoc, familyDoc, isAdmin, onOpenGeneralChat }) {
  const [open, setOpen] = useState(false);
  return React.createElement(
    "div", {
      style: {
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 46, height: "44px",
        maxWidth: "480px", margin: "0 auto", display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 14px", background: "#fff",
        borderBottom: "1px solid #E2E8F0",
      },
    },
    React.createElement("span", { style: { fontWeight: 700, color: "#0E4B43", fontSize: "15px" } }, "Health Assistant"),
    React.createElement(
      "div", { style: { position: "relative" } },
      React.createElement(
        "button", {
          onClick: () => setOpen((o) => !o),
          style: {
            display: "flex", alignItems: "center", gap: "4px", border: "1px solid #E2E8F0",
            borderRadius: "999px", padding: "5px 10px", background: "#F5F5F0", cursor: "pointer",
            fontSize: "12px", color: "#0E4B43", fontWeight: 600,
          },
        },
        "👤 " + memberDoc.name + (open ? " ▲" : " ▼")
      ),
      open && React.createElement(
        "div", {
          style: {
            position: "absolute", right: 0, top: "36px", zIndex: 50, background: "#fff",
            border: "1px solid #E2E8F0", borderRadius: "8px", minWidth: "210px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)", padding: "10px", fontSize: "13px",
          },
        },
        React.createElement("div", { style: { color: "#666" } }, "ভূমিকা: ", React.createElement("b", null, isAdmin ? "Admin" : memberDoc.role)),
        React.createElement("div", { style: { color: "#666", marginTop: "2px", fontSize: "11px" } }, "পরিবারের কোড: " + familyDoc.familyCodeDisplay),
        isAdmin && React.createElement(
          "button", {
            onClick: () => { setOpen(false); onOpenGeneralChat(); },
            style: {
              marginTop: "10px", width: "100%", padding: "8px", border: "1px solid #1B2430",
              borderRadius: "6px", background: "#1B2430", color: "#fff", fontSize: "12px",
              fontWeight: 600, cursor: "pointer",
            },
          },
          "🌐 General Chat"
        )
      )
    )
  );
}

function ProfileMiniCard({ memberDoc, familyDoc, isAdmin }) {
  return React.createElement(
    "div", { style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", marginBottom: "12px", background: "#fff" } },
    React.createElement("div", { style: { fontWeight: 700, color: "#0E4B43", fontSize: "15px" } }, "👤 " + memberDoc.name),
    React.createElement(
      "div", { style: { fontSize: "12px", color: "#666", marginTop: "4px" } },
      "ভূমিকা: ", React.createElement("b", null, isAdmin ? "Admin" : memberDoc.role),
      " · পরিবারের কোড: ", React.createElement("b", null, familyDoc.familyCodeDisplay)
    )
  );
}

function MenuPage({ uid, familyId, familyDoc, memberId, memberDoc, isAdmin, refreshTick, setRefreshTick, onOpenDoctorDetails }) {
  return React.createElement(
    "div", { style: { paddingTop: "56px", paddingLeft: "12px", paddingRight: "12px", paddingBottom: (BOTTOM_NAV_HEIGHT + 12) + "px" } },
    React.createElement("h2", { style: { color: "#0E4B43", fontSize: "17px", margin: "4px 0 12px" } }, "☰ মেনু"),
    React.createElement(ProfileMiniCard, { memberDoc, familyDoc, isAdmin }),
    React.createElement(NotificationsPanel, { key: "nt" + refreshTick, familyId, uid }),
    React.createElement(CollapsibleSection, {
      title: "👨‍👩‍👧‍👦 পরিবার", defaultOpen: true,
      children: React.createElement(
        React.Fragment, null,
        isAdmin && React.createElement(AddMemberForm, { familyId, onAdded: () => setRefreshTick((t) => t + 1) }),
        React.createElement(MemberList, { key: "ml" + refreshTick, familyId, isAdmin, myMemberId: memberId }),
        isAdmin && React.createElement(AccessRequestsPanel, { key: "ar" + refreshTick, familyId })
      ),
    }),
    React.createElement(CollapsibleSection, {
      title: "🧭 নেভিগেশন", defaultOpen: false,
      children: React.createElement(
        "button", {
          onClick: onOpenDoctorDetails,
          style: { width: "100%", padding: "10px", border: "1px solid #0E4B43", borderRadius: "8px", background: "#0E4B43", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
        },
        "🩺 ডাক্তার বিবরণ ও ভিজিটিং কার্ড"
      ),
    }),
    React.createElement(CollapsibleSection, {
      title: "📞 রেফারেন্স — Verified Care-Escalation Directory", defaultOpen: false,
      children: React.createElement(CareEscalationDirectory, { key: "care-escalation" + refreshTick }),
    }),
    React.createElement(CollapsibleSection, {
      title: "💾 ডেটা-ম্যানেজমেন্ট — ব্যাকআপ/রিস্টোর", defaultOpen: false,
      children: React.createElement(BackupRestoreSection, { key: "backup" + refreshTick, familyId, callerMemberId: memberId, isAdmin }),
    })
  );
}

function Dashboard({ uid, familyId, familyDoc, memberId, memberDoc, isAdmin }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeTab, setActiveTab] = useState("home");
  // General Chat / Doctor Details — bottom-nav ট্যাব না, আগের মতোই স্বতন্ত্র
  // full-screen overlay (এখন Menu ট্যাব থেকে trigger হয়, আগে flat-dashboard-
  // এর বাটন থেকে হতো — শুধু entry-point বদলেছে, component/rules অপরিবর্তিত)।
  const [showGeneralChat, setShowGeneralChat] = useState(false);
  const [showDoctorDetails, setShowDoctorDetails] = useState(false);

  const goHome = () => setActiveTab("home");

  if (isAdmin && showGeneralChat) {
    return React.createElement(GeneralChatSection, { familyId, onExit: () => setShowGeneralChat(false) });
  }
  if (showDoctorDetails) {
    return React.createElement(DoctorDetailsSection, { familyId, callerMemberId: memberId, isAdmin, onExit: () => setShowDoctorDetails(false) });
  }

  let tabContent;
  if (activeTab === "home") {
    tabContent = React.createElement(HealthRecordsPageSection, { familyId, callerMemberId: memberId, onExit: goHome });
  } else if (activeTab === "aichat") {
    tabContent = React.createElement(AIChatSection, { familyId, callerMemberId: memberId, onExit: goHome });
  } else if (activeTab === "blog") {
    tabContent = React.createElement(WellnessGuideSection, { familyId, isAdmin, myMemberId: memberId, onExit: goHome });
  } else if (activeTab === "documents") {
    tabContent = React.createElement(DocumentsPageSection, { familyId, callerMemberId: memberId, onExit: goHome });
  } else {
    tabContent = React.createElement(MenuPage, {
      uid, familyId, familyDoc, memberId, memberDoc, isAdmin, refreshTick, setRefreshTick,
      onOpenDoctorDetails: () => setShowDoctorDetails(true),
    });
  }

  return React.createElement(
    React.Fragment, null,
    React.createElement(TopBar, { memberDoc, familyDoc, isAdmin, onOpenGeneralChat: () => setShowGeneralChat(true) }),
    tabContent,
    React.createElement(BottomNav, { active: activeTab, onChange: setActiveTab })
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

  return React.createElement(Dashboard, { uid, familyId, familyDoc, memberId, memberDoc, isAdmin });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
