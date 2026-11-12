import { Icon } from "../../shared/icons.js";
import { t } from "../../shared/i18n.js";
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
import { VaccinationScheduler } from "../calendar/VaccinationScheduler.js";
import { HealthTimeline } from "../timeline/HealthTimeline.js";
import { DietGuidanceSection } from "../nutrition-fitness/DietGuidanceSection.js";
import { TodaySummary } from "../summary/TodaySummary.js";
import { Skeleton } from "../../shared/ui.js";
import { DocumentsSection } from "../documents/DocumentsSection.js";
import { DoctorExportSection } from "../doctor-export/DoctorExportSection.js";
import { DoctorDetailsSection } from "../doctor-details/DoctorDetailsSection.js";
import { useMemberHealth } from "./useMemberHealth.js";
import { PrescriptionFold } from "./PrescriptionFold.js";
import { listDocuments } from "../documents/documentsData.js";

const { useState, useEffect } = React;
import { histBind, histChange } from "../../shared/navHistory.js";
import { peekQuickIntent, setQuickIntent } from "../../shared/quickIntent.js";

// স্বাস্থ্য তথ্য-ট্যাব (ধাপ ৪): তিন সাব-পিলের বদলে একটা "আমার স্বাস্থ্য" তালিকা + ফিল্টার-চিপ।
// id আগের মতোই (records/meds/docs) + "all"; ভেতরের কম্পোনেন্ট অপরিবর্তিত, ডেটা-লেয়ার অক্ষত।
const RECORD_SUBS = [
  { id: "meds", label: "ওষুধ/প্রেসক্রিপশন", hint: "ওষুধ, খাওয়ার সময় ও রিমাইন্ডার" },
  { id: "records", label: "অসুখ", hint: "অসুখ, অ্যালার্জি ও পরিমাপ (প্রেসার, সুগার ইত্যাদি)" },
  { id: "docs", label: "ল্যাব রিপোর্ট", hint: "ল্যাব রিপোর্ট, ইমেজিং, ডিসচার্জ ও অন্যান্য নথি" }, // জমা নথি (ধাপ ৩-এ প্রেসক্রিপশন ওষুধ-পিলে যাবে)
];
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bnNum = (n) => String(n).replace(/\d/g, (d) => BN_DIGITS[d]);
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
  const lab = docs ? docs.filter((d) => d.docType !== "prescription").length : null; // ল্যাব রিপোর্ট-পিলে প্রেসক্রিপশন নয় (ওষুধ-পিলে ভাঁজ)
  const rx = docs ? docs.length - lab : null;
  if (!records) return { meds: null, records: null, docs: lab, rx };
  const today = localTodayStr();
  return {
    meds: records.filter((r) => r.resourceType === "medicationStatement" && !(r.endDate && today > r.endDate)).length,
    records: records.filter((r) => r.resourceType === "condition" || r.resourceType === "allergy").length,
    docs: lab,
    rx,
  };
}

// mode "home" = শুধু "আজ" (হোম ট্যাব); mode "health" = স্বাস্থ্য প্রোফাইল (প্রোফাইল+স্বাস্থ্য তথ্য) · খাদ্যাভ্যাস ও টাইমলাইন · নথিপত্র (শেষ পিল)
const HEALTH_TABS = [
  { id: "profile", label: "tab.healthProfile" }, // প্রোফাইল + স্বাস্থ্য তথ্য একসাথে (owner-approved ২০২৬-১১-১১)
  { id: "diet", label: "tab.food" }, // খাদ্য: স্বাস্থ্য প্রোফাইলের ঠিক পরে (owner-request ২০২৬-১১-১২)
  { id: "timeline", label: "tab.timeline" },
  { id: "docs", label: "tab.export" }, // "🩺 ডাক্তারের জন্য" — ডাক্তারকে দেখানোর সারাংশ/এক্সপোর্ট
];

export function HealthRecordsPageSection({ familyId, callerMemberId, isAdmin, selectedMemberId, topOffsetPx, chip, onExit, mode = "home" }) {
  const isHealth = mode === "health";
  const TABS = isHealth ? HEALTH_TABS : [];
  const hk = isHealth ? "health-" : "home-";
  // "+ দ্রুত যোগ" থেকে এলে সংশ্লিষ্ট ট্যাবে শুরু (ধাপ ৯): প্রেসার/সুগার/ওষুধ → স্বাস্থ্য তথ্য; রিপোর্ট → নথিপত্র; ওষুধ-বার্তা এখানেই শেষ, বাকিটা ফর্ম নিজে নেয়
  const [activeTab, setActiveTab] = useState(() => {
    if (!isHealth) return "today";
    return "profile"; // দ্রুত-যোগ (প্রেসার/সুগার/ওষুধ/রিপোর্ট) এখন একই ট্যাবের সাব-পিলে (recordSub) নামে
  });
  const [docSub, setDocSub] = useState("summary"); // ডাক্তার-ট্যাব: সারাংশ | আমার ডাক্তার
  const [medTick, setMedTick] = useState(0); // "যোগ করুন → ওষুধ" থেকে এলে ওষুধ-পাতা নতুন করে খুলে সংশ্লিষ্ট ফর্ম দেখায়
  const [addTick, setAddTick] = useState(0); // নতুন রেকর্ড যোগের পর ওষুধ/রিপোর্ট-তালিকা রিফ্রেশ
  const [recordSub, setRecordSub] = useState(() => (peekQuickIntent(["medicine"]) ? "meds" : peekQuickIntent(["bp", "sugar"]) ? "records" : peekQuickIntent(["report"]) ? "docs" : "meds")); // শুধু peek: ইনটেন্ট নেয় গন্তব্য-ফর্ম নিজে (ওষুধ→MedicationReminders, প্রেসার/সুগার→HealthRecordsSection, রিপোর্ট→DocumentsSection)
  const counts = usePillCounts(familyId, isHealth ? selectedMemberId : null, addTick);
  const topPx = (topOffsetPx == null ? 44 : topOffsetPx) + "px";
  histBind(hk + "main", activeTab, setActiveTab);
  histBind(hk + "rec", recordSub, setRecordSub);
  histBind(hk + "doc", docSub, setDocSub);

  return React.createElement(
    "div", { className: "hs-page", style: { position: "fixed", top: topPx, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif" } },
    isHealth && React.createElement(
      "div", { className: "hs-noscroll", style: { display: "flex", overflowX: "auto", gap: "6px", padding: "6px 12px", background: "#fff", borderBottom: "1px solid #D9E5DE", boxShadow: "0 2px 6px rgba(14,75,67,0.06)", flexShrink: 0, alignItems: "center" } },
      chip || null,
      TABS.map((tb) => React.createElement(
        "button", {
          key: tb.id,
          onClick: () => histChange(hk + "main", activeTab, tb.id, setActiveTab),
          style: {
            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 14px", minHeight: "32px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            border: activeTab === tb.id ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA",
            background: activeTab === tb.id ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "#fff",
            color: activeTab === tb.id ? "#fff" : "#2B3A36",
            boxShadow: activeTab === tb.id ? "0 3px 8px rgba(14,75,67,0.25)" : "none",
          },
        }, tb.id === "docs" ? [Icon("health", { key: "i", size: 15 }), t(tb.label).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "")] : t(tb.label))
      )),
    !selectedMemberId
      ? React.createElement("div", { style: { padding: "12px" } }, Skeleton(3, 64))
      : React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "8px 12px 84px" } },
      !isHealth && React.createElement(TodaySummary, { familyId, callerMemberId, selectedMemberId }),
      // স্বাস্থ্য প্রোফাইল = হিরো-কার্ড (নাম/বয়স/উচ্চতা/ওজন/BMI/অ্যালার্জি) + ফিল্টার-পিল (সব | অসুখ | ওষুধ | রিপোর্ট) + সংশ্লিষ্ট তালিকা।
      // "সব"/"অসুখ" = section "all" (কার্ড + ফর্ম + তালিকা + ট্রেন্ড একই instance); "ওষুধ"/"রিপোর্ট" = section "profile" (শুধু কার্ড)।
      isHealth && activeTab === "profile" && React.createElement(React.Fragment, null,
        React.createElement(HealthRecordsSection, {
          familyId, callerMemberId, selectedMemberId, section: recordSub === "records" ? "all" : "profile",
          onRecordAdded: () => setAddTick((n) => n + 1),
          onUpload: () => { setQuickIntent("report"); histChange(hk + "rec", recordSub, "docs", setRecordSub); setAddTick((n) => n + 1); },
          onMedChoice: (k) => { setQuickIntent(k === "rx" ? "rx" : "medmanual"); histChange(hk + "rec", recordSub, "meds", setRecordSub); setMedTick((n) => n + 1); },
          belowSummary: React.createElement("div", { key: "subs", style: { marginTop: "16px", marginBottom: "0" } },
            React.createElement("div", { role: "group", "aria-label": "ফিল্টার", className: "hs-noscroll", style: { display: "flex", gap: "8px", marginBottom: "6px", overflowX: "auto", padding: "2px 2px 6px" } },
              RECORD_SUBS.map((sb) => React.createElement("button", {
                key: sb.id, onClick: () => histChange(hk + "rec", recordSub, sb.id, setRecordSub), "aria-pressed": recordSub === sb.id,
                style: {
                  flex: "1 0 auto", minHeight: "44px", padding: "6px 16px", borderRadius: "999px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  border: recordSub === sb.id ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA",
                  background: recordSub === sb.id ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "#fff", color: recordSub === sb.id ? "#fff" : "#2B3A36",
                },
              }, sb.label + (counts[sb.id] == null ? "" : " (" + bnNum(counts[sb.id]) + ")")))),
            null),
        }),
        recordSub === "meds" && React.createElement(MedicationReminders, { key: "med-" + addTick + "-" + medTick, familyId, callerMemberId, selectedMemberId }),
        recordSub === "meds" && React.createElement(PrescriptionFold, { key: "rxf-" + selectedMemberId + "-" + addTick, familyId, callerMemberId, selectedMemberId, count: counts.rx, refreshTick: addTick, onDeleted: () => setAddTick((n) => n + 1) }),
        recordSub === "docs" && React.createElement(DocumentsSection, { key: "doc-" + addTick, familyId, callerMemberId, selectedMemberId, excludeType: "prescription", hideAdd: true, emptyText: "এখনো ল্যাব রিপোর্ট নেই — ＋ যোগ করুন" })),
      isHealth && activeTab === "docs" && React.createElement(React.Fragment, null,
        React.createElement("div", { role: "group", "aria-label": "ডাক্তার", style: { display: "flex", gap: "4px", padding: "4px", margin: "4px 0 16px", borderRadius: "999px", background: "#E3ECE7" } },
          [["summary", "📋 সারাংশ"], ["doctors", "🩺 আমার ডাক্তার"]].map(([id, label]) => React.createElement("button", {
            key: id, onClick: () => histChange(hk + "doc", docSub, id, setDocSub), "aria-pressed": docSub === id,
            style: {
              flex: 1, minHeight: "44px", padding: "6px 10px", borderRadius: "999px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none",
              background: docSub === id ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "transparent", color: docSub === id ? "#fff" : "#2B3A36",
              boxShadow: docSub === id ? "0 3px 8px rgba(14,75,67,0.25)" : "none",
            },
          }, label))),
        docSub === "summary" && React.createElement(DoctorExportSection, { familyId, callerMemberId, selectedMemberId, onGoUpload: () => { histChange(hk + "main", activeTab, "profile", setActiveTab); setRecordSub("docs"); } }),
        // ডাক্তারের তথ্য ও ভিজিটিং কার্ড — মেনু থেকে এখানে সরানো (owner-request ২০২৬-১১-১১); inline mode
        docSub === "doctors" && React.createElement(DoctorDetailsSection, { familyId, callerMemberId, isAdmin })),
      isHealth && activeTab === "diet" && React.createElement(DietGuidanceSection, { familyId, callerMemberId, selectedMemberId }),
      isHealth && activeTab === "timeline" && React.createElement(HealthTimeline, { familyId, callerMemberId, selectedMemberId,
        vaccineSlot: React.createElement(VaccinationScheduler, { familyId, callerMemberId, selectedMemberId, inline: true }) })
    )
  );
}
