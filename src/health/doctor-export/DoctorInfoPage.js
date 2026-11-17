// "ডাক্তারের তথ্য" পাতা — Health ট্যাবের Doctor পিল থেকে মেনুতে সরানো (owner-request ২০২৬-১১-১৭)।
// ভেতরের দুই অংশ (সারাংশ | আমার ডাক্তার) ও কম্পোনেন্ট অপরিবর্তিত; শুধু ঠিকানা বদল।
import { DoctorExportSection } from "./DoctorExportSection.js";
import { DoctorDetailsSection } from "../doctor-details/DoctorDetailsSection.js";

const { useState } = React;

const TABS = [["summary", "📋 সারাংশ"], ["doctors", "🩺 আমার ডাক্তার"]];

export function DoctorInfoPage({ familyId, callerMemberId, isAdmin, selectedMemberId, onGoUpload }) {
  const [sub, setSub] = useState("summary");
  return React.createElement(React.Fragment, null,
    React.createElement("div", { role: "group", "aria-label": "ডাক্তার", style: { display: "flex", gap: "4px", padding: "4px", margin: "4px 0 16px", borderRadius: "999px", background: "#E3ECE7" } },
      TABS.map(([id, label]) => React.createElement("button", {
        key: id, type: "button", onClick: () => setSub(id), "aria-pressed": sub === id,
        style: {
          flex: 1, minHeight: "44px", padding: "6px 10px", borderRadius: "999px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "none",
          background: sub === id ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "transparent", color: sub === id ? "#fff" : "#2B3A36",
          boxShadow: sub === id ? "0 3px 8px rgba(14,75,67,0.25)" : "none",
        },
      }, label))),
    sub === "summary" && React.createElement(DoctorExportSection, { familyId, callerMemberId, selectedMemberId, onGoUpload }),
    sub === "doctors" && React.createElement(DoctorDetailsSection, { familyId, callerMemberId, isAdmin }));
}
