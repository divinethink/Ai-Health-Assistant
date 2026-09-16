// Doctor Details — Add/Edit ফর্ম। WellnessGuideForm.js-এর edit-mode pattern +
// DocumentUploadForm.js-এর file-input pattern reuse।

import { TextField, SelectField, ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { createDoctor, updateDoctorFields, validateCardImage, DOCTOR_CATEGORIES } from "./doctorDetailsData.js";

const { useState, useCallback, useRef } = React;

export function DoctorDetailsForm({ familyId, callerMemberId, editingDoctor, onSaved, onCancel }) {
  const isEdit = !!editingDoctor;
  const [name, setName] = useState(editingDoctor ? editingDoctor.name : "");
  const [specialtyCategory, setSpecialtyCategory] = useState(editingDoctor ? editingDoctor.specialtyCategory : DOCTOR_CATEGORIES[0][0]);
  const [area, setArea] = useState(editingDoctor ? editingDoctor.area || "" : "");
  const [hospital, setHospital] = useState(editingDoctor ? editingDoctor.hospital || "" : "");
  const [chamberAddress, setChamberAddress] = useState(editingDoctor ? editingDoctor.chamberAddress || "" : "");
  const [phone, setPhone] = useState(editingDoctor ? editingDoctor.phone || "" : "");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileInputRef = useRef(null);

  const onFileChange = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    setErr(null);
    if (f) {
      const v = validateCardImage(f);
      if (v) { setErr(v); setFile(null); return; }
    }
    setFile(f || null);
  }, []);

  const submit = useCallback(async () => {
    setErr(null);
    if (!name.trim()) { setErr("ডাক্তারের নাম লিখুন।"); return; }
    setBusy(true);
    try {
      const fields = { name, specialtyCategory, area, hospital, chamberAddress, phone };
      if (isEdit) {
        await updateDoctorFields(familyId, editingDoctor.id, callerMemberId, fields);
      } else {
        await createDoctor(familyId, callerMemberId, fields, file);
      }
      onSaved();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই তথ্য যোগ/এডিট করার অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, callerMemberId, name, specialtyCategory, area, hospital, chamberAddress, phone, file, isEdit, editingDoctor, onSaved]);

  return React.createElement(
    "div", { style: { marginTop: "10px", padding: "12px", border: "1px solid #CBD5E1", borderRadius: "8px", background: isEdit ? "#FFFBEB" : "#F9FBFA" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 6px" } }, isEdit ? "ডাক্তারের তথ্য এডিট করুন" : "নতুন ডাক্তার যোগ করুন"),
    TextField("ডাক্তারের নাম", name, setName, "যেমন: ডা. রহিম উদ্দিন"),
    SelectField("বিশেষত্ব / ক্যাটেগরি", specialtyCategory, setSpecialtyCategory, DOCTOR_CATEGORIES),
    TextField("এলাকা (ঐচ্ছিক)", area, setArea, "যেমন: ধানমন্ডি, ঢাকা"),
    TextField("প্রতিষ্ঠান/হাসপাতাল (ঐচ্ছিক)", hospital, setHospital, "যেমন: ঢাকা মেডিকেল কলেজ হাসপাতাল"),
    TextField("চেম্বার-ঠিকানা (ঐচ্ছিক)", chamberAddress, setChamberAddress, "চেম্বারের ঠিকানা/সময়সূচি"),
    TextField("ফোন/যোগাযোগ (ঐচ্ছিক)", phone, setPhone, "যেমন: 01XXXXXXXXX"),
    !isEdit && React.createElement(
      "div", { style: { marginTop: "8px" } },
      React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "ভিজিটিং কার্ডের ছবি (ঐচ্ছিক)"),
      React.createElement("input", {
        ref: fileInputRef, type: "file", accept: "image/*", onChange: onFileChange,
        style: { fontSize: "13px" },
      })
    ),
    isEdit && React.createElement(
      "p", { style: { fontSize: "11px", color: "#888", marginTop: "8px" } },
      "ভিজিটিং কার্ডের ছবি বদলাতে চাইলে এই এন্ট্রি ডিলিট করে নতুন করে যোগ করুন।"
    ),
    err && ErrorBox(err),
    PrimaryButton(isEdit ? "Update করুন" : "যোগ করুন", submit, busy),
    isEdit && SecondaryButton("বাতিল", onCancel, busy)
  );
}
