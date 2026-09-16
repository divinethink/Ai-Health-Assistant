// AI চ্যাট — Full-page wrapper (amendment item ৪, Full-Page System — P11
// precondition, 1_1_1_1_Health_Assistant_Amendment_Plan_DRAFT.md)।
//
// আপডেট (owner-request, ২০২৬-০৯-১৬): আগে ৪টা component (Symptom Check,
// Medical Science, Herbal/Homeopathy, Nutrition/Fitness) একসাথে স্ট্যাক করে
// দেখানো হতো (লম্বা scroll)। এখন roadmap §1_5-এর "sub-tab pill" নীতি অনুযায়ী
// (§১ টেবিল: "AI চ্যাট ট্যাব — sub-tab split") এই ৪টাকে ট্যাব হিসেবে ভাগ করা
// হলো — একবারে শুধু নির্বাচিত ট্যাবের component render/mount হয়। প্রতিটা
// component নিজে অপরিবর্তিত (কোনো prop/logic পরিবর্তন নেই) — শুধু
// presentation-layer regrouping, নতুন schema/logic লাগেনি।

import { TabPills } from "../../shared/ui.js";
import { TriageForm } from "../triage/TriageForm.js";
import { MedicalScienceChat } from "../treatment-modes/MedicalScienceChat.js";
import { RemedySection } from "../treatment-modes/RemedySection.js";
import { NutritionGuidance } from "../nutrition-fitness/NutritionGuidance.js";

const { useState } = React;

const TABS = [
  ["symptom-check", "🩺 Symptom Check"],
  ["medical-science", "⚕️ Medical Science"],
  ["herbal-homeopathy", "🌿 Herbal/Homeopathy"],
  ["nutrition-fitness", "🥗 Nutrition/Fitness"],
];

export function AIChatSection({ familyId, callerMemberId, onExit }) {
  const [tab, setTab] = useState(TABS[0][0]);

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
      "div", { style: { flex: 1, overflowY: "auto", padding: "12px" } },
      TabPills(TABS, tab, setTab),
      tab === "symptom-check" && React.createElement(TriageForm, { familyId, callerMemberId }),
      tab === "medical-science" && React.createElement(MedicalScienceChat, { familyId }),
      tab === "herbal-homeopathy" && React.createElement(RemedySection, { familyId }),
      tab === "nutrition-fitness" && React.createElement(NutritionGuidance, { familyId })
    )
  );
}
