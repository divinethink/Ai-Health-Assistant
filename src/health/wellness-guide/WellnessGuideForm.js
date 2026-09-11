// Wellness Guide — Admin-only Add/Edit ফর্ম (owner-request, ২০২৬-০৯-১২)।
// HealthRecordForm.js-এর edit-mode pattern reuse (editingPost দিলে prefill+update)।

import { TextField, SelectField, ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { createWellnessGuide, updateWellnessGuide, WELLNESS_CATEGORIES } from "./wellnessGuideData.js";

const { useState, useEffect, useCallback } = React;

function TextAreaField(label, value, onChange, placeholder) {
  return React.createElement(
    "div", { style: { marginBottom: "8px" } },
    React.createElement("label", { style: { fontSize: "12px", color: "#555", display: "block", marginBottom: "2px" } }, label),
    React.createElement("textarea", {
      value, placeholder, onChange: (e) => onChange(e.target.value), rows: 6,
      style: { width: "100%", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontFamily: "inherit", fontSize: "13px", boxSizing: "border-box" },
    })
  );
}

export function WellnessGuideForm({ familyId, editingPost, onSaved, onCancel }) {
  const isEdit = !!editingPost;
  const [category, setCategory] = useState(editingPost ? editingPost.category : WELLNESS_CATEGORIES[0][0]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [monthMin, setMonthMin] = useState("");
  const [monthMax, setMonthMax] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!editingPost) return;
    setCategory(editingPost.category);
    setTitle(editingPost.title || "");
    setSummary(editingPost.summary || "");
    setBody(editingPost.body || "");
    setTagsText((editingPost.tags || []).join(", "));
    setAgeMin(editingPost.ageRangeYears ? String(editingPost.ageRangeYears[0]) : "");
    setAgeMax(editingPost.ageRangeYears ? String(editingPost.ageRangeYears[1]) : "");
    setMonthMin(editingPost.pregnancyMonthRange ? String(editingPost.pregnancyMonthRange[0]) : "");
    setMonthMax(editingPost.pregnancyMonthRange ? String(editingPost.pregnancyMonthRange[1]) : "");
    setSourceNote(editingPost.sourceNote || "");
  }, [editingPost]);

  const needsAgeRange = category === "child-care" || category === "elderly-care";
  // "women-health" গর্ভাবস্থা-সহ বিস্তৃত ক্যাটাগরি — month-range ঐচ্ছিক (গর্ভাবস্থা-সংক্রান্ত পোস্টেই শুধু পূরণ হবে)
  const needsMonthRange = category === "women-health";

  const submit = useCallback(async () => {
    setErr(null);
    if (!title.trim()) { setErr("শিরোনাম লিখুন।"); return; }
    if (!body.trim()) { setErr("লেখার মূল অংশ (body) লিখুন।"); return; }
    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    const ageRangeYears = needsAgeRange && ageMin.trim() && ageMax.trim() ? [Number(ageMin), Number(ageMax)] : null;
    const pregnancyMonthRange = needsMonthRange && monthMin.trim() && monthMax.trim() ? [Number(monthMin), Number(monthMax)] : null;
    const fields = { category, title, summary, body, tags, ageRangeYears, pregnancyMonthRange, sourceNote };
    setBusy(true);
    try {
      if (isEdit) {
        await updateWellnessGuide(editingPost.id, fields);
      } else {
        await createWellnessGuide(familyId, fields);
        setTitle(""); setSummary(""); setBody(""); setTagsText("");
        setAgeMin(""); setAgeMax(""); setMonthMin(""); setMonthMax(""); setSourceNote("");
      }
      onSaved();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "শুধু Admin নতুন পোস্ট যোগ/এডিট করতে পারবেন।" : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, category, title, summary, body, tagsText, ageMin, ageMax, monthMin, monthMax, sourceNote, needsAgeRange, needsMonthRange, isEdit, editingPost, onSaved]);

  return React.createElement(
    "div", { style: { marginTop: "10px", padding: "12px", border: "1px solid #CBD5E1", borderRadius: "8px", background: isEdit ? "#FFFBEB" : "#F9FBFA" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 6px" } }, isEdit ? "পোস্ট এডিট করুন" : "নতুন লেখা যোগ করুন"),
    SelectField("ক্যাটেগরি", category, setCategory, WELLNESS_CATEGORIES),
    TextField("শিরোনাম", title, setTitle, "যেমন: গর্ভাবস্থার ৩য় মাসের পুষ্টি"),
    needsAgeRange && React.createElement(
      "div", { style: { display: "flex", gap: "8px" } },
      TextField("বয়স থেকে (বছর)", ageMin, setAgeMin, "যেমন: 1"),
      TextField("বয়স পর্যন্ত (বছর)", ageMax, setAgeMax, "যেমন: 3")
    ),
    needsMonthRange && React.createElement(
      "div", { style: { display: "flex", gap: "8px" } },
      TextField("মাস থেকে (১-৯)", monthMin, setMonthMin, "যেমন: 3"),
      TextField("মাস পর্যন্ত (১-৯)", monthMax, setMonthMax, "যেমন: 3")
    ),
    TextField("সংক্ষিপ্ত সারাংশ (ঐচ্ছিক)", summary, setSummary, "লিস্টে ছোট করে দেখাবে"),
    TextAreaField("মূল লেখা (Body)", body, setBody, "এখানে পূর্ণ ব্লগ-কন্টেন্ট লিখুন..."),
    TextField("ট্যাগ (কমা দিয়ে আলাদা, ঐচ্ছিক)", tagsText, setTagsText, "যেমন: diabetes, prevention"),
    TextField("সোর্স/রেফারেন্স নোট (ঐচ্ছিক)", sourceNote, setSourceNote, "যেমন: WHO, NHS ইত্যাদি"),
    err && ErrorBox(err),
    PrimaryButton(isEdit ? "Update করুন" : "প্রকাশ করুন", submit, busy),
    isEdit && SecondaryButton("বাতিল", onCancel, busy)
  );
}
