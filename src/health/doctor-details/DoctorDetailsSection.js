// Doctor Details & Visiting Card — container। WellnessGuideSection.js-এর
// show-form/edit/refresh-tick pattern reuse। Family-wide (member-picker লাগে
// না, doctors কোনো নির্দিষ্ট member-scoped না)।

import { DoctorDetailsForm } from "./DoctorDetailsForm.js";
import { DoctorDetailsList } from "./DoctorDetailsList.js";

const { useState } = React;

export function DoctorDetailsSection({ familyId, callerMemberId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  function handleSaved() {
    setShowForm(false);
    setEditingDoctor(null);
    setRefreshTick((t) => t + 1);
  }

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement(
      "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
      React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43", margin: 0 } }, "🩺 ডাক্তার বিবরণ ও ভিজিটিং কার্ড"),
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
      key: "doctor-list" + refreshTick, familyId, refreshTick,
      onEdit: (d) => { setShowForm(false); setEditingDoctor(d); },
      onDeleted: () => setRefreshTick((t) => t + 1),
    })
  );
}
