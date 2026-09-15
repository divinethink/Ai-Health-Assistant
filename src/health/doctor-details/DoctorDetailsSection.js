// Doctor Details & Visiting Card — container। WellnessGuideSection.js-এর
// show-form/edit/refresh-tick pattern reuse। Family-wide (member-picker লাগে
// না, doctors কোনো নির্দিষ্ট member-scoped না)।

import { DoctorDetailsForm } from "./DoctorDetailsForm.js";
import { DoctorDetailsList } from "./DoctorDetailsList.js";

const { useState } = React;

export function DoctorDetailsSection({ familyId, callerMemberId, isAdmin, onExit }) {
  const [showForm, setShowForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  function handleSaved() {
    setShowForm(false);
    setEditingDoctor(null);
    setRefreshTick((t) => t + 1);
  }

  const body = React.createElement(
    React.Fragment, null,
    React.createElement(
      "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
      !onExit && React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43", margin: 0 } }, "🩺 ডাক্তার বিবরণ ও ভিজিটিং কার্ড"),
      !showForm && !editingDoctor && React.createElement(
        "button", {
          onClick: () => { setEditingDoctor(null); setShowForm(true); },
          style: { fontSize: "12px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #0E4B43", background: "#0E4B43", color: "#fff", cursor: "pointer" },
        },
        "+ নতুন ডাক্তার যোগ করুন"
      )
    ),
    (showForm || editingDoctor) && React.createElement(DoctorDetailsForm, {
      familyId, callerMemberId, editingDoctor,
      onSaved: handleSaved,
      onCancel: () => { setShowForm(false); setEditingDoctor(null); },
    }),
    React.createElement(DoctorDetailsList, {
      key: "doctor-list" + refreshTick, familyId, refreshTick, callerMemberId, isAdmin,
      onEdit: (d) => { setShowForm(false); setEditingDoctor(d); },
      onDeleted: () => setRefreshTick((t) => t + 1),
    })
  );

  // Full-page mode (amendment item ৪, Full-Page System — P11 precondition) —
  // onExit prop দিলে position:fixed full-screen wrapper + header/back-button
  // (WellnessGuideSection.js/GeneralChatSection.js-এর প্রমাণিত pattern reuse)।
  // onExit না দিলে আগের মতোই ভেতরে-embed করা inline section (backward-compatible)।
  if (!onExit) {
    return React.createElement("div", { style: { marginTop: "20px" } }, body);
  }

  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "#fff", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement(
      "div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#0E4B43", color: "#fff", flexShrink: 0 } },
      React.createElement("span", { style: { fontWeight: 700, fontSize: "15px" } }, "🩺 ডাক্তার বিবরণ ও ভিজিটিং কার্ড"),
      React.createElement("button", {
        onClick: onExit,
        style: { background: "none", border: "1px solid #fff", color: "#fff", fontSize: "11px", padding: "3px 10px", borderRadius: "6px", cursor: "pointer" },
      }, "← ফিরে যান")
    ),
    React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "16px" } }, body)
  );
}
