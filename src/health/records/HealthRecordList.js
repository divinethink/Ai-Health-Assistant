// একজন সদস্যের Health Record-এর তালিকা দেখানো। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { ErrorBox } from "../../shared/ui.js";
import { listHealthRecords, describeHealthRecord, deleteHealthRecord, RESOURCE_TYPE_LABELS } from "./healthRecordsData.js";

const { useState, useEffect, useCallback } = React;

// callerMemberId/onEdit/onDeleted নতুন — Update/Delete UI (roadmap §3.4 delete-
// safeguard-সহ: নিজের record না হলে ২-ধাপ confirm + deleteHealthRecord নিজেই
// owner-কে notification পাঠায়)।
export function HealthRecordList({ familyId, targetMemberId, callerMemberId, refreshTick, onEdit, onDeleted }) {
  const [records, setRecords] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // ২-ধাপ delete-confirm
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setRecords(null);
    setErr(null);
    listHealthRecords(familyId, targetMemberId)
      .then(setRecords)
      .catch((e) => setErr(e.code === "permission-denied"
        ? "এই সদস্যের Health Record দেখার অনুমতি আপনার নেই (Take-Access grant ছাড়া অন্য সদস্যের data দেখা যায় না)।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId, refreshTick]);

  const doDelete = useCallback(async (r) => {
    setBusyId(r.id);
    try {
      await deleteHealthRecord(familyId, r.id, targetMemberId, callerMemberId);
      setConfirmId(null);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই record মুছার অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally {
      setBusyId(null);
    }
  }, [familyId, targetMemberId, callerMemberId, onDeleted]);

  if (err) return ErrorBox(err);
  if (!records) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "লোড হচ্ছে...");
  if (records.length === 0) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "কোনো record নেই।");

  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    records.map((r) =>
      React.createElement(
        "div", { key: r.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px" } },
        React.createElement("div", null, React.createElement("b", null, RESOURCE_TYPE_LABELS[r.resourceType] || r.resourceType)),
        React.createElement("div", { style: { color: "#555" } }, describeHealthRecord(r)),
        React.createElement(
          "div", { style: { display: "flex", gap: "10px", marginTop: "4px" } },
          React.createElement("button", {
            onClick: () => onEdit && onEdit(r),
            style: { fontSize: "12px", border: "none", background: "none", color: "#0E4B43", cursor: "pointer", padding: 0 },
          }, "✎ Edit"),
          confirmId === r.id
            ? React.createElement(
                React.Fragment, null,
                React.createElement("span", { style: { fontSize: "12px", color: "#C0392B" } }, "নিশ্চিত মুছবেন?"),
                React.createElement("button", {
                  onClick: () => doDelete(r), disabled: busyId === r.id,
                  style: { fontSize: "12px", border: "none", background: "none", color: "#C0392B", fontWeight: 600, cursor: "pointer", padding: 0 },
                }, busyId === r.id ? "মুছছে..." : "হ্যাঁ, মুছুন"),
                React.createElement("button", {
                  onClick: () => setConfirmId(null),
                  style: { fontSize: "12px", border: "none", background: "none", color: "#888", cursor: "pointer", padding: 0 },
                }, "না")
              )
            : React.createElement("button", {
                onClick: () => setConfirmId(r.id),
                style: { fontSize: "12px", border: "none", background: "none", color: "#C0392B", cursor: "pointer", padding: 0 },
              }, "🗑 Delete")
        )
      )
    )
  );
}
