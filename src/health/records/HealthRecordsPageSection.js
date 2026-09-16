// হেলথ রেকর্ড (হোম) — Full-page wrapper (P11 mockup §১-এর "হোম" ট্যাব প্রস্তুতি,
// Full-Page System — amendment item ৪-এর একই pattern, DocumentsPageSection.js/
// AIChatSection.js verbatim অনুসরণ করে)।
//
// ধাপ ১ (এই ফাইল): শুধু বাটন-কে full-page-এ রূপান্তর — existing পাঁচটা component
// (HealthRecordsSection/MedicationReminders/VaccinationScheduler/
// FamilyHealthCalendar/HealthTimeline) অপরিবর্তিত রেখে একটা কন্টেইনারে composed।
// কোনো নতুন schema/logic পরিবর্তন নেই, শুধু presentation-layer regrouping।
//
// ধাপ ২ (পরবর্তী থ্রেড): এই ফাইলের ভেতরে sub-tab pill (প্রোফাইল/স্বাস্থ্য তথ্য/
// খাদ্য নির্দেশিকা/ঔষধ+রিমাইন্ডার/টাইমলাইন+ক্যালেন্ডার) ও accordion/drawer
// layout বসানো হবে (মকআপ §৩)। Care-Escalation Directory ও Backup/Restore
// পরিকল্পনা অনুযায়ী Menu full-page তৈরি হলে সেখানে সরানো হবে — আপাতত এই
// ফাইলে টাচ করা হয়নি (main Dashboard-এই থেকে গেছে, minimal-change নীতি)।

import { HealthRecordsSection } from "./HealthRecordsSection.js";
import { MedicationReminders } from "./MedicationReminders.js";
import { VaccinationScheduler } from "../calendar/VaccinationScheduler.js";
import { FamilyHealthCalendar } from "../calendar/FamilyHealthCalendar.js";
import { HealthTimeline } from "../timeline/HealthTimeline.js";

export function HealthRecordsPageSection({ familyId, callerMemberId, onExit }) {
  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "#F5F5F0", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement(
      "div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#0E4B43", color: "#fff", flexShrink: 0 } },
      React.createElement("span", { style: { fontWeight: 700, fontSize: "15px" } }, "🏠 হেলথ রেকর্ড"),
      React.createElement("button", {
        onClick: onExit,
        style: { background: "none", border: "1px solid #fff", color: "#fff", fontSize: "11px", padding: "3px 10px", borderRadius: "6px", cursor: "pointer" },
      }, "← ফিরে যান")
    ),
    React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "12px" } },
      React.createElement(HealthRecordsSection, { familyId, callerMemberId }),
      React.createElement(MedicationReminders, { familyId, callerMemberId }),
      React.createElement(VaccinationScheduler, { familyId, callerMemberId }),
      React.createElement(FamilyHealthCalendar, { familyId, callerMemberId }),
      React.createElement(HealthTimeline, { familyId, callerMemberId })
    )
  );
}
