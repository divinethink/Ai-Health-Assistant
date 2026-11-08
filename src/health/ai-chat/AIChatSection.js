import { t } from "../../shared/i18n.js";
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

// আপডেট (owner-request, item ১, ২০২৬-০৯-১৬, app-wide member-switcher):
// `selectedMemberId`/`topOffsetPx` এখন Dashboard (app.js)-এর একক app-wide
// switcher থেকে prop হিসেবে আসে — এই wrapper নিজে আর member fetch/dropdown
// রাখে না, hardcoded "44px"-ও সরানো হয়েছে।

import { TabPills } from "../../shared/ui.js";
import { TriageForm } from "../triage/TriageForm.js";
import { MedicalScienceChat } from "../treatment-modes/MedicalScienceChat.js";
import { RemedySection } from "../treatment-modes/RemedySection.js";
import { NutritionGuidance } from "../nutrition-fitness/NutritionGuidance.js";

const { useState } = React;

const TABS = [
  ["symptom-check", "tab.symptom"],
  ["medical-science", "tab.medsci"],
  ["herbal-homeopathy", "tab.herbal"],
  ["nutrition-fitness", "tab.nutrition"],
];

export function AIChatSection({ familyId, callerMemberId, selectedMemberId, topOffsetPx, onExit }) {
  const [tab, setTab] = useState(TABS[0][0]);
  const topPx = (topOffsetPx || 44) + "px";

  return React.createElement(
    "div", { className: "hs-page", style: { position: "fixed", top: topPx, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "12px" } },
      TabPills(TABS.map(([i, k]) => [i, t(k)]), tab, setTab),
      !selectedMemberId
        ? React.createElement("p", { style: { color: "#888", fontSize: "14px" } }, "সদস্য-তালিকা লোড হচ্ছে...")
        : React.createElement(
          React.Fragment, null,
          tab === "symptom-check" && React.createElement(TriageForm, { familyId, callerMemberId, selectedMemberId }),
          tab === "medical-science" && React.createElement(MedicalScienceChat, { familyId, selectedMemberId }),
          tab === "herbal-homeopathy" && React.createElement(RemedySection, { familyId, selectedMemberId }),
          tab === "nutrition-fitness" && React.createElement(NutritionGuidance, { familyId, selectedMemberId })
        )
    )
  );
}
