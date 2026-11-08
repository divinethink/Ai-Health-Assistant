// Doctor Details — card list। DocumentList.js-এর ২-ধাপ delete-confirm pattern reuse।

import { ErrorBox } from "../../shared/ui.js";
import { listDoctors, deleteDoctor, DOCTOR_CATEGORIES } from "./doctorDetailsData.js";

const { useState, useEffect, useCallback } = React;

const CATEGORY_LABELS = Object.fromEntries(DOCTOR_CATEGORIES);

export function DoctorDetailsList({ familyId, category, refreshTick, callerMemberId, isAdmin, onEdit, onDeleted }) {
  const [doctors, setDoctors] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

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
  if (doctors.length === 0) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "এখনো কোনো ডাক্তারের তথ্য যোগ হয়নি।");
  if (filtered.length === 0) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "এই ক্যাটেগরিতে এখনো কোনো ডাক্তার যোগ হয়নি।");

  return React.createElement(
    "div", { style: { marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" } },
    filtered.map((d) => {
      const canEdit = !!callerMemberId && d.lastEditedByMemberId === callerMemberId;
      const canDelete = isAdmin || canEdit;
      return React.createElement(
        "div", { key: d.id, style: { display: "flex", gap: "10px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)", padding: "10px" } },
        d.visitingCardImageUrl && React.createElement("img", {
          src: d.visitingCardImageUrl,
          style: { width: "64px", height: "64px", objectFit: "cover", borderRadius: "10px", flexShrink: 0 },
        }),
        React.createElement(
          "div", { style: { flex: 1, minWidth: 0 } },
          React.createElement("div", { style: { fontWeight: 600, color: "#0E4B43", fontSize: "14px" } }, "🩺 " + d.name),
          React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49" } }, CATEGORY_LABELS[d.specialtyCategory] || d.specialtyCategory),
          d.area && React.createElement("div", { style: { fontSize: "14px", color: "#0E4B43", fontWeight: 600 } }, "📍 " + d.area),
          d.hospital && React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49" } }, d.hospital),
          d.chamberAddress && React.createElement("div", { style: { fontSize: "14px", color: "#5F716C" } }, d.chamberAddress),
          d.phone && React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49" } }, "📞 " + d.phone),
          d.status === "pending" && React.createElement(
            "div", { style: { fontSize: "14px", color: "#B8860B" } },
            "ছবি আপলোড অসম্পূর্ণ ছিল — চাইলে ডিলিট করে আবার যোগ করুন।"
          ),
          (canEdit || canDelete) && React.createElement(
            "div", { style: { display: "flex", gap: "10px", marginTop: "6px" } },
            canEdit && React.createElement("button", {
              onClick: () => onEdit(d),
              style: { fontSize: "14px", border: "none", background: "none", color: "#0E4B43", cursor: "pointer", padding: 0, fontWeight: 600 },
            }, "✎ এডিট"),
            canDelete && (confirmId === d.id
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
                }, "🗑 Delete"))
          )
        )
      );
    })
  );
}
