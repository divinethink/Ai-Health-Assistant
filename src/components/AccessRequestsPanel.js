// Admin-only — pending join-request approve/deny panel। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { ErrorBox } from "../shared/ui.js";
import { listPendingAccessRequests, decideAccessRequest } from "../legacy/accessRequests.js";

const { useState, useEffect, useCallback } = React;

export function AccessRequestsPanel({ familyId }) {
  const [requests, setRequests] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(() => {
    listPendingAccessRequests(familyId).then(setRequests).catch((e) => setErr(e.message || String(e)));
  }, [familyId]);
  useEffect(() => { reload(); }, [reload]);

  const decide = useCallback(async (requesterUid, decision) => {
    setBusyId(requesterUid);
    try { await decideAccessRequest(familyId, requesterUid, decision); reload(); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusyId(null); }
  }, [familyId, reload]);

  if (err) return ErrorBox(err);
  if (!requests) return null;

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "যোগদানের অনুরোধ"),
    requests.length === 0
      ? React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "কোনো পেন্ডিং অনুরোধ নেই।")
      : requests.map((r) =>
          React.createElement(
            "div", { key: r.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
            React.createElement("span", null, "uid: " + r.id.slice(0, 10) + "…"),
            React.createElement(
              "div", { style: { display: "flex", gap: "6px" } },
              React.createElement("button", {
                onClick: () => decide(r.id, "approved"), disabled: busyId === r.id,
                style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #0E4B43", background: "#0E4B43", color: "#fff", cursor: "pointer" },
              }, "অনুমোদন"),
              React.createElement("button", {
                onClick: () => decide(r.id, "denied"), disabled: busyId === r.id,
                style: { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", cursor: "pointer" },
              }, "প্রত্যাখ্যান")
            )
          )
        )
  );
}
