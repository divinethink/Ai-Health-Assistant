// AI চ্যাট — Full-page wrapper (amendment item ৪, Full-Page System — P11
// precondition, 1_1_1_1_Health_Assistant_Amendment_Plan_DRAFT.md)। Symptom
// Check/Medical Science/Herbal-Homeopathy/Nutrition-Fitness — চারটা existing
// component অপরিবর্তিত রেখে শুধু একটা full-screen container-এ composed করা
// হলো (WellnessGuideSection.js/GeneralChatSection.js-এর প্রমাণিত fixed-overlay
// + header/back-button pattern reuse)। কোনো নতুন schema/logic লাগেনি —
// presentation-layer-only regrouping।

import { TriageForm } from "../triage/TriageForm.js";
import { MedicalScienceChat } from "../treatment-modes/MedicalScienceChat.js";
import { RemedySection } from "../treatment-modes/RemedySection.js";
import { NutritionGuidance } from "../nutrition-fitness/NutritionGuidance.js";

export function AIChatSection({ familyId, callerMemberId, onExit }) {
  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "#F5F5F0", fontFamily: "'Hind Siliguri', sans-serif" } },
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
      React.createElement(TriageForm, { familyId, callerMemberId }),
      React.createElement(MedicalScienceChat, { familyId }),
      React.createElement(RemedySection, { familyId }),
      React.createElement(NutritionGuidance, { familyId })
    )
  );
}
