// হেলথ রেকর্ড (হোম) — Full-page wrapper, P11 mockup §৩ অনুযায়ী ৫টা sub-tab
// pill দিয়ে reorganized (ধাপ ২)। প্রতিটা sub-tab-এর ভেতরের existing
// component অপরিবর্তিত (HealthRecordsSection-এ শুধু নতুন `section` prop
// যোগ হয়েছে profile/records ভাগ করতে) — কোনো নতুন schema/data-logic নেই।
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

const TABS = [
  { id: "profile", label: "প্রোফাইল" },
  { id: "records", label: "স্বাস্থ্য তথ্য" },
  { id: "diet", label: "খাদ্য নির্দেশিকা" },
  { id: "medication", label: "ঔষধ ও রিমাইন্ডার" },
  { id: "timeline", label: "টাইমলাইন ও ক্যালেন্ডার" },
];

export function HealthRecordsPageSection({ familyId, callerMemberId, onExit }) {
  const [activeTab, setActiveTab] = useState("profile");

  return React.createElement(
    "div", { style: { position: "fixed", top: "44px", left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F5F5F0", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement(
      "div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#0E4B43", color: "#fff", flexShrink: 0 } },
      React.createElement("span", { style: { fontWeight: 700, fontSize: "15px" } }, "🏠 হেলথ রেকর্ড"),
      React.createElement("button", {
        onClick: onExit,
        style: { background: "none", border: "1px solid #fff", color: "#fff", fontSize: "11px", padding: "3px 10px", borderRadius: "6px", cursor: "pointer" },
      }, "← ফিরে যান")
    ),
    React.createElement(
      "div", { style: { display: "flex", overflowX: "auto", gap: "6px", padding: "8px 10px", background: "#fff", borderBottom: "1px solid #ddd", flexShrink: 0 } },
      TABS.map((t) => React.createElement(
        "button", {
          key: t.id,
          onClick: () => setActiveTab(t.id),
          style: {
            flexShrink: 0, padding: "7px 12px", borderRadius: "16px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            border: activeTab === t.id ? "1px solid #0E4B43" : "1px solid #ccc",
            background: activeTab === t.id ? "#0E4B43" : "#fff",
            color: activeTab === t.id ? "#fff" : "#333",
          },
        }, t.label)
      )),
    React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "12px" } },
      activeTab === "profile" && React.createElement(HealthRecordsSection, { familyId, callerMemberId, section: "profile" }),
      activeTab === "records" && React.createElement(HealthRecordsSection, { familyId, callerMemberId, section: "records" }),
      activeTab === "diet" && React.createElement(DietGuidanceSection, { familyId, callerMemberId }),
      activeTab === "medication" && React.createElement(MedicationReminders, { familyId, callerMemberId }),
      activeTab === "timeline" && React.createElement(
        React.Fragment, null,
        React.createElement(VaccinationScheduler, { familyId, callerMemberId }),
        React.createElement(FamilyHealthCalendar, { familyId, callerMemberId }),
        React.createElement(HealthTimeline, { familyId, callerMemberId })
      )
    )
  );
}
