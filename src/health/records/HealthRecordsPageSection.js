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
import { FamilyHealthCalendar } from "../calendar/FamilyHealthCalendar.js";
import { HealthTimeline } from "../timeline/HealthTimeline.js";
import { DietGuidanceSection } from "../nutrition-fitness/DietGuidanceSection.js";
import { TodaySummary } from "../summary/TodaySummary.js";
import { Skeleton } from "../../shared/ui.js";
import { DocumentsSection } from "../documents/DocumentsSection.js";
import { DoctorExportSection } from "../doctor-export/DoctorExportSection.js";
import { DoctorDetailsSection } from "../doctor-details/DoctorDetailsSection.js";

const { useState } = React;
import { histBind, histChange } from "../../shared/navHistory.js";
import { peekQuickIntent, takeQuickIntent } from "../../shared/quickIntent.js";

// স্বাস্থ্য তথ্য-ট্যাব (ধাপ ৪): তিন সাব-পিলের বদলে একটা "আমার স্বাস্থ্য" তালিকা + ফিল্টার-চিপ।
// id আগের মতোই (records/meds/docs) + "all"; ভেতরের কম্পোনেন্ট অপরিবর্তিত, ডেটা-লেয়ার অক্ষত।
const RECORD_SUBS = [
  { id: "all", label: "সব", hint: "অসুখ, ওষুধ ও রিপোর্ট — সব এক জায়গায়" },
  { id: "records", label: "অসুখ", hint: "অসুখ, অ্যালার্জি ও পরিমাপ (প্রেসার, সুগার ইত্যাদি)" },
  { id: "meds", label: "ওষুধ", hint: "ওষুধ, খাওয়ার সময় ও রিমাইন্ডার" },
  { id: "docs", label: "রিপোর্ট", hint: "ল্যাব রিপোর্ট ও প্রেসক্রিপশন" }, // জমা নথি/রিপোর্ট
];

// টাইমলাইন-ট্যাবের ভেতরের ৩টা ছোট পিল (owner-approved, ২০২৬-০৯-০৮) — একবারে একটাই দেখা যায়
const TIMELINE_SUBS = [
  { id: "diet", label: "🍽️ খাদ্য" },
  { id: "calendar", label: "📅 ক্যালেন্ডার" },
  { id: "vaccine", label: "💉 টিকা" },
  { id: "timeline", label: "🕘 টাইমলাইন" },
];

// mode "home" = শুধু "আজ" (হোম ট্যাব); mode "health" = স্বাস্থ্য প্রোফাইল (প্রোফাইল+স্বাস্থ্য তথ্য) · খাদ্যাভ্যাস ও টাইমলাইন · নথিপত্র (শেষ পিল)
const HEALTH_TABS = [
  { id: "profile", label: "tab.healthProfile" }, // প্রোফাইল + স্বাস্থ্য তথ্য একসাথে (owner-approved ২০২৬-১১-১১)
  { id: "timeline", label: "tab.timeline" },
  { id: "docs", label: "tab.export" }, // "🩺 ডাক্তারের জন্য" — ডাক্তারকে দেখানোর সারাংশ/এক্সপোর্ট
];

function sectionHead(icon, text) {
  return React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: "#0E4B43", margin: "18px 2px 6px", paddingTop: "10px", borderTop: "1px solid #D9E5DE" } }, icon + " " + text);
}

export function HealthRecordsPageSection({ familyId, callerMemberId, isAdmin, selectedMemberId, topOffsetPx, chip, onExit, mode = "home" }) {
  const isHealth = mode === "health";
  const TABS = isHealth ? HEALTH_TABS : [];
  const hk = isHealth ? "health-" : "home-";
  // "+ দ্রুত যোগ" থেকে এলে সংশ্লিষ্ট ট্যাবে শুরু (ধাপ ৯): প্রেসার/সুগার/ওষুধ → স্বাস্থ্য তথ্য; রিপোর্ট → নথিপত্র; ওষুধ-বার্তা এখানেই শেষ, বাকিটা ফর্ম নিজে নেয়
  const [activeTab, setActiveTab] = useState(() => {
    if (!isHealth) return "today";
    return "profile"; // দ্রুত-যোগ (প্রেসার/সুগার/ওষুধ/রিপোর্ট) এখন একই ট্যাবের সাব-পিলে (recordSub) নামে
  });
  const [timelineSub, setTimelineSub] = useState("diet");
  const [recordSub, setRecordSub] = useState(() => (takeQuickIntent(["medicine"]) ? "meds" : peekQuickIntent(["report"]) ? "docs" : "all"));
  const topPx = (topOffsetPx == null ? 44 : topOffsetPx) + "px";
  histBind(hk + "main", activeTab, setActiveTab);
  histBind(hk + "rec", recordSub, setRecordSub);
  histBind(hk + "tl", timelineSub, setTimelineSub);

  return React.createElement(
    "div", { className: "hs-page", style: { position: "fixed", top: topPx, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif" } },
    isHealth && React.createElement(
      "div", { style: { display: "flex", overflowX: "auto", gap: "6px", padding: "6px 12px", background: "#fff", borderBottom: "1px solid #D9E5DE", boxShadow: "0 2px 6px rgba(14,75,67,0.06)", flexShrink: 0, alignItems: "center" } },
      chip || null,
      TABS.map((tb) => React.createElement(
        "button", {
          key: tb.id,
          onClick: () => histChange(hk + "main", activeTab, tb.id, setActiveTab),
          style: {
            flexShrink: 0, padding: "6px 14px", minHeight: "32px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            border: activeTab === tb.id ? "1px solid #0E4B43" : "1px solid #C3D2CA",
            background: activeTab === tb.id ? "linear-gradient(135deg, #0E4B43, #17705F)" : "#fff",
            color: activeTab === tb.id ? "#fff" : "#2B3A36",
            boxShadow: activeTab === tb.id ? "0 3px 8px rgba(14,75,67,0.25)" : "none",
          },
        }, t(tb.label))
      )),
    !selectedMemberId
      ? React.createElement("div", { style: { padding: "12px" } }, Skeleton(3, 64))
      : React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "8px 12px 12px" } },
      !isHealth && React.createElement(TodaySummary, { familyId, callerMemberId, selectedMemberId }),
      // স্বাস্থ্য প্রোফাইল = হিরো-কার্ড (নাম/বয়স/উচ্চতা/ওজন/BMI/অ্যালার্জি) + ফিল্টার-পিল (সব | অসুখ | ওষুধ | রিপোর্ট) + সংশ্লিষ্ট তালিকা।
      // "সব"/"অসুখ" = section "all" (কার্ড + ফর্ম + তালিকা + ট্রেন্ড একই instance); "ওষুধ"/"রিপোর্ট" = section "profile" (শুধু কার্ড)।
      isHealth && activeTab === "profile" && React.createElement(React.Fragment, null,
        React.createElement(HealthRecordsSection, {
          familyId, callerMemberId, selectedMemberId, section: recordSub === "all" || recordSub === "records" ? "all" : "profile",
          belowSummary: React.createElement("div", { key: "subs" },
            React.createElement("div", { role: "group", "aria-label": "ফিল্টার", style: { display: "flex", gap: "6px", marginBottom: "6px", overflowX: "auto" } },
              RECORD_SUBS.map((sb) => React.createElement("button", {
                key: sb.id, onClick: () => histChange(hk + "rec", recordSub, sb.id, setRecordSub), "aria-pressed": recordSub === sb.id,
                style: {
                  flex: "1 0 auto", minHeight: "44px", padding: "6px 16px", borderRadius: "999px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  border: recordSub === sb.id ? "1px solid #0E4B43" : "1px solid #C3D2CA",
                  background: recordSub === sb.id ? "linear-gradient(135deg, #0E4B43, #17705F)" : "#fff", color: recordSub === sb.id ? "#fff" : "#2B3A36",
                },
              }, sb.label))),
            React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", margin: "0 2px 8px", lineHeight: 1.4 } }, (RECORD_SUBS.find((x) => x.id === recordSub) || RECORD_SUBS[0]).hint)),
        }),
        // "সব": অসুখ-পরিমাপের নিচে ওষুধ ও রিপোর্ট (অসুখ-তালিকা উপরের "all" instance-এ)
        recordSub === "all" && React.createElement(React.Fragment, null,
          sectionHead("💊", "ওষুধ"),
          React.createElement(MedicationReminders, { familyId, callerMemberId, selectedMemberId }),
          sectionHead("📁", "রিপোর্ট"),
          React.createElement(DocumentsSection, { familyId, callerMemberId, selectedMemberId })),
        recordSub === "meds" && React.createElement(MedicationReminders, { familyId, callerMemberId, selectedMemberId }),
        recordSub === "docs" && React.createElement(DocumentsSection, { familyId, callerMemberId, selectedMemberId })),
      isHealth && activeTab === "docs" && React.createElement(React.Fragment, null,
        React.createElement(DoctorExportSection, { familyId, callerMemberId, selectedMemberId, onGoUpload: () => { histChange(hk + "main", activeTab, "profile", setActiveTab); setRecordSub("docs"); } }),
        // ডাক্তারের তথ্য ও ভিজিটিং কার্ড — মেনু থেকে এখানে সরানো (owner-request ২০২৬-১১-১১); inline mode
        React.createElement(DoctorDetailsSection, { familyId, callerMemberId, isAdmin })),
      isHealth && activeTab === "timeline" && React.createElement(
        React.Fragment, null,
        React.createElement(
          "div", { style: { display: "flex", gap: "6px", marginBottom: "10px", overflowX: "auto" } },
          TIMELINE_SUBS.map((sb) => React.createElement("button", {
            key: sb.id, onClick: () => histChange(hk + "tl", timelineSub, sb.id, setTimelineSub), "aria-pressed": timelineSub === sb.id,
            style: {
              flex: "1 0 auto", minHeight: "40px", padding: "6px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
              border: timelineSub === sb.id ? "1px solid #0E4B43" : "1px solid #C3D2CA",
              background: timelineSub === sb.id ? "#0E4B43" : "#fff", color: timelineSub === sb.id ? "#fff" : "#2B3A36",
            },
          }, sb.label))
        ),
        timelineSub === "diet" && React.createElement(DietGuidanceSection, { familyId, callerMemberId, selectedMemberId }),
        timelineSub === "calendar" && React.createElement(FamilyHealthCalendar, { familyId, callerMemberId }),
        timelineSub === "vaccine" && React.createElement(VaccinationScheduler, { familyId, callerMemberId, selectedMemberId, inline: true }),
        timelineSub === "timeline" && React.createElement(HealthTimeline, { familyId, callerMemberId, selectedMemberId })
      )
    )
  );
}
