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
import { Card, BootSplash, ErrorBox, CollapsibleSection } from "../shared/ui.js";
import { histRestore } from "../shared/navHistory.js";
import { Icon } from "../shared/icons.js";
import { clearMemberHealthCache } from "../health/records/memberHealthStore.js";
import { t, useLang, setLang, getLang } from "../shared/i18n.js";
import { GoogleSignInGate } from "../components/GoogleSignInGate.js";
import { rotateInviteLink, revokeInviteLink, getActiveInvite, startGoogleAccountChange, hasGoogleProvider } from "./googleAuth.js";
import { GoogleRelinkGate } from "../components/GoogleRelinkGate.js";
import { AddMemberForm } from "../components/AddMemberForm.js";
import { MemberList } from "../components/MemberList.js";
import { NotificationsPanel } from "../components/NotificationsPanel.js";
import { HealthRecordsPageSection } from "../health/records/HealthRecordsPageSection.js";
import { HealthTimeline } from "../health/timeline/HealthTimeline.js";
import { VaccinationScheduler } from "../health/calendar/VaccinationScheduler.js";
import { CareEscalationDirectory } from "../health/emergency/CareEscalationDirectory.js";
import { BackupRestoreSection } from "../health/backup/BackupRestoreSection.js";
import { WellnessGuideSection } from "../health/wellness-guide/WellnessGuideSection.js";
import { AIChatSection } from "../health/ai-chat/AIChatSection.js";
import { TrackerPageSection } from "../health/tracker/TrackerPageSection.js";
import { QuickAddFab, QuickAddSheet } from "../health/quickadd/QuickAddSheet.js";
import { quickTarget } from "../health/quickadd/quickAddTargets.js";
import { setQuickIntent, setQuickOrigin } from "../shared/quickIntent.js";
import { TrackerReminderRunner } from "../health/tracker/TrackerReminderRunner.js";
import { listMembers } from "./familyIdentity.js";
import { AppLockGate } from "../components/AppLockGate.js";
import { PasscodeSettings } from "../components/PasscodeSettings.js";
import { PageLayoutScreen } from "../components/PageLayoutScreen.js";
import { AiModelSettings } from "../components/AiModelSettings.js";
import { isAppCreatorUid } from "./appDesign.js";
import { PAGE_IDS, PAGE_DEFS } from "../shared/pageLayout.js";
import { clearPasscode } from "../shared/appLock.js";

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
// নেই)। Doctor Details আগের মতোই স্বতন্ত্র full-screen overlay
// (Menu-এর "নেভিগেশন" গ্রুপ থেকে) — bottom-nav-এর ট্যাব না, mockup §১-এর সাথে সংগতিপূর্ণ।
//
// P11 সংযোজন (Design Tokens + Tablet/Desktop pass, mockup §৬/§৯): TopBar/
// BottomNav-এর আগের কৃত্রিম maxWidth:480px cap সরানো হয়েছে (tab-content আগে
// থেকেই full-viewport-width fixed-overlay ছিল — cap থাকলে wide screen-এ
// nav-bar ও content-এর width মিলত না; মোবাইলে viewport এমনিতেই <480px বলে
// কোনো visual regression নেই)। Light/Sepia/Dark theme — index.html-এ CSS
// var()-token + ThemeSwitcher (Menu → "⚙️ প্রেফারেন্স") + shared
// CollapsibleSection (shared/ui.js)-এ token প্রয়োগ; Light-mode-এর ডিফল্ট
// value আগের hex-এর সাথে হুবহু মিলিয়ে রাখা হয়েছে (zero regression),
// Sepia/Dark শুধু explicit selection-এই সক্রিয় হয়। বাকি existing
// page-content (HealthRecords/AIChat/Documents/Wellness-Blog ইত্যাদি)
// নিজস্ব hardcoded রং-এই থাকে — বড় retrofit এখানে scope করা হয়নি।

const BOTTOM_NAV_HEIGHT = 56;

const NAV_TABS = [
  // ৫ ট্যাব (owner-request): এআই চ্যাট এখন মেনু থেকে খোলে (activeTab "aichat" থাকে, শুধু বটম-নেভে বাটন নেই)
  ["home", "home", "Home"],
  ["health", "health", "Health"],
  ["tracker", "tracker", "Tracker"],
  ["blog", "blog", "Blog"],
  ["menu", "menu", "Menu"],
];

function BottomNav({ active, onChange }) {
  return React.createElement(
    "div", {
      style: {
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45,
        display: "flex", background: "var(--hs-surface)", borderTop: "1px solid var(--hs-border)",
        height: BOTTOM_NAV_HEIGHT + "px", boxShadow: "0 -4px 14px rgba(14,75,67,0.10)",
      },
    },
    NAV_TABS.map(([id, icon, label]) => {
      const isActive = id === active;
      return React.createElement(
        "button", {
          key: id, onClick: () => onChange(id),
          style: {
            flex: 1, maxWidth: "160px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: "2px", border: "none", background: "none", minHeight: 0,
            cursor: "pointer", color: isActive ? "var(--hs-primary)" : "var(--hs-muted)",
            fontWeight: isActive ? 700 : 500, padding: 0,
          },
        },
        React.createElement("span", { style: { display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 18px", borderRadius: "999px", background: isActive ? "var(--hs-chip-bg)" : "transparent", transition: "background .2s" } }, Icon(icon, { size: 22, stroke: isActive ? 2 : 1.7 })),
        React.createElement("span", { style: { fontSize: "14px", lineHeight: 1 } }, label)
      );
    })
  );
}

// প্রোফাইল-চিপ — পুরনো স্থির TopBar-এর বদলে (৪৪px ফেরত)। প্রতিটি পেজের
// ট্যাব-পিল-সারির বামে বসে। ড্রপডাউন position:fixed — পিল-সারির overflow-এ কাটা পড়ে না।
// variant=="name": মেনুর প্রোফাইল-কার্ডের নামটাই ট্রিগার (ড্রপডাউন কার্ডের নিচে, কার্ড-প্রস্থে)। ডিফল্ট: আগের পিল-চিপ।
function ProfileChip({ memberDoc, familyDoc, isAdmin, members, selectedMemberId, onChangeMember, variant }) {
  const asName = variant === "name";
  const [open, setOpen] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeErr, setChangeErr] = useState(null);
  const doChangeGmail = async () => {
    if (changeBusy) return;
    setChangeBusy(true); setChangeErr(null);
    const res = await startGoogleAccountChange();
    setChangeBusy(false);
    if (res && res.ok) { setOpen(false); setConfirmChange(false); } // গেট নিজে থেকে পূর্ণ-পর্দায় আসবে
    else setChangeErr((res && res.message) || null);
  };
  const first = ((memberDoc.name || "?").trim().split(/\s+/)[0]) || "?";
  return React.createElement(
    React.Fragment, null,
    React.createElement(
      "button", {
        onClick: () => setOpen((o) => !o), "aria-label": memberDoc.name,
        style: asName ? {
          display: "flex", alignItems: "center", gap: "4px", minHeight: "36px", maxWidth: "100%", minWidth: 0,
          border: "none", background: "none", padding: 0, margin: 0, cursor: "pointer", fontFamily: "inherit",
          color: "var(--hs-primary)", fontSize: "16px", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        } : {
          flexShrink: 0, display: "flex", alignItems: "center", gap: "4px", minHeight: "42px", maxWidth: "130px",
          border: "1px solid var(--hs-primary)", borderRadius: "999px", padding: "4px 10px", cursor: "pointer",
          background: "var(--hs-primary)", color: "var(--hs-primary-contrast)", fontSize: "16px", fontWeight: 700,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        },
      },
      (asName ? (memberDoc.name || "?") : first) + " ▾"
    ),
    open && React.createElement("div", { onClick: () => setOpen(false), style: { position: "fixed", inset: 0, zIndex: 59, background: "rgba(0,0,0,0.15)" } }),
    open && React.createElement(
      "div", {
        style: {
          ...(asName ? { position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)" } : { position: "fixed", left: "12px", top: "56px" }),
          zIndex: 60, background: "var(--hs-surface)",
          border: "1px solid var(--hs-border)", borderRadius: "14px", minWidth: asName ? 0 : "220px", maxWidth: "calc(100vw - 24px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: "10px", fontSize: "14px", color: "var(--hs-text)",
        },
      },
      React.createElement("div", { style: { fontWeight: 700, fontSize: "16px", color: "var(--hs-primary)" } }, memberDoc.name),
      auth.currentUser && auth.currentUser.email && React.createElement("div", { style: { color: "var(--hs-muted)", fontSize: "13px", marginTop: "2px", wordBreak: "break-all" } }, auth.currentUser.email),
      React.createElement("div", { style: { marginTop: "8px" } },
        React.createElement("span", { style: { display: "inline-block", padding: "3px 10px", borderRadius: "999px", background: "var(--hs-border)", fontSize: "12px", fontWeight: 600 } }, isAdmin ? "Admin" : memberDoc.role)),
      React.createElement("div", { style: { color: "var(--hs-muted)", marginTop: "8px", fontSize: "13px" } }, t("top.familyCode") + ": " + familyDoc.familyCodeDisplay),
      members && members.length > 1 && React.createElement(
        "div", { style: { marginTop: "10px" } },
        React.createElement("div", { style: { color: "var(--hs-muted)", fontSize: "12px", marginBottom: "4px" } }, t("top.member")),
        members.map((m) => React.createElement(
          "button", {
            key: m.id, onClick: () => { onChangeMember(m.id); setOpen(false); },
            style: {
              display: "block", width: "100%", textAlign: "left", padding: "8px 10px", marginTop: "4px", minHeight: "40px", borderRadius: "10px", cursor: "pointer", fontSize: "14px",
              border: m.id === selectedMemberId ? "1px solid var(--hs-primary)" : "1px solid var(--hs-border)",
              background: m.id === selectedMemberId ? "var(--hs-chip-bg)" : "var(--hs-surface)", color: "var(--hs-text)",
              fontWeight: m.id === selectedMemberId ? 700 : 500,
            },
          },
          (m.id === selectedMemberId ? "✓ " : "") + m.name
        ))
      ),
      auth.currentUser && hasGoogleProvider(auth.currentUser) && React.createElement(
        "div", { style: { marginTop: "8px", borderTop: "1px solid var(--hs-border)", paddingTop: "8px" } },
        !confirmChange
          ? React.createElement("button", { onClick: () => setConfirmChange(true), style: { width: "100%", minHeight: "40px", padding: "8px", border: "1px solid var(--hs-border)", borderRadius: "10px", background: "var(--hs-surface)", color: "var(--hs-text)", fontSize: "14px", fontWeight: 600, cursor: "pointer" } }, "🔄 " + t("top.changeGmail"))
          : React.createElement("div", { style: { fontSize: "12.5px", lineHeight: 1.5 } },
              React.createElement("div", { style: { fontWeight: 700, marginBottom: "4px" } }, t("top.changeGmailSure")),
              React.createElement("ul", { style: { margin: "0 0 6px", paddingLeft: "18px", color: "var(--hs-muted)" } },
                ["top.changeGmailN1", "top.changeGmailN2", "top.changeGmailN3"].map((k) => React.createElement("li", { key: k }, t(k)))),
              changeErr && React.createElement("div", { style: { color: "#C0392B", marginBottom: "6px" } }, changeErr),
              React.createElement("div", { style: { display: "flex", gap: "6px" } },
                React.createElement("button", { disabled: changeBusy, onClick: doChangeGmail, style: { flex: 1, minHeight: "40px", border: "none", borderRadius: "10px", background: "var(--hs-primary)", color: "var(--hs-primary-contrast)", fontWeight: 700, fontSize: "14px", cursor: "pointer", opacity: changeBusy ? 0.5 : 1 } }, changeBusy ? t("top.wait") : t("top.changeGmailYes")),
                React.createElement("button", { disabled: changeBusy, onClick: () => { setConfirmChange(false); setChangeErr(null); }, style: { flex: 1, minHeight: "40px", border: "1px solid var(--hs-border)", borderRadius: "10px", background: "var(--hs-surface)", color: "var(--hs-text)", fontSize: "14px", cursor: "pointer" } }, t("top.cancel"))
              ))
      ),
      React.createElement(
        "button", {
          onClick: () => { setOpen(false); clearPasscode(); clearMemberHealthCache(); auth.signOut(); }, // সাইন-আউটে এই ফোনের অ্যাপ-লক PIN-ও মোছে
          style: { marginTop: "8px", width: "100%", padding: "8px", border: "1px solid #C0392B", borderRadius: "10px", background: "#fff", color: "#C0392B", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
        },
        t("top.logout")
      )
    )
  );
}

function ProfileMiniCard({ memberDoc, familyDoc, isAdmin, nameSlot }) {
  const [copied, setCopied] = useState(false);
  const initial = ((memberDoc.name || "?").trim()[0] || "?").toUpperCase();
  const copyCode = () => {
    try {
      navigator.clipboard.writeText(familyDoc.familyCodeDisplay).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    } catch (e) { /* noop */ }
  };
  return React.createElement(
    "div", { style: { position: "relative", display: "flex", alignItems: "center", gap: "12px", border: "1px solid var(--hs-border)", borderRadius: "18px", padding: "12px 14px", marginBottom: "10px", background: "linear-gradient(135deg, var(--hs-surface), var(--hs-chip-bg))", boxShadow: "0 3px 12px rgba(14,75,67,0.10)" } },
    React.createElement("div", { style: { width: "46px", height: "46px", flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 800, color: "var(--hs-primary-contrast)", background: "linear-gradient(135deg, var(--hs-primary), var(--hs-primary-2, var(--hs-primary)))", boxShadow: "0 3px 8px rgba(14,75,67,0.3)" } }, initial),
    React.createElement(
      "div", { style: { flex: 1, minWidth: 0 } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
        nameSlot || React.createElement("span", { style: { fontWeight: 800, color: "var(--hs-primary)", fontSize: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, memberDoc.name),
        React.createElement("span", { style: { fontSize: "11px", fontWeight: 700, padding: "1px 8px", borderRadius: "999px", background: "var(--hs-primary)", color: "var(--hs-primary-contrast)", flexShrink: 0 } }, isAdmin ? "Admin" : memberDoc.role)
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", minWidth: 0 } },
        React.createElement("span", { style: { fontSize: "12px", color: "var(--hs-muted)", flexShrink: 0 } }, t("top.familyCode")),
        React.createElement("b", { style: { fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 } }, familyDoc.familyCodeDisplay),
        React.createElement("button", {
          type: "button", onClick: copyCode, "aria-label": copied ? t("menu.copied") : t("menu.copy"), title: copied ? t("menu.copied") : t("menu.copy"),
          style: { width: "32px", height: "32px", minWidth: "32px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: "none", borderRadius: "10px", background: "transparent", color: "var(--hs-primary)", cursor: "pointer", flexShrink: 0 },
        }, Icon(copied ? "check" : "copy", { size: 18, stroke: 2 }))
      )
    )
  );
}

// Design Tokens — Light/Sepia/Dark theme-switcher (mockup §৬, P11)। শুধু
// document.documentElement-এ data-theme attribute সেট করে (index.html-এর CSS
// var()-গুলো সেই অনুযায়ী resolve হয়) + localStorage-এ persist — কোনো
// Firestore/schema টাচ হয় না, pure client-side preference।
const HS_THEME_STORAGE_KEY = "hs-theme";
// [id, নামের key, primary(dot), bg, surface, মোড] — নমুনা-রঙ index.html-এর টোকেনের সাথে মেলানো
const THEME_OPTIONS = [
  ["light", "theme.light", "#0E4B43", "#F1F6F2", "#FFFFFF", "Light"],
  ["sepia", "theme.sepia", "#6B4A2B", "#F2E8D5", "#FBF3E3", "Light"],
  ["dark", "theme.dark", "#2E7D6F", "#10151A", "#1B232B", "Dark"],
  ["herbal", "theme.herbal", "#14532D", "#E6EEDE", "#FBF8EA", "Light"],
  ["night-pulse", "theme.nightPulse", "#1A8F60", "#05080A", "#11181A", "Dark"],
  ["calm-paper", "theme.calmPaper", "#185E6A", "#ECE0C2", "#FDF8E9", "Light"],
  ["warm-clay", "theme.warmClay", "#AA4826", "#F8EFE6", "#FFFAF5", "Light"],
  ["ocean-calm", "theme.oceanCalm", "#3E6092", "#E2E7F2", "#F7F9FC", "Light"],
];
const HS_THEME_IDS = THEME_OPTIONS.map((o) => o[0]);

function currentThemeId() { return localStorage.getItem(HS_THEME_STORAGE_KEY) || "light"; }
function currentThemeLabel() { const o = THEME_OPTIONS.find((x) => x[0] === currentThemeId()); return t((o || THEME_OPTIONS[0])[1]).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, ""); }

// থিম-পেজ: ২ কলামের কার্ড (৩টা নমুনা-রং + নাম + Light/Dark)। শুধু ডিভাইসের পছন্দ, DB-তে কিছু নয়।
function ThemeSwitcher() {
  useLang();
  const [theme, setTheme] = useState(currentThemeId);
  const applyTheme = (id) => {
    document.documentElement.setAttribute("data-theme", id);
    try { localStorage.setItem(HS_THEME_STORAGE_KEY, id); } catch (_e) { /* স্টোরেজ বন্ধ থাকলেও থিম বদলায় */ }
    setTheme(id);
  };
  const dot = (c) => React.createElement("span", { style: { width: "22px", height: "22px", borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,0.1)", marginLeft: "-6px", display: "inline-block" } });
  return React.createElement("div", { role: "radiogroup", "aria-label": t("menu.themeShort"), style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" } },
    THEME_OPTIONS.map(([id, label, primary, bg, surface, mode]) => {
      const on = theme === id;
      return React.createElement("button", { key: id, type: "button", role: "radio", "aria-checked": on, onClick: () => applyTheme(id),
        style: { minHeight: "76px", padding: "10px 12px", borderRadius: "16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: "8px",
          border: on ? "2px solid var(--hs-primary)" : "1.5px solid var(--hs-border)", background: "var(--hs-surface)", color: "var(--hs-text)", boxShadow: on ? "0 3px 10px rgba(14,75,67,0.18)" : "none" } },
        React.createElement("span", { style: { display: "flex", paddingLeft: "6px" } }, dot(bg), dot(surface), dot(primary)),
        React.createElement("span", { style: { fontSize: "14px", fontWeight: 700 } }, (on ? "✓ " : "") + t(label).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "")),
        React.createElement("span", { style: { fontSize: "12px", color: "var(--hs-muted)" } }, mode));
    }));
}

// ভাষা-নির্বাচন (বাংলা / English) — শুধু এই ডিভাইসের পছন্দ (shared/i18n.js)।
function LanguageSwitcher() {
  const lang = useLang();
  return React.createElement(
    "div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
    ["bn", "en"].map((id) =>
      React.createElement(
        "button", {
          key: id, onClick: () => setLang(id),
          style: {
            padding: "10px 18px", borderRadius: "999px", cursor: "pointer", fontSize: "14px",
            border: lang === id ? "2px solid var(--hs-primary)" : "1px solid var(--hs-border)",
            background: lang === id ? "var(--hs-chip-bg)" : "var(--hs-surface)",
            color: "var(--hs-text)", fontWeight: lang === id ? 700 : 500,
          },
        },
        t("lang." + id)
      )
    )
  );
}

// Invite-Link — Admin-only, বিদ্যমান family-তে join করার একমাত্র পথ
// (Architecture Part A §3.0)। familyDoc.activeInviteToken already MenuPage-
// এর প্রপ হিসেবে পাওয়া যায় বলে আলাদা Firestore read লাগছে না।
function InviteLinkPanel({ familyId, familyDoc, isAdmin }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // component-local override — rotate/revoke-এর পর familyDoc প্রপ App()-এর
  // পরবর্তী family-reload না হওয়া পর্যন্ত stale থাকতে পারে, তাই সাথে সাথে
  // UI আপডেট দেখাতে local state ব্যবহার (Firestore-এই আসল সত্য লেখা হয়ে
  // গেছে — এটা শুধু optimistic display)।
  const [localToken, setLocalToken] = useState(null);
  // ধাপ ২: token এখন invites/{token} ডকে — Admin প্যানেল খুললে একবার পড়ে।
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  useEffect(() => {
    if (!isAdmin) return undefined;
    let alive = true;
    getActiveInvite(familyId)
      .then((a) => { if (alive) { setLocalToken(a); setLoaded(true); } })
      .catch(() => { if (alive) { setLoadErr(true); setLoaded(true); } });
    return () => { alive = false; };
  }, [familyId, isAdmin]);
  if (!isAdmin) return null;
  if (!loaded) return React.createElement("div", { style: { marginTop: "14px", fontSize: "14px", color: "var(--hs-muted)" } }, "আমন্ত্রণ লিংক লোড হচ্ছে...");

  const active = localToken;
  const isLive = active && !active.revoked;
  const link = isLive ? `${window.location.origin}${window.location.pathname}?fam=${familyId}&tok=${active.token}` : null;

  const handleGenerate = () => {
    setBusy(true); setCopied(false);
    rotateInviteLink(familyId)
      .then((token) => setLocalToken({ token, revoked: false }))
      .finally(() => setBusy(false));
  };
  const handleRevoke = () => {
    setBusy(true);
    revokeInviteLink(familyId, active)
      .then(() => setLocalToken({ ...active, revoked: true }))
      .finally(() => setBusy(false));
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => setCopied(true));
  };

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "10px", border: "1px dashed var(--hs-border)", borderRadius: "14px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "var(--hs-primary)", margin: "0 0 6px" } }, "🔗 আমন্ত্রণ লিংক"),
    loadErr && React.createElement("div", { style: { fontSize: "13px", color: "#C0392B", marginBottom: "6px" } }, "আমন্ত্রণ লিংক পড়া যায়নি।"),
    isLive
      ? React.createElement(
          React.Fragment, null,
          React.createElement("div", { style: { fontSize: "14px", wordBreak: "break-all", background: "var(--hs-chip-bg)", padding: "6px", borderRadius: "10px" } }, link),
          React.createElement(
            "div", { style: { display: "flex", gap: "8px", marginTop: "6px" } },
            React.createElement("button", {
              onClick: handleCopy, disabled: busy,
              style: { fontSize: "14px", padding: "6px 10px", borderRadius: "10px", border: "1px solid var(--hs-primary)", background: "#fff", color: "var(--hs-primary)", cursor: "pointer" },
            }, copied ? "কপি হয়েছে ✓" : "লিংক কপি করুন"),
            React.createElement("button", {
              onClick: handleRevoke, disabled: busy,
              style: { fontSize: "14px", padding: "6px 10px", borderRadius: "10px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", cursor: "pointer" },
            }, "বাতিল করুন")
          )
        )
      : React.createElement("button", {
          onClick: handleGenerate, disabled: busy,
          style: { fontSize: "14px", padding: "6px 10px", borderRadius: "10px", border: "1px solid var(--hs-primary)", background: "var(--hs-primary)", color: "#fff", cursor: "pointer" },
        }, busy ? "তৈরি হচ্ছে..." : "লিংক তৈরি করুন")
  );
}

// মেনুর প্রিমিয়াম আইকন-বাবল: প্রতিটির নিজস্ব হালকা রঙ (রঙ-এর alpha পটভূমি, তাই সব থিমে মানায়)
const MENU_ICONS = {
  family: ["users", "#1F7A5C"], timeline: ["clock", "#3B82B6"], data: ["save", "#D08A2E"], lock: ["lock", "#7A5BB0"],
  design: ["sliders", "#5F7A8A"], aimodel: ["bot", "#3E6BC4"], theme: ["palette", "#C25B8A"], lang: ["globe", "#2A9AA8"],
  aichat: ["health", "#1F7A5C"], notif: ["bell", "#D08A2E"], emergency: ["phone", "#C0392B"],
};
function menuBubble(id, size) {
  const [icon, color] = MENU_ICONS[id] || ["home", "#1F7A5C"];
  const sz = size || 38;
  return React.createElement("span", { "aria-hidden": "true", style: { width: sz + "px", height: sz + "px", flexShrink: 0, borderRadius: Math.round(sz * 0.32) + "px", display: "flex", alignItems: "center", justifyContent: "center", color, background: "linear-gradient(145deg, " + color + "29, " + color + "14)", boxShadow: "inset 0 0 0 1px " + color + "30" } },
    Icon(icon, { size: Math.round(sz * 0.52), stroke: 1.9 }));
}

function MenuPage({ uid, familyId, familyDoc, memberId, memberDoc, isAdmin, refreshTick, setRefreshTick, onOpenAIChat, onOpenReminders, chip, selectedMemberId }) {
  // মেনু-reorg ধাপ ক (owner-approved, ২০২৬-১১-০৮): প্রোফাইল-হেডার + সমান দুই দ্রুত-টাইল
  // (ডাক্তার/জরুরি) + পরিষ্কার সারি-তালিকা; সারিতে চাপলে নিজস্ব সাব-পেজ (← মেনু)।
  // কনটেন্ট component-গুলো অপরিবর্তিত — শুধু সাজানো/নেভিগেশন।
  const [showCare, setShowCare] = useState(false);
  const [sub, setSub] = useState(null); // null | "family" | "data" | "lock" | "settings" | "design"
  const [designPage, setDesignPage] = useState(null); // App Creator-এর পেজ-কাস্টমাইজ স্ক্রিন (null | "home" | "trend")
  const isCreator = isAppCreatorUid(uid);
  const wrapStyle = { paddingTop: "8px", paddingLeft: "12px", paddingRight: "12px", paddingBottom: (BOTTOM_NAV_HEIGHT + 12) + "px", color: "var(--hs-text)" };

  if (designPage && isCreator) {
    return React.createElement(PageLayoutScreen, { key: "pl-" + designPage, page: designPage, onClose: () => setDesignPage(null) });
  }

  if (sub) {
    const titles = { family: ["family", t("menu.familyTitle")], data: ["data", t("menu.dataTitle")], timeline: ["timeline", "টাইমলাইন"], lock: ["lock", t("menu.lockTitle")], theme: ["theme", "থিম"], lang: ["lang", "ভাষা"], design: ["design", "কাস্টমাইজ"], aimodel: ["aimodel", "AI মডেল"] };
    let body = null;
    if (sub === "family") {
      body = React.createElement(
        React.Fragment, null,
        React.createElement(MemberList, { key: "ml" + refreshTick, familyId, isAdmin, myMemberId: memberId }),
        isAdmin && React.createElement(CollapsibleSection, {
          title: t("menu.adminTools"), defaultOpen: false,
          children: React.createElement(
            React.Fragment, null,
            React.createElement(InviteLinkPanel, { familyId, familyDoc, isAdmin }),
            React.createElement(AddMemberForm, { familyId, onAdded: () => setRefreshTick((x) => x + 1) })
          ),
        })
      );
    } else if (sub === "timeline") {
      // টাইমলাইন + টিকা — হেলথ-পিল থেকে মেনুতে সরানো (owner-request ২০২৬-১১-১৩); কম্পোনেন্ট অপরিবর্তিত
      body = React.createElement(HealthTimeline, { familyId, callerMemberId: memberId, selectedMemberId,
        vaccineSlot: React.createElement(VaccinationScheduler, { familyId, callerMemberId: memberId, selectedMemberId, inline: true }) });
    } else if (sub === "data") {
      body = React.createElement(BackupRestoreSection, { key: "backup" + refreshTick, familyId, callerMemberId: memberId, isAdmin });
    } else if (sub === "lock") {
      body = React.createElement(PasscodeSettings);
    } else if (sub === "design" && isCreator) {
      // শুধু App Creator: পেজ বেছে কার্ডের ক্রম/দৃশ্যমানতা/ভাঁজ সাজান — সব সদস্য একই দেখবেন
      body = React.createElement(React.Fragment, null,
        React.createElement("p", { style: { fontSize: "13px", color: "var(--hs-muted)", margin: "0 0 10px", lineHeight: 1.5 } }, "পেজ বেছে নিন। আপনার সাজানো ডিজাইন সব সদস্য একই দেখবেন।"),
        React.createElement("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          PAGE_IDS.map((pid) => React.createElement("button", { key: pid, type: "button", onClick: () => setDesignPage(pid),
            style: { flex: "1 1 40%", minHeight: "70px", borderRadius: "16px", border: "1px solid var(--hs-border)", background: "linear-gradient(180deg, var(--hs-surface), var(--hs-chip-bg))", color: "var(--hs-primary)", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 10px rgba(14,75,67,0.09)" } }, PAGE_DEFS[pid].label))));
    } else if (sub === "aimodel" && isCreator) {
      // শুধু App Creator: AI provider + model বদল (API key নয়) — Worker পরের চ্যাট থেকেই ব্যবহার করে
      body = React.createElement(AiModelSettings, { uid, isCreator });
    } else if (sub === "theme") {
      body = React.createElement(ThemeSwitcher);
    } else {
      body = React.createElement(LanguageSwitcher);
    }
    return React.createElement(
      "div", { style: wrapStyle },
      React.createElement("div", { style: { display: "flex", marginBottom: "4px" } }, chip),
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        React.createElement("button", {
          onClick: () => setSub(null),
          style: { border: "none", background: "none", color: "var(--hs-primary)", fontSize: "15px", fontWeight: 700, cursor: "pointer", padding: "6px 0", minHeight: "44px" },
        }, t("menu.back")),
        React.createElement("button", { type: "button", onClick: () => setSub(null), "aria-label": "বন্ধ করুন", style: { minWidth: "44px", minHeight: "44px", border: "none", borderRadius: "12px", background: "var(--hs-chip-bg)", color: "var(--hs-primary)", fontSize: "20px", fontWeight: 700, cursor: "pointer" } }, "✕")),
      React.createElement("h3", { style: { display: "flex", alignItems: "center", gap: "10px", fontSize: "18px", color: "var(--hs-primary)", margin: "2px 0 12px" } }, menuBubble(titles[sub][0], 34), titles[sub][1]),
      body
    );
  }

  // কমপ্যাক্ট প্রিমিয়াম: ছোট দ্রুত-টাইল (গ্রেডিয়েন্ট + আইকন-বাবল) + এক কার্ডে ভাগ-করা সারি-তালিকা
  const tile = (id, label, onClick, urgent) => React.createElement("button", {
    key: label, type: "button", onClick,
    style: {
      flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "88px", padding: "12px 4px",
      borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontWeight: 700, lineHeight: 1.2, textAlign: "center", fontFamily: "inherit",
      border: "1px solid " + (urgent ? "#EBB5AE" : "var(--hs-border)"),
      background: urgent ? "linear-gradient(180deg, #FFF8F6, #FFECE8)" : "linear-gradient(180deg, var(--hs-surface), var(--hs-chip-bg))",
      color: urgent ? "#C0392B" : "var(--hs-primary)",
      boxShadow: "0 4px 14px rgba(14,75,67,0.10)",
    },
  }, menuBubble(id, 40), React.createElement("span", { style: { maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, label));

  const row = (id, title, subtitle, onClick, last) => React.createElement("button", {
    key: title, type: "button", onClick,
    style: { width: "100%", display: "flex", alignItems: "center", gap: "14px", minHeight: "64px", padding: "10px 16px", border: "none", borderBottom: last ? "none" : "1px solid var(--hs-border)", background: "transparent", cursor: "pointer", textAlign: "left", color: "var(--hs-text)", fontFamily: "inherit" },
  },
    menuBubble(id, 40),
    React.createElement("span", { style: { flex: 1, minWidth: 0 } },
      React.createElement("span", { style: { display: "block", fontSize: "15px", fontWeight: 700, color: "var(--hs-primary)", lineHeight: 1.25 } }, title),
      React.createElement("span", { style: { display: "block", fontSize: "12.5px", color: "var(--hs-muted)", marginTop: "2px", lineHeight: 1.3 } }, subtitle)),
    React.createElement("span", { "aria-hidden": "true", style: { color: "var(--hs-muted)", opacity: 0.7, display: "flex" } }, Icon("chevronRight", { size: 18, stroke: 2 }))
  );
  const group = (children) => React.createElement("div", { style: { borderRadius: "20px", border: "1px solid var(--hs-border)", background: "var(--hs-surface)", overflow: "hidden", boxShadow: "0 4px 14px rgba(14,75,67,0.09)", marginBottom: "14px" } }, children);

  return React.createElement(
    "div", { style: wrapStyle },
    // উপরের আলাদা নাম-চিপ সরানো (owner-request ২০২৬-১১-১৪) — কার্ডের নামই ড্রপডাউন-ট্রিগার (সদস্য-বদল/Change Gmail/Log out)
    React.createElement(ProfileMiniCard, { memberDoc, familyDoc, isAdmin, nameSlot: React.cloneElement(chip, { variant: "name", key: "profile-name" }) }),
    React.createElement(NotificationsPanel, { key: "nt" + refreshTick, familyId, uid }),
    React.createElement(
      "div", { style: { display: "flex", gap: "8px", marginBottom: "12px" } },
      tile("aichat", t("nav.aichat"), onOpenAIChat, false),
      tile("notif", t("menu.notifShort"), onOpenReminders, false), // ট্যাপে সরাসরি ট্র্যাকার ▸ রিমাইন্ডার
      tile("emergency", t("menu.emergencyShort").replace("📞 ", ""), () => setShowCare((v) => !v), true)
    ),
    showCare && React.createElement(
      "div", { style: { marginBottom: "14px" } },
      React.createElement("h4", { style: { fontSize: "15px", color: "var(--hs-primary)", margin: "0 0 8px" } }, t("menu.care")),
      React.createElement(CareEscalationDirectory, { key: "care-escalation" + refreshTick })
    ),
    group([
      row("family", t("menu.familyTitle"), t("menu.familySub"), () => setSub("family")),
      row("timeline", "টাইমলাইন", "স্বাস্থ্য-ঘটনা ও টিকা, মাস অনুযায়ী", () => setSub("timeline")),
      row("data", t("menu.dataTitle"), t("menu.dataSub"), () => setSub("data"), true),
    ]),
    group([
      row("lock", t("menu.lockTitle"), t("menu.lockSub"), () => setSub("lock")),
      isCreator && row("design", "কাস্টমাইজ", "পেজের কার্ড সাজান (শুধু অ্যাপ-ক্রিয়েটর)", () => setSub("design")),
      isCreator && row("aimodel", "AI মডেল", "provider ও model বদলান (শুধু অ্যাপ-ক্রিয়েটর)", () => setSub("aimodel")),
      row("theme", "থিম", currentThemeLabel(), () => setSub("theme")),
      row("lang", "ভাষা", t("lang." + getLang()), () => setSub("lang"), true),
    ])
  );
}


function Dashboard({ uid, familyId, familyDoc, memberId, memberDoc, isAdmin }) {
  useLang(); // ভাষা বদলালে পুরো স্ক্রিন নতুন করে আঁকা হয় (state অক্ষত থাকে)
  const [refreshTick, setRefreshTick] = useState(0);
  // ফোনের Back বাটন: ট্যাব/ওভারলে বদলালে browser-history-তে এন্ট্রি যোগ হয়, Back চাপলে ঠিক আগের স্ক্রিনে ফেরে
  // (আগে history-তে কিছুই ছিল না বলে সরাসরি অ্যাপ থেকে বেরিয়ে যেত)। ভিউ = {tab, dd: Doctor Details}।
  const [view, setView] = useState({ tab: "home", dd: false });
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const navigate = (patch) => {
    const cur = viewRef.current;
    const next = { ...cur, ...patch };
    if (next.tab === cur.tab && next.dd === cur.dd) return;
    try { window.history.pushState({ hs: 1, ...next }, ""); } catch (_e) { /* history ব্যর্থ হলেও নেভিগেশন চলে */ }
    viewRef.current = next;
    setView(next);
  };
  useEffect(() => {
    try { window.history.replaceState({ hs: 1, tab: "home", dd: false }, ""); } catch (_e) { /* উপেক্ষা */ }
    const onPop = (e) => {
      const st = e.state;
      if (st && st.hs) { const next = { tab: st.tab || "home", dd: !!st.dd }; viewRef.current = next; setView(next); histRestore(st.inner); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const activeTab = view.tab;
  const setActiveTab = (tab) => navigate({ tab, dd: false });
  const [members, setMembers] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  // Doctor Details — bottom-nav ট্যাব না, আগের মতোই স্বতন্ত্র
  // full-screen overlay (এখন Menu ট্যাব থেকে trigger হয়, আগে flat-dashboard-
  // এর বাটন থেকে হতো — শুধু entry-point বদলেছে, component/rules অপরিবর্তিত)।

  // app-wide সদস্য-তালিকা — একবারই fetch, Home/AI-চ্যাট/Documents ৩ ট্যাব-ই
  // এই একই selectedMemberId শেয়ার করে (ট্যাব পাল্টালেও persist থাকে, item ১)।
  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        setSelectedMemberId((prev) => prev || memberId || (list[0] && list[0].id) || null);
      })
      .catch(() => { /* non-critical — সদস্য-স্তরের পেজ নিজেই permission-error দেখাবে */ });
  }, [familyId, memberId]);

  const goHome = () => setActiveTab("home");
  // "+ দ্রুত যোগ" (ধাপ ৯): বার্তা রেখে গন্তব্যে যাওয়া; হোমেই থাকলে হোম নতুন করে আঁকা (homeKey) যাতে ফর্ম খোলে
  const [quickOpen, setQuickOpen] = useState(false);
  const [homeKey, setHomeKey] = useState(0);
  const [blogKey, setBlogKey] = useState(0); // ব্লগ ট্যাবে আবার ট্যাপ → ব্লগের হোমে ফেরা (পোস্ট/ক্যাটেগরি বন্ধ)
  const onQuickPick = (kind) => {
    const tab = quickTarget(kind);
    setQuickIntent(kind);
    setQuickOpen(false);
    if (!tab) return;
    if (tab === activeTab) setHomeKey((n) => n + 1); else { setQuickOrigin(activeTab); setActiveTab(tab); }
  };


  // স্থির TopBar নেই — প্রোফাইল-চিপ (নাম ▾) শুধু মেনু-পেজে (সদস্য-বদল, লগআউট এখানেই); অন্য পেজের পিল-সারিতে নেই।
  // নির্বাচিত সদস্য ডিফল্টে সবসময় নিজে (selectedMemberId শুরুতে memberId)।
  const topOffsetPx = 0;
  const chip = React.createElement(ProfileChip, {
    key: "profile-chip", memberDoc, familyDoc, isAdmin,
    members, selectedMemberId, onChangeMember: setSelectedMemberId,
  });

  let tabContent;
  if (activeTab === "home") {
    tabContent = React.createElement(TrackerPageSection, { key: "home-" + homeKey, mode: "today", familyId, callerMemberId: memberId, selectedMemberId, members, topOffsetPx, onOpenTrend: () => { setQuickIntent("trend"); setActiveTab("tracker"); } });
  } else if (activeTab === "health") {
    tabContent = React.createElement(HealthRecordsPageSection, { key: "health-" + homeKey, mode: "health", familyId, callerMemberId: memberId, isAdmin, selectedMemberId, topOffsetPx, onExit: goHome });
  } else if (activeTab === "aichat") {
    tabContent = React.createElement(AIChatSection, { familyId, callerMemberId: memberId, selectedMemberId, topOffsetPx, onExit: () => setActiveTab("menu") });
  } else if (activeTab === "tracker") {
    tabContent = React.createElement(TrackerPageSection, { mode: "plan", familyId, callerMemberId: memberId, selectedMemberId, members, topOffsetPx, onGoHome: goHome });
  } else if (activeTab === "blog") {
    tabContent = React.createElement(WellnessGuideSection, { key: "blog-" + blogKey, familyId, isAdmin, myMemberId: memberId, onExit: goHome });
  } else {
    tabContent = React.createElement(MenuPage, {
      uid, familyId, familyDoc, memberId, memberDoc, isAdmin, refreshTick, setRefreshTick,
      onOpenAIChat: () => setActiveTab("aichat"), onOpenReminders: () => { setQuickIntent("reminder"); setActiveTab("tracker"); }, chip, selectedMemberId,
    });
  }

  return React.createElement(
    React.Fragment, null,
    tabContent,
    React.createElement(TrackerReminderRunner, { familyId, memberId, members }),
    (activeTab === "home" || activeTab === "health") && selectedMemberId && React.createElement(QuickAddFab, { onOpen: () => setQuickOpen(true) }),
    React.createElement(QuickAddSheet, { open: quickOpen, onClose: () => setQuickOpen(false), onPick: onQuickPick, memberName: ((members || []).find((m) => m.id === selectedMemberId) || {}).name || "" }),
    React.createElement(BottomNav, { active: activeTab === "aichat" ? "menu" : activeTab, onChange: (t) => { if (t === "blog" && activeTab === "blog") { setBlogKey((n) => n + 1); return; } setActiveTab(t); } })
  );
}

// Invite-Link join (Architecture Part A §3.0) — URL query-param থেকে
// ?fam={familyId}&tok={token} পার্স করা হয়, একবার/lazy-init (mount-এর পর
// URL বদলে গেলেও নতুন করে পড়া হবে না, expected — join সম্পন্ন হলে নিচে
// clearInviteParamsFromURL() দিয়ে পরিষ্কার হয়)।
function parseInviteParamsFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fam = params.get("fam");
    const tok = params.get("tok");
    if (fam && tok) return { inviteFamilyId: fam, inviteToken: tok };
  } catch (e) { /* noop */ }
  return { inviteFamilyId: null, inviteToken: null };
}
function clearInviteParamsFromURL() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("fam");
    url.searchParams.delete("tok");
    window.history.replaceState({}, "", url.toString());
  } catch (e) { /* noop */ }
}

function App() {
  const [uid, setUid] = useState(null);
  const [authState, setAuthState] = useState("checking");
  const [{ inviteFamilyId, inviteToken }] = useState(parseInviteParamsFromURL);
  const [familyId, setFamilyId] = useState(null);
  const [familyDoc, setFamilyDoc] = useState(null);
  const [memberId, setMemberId] = useState(undefined);
  const [memberDoc, setMemberDoc] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const preMemberRef = React.useRef(null); // গেট যে member ডক আগেই পড়েছে — দ্বিতীয়বার read এড়াতে

  useEffect(() => {
    // Design Tokens (P11, mockup §৬) — আগের সেশনে বাছাই করা theme (Sepia/Dark)
    // localStorage থেকে পড়ে <html data-theme> সেট করা, যাতে Menu-তে না গিয়েও
    // reload-এর পর আগের theme বহাল থাকে। ThemeSwitcher (app.js) একই key ব্যবহার করে।
    const saved = localStorage.getItem(HS_THEME_STORAGE_KEY);
    if (saved && HS_THEME_IDS.includes(saved)) document.documentElement.setAttribute("data-theme", saved);
  }, []);

  // Google Sign-in Only (Architecture Part A §3.0) — কোনো Anonymous Auth
  // fallback নেই। uid==null মানে সাইন-ইন করা হয়নি, GoogleSignInGate বাটন
  // দেখাবে।
  useEffect(() => {
    if (!auth) { setAuthState("unavailable"); return; }
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) { setUid(user.uid); setAuthState("connected"); }
      else {
        setUid(null); setAuthState("signed-out");
        // FIXED — sign-out-এ familyId/familyDoc/memberId/memberDoc reset না
        // করলে render-logic (!familyId) মিথ্যা থেকে যেত ও পুরনো stale
        // Dashboard-ই দেখাতে থাকত (GoogleSignInGate-এ ফেরত না গিয়ে)।
        setFamilyId(null); setFamilyDoc(null);
        setMemberId(undefined); setMemberDoc(null);
      }
    }, (err) => setAuthState("error: " + err.message));
    return () => unsub();
  }, []);

  // পুরনো localStorage-ভিত্তিক family-id resume সম্পূর্ণ বাদ — এখন familyId
  // GoogleSignInGate-এর onSuccess() থেকে সরাসরি আসে (users/{uid} global
  // fast-path lookup GoogleSignInGate নিজেই করে, নিচে দ্রষ্টব্য)।

  const loadFamilyAndMember = useCallback(async (fid, u) => {
    setLoadErr(null);
    try {
      // family ডক ও uidMemberIndex একসাথে (parallel) — আগে পরপর ছিল।
      const famRef = db.collection("families").doc(fid);
      const [famSnap, idxSnap] = await Promise.all([famRef.get(), famRef.collection("uidMemberIndex").doc(u).get()]);
      if (!famSnap.exists) {
        setFamilyId(null);
        return;
      }
      setFamilyDoc(famSnap.data());
      if (idxSnap.exists) {
        const mId = idxSnap.data().memberId;
        const pre = preMemberRef.current;
        if (pre && pre.id === mId && pre.data) {
          setMemberId(mId);
          setMemberDoc(pre.data);
        } else {
          const mSnap = await famRef.collection("members").doc(mId).get();
          setMemberId(mId);
          setMemberDoc(mSnap.exists ? mSnap.data() : null);
        }
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

  if (initError && !uid) {
    return Card(ErrorBox("Firebase init error: " + initError));
  }

  // Google Sign-in Only (Architecture Part A §3.0) — !uid(sign-in করা হয়নি)
  // ও uid-আছে-কিন্তু-familyId-এখনো-resolve-হয়নি(mapping-check/নতুন-ইউজার)
  // — দুটো ক্ষেত্রেই GoogleSignInGate। uid prop পাঠানো থাকলে component নিজেই
  // (কোনো দ্বিতীয় popup ছাড়া) fast-path/email-match check চালায়।
  // auth অবস্থা যাচাই চলার সময় লগইন-পেজ নয়, স্প্ল্যাশ (আগে ভুল করে লগইন ঝলকাত)।
  if (authState === "checking") return React.createElement(BootSplash);

  if (!familyId) {
    return React.createElement(GoogleSignInGate, {
      uid, inviteFamilyId, inviteToken,
      onSuccess: (fid, mId, mData) => {
        preMemberRef.current = mId && mData ? { id: mId, data: mData } : null;
        clearInviteParamsFromURL();
        setFamilyId(fid);
        if (mId) setMemberId(mId);
      },
    });
  }

  if (loadErr) return Card(ErrorBox(loadErr));
  // memberId===null — familyId resolve হয়েছে কিন্তু uidMemberIndex-এ এই uid
  // পাওয়া যায়নি। নতুন Google Sign-in flow-এ প্রতিটা valid claim/creation
  // path একই transaction-এ uidMemberIndex লেখে (googleAuth.js), তাই এই
  // অবস্থা স্বাভাবিক flow-এ ঘটার কথা না — শুধু data-inconsistency-এর
  // defensive fallback হিসেবে স্পষ্ট বার্তা দেখানো হচ্ছে (অনির্দিষ্টকালের
  // silent loading এড়াতে)।
  if (memberId === null) {
    return Card(ErrorBox("এই account-এর সাথে কোনো প্রোফাইল মেলেনি। আবার সাইন-ইন করে দেখুন।"));
  }
  if (!familyDoc || memberId === undefined || !memberDoc) {
    return React.createElement(BootSplash);
  }

  const isAdmin = (familyDoc.adminUids || []).includes(uid);

  return React.createElement(AppLockGate, null, React.createElement(Dashboard, { uid, familyId, familyDoc, memberId, memberDoc, isAdmin }));
}

const root = ReactDOM.createRoot(document.getElementById("root"));
// GoogleRelinkGate App()-এর বাইরে: জিমেইল-বদলের মাঝপথের রিকভারি-পর্দা App-এর early-return-এ ঢাকা পড়ে না।
root.render(React.createElement(React.Fragment, null, React.createElement(App), React.createElement(GoogleRelinkGate)));
