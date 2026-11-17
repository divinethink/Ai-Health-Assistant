// Document/Report তালিকা — কার্ড-লেআউট + ধরন-ভিত্তিক ফিল্টার-চিপ।
// HealthRecordList.js-এর হুবহু ২-ধাপ delete-confirm pattern অপরিবর্তিত (roadmap §3.4
// delete-safeguard, Admin-override notification deleteDocument()-এর ভেতরেই হয়)।
// "দেখুন"/"ডাউনলোড" সরাসরি Cloudinary URL ব্যবহার করে — সেই URL শুধু আমাদের
// access-controlled Firestore metadata doc-এর ভেতরেই থাকে (listDocuments() নিজেই
// hasAccess()-গেটেড)। Delete বোতাম এখন ⋮ মেনুর ভেতরে (ভুল-ট্যাপ কমাতে)।

import { PREMIUM_CARD } from "../../shared/cardStyle.js";
import { ErrorBox, ConfirmDialog, Skeleton } from "../../shared/ui.js";
import { Icon } from "../../shared/icons.js";
import { getLang } from "../../shared/i18n.js";
import { bnDate } from "../../shared/dates.js";
import { listDocuments, deleteDocument, renameDocument, getDownloadUrl, DOC_TYPE_LABELS } from "./documentsData.js";

const { useState, useEffect, useCallback } = React;

// নথির ধরন → লাইন-আইকন (নাম) ও নরম টালির রং; বাকি অ্যাপের আইকন-ধাঁচের সাথে মেলানো
const TYPE_ICONS = {
  prescription: ["pill", "#E6E4F5"],
  "lab-report": ["flask", "#E4F2EA"],
  imaging: ["scan", "#E3EEF8"],
  "discharge-summary": ["cross", "#FDE8E4"],
  other: ["file", "#F3ECD9"],
};

// "2026-11-14" → বাংলায় "১৪ নভেম্বর ২০২৬", English-এ "14 Nov 2026"; ISO না হলে যেমন আছে
function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  if (getLang() === "bn") return bnDate(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// শুধু-আইকন বাটন (≥44px টাচ-এলাকা; aria-label/title-এ নাম)
function iconLink(icon, label, href, primary) {
  return React.createElement("a", { href, target: "_blank", rel: "noopener noreferrer", "aria-label": label, title: label,
    style: { width: "44px", height: "44px", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", textDecoration: "none", color: "var(--hs-primary, #0E4B43)", background: primary ? "#E2F3E9" : "transparent" } },
    Icon(icon, { size: 22 }));
}

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

function menuItem(icon, label, onClick, color, disabled) {
  return React.createElement("button", { role: "menuitem", onClick, disabled, style: { display: "flex", alignItems: "center", gap: "10px", width: "100%", minHeight: "48px", padding: "0 16px", border: "none", borderBottom: "1px solid #EEF1EF", background: "none", color: color || "#1F2D2A", fontSize: "15px", fontWeight: 600, textAlign: "left", cursor: "pointer", fontFamily: "inherit" } },
    React.createElement("span", { "aria-hidden": "true" }, icon), label);
}

function chipStyle(active) {
  return {
    flexShrink: 0, fontSize: "14px", fontWeight: 600, padding: "7px 12px", borderRadius: "999px", cursor: "pointer",
    border: active ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA",
    background: active ? "var(--hs-primary, #0E4B43)" : "#fff", color: active ? "#fff" : "#2B3A36",
  };
}

export function DocumentList({ familyId, targetMemberId, callerMemberId, refreshTick, onDeleted, onAdd, onlyType, excludeType, emptyText, medsByDoc, onReanalyze }) {
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");
  const [menuId, setMenuId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [renameId, setRenameId] = useState(null); // নাম-বদলের ইনলাইন ঘর
  const [renameVal, setRenameVal] = useState("");
  const [menuErr, setMenuErr] = useState(null);   // মেনু-ক্রিয়ার ত্রুটি (তালিকা না লুকিয়ে)
  const [menuBusy, setMenuBusy] = useState(false);
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

  const doRename = async (d) => {
    setMenuBusy(true); setMenuErr(null);
    try {
      const name = await renameDocument(familyId, d.id, callerMemberId, renameVal);
      setDocs((all) => (all || []).map((x) => (x.id === d.id ? { ...x, fileName: name } : x)));
      setRenameId(null); setMenuId(null);
    } catch (e) { setMenuErr(e.message || String(e)); } finally { setMenuBusy(false); }
  };
  const doReanalyze = async (d) => {
    setMenuBusy(true); setMenuErr(null);
    try { await onReanalyze(d); setMenuId(null); } catch (e) { setMenuErr(e.message || String(e)); } finally { setMenuBusy(false); }
  };

  if (err) return ErrorBox(err);
  if (!docs) return Skeleton(3, 64);
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
      const meta = (isRx ? [fmtDate(d.date), d.source ? "ডাক্তার: " + d.source : null] : [fmtDate(d.date), d.source, formatSize(d.sizeBytes)]).filter(Boolean).join(" • ");
      const isPdf = d.originalContentType === "application/pdf";
      return React.createElement(
        "div", { key: d.id, style: { padding: "8px 8px 8px 12px", marginBottom: "8px", ...PREMIUM_CARD, position: "relative" } },
        React.createElement(
          "div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
          React.createElement("div", { "aria-hidden": "true", style: { width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px", background: (TYPE_ICONS[d.docType] || TYPE_ICONS.other)[1], color: "var(--hs-primary, #0E4B43)", display: "flex", alignItems: "center", justifyContent: "center" } }, Icon((TYPE_ICONS[d.docType] || TYPE_ICONS.other)[0], { size: 20 })),
          React.createElement(
            "div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontWeight: 700, fontSize: "15px", color: "var(--hs-primary, #0E4B43)" } },
              (isRx ? "প্রেসক্রিপশন" : (DOC_TYPE_LABELS[d.docType] || d.docType)) + (isPdf ? " · PDF" : "")),
            React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", wordBreak: "break-all" } }, d.fileName),
            meta && React.createElement("div", { style: { fontSize: "14px", color: "#5F716C" } }, meta),
            isRx && medsByDoc && medsByDoc[d.id] && medsByDoc[d.id].length > 0 && React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", marginTop: "2px" } }, "এই প্রেসক্রিপশনের ওষুধ: " + medsByDoc[d.id].join(", "))
          ),
          d.status === "ready" && iconLink("eye", "দেখুন", d.cloudinaryUrl, true),
          d.status === "ready" && iconLink("download", "ডাউনলোড", getDownloadUrl(d.cloudinaryUrl), false),
          React.createElement("button", {
            onClick: () => { setMenuId(menuId === d.id ? null : d.id); setRenameId(null); setMenuErr(null); },
            "aria-label": "More options", "aria-haspopup": "menu", "aria-expanded": menuId === d.id,
            style: { border: "none", background: "none", fontSize: "20px", cursor: "pointer", width: "32px", minHeight: "44px", padding: 0, color: "#5F716C" },
          }, "⋮")
        ),
        d.status === "pending" && React.createElement("div", { style: { color: "#B8860B", fontSize: "14px", marginTop: "6px" } },
          "আপলোড অসম্পূর্ণ (হয়তো নেটওয়ার্ক-সমস্যায় থেমে গেছে) — মুছে আবার চেষ্টা করুন।"),
        // ⋮ ড্রপডাউন (বোতামের পাশেই): Rename · Re-analyze (শুধু ল্যাব রিপোর্ট) · Delete
        menuId === d.id && React.createElement(React.Fragment, null,
          React.createElement("div", { "aria-hidden": "true", onClick: () => setMenuId(null), style: { position: "fixed", inset: 0, zIndex: 4 } }),
          React.createElement("div", { role: "menu", style: { position: "absolute", top: "52px", right: "8px", zIndex: 5, minWidth: "180px", background: "#fff", border: "1px solid #D3E0D9", borderRadius: "12px", boxShadow: "0 6px 18px rgba(14,75,67,0.18)", overflow: "hidden" } },
            menuItem("✏️", "Rename", () => { setRenameId(d.id); setRenameVal(d.fileName || ""); setMenuErr(null); setMenuId(null); }),
            onReanalyze && d.docType === "lab-report" && d.status === "ready" && menuItem("🔬", menuBusy ? "Loading..." : "Re-analyze", () => doReanalyze(d), "#1F2D2A", menuBusy),
            menuItem("🗑", "Delete", () => { setConfirmId(d.id); setMenuId(null); }, "#C0392B"))),
        (menuId === d.id || renameId === d.id) && menuErr && ErrorBox(menuErr),
        renameId === d.id && React.createElement("div", { style: { marginTop: "10px" } },
          React.createElement("input", { type: "text", value: renameVal, onChange: (e) => setRenameVal(e.target.value), "aria-label": "New name", style: { width: "100%", boxSizing: "border-box", padding: "12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px" } }),
          React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } },
            React.createElement("button", { onClick: () => doRename(d), disabled: menuBusy, style: { ...linkStyle(true), minHeight: "44px", cursor: "pointer" } }, "Save"),
            React.createElement("button", { onClick: () => { setRenameId(null); setMenuErr(null); }, disabled: menuBusy, style: { ...linkStyle(false), minHeight: "44px", cursor: "pointer" } }, "Cancel"))),
        confirmId === d.id && React.createElement(ConfirmDialog, { title: "Delete this document?", message: "\"" + d.fileName + "\" will be permanently deleted.", confirmLabel: "Delete", cancelLabel: "Cancel", busy: busyId === d.id, onConfirm: () => doDelete(d), onCancel: () => setConfirmId(null) })
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
