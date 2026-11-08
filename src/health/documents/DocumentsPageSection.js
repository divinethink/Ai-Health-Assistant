import { t } from "../../shared/i18n.js";
// Documents — Full-page wrapper (amendment item ৪, Full-Page System — P11
// precondition)।
//
// আপডেট (owner-request, ২০২৬-০৯-১৬): আগে Upload/Reports + Doctor-Facing
// Export দুটো component একসাথে স্ট্যাক করে দেখানো হতো। এখন roadmap §1_5 §৫-এর
// মকআপ অনুযায়ী ("[আপলোড] [ডাক্তার-ডকুমেন্ট (Export)] [ডাক্তার বিবরণ]")
// sub-tab pill দিয়ে ভাগ করা হলো — "ডাক্তার বিবরণ" আপাতত আলাদা নিজস্ব
// full-page হিসেবেই থাকছে (owner-নির্দেশ অনুযায়ী, DoctorDetailsSection.js)।
//
// আপডেট (owner-request, member-selector unification): আগে দুই sub-tab-এই
// (আপলোড, ডাক্তার-এক্সপোর্ট) আলাদা "সদস্য বাছাই করুন" dropdown ছিল। এখন
// `selectedMemberId` এই পেজ-wrapper-level-এ lift করা হয়েছে — একবার বাছলে
// দুই sub-tab-এই persist থাকে। DocumentsSection/DoctorExportSection-এর
// ভেতরের নিজস্ব member-fetch/dropdown সরিয়ে প্রপ নেওয়া হচ্ছে — কোনো
// schema/permission পরিবর্তন নেই।

// আপডেট (owner-request, item ১, ২০২৬-০৯-১৬, app-wide member-switcher):
// `selectedMemberId`/`topOffsetPx` এখন Dashboard (app.js)-এর একক app-wide
// switcher থেকে prop হিসেবে আসে — এই wrapper নিজে আর member fetch/dropdown
// রাখে না, hardcoded "44px"-ও সরানো হয়েছে।

import { TabPills } from "../../shared/ui.js";
import { DocumentsSection } from "./DocumentsSection.js";
import { DoctorExportSection } from "../doctor-export/DoctorExportSection.js";

const { useState } = React;

const TABS = [
  ["upload", "tab.upload"],
  ["doctor-export", "tab.export"],
];

export function DocumentsPageSection({ familyId, callerMemberId, selectedMemberId, topOffsetPx, onExit }) {
  const [tab, setTab] = useState(TABS[0][0]);
  const topPx = (topOffsetPx || 44) + "px";

  return React.createElement(
    "div", { className: "hs-page", style: { position: "fixed", top: topPx, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "12px" } },
      TabPills(TABS.map(([i, k]) => [i, t(k)]), tab, setTab),
      !selectedMemberId
        ? React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "সদস্য-তালিকা লোড হচ্ছে...")
        : React.createElement(
          React.Fragment, null,
          tab === "upload" && React.createElement(DocumentsSection, { familyId, callerMemberId, selectedMemberId }),
          tab === "doctor-export" && React.createElement(DoctorExportSection, { familyId, callerMemberId, selectedMemberId, onGoUpload: () => setTab("upload") })
        )
    )
  );
}
