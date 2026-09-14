// Wellness Guide — Admin-only Add/Edit ফর্ম।
// HealthRecordForm.js-এর edit-mode pattern reuse (editingPost দিলে prefill+update)।
//
// আপডেট (owner-request, ২০২৬-০৯-১৩): আলাদা "সংক্ষিপ্ত সারাংশ" ফিল্ড বাদ —
// এর বদলে WordPress-এর "Insert More Tag"-এর মতো, লেখক নিজেই মূল লেখার (body)
// যেখানে প্রিভিউ শেষ করতে চান সেখানে `[MORE]` টাইপ করবেন — সেই বিন্দু পর্যন্ত
// প্রিভিউ + "আরো পড়ুন" দেখাবে (রেন্ডারিং-লজিক WellnessGuideSection.js-এ)।

import { TextField, SelectField, ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { createWellnessGuide, updateWellnessGuide, WELLNESS_CATEGORIES } from "./wellnessGuideData.js";

const { useState, useEffect, useCallback } = React;

function TextAreaField(label, value, onChange, placeholder) {
  return React.createElement(
    "div", { style: { marginBottom: "8px" } },
    React.createElement("label", { style: { fontSize: "12px", color: "#555", display: "block", marginBottom: "2px" } }, label),
    React.createElement("textarea", {
      value, placeholder, onChange: (e) => onChange(e.target.value), rows: 8,
      style: { width: "100%", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontFamily: "inherit", fontSize: "13px", boxSizing: "border-box" },
    })
  );
}

export function WellnessGuideForm({ familyId, editingPost, onSaved, onCancel }) {
  const isEdit = !!editingPost;
  const [category, setCategory] = useState(editingPost ? editingPost.category : WELLNESS_CATEGORIES[0][0]);
  const [title, setTitle] = useState("");
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
    // summary আর পাঠানো হচ্ছে না (নতুন marker-based read-more, নিচের নোট দ্রষ্টব্য) —
    // data-layer (wellnessGuideData.js) নিজেই undefined-কে "" হিসেবে সামলে নেয়।
    const fields = { category, title, body, tags, ageRangeYears, pregnancyMonthRange, sourceNote };
    setBusy(true);
    try {
      if (isEdit) {
        await updateWellnessGuide(editingPost.id, fields);
      } else {
        await createWellnessGuide(familyId, fields);
        setTitle(""); setBody(""); setTagsText("");
        setAgeMin(""); setAgeMax(""); setMonthMin(""); setMonthMax(""); setSourceNote("");
      }
      onSaved();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "শুধু Admin নতুন পোস্ট যোগ/এডিট করতে পারবেন।" : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, category, title, body, tagsText, ageMin, ageMax, monthMin, monthMax, sourceNote, needsAgeRange, needsMonthRange, isEdit, editingPost, onSaved]);

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
    React.createElement(
      "p", { style: { fontSize: "11px", color: "#888", margin: "6px 0" } },
      "প্রিভিউ কতটুকু দেখাবে তা ঠিক করতে, নিচের লেখায় যেখানে কাটতে চান সেখানে ঠিক এই শব্দটা বসান: ",
      React.createElement("b", { style: { color: "#0E4B43" } }, "[MORE]"),
      " — এর আগে পর্যন্ত অংশ প্রিভিউ হিসেবে দেখাবে, বাকিটা \"আরো পড়ুন\"-এ ক্লিক করলে দেখা যাবে। না বসালে পুরো লেখা ক্লিকেই দেখাবে।"
    ),
    TextAreaField("মূল লেখা (Body)", body, setBody, "এখানে পূর্ণ ব্লগ-কন্টেন্ট লিখুন...\n\nপ্রিভিউ শেষ করতে চাইলে এখানে বসান: [MORE]"),
    TextField("ট্যাগ (কমা দিয়ে আলাদা, ঐচ্ছিক)", tagsText, setTagsText, "যেমন: diabetes, prevention"),
    TextField("সোর্স/রেফারেন্স নোট (ঐচ্ছিক)", sourceNote, setSourceNote, "যেমন: WHO, NHS ইত্যাদি"),
    err && ErrorBox(err),
    PrimaryButton(isEdit ? "Update করুন" : "প্রকাশ করুন", submit, busy),
    isEdit && SecondaryButton("বাতিল", onCancel, busy)
  );
}
