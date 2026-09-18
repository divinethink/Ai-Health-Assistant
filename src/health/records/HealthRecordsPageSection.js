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
// MedicationReminders/VaccinationScheduler/FamilyHealthCalendar পরিবর্তন হয়নি
// (এগুলো family-wide/সব-সদস্যের-একত্রে view, single-member selector প্রযোজ্য না)।
//
// Care-Escalation Directory ও Backup/Restore এখনো main Dashboard-এই আছে
// (Menu full-page তৈরি না হওয়া পর্যন্ত, আলাদা থ্রেড)।

import { SelectField, ErrorBox } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { HealthRecordsSection } from "./HealthRecordsSection.js";
import { MedicationReminders } from "./MedicationReminders.js";
import { VaccinationScheduler } from "../calendar/VaccinationScheduler.js";
import { FamilyHealthCalendar } from "../calendar/FamilyHealthCalendar.js";
import { HealthTimeline } from "../timeline/HealthTimeline.js";
import { DietGuidanceSection } from "../nutrition-fitness/DietGuidanceSection.js";

const { useState, useEffect } = React;

const TABS = [
  { id: "profile", label: "প্রোফাইল" },
  { id: "records", label: "স্বাস্থ্য তথ্য" },
  { id: "diet", label: "খাদ্য নির্দেশিকা" },
  { id: "medication", label: "ঔষধ ও রিমাইন্ডার" },
  { id: "timeline", label: "টাইমলাইন ও ক্যালেন্ডার" },
];

export function HealthRecordsPageSection({ familyId, callerMemberId, onExit }) {
  const [activeTab, setActiveTab] = useState("profile");
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        setSelectedMemberId((prev) => prev || callerMemberId || (list[0] && list[0].id) || null);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId, callerMemberId]);

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
      "div", { style: { padding: "8px 14px 0", background: "#fff", flexShrink: 0 } },
      loadErr
        ? ErrorBox(loadErr)
        : !members
        ? React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...")
        : SelectField("সদস্য", selectedMemberId, setSelectedMemberId, members.map((m) => [m.id, m.name]))
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
    selectedMemberId && React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "12px" } },
      activeTab === "profile" && React.createElement(HealthRecordsSection, { familyId, callerMemberId, selectedMemberId, section: "profile" }),
      activeTab === "records" && React.createElement(HealthRecordsSection, { familyId, callerMemberId, selectedMemberId, section: "records" }),
      activeTab === "diet" && React.createElement(DietGuidanceSection, { familyId, callerMemberId, selectedMemberId }),
      activeTab === "medication" && React.createElement(MedicationReminders, { familyId, callerMemberId }),
      activeTab === "timeline" && React.createElement(
        React.Fragment, null,
        React.createElement(VaccinationScheduler, { familyId, callerMemberId }),
        React.createElement(FamilyHealthCalendar, { familyId, callerMemberId }),
        React.createElement(HealthTimeline, { familyId, callerMemberId, selectedMemberId })
      )
    )
  );
}
