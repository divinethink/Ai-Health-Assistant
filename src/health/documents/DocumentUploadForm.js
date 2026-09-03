// Document upload form — Roadmap §7। shared/ui.js primitives + healthRecords-এর
// ফর্ম-প্যাটার্ন reuse (state/logic component-এই, presentational callback দিয়ে
// parent-কে জানায়, Process Rule ১১)।

import { SelectField, DateField, ErrorBox, PrimaryButton } from "../../shared/ui.js";
import { uploadDocument, DOC_TYPE_LABELS, validateFile } from "./documentsData.js";

const { useState, useCallback, useRef } = React;

export function DocumentUploadForm({ familyId, targetMemberId, callerMemberId, onUploaded }) {
  const [docType, setDocType] = useState("prescription");
  const [date, setDate] = useState("");
  const [source, setSource] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileInputRef = useRef(null);

  const onFileChange = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    setErr(null);
    if (f) {
      const v = validateFile(f);
      if (v) { setErr(v); setFile(null); return; }
    }
    setFile(f || null);
  }, []);

  const submit = useCallback(async () => {
    setErr(null);
    if (!file) { setErr("একটা ফাইল বেছে নিন।"); return; }
    setBusy(true);
    try {
      await uploadDocument(familyId, targetMemberId, callerMemberId, file, { docType, date, source });
      setFile(null);
      setDate("");
      setSource("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded && onUploaded();
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? "এই সদস্যের জন্য Document আপলোড করার অনুমতি আপনার নেই।"
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, file, docType, date, source, onUploaded]);

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #CBD5E1", borderRadius: "8px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "নতুন Document/Report যোগ করুন"),
    React.createElement("p", { style: { fontSize: "12px", color: "#888", margin: "4px 0" } }, "ছবি বা PDF — আসল ফাইলই সংরক্ষিত হবে (পরে সম্পূর্ণ ডাউনলোড করা যাবে)।"),
    SelectField("ধরন", docType, setDocType, Object.entries(DOC_TYPE_LABELS).map(([v, l]) => [v, l])),
    DateField("তারিখ (ঐচ্ছিক)", date, setDate),
    React.createElement(
      "div", { style: { marginTop: "8px" } },
      React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "উৎস (ঐচ্ছিক, যেমন: ল্যাবের নাম)"),
      React.createElement("input", {
        type: "text", value: source, onChange: (e) => setSource(e.target.value),
        style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
      })
    ),
    React.createElement(
      "div", { style: { marginTop: "8px" } },
      React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, "ফাইল (ছবি/PDF, সর্বোচ্চ 20MB)"),
      React.createElement("input", {
        ref: fileInputRef, type: "file", accept: "image/*,application/pdf", onChange: onFileChange,
        style: { fontSize: "13px" },
      })
    ),
    err && ErrorBox(err),
    PrimaryButton("Upload করুন", submit, busy)
  );
}
