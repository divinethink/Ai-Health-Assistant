// Documents — Full-page wrapper (amendment item ৪, Full-Page System — P11
// precondition)। Upload/Reports + Doctor-Facing Export — দুই existing
// component অপরিবর্তিত রেখে একটা full-screen container-এ composed করা হলো,
// AIChatSection.js/WellnessGuideSection.js-এর একই pattern। Doctor Details
// আপাতত আলাদা নিজস্ব full-page হিসেবেই থাকছে (owner-নির্দেশ অনুযায়ী) — P11-এর
// আসল nav-redesign-এ পরে প্রয়োজনে এখানে merge করা যাবে (schema/logic
// পরিবর্তন ছাড়াই, শুধু presentation-layer regrouping)।

import { DocumentsSection } from "./DocumentsSection.js";
import { DoctorExportSection } from "../doctor-export/DoctorExportSection.js";

export function DocumentsPageSection({ familyId, callerMemberId, onExit }) {
  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "#F5F5F0", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement(
      "div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#0E4B43", color: "#fff", flexShrink: 0 } },
      React.createElement("span", { style: { fontWeight: 700, fontSize: "15px" } }, "📁 Documents"),
      React.createElement("button", {
        onClick: onExit,
        style: { background: "none", border: "1px solid #fff", color: "#fff", fontSize: "11px", padding: "3px 10px", borderRadius: "6px", cursor: "pointer" },
      }, "← ফিরে যান")
    ),
    React.createElement(
      "div", { style: { flex: 1, overflowY: "auto", padding: "12px" } },
      React.createElement(DocumentsSection, { familyId, callerMemberId }),
      React.createElement(DoctorExportSection, { familyId, callerMemberId })
    )
  );
}
