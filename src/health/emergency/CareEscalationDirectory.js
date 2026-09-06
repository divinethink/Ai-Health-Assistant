// Verified Care-Escalation Directory UI (roadmap §12.5.1, Architecture Plan
// Part B §5.1, P8 ধাপ ১)। Global data (family-independent), তাই কোনো
// familyId/memberId prop লাগে না — RemedySection.js-এর একই standalone-
// reference প্যাটার্ন।

import { ErrorBox } from "../../shared/ui.js";
import { listCareEscalationDirectory, CARE_ESCALATION_TYPE_LABELS } from "./careEscalationData.js";

const { useState, useEffect } = React;

function groupByType(entries) {
  const groups = {};
  entries.forEach((e) => {
    if (!groups[e.type]) groups[e.type] = [];
    groups[e.type].push(e);
  });
  return groups;
}

function EntryRow(e) {
  return React.createElement(
    "div",
    { key: e.id, style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px" } },
    React.createElement("div", { style: { fontWeight: 600 } }, e.name),
    React.createElement("div", { style: { fontSize: "13px", color: "#0E4B43", marginTop: "2px" } }, e.contact),
    e.notes && React.createElement("div", { style: { fontSize: "12px", color: "#888", marginTop: "4px" } }, e.notes)
  );
}

export function CareEscalationDirectory() {
  const [entries, setEntries] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    listCareEscalationDirectory()
      .then(setEntries)
      .catch((e) => setLoadErr(e.message || String(e)));
  }, []);

  if (loadErr) return ErrorBox(loadErr);
  if (entries === null) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "Directory লোড হচ্ছে...");
  }
  if (entries.length === 0) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "এখনো কোনো entry নেই।");
  }

  const groups = groupByType(entries);
  const typeOrder = Object.keys(CARE_ESCALATION_TYPE_LABELS).filter((t) => groups[t]);

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43", margin: 0 } }, "Verified Care-Escalation Directory"),
    React.createElement(
      "p", { style: { fontSize: "12px", color: "#888", margin: "4px 0 10px" } },
      "জরুরি/স্বাস্থ্য/সুরক্ষা-সংক্রান্ত verified হেল্পলাইন ও যোগাযোগ — সব পরিবার একই তালিকা শেয়ার করে।"
    ),
    ...typeOrder.map((type) =>
      React.createElement(
        "div", { key: type, style: { marginTop: "12px" } },
        React.createElement("h4", { style: { fontSize: "13px", color: "#0E4B43", marginBottom: "6px" } }, CARE_ESCALATION_TYPE_LABELS[type]),
        React.createElement(
          "div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          ...groups[type].map(EntryRow)
        )
      )
    )
  );
}
