// Doctor Details — card list। DocumentList.js-এর ২-ধাপ delete-confirm pattern reuse।

import { ErrorBox, ConfirmDialog } from "../../shared/ui.js";
import { listDoctors, deleteDoctor, DOCTOR_CATEGORIES } from "./doctorDetailsData.js";

const { useState, useEffect, useCallback } = React;

const CATEGORY_LABELS = Object.fromEntries(DOCTOR_CATEGORIES);

export function DoctorDetailsList({ familyId, category, refreshTick, callerMemberId, isAdmin, onEdit, onDeleted }) {
  const [doctors, setDoctors] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null); // ৩-কলাম টাইলে চাপলে নিচের শিটে পুরো কার্ড

  useEffect(() => {
    setDoctors(null);
    setErr(null);
    listDoctors(familyId).then(setDoctors).catch((e) => setErr(e.message || String(e)));
  }, [familyId, refreshTick]);

  const doDelete = useCallback(async (d) => {
    setBusyId(d.id);
    try {
      await deleteDoctor(familyId, d.id);
      setConfirmId(null);
      setOpenId(null);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  }, [familyId, onDeleted]);

  if (err) return ErrorBox(err);
  if (!doctors) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে...");

  const filtered = !category || category === "all" ? doctors : doctors.filter((d) => d.specialtyCategory === category);
  const empty = (icon, text) => React.createElement("div", { style: { marginTop: "10px", padding: "22px 14px", textAlign: "center", background: "#fff", border: "1.5px dashed #B9CDC2", borderRadius: "16px", color: "#5F716C", fontSize: "14px" } },
    React.createElement("div", { style: { fontSize: "30px", marginBottom: "4px" } }, icon), text);
  if (doctors.length === 0) return empty("🩺", "এখনো কোনো ডাক্তারের তথ্য যোগ হয়নি। উপরের বাটনে চেপে প্রথম ডাক্তার যোগ করুন।");
  if (filtered.length === 0) return empty("🔎", "এই বিভাগে এখনো কোনো ডাক্তার যোগ হয়নি।");

  const pill = (color, bg) => ({ minHeight: "40px", padding: "0 14px", borderRadius: "999px", border: "1px solid " + color, background: bg, color, fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", textDecoration: "none" });

  const renderCard = (d) => {
      const canEdit = !!callerMemberId && d.lastEditedByMemberId === callerMemberId;
      const canDelete = isAdmin || canEdit;
      const telMatch = d.phone ? String(d.phone).match(/\+?\d[\d\s-]{6,}/) : null;
      const telHref = telMatch ? "tel:" + telMatch[0].replace(/[\s-]/g, "") : null;
      const initial = Array.from(String(d.name || "?").replace(/^(ডাঃ|ডা\.?|Dr\.?)\s*/i, "").trim())[0] || "🩺";
      const line = (icon, text, color) => React.createElement("div", { style: { fontSize: "14px", color: color || "#3E4E49", display: "flex", gap: "6px", lineHeight: 1.4 } },
        React.createElement("span", { "aria-hidden": "true", style: { flexShrink: 0 } }, icon), React.createElement("span", { style: { minWidth: 0, overflowWrap: "anywhere" } }, text));
      return React.createElement(
        "div", { key: d.id, style: { background: "#fff", border: "1px solid #D3E0D9", borderLeft: "5px solid var(--hs-primary-2, #17705F)", borderRadius: "16px", boxShadow: "0 3px 10px rgba(14,75,67,0.08)", padding: "12px" } },
        React.createElement("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
          d.visitingCardImageUrl
            ? React.createElement("img", {
                src: String(d.visitingCardImageUrl).replace(/\.pdf$/i, ".jpg"),
                onError: (e) => { e.target.style.display = "none"; },
                style: { width: "56px", height: "56px", objectFit: "cover", borderRadius: "12px", flexShrink: 0, border: "1px solid #D3E0D9" },
              })
            : React.createElement("div", { "aria-hidden": "true", style: { width: "48px", height: "48px", flexShrink: 0, borderRadius: "50%", background: "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 800 } }, initial),
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontWeight: 800, color: "var(--hs-primary, #0E4B43)", fontSize: "16px", lineHeight: 1.25, overflowWrap: "anywhere" } }, d.name),
            React.createElement("span", { style: { display: "inline-block", marginTop: "4px", padding: "1px 10px", borderRadius: "999px", background: "#DDF0E5", color: "var(--hs-primary, #0E4B43)", fontSize: "12.5px", fontWeight: 700 } }, CATEGORY_LABELS[d.specialtyCategory] || d.specialtyCategory))),
        React.createElement("div", { style: { marginTop: "8px", display: "flex", flexDirection: "column", gap: "2px" } },
          d.area && line("📍", d.area, "var(--hs-primary, #0E4B43)"),
          d.hospital && line("🏥", d.hospital),
          d.chamberAddress && line("🚪", d.chamberAddress, "#5F716C"),
          d.phone && line("📞", d.phone),
          d.status === "pending" && React.createElement("div", { style: { fontSize: "14px", color: "#B8860B" } }, "ছবি আপলোড অসম্পূর্ণ ছিল — চাইলে ডিলিট করে আবার যোগ করুন।")),
        (telHref || canEdit || canDelete) && React.createElement(
          "div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "10px" } },
          telHref && React.createElement("a", { href: telHref, style: pill("#fff", "var(--hs-primary, #0E4B43)") }, "📞 কল করুন"),
          canEdit && React.createElement("button", { onClick: () => { setOpenId(null); onEdit(d); }, style: pill("var(--hs-primary, #0E4B43)", "#fff") }, "✎ এডিট"),
          canDelete && React.createElement("button", { onClick: () => setConfirmId(d.id), style: pill("#C0392B", "#fff") }, "🗑 মুছুন"),
          canDelete && confirmId === d.id && React.createElement(ConfirmDialog, { title: "ডাক্তারের তথ্য মুছবেন?", message: d.name + " — স্থায়ীভাবে মুছে যাবে।", busy: busyId === d.id, onConfirm: () => doDelete(d), onCancel: () => setConfirmId(null) }))
      );
  };

  // ৩-কলাম ছোট টাইল (ছবি/ইনিশিয়াল, নাম, বিশেষজ্ঞতা, কল) — চাপলে নিচ থেকে শিটে পুরো কার্ড, এডিট/মুছুন সহ
  const tileOf = (d) => {
    const telM = d.phone ? String(d.phone).match(/\+?\d[\d\s-]{6,}/) : null;
    const ini = Array.from(String(d.name || "?").replace(/^(ডাঃ|ডা\.?|Dr\.?)\s*/i, "").trim())[0] || "🩺";
    return React.createElement("div", { key: d.id, style: { background: "#fff", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 6px rgba(14,75,67,0.08)", display: "flex", flexDirection: "column", minWidth: 0 } },
      React.createElement("button", { onClick: () => setOpenId(d.id), "aria-label": d.name + " — বিস্তারিত", style: { border: "none", background: "none", padding: "10px 6px 4px", minHeight: "96px", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: 0 } },
        d.visitingCardImageUrl
          ? React.createElement("img", { src: String(d.visitingCardImageUrl).replace(/\.pdf$/i, ".jpg"), alt: "", onError: (e) => { e.target.style.display = "none"; }, style: { width: "44px", height: "44px", objectFit: "cover", borderRadius: "50%", border: "1px solid #D3E0D9" } })
          : React.createElement("div", { "aria-hidden": "true", style: { width: "44px", height: "44px", borderRadius: "50%", background: "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800 } }, ini),
        React.createElement("span", { style: { fontSize: "13px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", lineHeight: 1.25, textAlign: "center", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere", maxWidth: "100%" } }, d.name),
        React.createElement("span", { style: { fontSize: "12px", color: "#3E4E49", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" } }, CATEGORY_LABELS[d.specialtyCategory] || d.specialtyCategory || "")),
      telM
        ? React.createElement("a", { href: "tel:" + telM[0].replace(/[\s-]/g, ""), "aria-label": d.name + " — কল করুন", style: { minHeight: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "var(--hs-primary, #0E4B43)", textDecoration: "none", borderTop: "1px solid #E3ECE7" } }, "📞 কল")
        : React.createElement("div", { style: { minHeight: "36px", borderTop: "1px solid #E3ECE7" } }));
  };
  const openDoc = openId ? filtered.find((x) => x.id === openId) : null;

  return React.createElement(
    React.Fragment, null,
    React.createElement("div", { style: { marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" } }, filtered.map(tileOf)),
    openDoc && React.createElement(
      React.Fragment, null,
      React.createElement("div", { onClick: () => { setOpenId(null); setConfirmId(null); }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 90 } }),
      React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": openDoc.name, style: { position: "fixed", left: 0, right: 0, bottom: "56px", maxHeight: "70vh", overflowY: "auto", background: "#F1F6F2", borderRadius: "18px 18px 0 0", padding: "10px 12px 14px", zIndex: 91, boxShadow: "0 -4px 16px rgba(0,0,0,0.2)" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: "6px" } },
          React.createElement("button", { onClick: () => { setOpenId(null); setConfirmId(null); }, "aria-label": "বন্ধ করুন", style: { width: "44px", height: "44px", borderRadius: "50%", border: "1px solid #C3D2CA", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "18px", cursor: "pointer" } }, "✕")),
        renderCard(openDoc))));
}
