// একজন সদস্যের Health Record-এর তালিকা দেখানো। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { ErrorBox } from "../../shared/ui.js";
import { listHealthRecords, describeHealthRecord, RESOURCE_TYPE_LABELS } from "./healthRecordsData.js";

const { useState, useEffect } = React;

export function HealthRecordList({ familyId, targetMemberId, refreshTick }) {
  const [records, setRecords] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setRecords(null);
    setErr(null);
    listHealthRecords(familyId, targetMemberId)
      .then(setRecords)
      .catch((e) => setErr(e.code === "permission-denied"
        ? "এই সদস্যের Health Record দেখার অনুমতি আপনার নেই (Take-Access grant ছাড়া অন্য সদস্যের data দেখা যায় না)।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId, refreshTick]);

  if (err) return ErrorBox(err);
  if (!records) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "লোড হচ্ছে...");
  if (records.length === 0) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "কোনো record নেই।");

  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    records.map((r) =>
      React.createElement(
        "div", { key: r.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px" } },
        React.createElement("div", null, React.createElement("b", null, RESOURCE_TYPE_LABELS[r.resourceType] || r.resourceType)),
        React.createElement("div", { style: { color: "#555" } }, describeHealthRecord(r))
      )
    )
  );
}
