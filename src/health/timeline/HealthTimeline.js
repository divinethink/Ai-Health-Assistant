// Health Timeline UI — HealthRecordsSection.js/DocumentsSection.js-এর হুবহু
// member-picker pattern reuse। Checklist P2-এর শেষ আইটেম।

import { ErrorBox, SelectField } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { buildTimeline } from "./timelineData.js";

const { useState, useEffect } = React;

export function HealthTimeline({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [entries, setEntries] = useState(null);
  const [entriesErr, setEntriesErr] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        setTargetMemberId((prev) => prev || callerMemberId || (list[0] && list[0].id) || null);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId, callerMemberId]);

  useEffect(() => {
    if (!targetMemberId) return;
    setEntries(null);
    setEntriesErr(null);
    buildTimeline(familyId, targetMemberId)
      .then(setEntries)
      .catch((e) => setEntriesErr(e.code === "permission-denied"
        ? "এই সদস্যের timeline দেখার অনুমতি আপনার নেই (Take-Access grant ছাড়া অন্য সদস্যের data দেখা যায় না)।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId]);

  if (loadErr) return ErrorBox(loadErr);
  if (!members || !targetMemberId) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");
  }

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "Health Timeline"),
    SelectField("সদস্য বাছাই করুন", targetMemberId, setTargetMemberId, members.map((m) => [m.id, m.name])),

    entriesErr && ErrorBox(entriesErr),
    !entriesErr && !entries && React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "লোড হচ্ছে..."),
    !entriesErr && entries && entries.length === 0 &&
      React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "এখনো কোনো রেকর্ড/ডকুমেন্ট নেই।"),

    !entriesErr && entries && entries.length > 0 && React.createElement(
      "div", { style: { marginTop: "12px", borderLeft: "2px solid #CBD5E1", paddingLeft: "14px" } },
      entries.map((e) =>
        React.createElement(
          "div", { key: e.id, style: { marginBottom: "16px", position: "relative" } },
          React.createElement("div", {
            style: {
              position: "absolute", left: "-19px", top: "3px", width: "10px", height: "10px",
              borderRadius: "50%", background: "#0E4B43", border: "2px solid #F5F7F5",
            },
          }),
          React.createElement("div", { style: { fontSize: "12px", color: "#888" } }, e.displayDate || "তারিখ অজানা"),
          React.createElement("div", { style: { fontSize: "13px", marginTop: "2px" } },
            e.icon + " ", React.createElement("b", null, e.label)),
          React.createElement("div", { style: { fontSize: "13px", color: "#333", marginTop: "1px" } }, e.description),
          e.url && React.createElement("a", {
            href: e.url, target: "_blank", rel: "noopener noreferrer",
            style: { fontSize: "12px", color: "#0E4B43" },
          }, "👁 দেখুন")
        )
      )
    )
  );
}
