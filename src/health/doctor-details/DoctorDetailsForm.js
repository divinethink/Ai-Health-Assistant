// Doctor Details — Add/Edit ফর্ম। WellnessGuideForm.js-এর edit-mode pattern +
// DocumentUploadForm.js-এর file-input pattern reuse।

import { ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { createDoctor, updateDoctorFields, listDoctors, validateCardImage, DOCTOR_CATEGORIES } from "./doctorDetailsData.js";
import { DoctorFieldsRow } from "./DoctorFieldsRow.js";
import { buildCandidates, suggestDoctors, pickPatch, isDuplicate } from "./doctorSuggest.js";

const { useState, useCallback, useRef, useEffect, useMemo } = React;

export function DoctorDetailsForm({ familyId, callerMemberId, editingDoctor, onSaved, onCancel }) {
  const isEdit = !!editingDoctor;
  const e0 = editingDoctor || {};
  const [v, setV] = useState({
    name: e0.name || "", specialtyCategory: e0.specialtyCategory || DOCTOR_CATEGORIES[0][0],
    area: e0.area || "", hospital: e0.hospital || "", chamberAddress: e0.chamberAddress || "", phone: e0.phone || "",
  });
  const [file, setFile] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [existing, setExisting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submitting = useRef(false);

  useEffect(() => {
    let alive = true;
    listDoctors(familyId).then((d) => alive && setExisting(d)).catch(() => {});
    return () => { alive = false; };
  }, [familyId]);
  const others = useMemo(() => existing.filter((d) => !isEdit || d.id !== editingDoctor.id), [existing, isEdit, editingDoctor]);
  const suggestions = useMemo(() => suggestDoctors(buildCandidates(others, []), { query: v.name }), [others, v.name]);

  const onFileChange = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    setErr(null);
    if (f) {
      const msg = validateCardImage(f);
      if (msg) { setErr(msg); setFile(null); return; }
    }
    setFile(f || null);
  }, []);

  const submit = useCallback(async () => {
    setErr(null);
    if (submitting.current) return; // double-tap রোধ
    if (!v.name.trim()) { setErr("ডাক্তারের নাম লিখুন।"); return; }
    // সর্বশেষ তালিকা দিয়ে duplicate-check (নাম+ফোন)
    let current = others;
    try { current = (await listDoctors(familyId)).filter((d) => !isEdit || d.id !== editingDoctor.id); } catch (_e) { /* আগের তালিকায় চলবে */ }
    if (current.some((d) => isDuplicate(d, v))) { setErr("এই নাম ও ফোনের ডাক্তার আগে থেকেই তালিকায় আছে।"); return; }
    submitting.current = true;
    setBusy(true);
    try {
      if (isEdit) {
        await updateDoctorFields(familyId, editingDoctor.id, callerMemberId, v);
      } else {
        await createDoctor(familyId, callerMemberId, v, file);
      }
      onSaved();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই তথ্য যোগ/বদলানোর অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }, [familyId, callerMemberId, v, file, isEdit, editingDoctor, onSaved, others]);

  return React.createElement(
    "div", { style: { marginTop: "10px", padding: "12px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)", background: isEdit ? "#FFFBEB" : "#F9FBFA" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 6px" } }, isEdit ? "ডাক্তারের তথ্য এডিট করুন" : "নতুন ডাক্তার যোগ করুন"),
    React.createElement(DoctorFieldsRow, {
      value: v, suggestions, file, familyId,
      onChange: (patch) => setV((p) => ({ ...p, ...patch })),
      onPick: (c) => setV((p) => ({ ...p, ...pickPatch(c) })),
      onCardClick: isEdit ? undefined : () => setShowCard((s) => !s),
      cardLabel: file ? "📇✓" : "📇",
    }),
    !isEdit && (showCard || file) && React.createElement(
      "div", { style: { marginTop: "8px" } },
      React.createElement("label", { style: { fontSize: "14px", color: "#1F2D2A", display: "block", marginBottom: "4px" } }, "ভিজিটিং কার্ডের ছবি (ঐচ্ছিক)"),
      React.createElement("input", { type: "file", accept: "image/*,application/pdf", onChange: onFileChange, style: { fontSize: "14px" } })
    ),
    isEdit && React.createElement(
      "p", { style: { fontSize: "14px", color: "#5F716C", marginTop: "8px" } },
      "ভিজিটিং কার্ডের ছবি বদলাতে চাইলে এই এন্ট্রি ডিলিট করে নতুন করে যোগ করুন।"
    ),
    err && ErrorBox(err),
    PrimaryButton(isEdit ? "Update করুন" : "যোগ করুন", submit, busy),
    isEdit && SecondaryButton("বাতিল", onCancel, busy)
  );
}
