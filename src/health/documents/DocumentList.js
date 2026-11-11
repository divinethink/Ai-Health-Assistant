// Document/Report তালিকা — কার্ড-লেআউট + ধরন-ভিত্তিক ফিল্টার-চিপ।
// HealthRecordList.js-এর হুবহু ২-ধাপ delete-confirm pattern অপরিবর্তিত (roadmap §3.4
// delete-safeguard, Admin-override notification deleteDocument()-এর ভেতরেই হয়)।
// "দেখুন"/"ডাউনলোড" সরাসরি Cloudinary URL ব্যবহার করে — সেই URL শুধু আমাদের
// access-controlled Firestore metadata doc-এর ভেতরেই থাকে (listDocuments() নিজেই
// hasAccess()-গেটেড)। Delete বোতাম এখন ⋮ মেনুর ভেতরে (ভুল-ট্যাপ কমাতে)।

import { ErrorBox } from "../../shared/ui.js";
import { listDocuments, deleteDocument, getDownloadUrl, DOC_TYPE_LABELS } from "./documentsData.js";

const { useState, useEffect, useCallback } = React;

const TYPE_ICONS = {
  prescription: "💊",
  "lab-report": "🧪",
  imaging: "🩻",
  "discharge-summary": "🏥",
  other: "📄",
};

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function linkStyle(primary) {
  return {
    fontSize: "14px", fontWeight: 600, textDecoration: "none", padding: "8px 14px", minHeight: "20px", borderRadius: "12px",
    border: "1px solid #0E4B43", background: primary ? "#0E4B43" : "#fff", color: primary ? "#fff" : "#0E4B43",
  };
}

function chipStyle(active) {
  return {
    flexShrink: 0, fontSize: "14px", fontWeight: 600, padding: "7px 12px", borderRadius: "999px", cursor: "pointer",
    border: active ? "1px solid #0E4B43" : "1px solid #C3D2CA",
    background: active ? "#0E4B43" : "#fff", color: active ? "#fff" : "#2B3A36",
  };
}

export function DocumentList({ familyId, targetMemberId, callerMemberId, refreshTick, onDeleted, onAdd }) {
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");
  const [menuId, setMenuId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setDocs(null);
    setErr(null);
    listDocuments(familyId, targetMemberId)
      .then(setDocs)
      .catch((e) => setErr(e.code === "permission-denied"
        ? "এই সদস্যের নথি দেখার অনুমতি আপনার নেই (অ্যাডমিনের অনুমতি ছাড়া অন্য সদস্যের তথ্য দেখা যায় না)।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId, refreshTick]);

  const doDelete = useCallback(async (d) => {
    setBusyId(d.id);
    try {
      await deleteDocument(familyId, d.id, targetMemberId, callerMemberId);
      setConfirmId(null);
      setMenuId(null);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  }, [familyId, targetMemberId, callerMemberId, onDeleted]);

  if (err) return ErrorBox(err);
  if (!docs) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে...");
  if (docs.length === 0) {
    return React.createElement("div", { style: { textAlign: "center", padding: "28px 16px", border: "1px dashed #B9CFC4", borderRadius: "16px", background: "#fff", color: "#5F716C", fontSize: "14px" } },
      React.createElement("div", { style: { fontSize: "40px" } }, "🗂️"),
      React.createElement("div", { style: { fontWeight: 700, fontSize: "15px", color: "#0E4B43", margin: "6px 0 4px" } }, "এখনো কোনো নথি নেই"),
      React.createElement("div", null, "Prescription, ল্যাব রিপোর্ট বা ছবি/PDF এক জায়গায় নিরাপদে রাখুন।"),
      onAdd && React.createElement("button", {
        onClick: onAdd,
        style: { marginTop: "14px", minHeight: "44px", padding: "8px 20px", border: "none", borderRadius: "999px", background: "linear-gradient(135deg, #0E4B43, #17705F)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" },
      }, "＋ প্রথম নথি যোগ করুন"));
  }

  const counts = {};
  docs.forEach((d) => { counts[d.docType] = (counts[d.docType] || 0) + 1; });
  const chips = [["all", "সব (" + docs.length + ")"]].concat(
    Object.keys(DOC_TYPE_LABELS).filter((k) => counts[k]).map((k) => [k, DOC_TYPE_LABELS[k] + " (" + counts[k] + ")"])
  );
  const activeFilter = filter === "all" || counts[filter] ? filter : "all";
  const shown = activeFilter === "all" ? docs : docs.filter((d) => d.docType === activeFilter);

  return React.createElement(
    "div", { style: { marginTop: "6px" } },
    chips.length > 2 && React.createElement(
      "div", { style: { display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "8px" } },
      chips.map(([id, label]) => React.createElement("button", { key: id, onClick: () => setFilter(id), style: chipStyle(id === activeFilter) }, label))
    ),
    shown.map((d) => {
      const meta = [d.date, d.source, formatSize(d.sizeBytes)].filter(Boolean).join(" • ");
      const isPdf = d.originalContentType === "application/pdf";
      return React.createElement(
        "div", { key: d.id, style: { padding: "12px", marginBottom: "10px", border: "1px solid #D3E0D9", borderRadius: "14px", background: "#fff", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" } },
        React.createElement(
          "div", { style: { display: "flex", alignItems: "flex-start", gap: "10px" } },
          React.createElement("div", { style: { fontSize: "26px", lineHeight: 1 } }, TYPE_ICONS[d.docType] || "📄"),
          React.createElement(
            "div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontWeight: 700, fontSize: "15px", color: "#0E4B43" } },
              (DOC_TYPE_LABELS[d.docType] || d.docType) + (isPdf ? " · PDF" : "")),
            React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", wordBreak: "break-all" } }, d.fileName),
            meta && React.createElement("div", { style: { fontSize: "14px", color: "#5F716C" } }, meta)
          ),
          React.createElement("button", {
            onClick: () => { setMenuId(menuId === d.id ? null : d.id); setConfirmId(null); },
            "aria-label": "আরও",
            style: { border: "none", background: "none", fontSize: "20px", cursor: "pointer", padding: "0 6px", color: "#5F716C" },
          }, "⋮")
        ),
        d.status === "pending" && React.createElement("div", { style: { color: "#B8860B", fontSize: "14px", marginTop: "6px" } },
          "আপলোড অসম্পূর্ণ (হয়তো নেটওয়ার্ক-সমস্যায় থেমে গেছে) — মুছে আবার চেষ্টা করুন।"),
        d.status === "ready" && React.createElement(
          "div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
          React.createElement("a", { href: d.cloudinaryUrl, target: "_blank", rel: "noopener noreferrer", style: linkStyle(true) }, "👁 দেখুন"),
          React.createElement("a", { href: getDownloadUrl(d.cloudinaryUrl), target: "_blank", rel: "noopener noreferrer", style: linkStyle(false) }, "⬇ ডাউনলোড")
        ),
        menuId === d.id && React.createElement(
          "div", { style: { display: "flex", gap: "12px", alignItems: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed #D3E0D9" } },
          confirmId === d.id
            ? React.createElement(
                React.Fragment, null,
                React.createElement("span", { style: { fontSize: "14px", color: "#C0392B" } }, "নিশ্চিত মুছবেন?"),
                React.createElement("button", {
                  onClick: () => doDelete(d), disabled: busyId === d.id,
                  style: { fontSize: "14px", border: "none", background: "none", color: "#C0392B", fontWeight: 600, cursor: "pointer", padding: 0 },
                }, busyId === d.id ? "মুছছে..." : "হ্যাঁ, মুছুন"),
                React.createElement("button", {
                  onClick: () => setConfirmId(null),
                  style: { fontSize: "14px", border: "none", background: "none", color: "#5F716C", cursor: "pointer", padding: 0 },
                }, "না")
              )
            : React.createElement("button", {
                onClick: () => setConfirmId(d.id),
                style: { fontSize: "14px", border: "none", background: "none", color: "#C0392B", cursor: "pointer", padding: 0 },
              }, "🗑 মুছুন")
        )
      );
    })
  );
}
