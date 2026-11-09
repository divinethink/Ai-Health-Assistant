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

const { useState } = React;

// স্বাস্থ্য তথ্য-ট্যাবের ভেতরের ২টা সাব-পিল (ধাপ ৩: ঔষধ আলাদা হোম-পিল থেকে এখানে এসেছে)
const RECORD_SUBS = [
  { id: "records", label: "📋 স্বাস্থ্য রেকর্ড" },
  { id: "meds", label: "💊 প্রেসক্রিপশন/রিপোর্ট" },
];

// টাইমলাইন-ট্যাবের ভেতরের ৩টা ছোট পিল (owner-approved, ২০২৬-০৯-০৮) — একবারে একটাই দেখা যায়
const TIMELINE_SUBS = [
  { id: "diet", label: "🍽️ খাদ্য" },
  { id: "calendar", label: "📅 ক্যালেন্ডার" },
  { id: "vaccine", label: "💉 টিকা" },
  { id: "timeline", label: "🕘 টাইমলাইন" },
];

const TABS = [
  { id: "profile", label: "tab.profile" },
  { id: "records", label: "tab.records" },
  { id: "timeline", label: "tab.timeline" },
];

export function HealthRecordsPageSection({ familyId, callerMemberId, selectedMemberId, topOffsetPx, chip, onExit }) {
  const [activeTab, setActiveTab] = useState("profile");
  const [timelineSub, setTimelineSub] = useState("diet");
  const [recordSub, setRecordSub] = useState("records");
  const topPx = (topOffsetPx == null ? 44 : topOffsetPx) + "px";

  return React.createElement(
    "div", { className: "hs-page", style: { position: "fixed", top: topPx, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement(
      "div", { style: { display: "flex", overflowX: "auto", gap: "6px", padding: "6px 12px", background: "#fff", borderBottom: "1px solid #D9E5DE", boxShadow: "0 2px 6px rgba(14,75,67,0.06)", flexShrink: 0, alignItems: "center" } },
      chip || null,
      TABS.map((tb) => React.createElement(
        "button", {
          key: tb.id,
          onClick: () => setActiveTab(tb.id),
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
      ? React.createElement("p", { style: { color: "#5F716C", fontSize: "14px", padding: "12px" } }, "সদস্য-তালিকা লোড হচ্ছে...")
      : React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "8px 12px 12px" } },
      activeTab === "profile" && React.createElement(HealthRecordsSection, { familyId, callerMemberId, selectedMemberId, section: "profile" }),
      activeTab === "records" && React.createElement(React.Fragment, null,
        React.createElement("div", { style: { display: "flex", gap: "6px", marginBottom: "10px" } },
          RECORD_SUBS.map((sb) => React.createElement("button", {
            key: sb.id, onClick: () => setRecordSub(sb.id), "aria-pressed": recordSub === sb.id,
            style: {
              flex: 1, minHeight: "44px", padding: "6px 8px", borderRadius: "14px", fontSize: "14px", fontWeight: 600, cursor: "pointer",
              border: recordSub === sb.id ? "1px solid #0E4B43" : "1px solid #C3D2CA",
              background: recordSub === sb.id ? "linear-gradient(135deg, #0E4B43, #17705F)" : "#fff", color: recordSub === sb.id ? "#fff" : "#2B3A36",
            },
          }, sb.label))),
        recordSub === "records" && React.createElement(HealthRecordsSection, { familyId, callerMemberId, selectedMemberId, section: "records" }),
        recordSub === "meds" && React.createElement(MedicationReminders, { familyId, callerMemberId, selectedMemberId })),
      activeTab === "timeline" && React.createElement(
        React.Fragment, null,
        React.createElement(
          "div", { style: { display: "flex", gap: "6px", marginBottom: "10px", overflowX: "auto" } },
          TIMELINE_SUBS.map((sb) => React.createElement("button", {
            key: sb.id, onClick: () => setTimelineSub(sb.id), "aria-pressed": timelineSub === sb.id,
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
