// AI চ্যাট — Full-page wrapper (amendment item ৪, Full-Page System — P11
// precondition, 1_1_1_1_Health_Assistant_Amendment_Plan_DRAFT.md)।
//
// আপডেট (owner-request, ২০২৬-০৯-১৬): আগে ৪টা component (Symptom Check,
// Medical Science, Herbal/Homeopathy, Nutrition/Fitness) একসাথে স্ট্যাক করে
// দেখানো হতো (লম্বা scroll)। এখন roadmap §1_5-এর "sub-tab pill" নীতি অনুযায়ী
// (§১ টেবিল: "AI চ্যাট ট্যাব — sub-tab split") এই ৪টাকে ট্যাব হিসেবে ভাগ করা
// হলো — একবারে শুধু নির্বাচিত ট্যাবের component render/mount হয়।
//
// আপডেট (owner-request, member-selector unification): আগে ৪টা sub-tab-ই
// আলাদা আলাদা "সদস্য নির্বাচন করুন" dropdown রাখত। এখন `selectedMemberId`
// এই পেজ-wrapper-level-এ lift করা হয়েছে — একবার বাছলে ৪টা sub-tab-এই
// persist থাকে। প্রতিটা sub-tab component-এর নিজস্ব safety/AI-flow logic
// (TriageForm-এর reset-logic-সহ) অপরিবর্তিত — শুধু dropdown সরিয়ে
// `selectedMemberId` প্রপ নেওয়া হচ্ছে, কোনো নতুন schema/logic নেই।

import { SelectField, ErrorBox, TabPills } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { TriageForm } from "../triage/TriageForm.js";
import { MedicalScienceChat } from "../treatment-modes/MedicalScienceChat.js";
import { RemedySection } from "../treatment-modes/RemedySection.js";
import { NutritionGuidance } from "../nutrition-fitness/NutritionGuidance.js";

const { useState, useEffect } = React;

const TABS = [
  ["symptom-check", "🩺 Symptom Check"],
  ["medical-science", "⚕️ Medical Science"],
  ["herbal-homeopathy", "🌿 Herbal/Homeopathy"],
  ["nutrition-fitness", "🥗 Nutrition/Fitness"],
];

export function AIChatSection({ familyId, callerMemberId, onExit }) {
  const [tab, setTab] = useState(TABS[0][0]);
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
      React.createElement("span", { style: { fontWeight: 700, fontSize: "15px" } }, "🩺 AI চ্যাট"),
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
      "div", { style: { flex: 1, overflowY: "auto", padding: "12px" } },
      TabPills(TABS, tab, setTab),
      selectedMemberId && tab === "symptom-check" && React.createElement(TriageForm, { familyId, callerMemberId, selectedMemberId }),
      selectedMemberId && tab === "medical-science" && React.createElement(MedicalScienceChat, { familyId, selectedMemberId }),
      selectedMemberId && tab === "herbal-homeopathy" && React.createElement(RemedySection, { familyId, selectedMemberId }),
      selectedMemberId && tab === "nutrition-fitness" && React.createElement(NutritionGuidance, { familyId, selectedMemberId })
    )
  );
}
