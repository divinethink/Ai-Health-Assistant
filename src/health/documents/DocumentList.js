// Document/Report তালিকা — HealthRecordList.js-এর হুবহু ২-ধাপ delete-confirm
// pattern reuse (roadmap §3.4 delete-safeguard, Admin-override notification
// deleteDocument()-এর ভেতরেই হয়)।

import { ErrorBox } from "../../shared/ui.js";
import { listDocuments, deleteDocument, getDocumentDownloadUrl, DOC_TYPE_LABELS } from "./documentsData.js";

const { useState, useEffect, useCallback } = React;

export function DocumentList({ familyId, targetMemberId, callerMemberId, refreshTick, onDeleted }) {
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [linkErrId, setLinkErrId] = useState(null);

  useEffect(() => {
    setDocs(null);
    setErr(null);
    listDocuments(familyId, targetMemberId)
      .then(setDocs)
      .catch((e) => setErr(e.code === "permission-denied"
        ? "এই সদস্যের Document দেখার অনুমতি আপনার নেই (Take-Access grant ছাড়া অন্য সদস্যের data দেখা যায় না)।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId, refreshTick]);

  const doOpen = useCallback(async (d) => {
    setLinkErrId(null);
    try {
      const url = await getDocumentDownloadUrl(d.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setLinkErrId(d.id);
    }
  }, []);

  const doDelete = useCallback(async (d) => {
    setBusyId(d.id);
    try {
      await deleteDocument(familyId, d.id, targetMemberId, callerMemberId, d.storagePath);
      setConfirmId(null);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই Document মুছার অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally {
      setBusyId(null);
    }
  }, [familyId, targetMemberId, callerMemberId, onDeleted]);

  if (err) return ErrorBox(err);
  if (!docs) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "লোড হচ্ছে...");
  if (docs.length === 0) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "কোনো Document নেই।");

  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    docs.map((d) =>
      React.createElement(
        "div", { key: d.id, style: { padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "13px" } },
        React.createElement("div", null, React.createElement("b", null, DOC_TYPE_LABELS[d.docType] || d.docType)),
        React.createElement("div", { style: { color: "#555" } },
          d.fileName + (d.date ? " — " + d.date : "") + (d.source ? " (" + d.source + ")" : "")),
        linkErrId === d.id && React.createElement("div", { style: { color: "#C0392B", fontSize: "12px" } },
          "ফাইল খুলতে ব্যর্থ — অনুমতি বা নেটওয়ার্ক সমস্যা।"),
        React.createElement(
          "div", { style: { display: "flex", gap: "10px", marginTop: "4px" } },
          React.createElement("button", {
            onClick: () => doOpen(d),
            style: { fontSize: "12px", border: "none", background: "none", color: "#0E4B43", cursor: "pointer", padding: 0 },
          }, "👁 দেখুন/ডাউনলোড"),
          confirmId === d.id
            ? React.createElement(
                React.Fragment, null,
                React.createElement("span", { style: { fontSize: "12px", color: "#C0392B" } }, "নিশ্চিত মুছবেন?"),
                React.createElement("button", {
                  onClick: () => doDelete(d), disabled: busyId === d.id,
                  style: { fontSize: "12px", border: "none", background: "none", color: "#C0392B", fontWeight: 600, cursor: "pointer", padding: 0 },
                }, busyId === d.id ? "মুছছে..." : "হ্যাঁ, মুছুন"),
                React.createElement("button", {
                  onClick: () => setConfirmId(null),
                  style: { fontSize: "12px", border: "none", background: "none", color: "#888", cursor: "pointer", padding: 0 },
                }, "না")
              )
            : React.createElement("button", {
                onClick: () => setConfirmId(d.id),
                style: { fontSize: "12px", border: "none", background: "none", color: "#C0392B", cursor: "pointer", padding: 0 },
              }, "🗑 Delete")
        )
      )
    )
  );
}
