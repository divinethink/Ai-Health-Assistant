// Document/Report তালিকা — কার্ড-লেআউট + ধরন-ভিত্তিক ফিল্টার-চিপ।
// HealthRecordList.js-এর হুবহু ২-ধাপ delete-confirm pattern অপরিবর্তিত (roadmap §3.4
// delete-safeguard, Admin-override notification deleteDocument()-এর ভেতরেই হয়)।
// "দেখুন"/"ডাউনলোড" সরাসরি Cloudinary URL ব্যবহার করে — সেই URL শুধু আমাদের
// access-controlled Firestore metadata doc-এর ভেতরেই থাকে (listDocuments() নিজেই
// hasAccess()-গেটেড)। Delete বোতাম এখন ⋮ মেনুর ভেতরে (ভুল-ট্যাপ কমাতে)।

import { PREMIUM_CARD } from "../../shared/cardStyle.js";
import { ErrorBox, ConfirmDialog } from "../../shared/ui.js";
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
    border: "1px solid var(--hs-primary, #0E4B43)", background: primary ? "var(--hs-primary, #0E4B43)" : "#fff", color: primary ? "#fff" : "var(--hs-primary, #0E4B43)",
  };
}

function chipStyle(active) {
  return {
    flexShrink: 0, fontSize: "14px", fontWeight: 600, padding: "7px 12px", borderRadius: "999px", cursor: "pointer",
    border: active ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA",
    background: active ? "var(--hs-primary, #0E4B43)" : "#fff", color: active ? "#fff" : "#2B3A36",
  };
}

export function DocumentList({ familyId, targetMemberId, callerMemberId, refreshTick, onDeleted, onAdd, onlyType, excludeType, emptyText, medsByDoc }) {
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");
  const [menuId, setMenuId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [yearOpen, setYearOpen] = useState({}); // সাল → খোলা/বন্ধ; অনুল্লেখিত হলে সর্বশেষ সালটাই খোলা

  useEffect(() => {
    setDocs(null);
    setErr(null);
    listDocuments(familyId, targetMemberId)
      .then((all) => setDocs(all.filter((d) => (!onlyType || d.docType === onlyType) && (!excludeType || d.docType !== excludeType))))
      .catch((e) => setErr(e.code === "permission-denied"
        ? "এই সদস্যের নথি দেখার অনুমতি আপনার নেই (অ্যাডমিনের অনুমতি ছাড়া অন্য সদস্যের তথ্য দেখা যায় না)।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId, refreshTick, onlyType, excludeType]);

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
      React.createElement("div", { style: { fontWeight: 700, fontSize: "15px", color: "var(--hs-primary, #0E4B43)", margin: "6px 0 4px" } }, emptyText || "এখনো কোনো নথি নেই"),
      React.createElement("div", null, emptyText ? "" : "Prescription, ল্যাব রিপোর্ট বা ছবি/PDF এক জায়গায় নিরাপদে রাখুন।"),
      onAdd && React.createElement("button", {
        onClick: onAdd,
        style: { marginTop: "14px", minHeight: "44px", padding: "8px 20px", border: "none", borderRadius: "999px", background: "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" },
      }, "＋ প্রথম নথি যোগ করুন"));
  }

  const counts = {};
  docs.forEach((d) => { counts[d.docType] = (counts[d.docType] || 0) + 1; });
  const chips = [["all", "সব (" + docs.length + ")"]].concat(
    Object.keys(DOC_TYPE_LABELS).filter((k) => counts[k]).map((k) => [k, DOC_TYPE_LABELS[k] + " (" + counts[k] + ")"])
  );
  const activeFilter = filter === "all" || counts[filter] ? filter : "all";
  const shown = activeFilter === "all" ? docs : docs.filter((d) => d.docType === activeFilter);

  // সাল-অনুযায়ী ভাঁজ: তারিখ (YYYY-MM-DD) → নইলে আপলোডের সাল → নইলে "তারিখ অজানা"; নতুন সাল আগে
  const yearOf = (d) => {
    if (d.date && /^\d{4}/.test(d.date)) return d.date.slice(0, 4);
    const ms = d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : 0;
    return ms ? String(new Date(ms).getFullYear()) : "তারিখ অজানা";
  };
  const byYear = {};
  shown.forEach((d) => { const y = yearOf(d); (byYear[y] = byYear[y] || []).push(d); });
  const yearGroups = Object.entries(byYear).sort((a, b) => (a[0] === "তারিখ অজানা") - (b[0] === "তারিখ অজানা") || b[0].localeCompare(a[0]));

  const renderCard = (d) => {
      const isRx = d.docType === "prescription";
      const meta = (isRx ? [d.date, d.source ? "ডাক্তার: " + d.source : null] : [d.date, d.source, formatSize(d.sizeBytes)]).filter(Boolean).join(" • ");
      const isPdf = d.originalContentType === "application/pdf";
      return React.createElement(
        "div", { key: d.id, style: { padding: "12px", marginBottom: "10px", ...PREMIUM_CARD } },
        React.createElement(
          "div", { style: { display: "flex", alignItems: "flex-start", gap: "10px" } },
          React.createElement("div", { style: { fontSize: "26px", lineHeight: 1 } }, TYPE_ICONS[d.docType] || "📄"),
          React.createElement(
            "div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontWeight: 700, fontSize: "15px", color: "var(--hs-primary, #0E4B43)" } },
              (isRx ? "প্রেসক্রিপশন" : (DOC_TYPE_LABELS[d.docType] || d.docType)) + (isPdf ? " · PDF" : "")),
            React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", wordBreak: "break-all" } }, d.fileName),
            meta && React.createElement("div", { style: { fontSize: "14px", color: "#5F716C" } }, meta),
            isRx && medsByDoc && medsByDoc[d.id] && medsByDoc[d.id].length > 0 && React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", marginTop: "2px" } }, "এই প্রেসক্রিপশনের ওষুধ: " + medsByDoc[d.id].join(", "))
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
          React.createElement("button", {
            onClick: () => setConfirmId(d.id),
            style: { fontSize: "14px", border: "none", background: "none", color: "#C0392B", cursor: "pointer", padding: "8px 0", minHeight: "44px" },
          }, "🗑 মুছুন"),
          confirmId === d.id && React.createElement(ConfirmDialog, { title: "নথিটি মুছবেন?", message: "\"" + d.fileName + "\" স্থায়ীভাবে মুছে যাবে।", busy: busyId === d.id, onConfirm: () => doDelete(d), onCancel: () => setConfirmId(null) })
        )
      );
  };

  return React.createElement(
    "div", { style: { marginTop: "6px" } },
    chips.length > 2 && React.createElement(
      "div", { style: { display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "8px" } },
      chips.map(([id, label]) => React.createElement("button", { key: id, onClick: () => setFilter(id), style: chipStyle(id === activeFilter) }, label))
    ),
    yearGroups.map(([year, list], gi) => {
      const open = yearOpen[year] !== undefined ? yearOpen[year] : gi === 0;
      return React.createElement("div", { key: year, style: { marginBottom: "8px" } },
        React.createElement("button", { type: "button", onClick: () => setYearOpen((o) => ({ ...o, [year]: !open })), "aria-expanded": open,
          style: { width: "100%", minHeight: "48px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", marginBottom: "8px", borderRadius: "14px", border: "1px solid #C3D2CA", background: open ? "var(--hs-chip-bg, #E4F0E9)" : "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "16px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" } },
          React.createElement("span", null, (open ? "▾ " : "▸ ") + year),
          React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, color: "#5F716C" } }, list.length + "টি")),
        open && list.map(renderCard));
    })
  );
}
