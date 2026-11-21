import { t, L, digits } from "../../shared/i18n.js";
// হেলথ রেকর্ড (হোম) — Full-page wrapper, P11 mockup §৩ অনুযায়ী ৫টা sub-tab
// pill দিয়ে reorganized (ধাপ ২)। প্রতিটা sub-tab-এর ভেতরের existing
// component অপরিবর্তিত (HealthRecordsSection-এ শুধু নতুন `section` prop
// যোগ হয়েছে profile/records ভাগ করতে) — কোনো নতুন schema/data-logic নেই।
//
// আপডেট (owner-request, member-selector unification): আগে ৫টা sub-tab-এর
// ৩টাতে (প্রোফাইল/স্বাস্থ্য-তথ্য একই HealthRecordsSection, খাদ্য নির্দেশিকা,
// টাইমলাইন) আলাদা আলাদা "সদস্য বাছাই করুন" dropdown ছিল — ট্যাব পাল্টালেই
// আবার নতুন করে সদস্য বাছতে হতো। এখন `selectedMemberId` এই পেজ-wrapper-level-এ
// lift করা হয়েছে — একবার বাছলে এই পুরো হোম-পেজের সব sub-tab-এই persist থাকে।
// নিচের component-গুলোর ভেতরের নিজস্ব member-fetch/dropdown সরিয়ে
// `selectedMemberId` প্রপ নেওয়া হচ্ছে (HealthRecordsSection, DietGuidanceSection,
// HealthTimeline) — কোনো schema/permission পরিবর্তন নেই, presentation-layer-only।
// আপডেট (owner-request, ২০২৬-০৯-১৬): VaccinationScheduler-এও এখন
// `selectedMemberId` thread করা হয়েছে (আগে family-wide ভাবা হয়েছিল, কিন্তু
// আসলে per-child, নিজস্ব দ্বিতীয় dropdown ছিল — সেটা সরিয়ে এই পেজ-লেভেল
// selector-ই reuse হচ্ছে) এবং শুধু শিশুদের জন্য (৬ বছরের নিচে) দেখানো হয়,
// CollapsibleSection-এ। FamilyHealthCalendar সত্যিকারের family-wide (তার
// নিজস্ব "event কার জন্য" dropdown ভিন্ন purpose — event tagging, member-view-
// selector না) — Vaccination-এর উপরে আনা হলো (owner-request, দ্রুত-ব্যবহৃত
// জিনিস আগে)। MedicationReminders অপরিবর্তিত (সব সদস্যের aggregate list)।
//
// Care-Escalation Directory ও Backup/Restore এখনো main Dashboard-এই আছে
// (Menu full-page তৈরি না হওয়া পর্যন্ত, আলাদা থ্রেড)।

// আপডেট (owner-request, item ১, ২০২৬-০৯-১৬, app-wide member-switcher):
// `selectedMemberId` এখন এই wrapper-এও নিজে fetch/state করে না — Dashboard
// (app.js)-এর একক app-wide switcher থেকে prop হিসেবে আসে (Home/AI-চ্যাট/
// Documents ৩ ট্যাব-ই এখন এই একই সদস্য শেয়ার করে, ট্যাব পাল্টালেও persist
// থাকে)। `topOffsetPx`-ও Dashboard থেকে আসে (member-switcher-bar থাকলে ৭৮px,
// না থাকলে ৪৪px) — hardcoded "44px" সরানো হয়েছে।
//
// Care-Escalation Directory ও Backup/Restore এখনো main Dashboard-এই আছে
// (Menu full-page তৈরি না হওয়া পর্যন্ত, আলাদা থ্রেড)।

import { HealthRecordsSection } from "./HealthRecordsSection.js";
import { MedicationReminders } from "./MedicationReminders.js";
import { CommonCareSection } from "../commonCare/CommonCareSection.js";
import { TodaySummary } from "../summary/TodaySummary.js";
import { Skeleton } from "../../shared/ui.js";
import { DocumentsSection } from "../documents/DocumentsSection.js";
import { useMemberHealth } from "./useMemberHealth.js";
import { listDocuments } from "../documents/documentsData.js";

const { useState, useEffect } = React;
import { histBind, histChange } from "../../shared/navHistory.js";
import { peekQuickIntent, setQuickIntent } from "../../shared/quickIntent.js";

const bnNum = digits; // ভাষা-অনুযায়ী অঙ্ক (English-এ ৪ দেখতে ৮-এর মতো লাগত)
const pad2 = (n) => String(n).padStart(2, "0");
function localTodayStr() { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

// পিলের সংখ্যা — শুধু পড়ে (শেয়ার্ড cache + listDocuments), কিছু লেখে না
function usePillCounts(familyId, memberId, tick) {
  const { records } = useMemberHealth(familyId, memberId);
  const [docs, setDocs] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!memberId) { setDocs(null); return undefined; }
    listDocuments(familyId, memberId).then((d) => { if (alive) setDocs(d); }).catch(() => { if (alive) setDocs(null); });
    return () => { alive = false; };
  }, [familyId, memberId, tick]);
  const lab = docs ? docs.length : null; // Reports-পিলে সব নথি (ল্যাব রিপোর্ট + প্রেসক্রিপশন + ইমেজিং…) — owner-approved ২০২৬-১১-১৭
  if (!records) return { meds: null, records: null, docs: lab };
  const today = localTodayStr();
  return {
    meds: records.filter((r) => r.resourceType === "medicationStatement" && !(r.endDate && today > r.endDate)).length,
    records: records.filter((r) => r.resourceType === "condition" || r.resourceType === "allergy").length,
    docs: lab,
  };
}

// mode "home" = শুধু "আজ" (হোম ট্যাব); mode "health" = স্বাস্থ্য প্রোফাইল (প্রোফাইল+স্বাস্থ্য তথ্য) · খাদ্যাভ্যাস ও টাইমলাইন · নথিপত্র (শেষ পিল)
const HEALTH_TABS = [
  { id: "profile", label: "tab.healthProfile" }, // প্রোফাইল + অসুস্থতা + ওষুধ + ভাঁজ-করা রেকর্ড (owner-approved ২০২৬-১১-১৭)
  { id: "reports", label: "tab.reports" }, // রিপোর্ট ওপরের পিলে (owner-request ২০২৬-১১-১৭)
  { id: "care", label: "tab.commonCare" }, // সাধারণ চিকিৎসা (টাইমলাইন মেনুতে সরানো — owner-request ২০২৬-১১-১৩)
  // ডাক্তার-পিল মেনুর "ডাক্তারের তথ্য" টাইলে সরানো হয়েছে (owner-request ২০২৬-১১-১৭)
];

export function HealthRecordsPageSection({ familyId, callerMemberId, isAdmin, selectedMemberId, topOffsetPx, chip, onExit, mode = "home" }) {
  const isHealth = mode === "health";
  const TABS = isHealth ? HEALTH_TABS : [];
  const hk = isHealth ? "health-" : "home-";
  // "+ দ্রুত যোগ" থেকে এলে সংশ্লিষ্ট ট্যাবে শুরু (ধাপ ৯): প্রেসার/সুগার/ওষুধ → স্বাস্থ্য তথ্য; রিপোর্ট → নথিপত্র; ওষুধ-বার্তা এখানেই শেষ, বাকিটা ফর্ম নিজে নেয়
  const [activeTab, setActiveTab] = useState(() => {
    if (!isHealth) return "today";
    return peekQuickIntent(["report"]) ? "reports" : "profile"; // "+ দ্রুত যোগ → রিপোর্ট" সরাসরি Reports পিলে; বাকিরা প্রোফাইলে (ফর্ম নিজে ইনটেন্ট নেয়)
  });
  const [medTick, setMedTick] = useState(0); // "যোগ করুন → ওষুধ" থেকে এলে ওষুধ-পাতা নতুন করে খুলে সংশ্লিষ্ট ফর্ম দেখায়
  const [addTick, setAddTick] = useState(0); // নতুন রেকর্ড যোগের পর ওষুধ/রিপোর্ট-তালিকা রিফ্রেশ
  const [recOpen, setRecOpen] = useState(() => !!peekQuickIntent(["bp", "sugar", "observation"])); // প্রেসার/সুগার/পরিমাপ-যোগ থেকে এলে রেকর্ড ভাঁজ খোলা
  const counts = usePillCounts(familyId, isHealth ? selectedMemberId : null, addTick);
  const topPx = (topOffsetPx == null ? 44 : topOffsetPx) + "px";
  histBind(hk + "main", activeTab, setActiveTab);
  histBind(hk + "rec", recOpen, setRecOpen);

  return React.createElement(
    "div", { className: "hs-page", style: { position: "fixed", top: topPx, left: "var(--hs-pl, 0px)", right: "var(--hs-pr, 0px)", bottom: "var(--hs-nav-b, 56px)", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', sans-serif" } },
    isHealth && React.createElement(
      "div", { className: "hs-noscroll", style: { display: "flex", justifyContent: "safe center", overflowX: "auto", gap: "6px", padding: "8px 10px", background: "#fff", borderBottom: "1px solid #D9E5DE", boxShadow: "0 2px 6px rgba(14,75,67,0.06)", flexShrink: 0, alignItems: "center" } },
      chip || null,
      TABS.map((tb) => React.createElement(
        "button", {
          key: tb.id,
          onClick: () => histChange(hk + "main", activeTab, tb.id, setActiveTab),
          style: {
            flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px", padding: "6px 12px", minHeight: "40px", borderRadius: "999px", fontSize: "13.5px", fontWeight: 600, cursor: "pointer", lineHeight: 1.2,
            border: activeTab === tb.id ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA",
            background: activeTab === tb.id ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "#fff",
            color: activeTab === tb.id ? "#fff" : "#2B3A36",
            boxShadow: activeTab === tb.id ? "0 3px 8px rgba(14,75,67,0.25)" : "none",
          },
        }, t(tb.label) + (tb.id === "reports" && counts.docs != null ? " (" + bnNum(counts.docs) + ")" : ""))
      )),
    !selectedMemberId
      ? React.createElement("div", { style: { padding: "12px" } }, Skeleton(3, 64))
      : React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "8px 12px 84px" } },
      !isHealth && React.createElement(TodaySummary, { familyId, callerMemberId, selectedMemberId }),
      // স্বাস্থ্য প্রোফাইল = হিরো-কার্ড → অসুস্থতা/অ্যালার্জি (সবসময় খোলা) → ওষুধ → ভাঁজ-করা "রেকর্ড" (পরিমাপ + ট্রেন্ড)।
      isHealth && activeTab === "profile" && React.createElement(HealthRecordsSection, {
        familyId, callerMemberId, selectedMemberId, section: "page",
        recOpen, onToggleRec: () => setRecOpen((v) => !v),
        onRecordAdded: () => setAddTick((n) => n + 1),
        onUpload: () => { setQuickIntent("report"); histChange(hk + "main", activeTab, "reports", setActiveTab); setAddTick((n) => n + 1); },
        onMedChoice: (k) => { setQuickIntent(k === "rx" ? "rx" : "medmanual"); setMedTick((n) => n + 1); },
        middleSlot: React.createElement(MedicationReminders, { key: "med-" + addTick + "-" + medTick, familyId, callerMemberId, selectedMemberId }),
      }),
      isHealth && activeTab === "reports" && React.createElement(DocumentsSection, { key: "doc-" + addTick, familyId, callerMemberId, selectedMemberId, hideAdd: true, emptyText: L("এখনো কোনো রিপোর্ট বা প্রেসক্রিপশন নেই — ＋ যোগ করুন", "No reports or prescriptions yet — tap ＋ to add") }),
      isHealth && activeTab === "care" && React.createElement(CommonCareSection, { familyId, callerMemberId, selectedMemberId })
    )
  );
}
