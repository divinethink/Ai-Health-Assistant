// Document upload form — Roadmap §7। shared/ui.js primitives + healthRecords-এর
// ফর্ম-প্যাটার্ন reuse (state/logic component-এই, presentational callback দিয়ে
// parent-কে জানায়, Process Rule ১১)।

import { SelectField, DateField, ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { localISO } from "../../shared/dates.js";
import { uploadDocument, DOC_TYPE_LABELS, validateFile } from "./documentsData.js";

const { useState, useCallback, useRef } = React;

// একীভূত ফ্লো: ফাইল একবারই বাছা হয়। "সংরক্ষণ" = শুধু vault; "সংরক্ষণ + বিশ্লেষণ"
// = আগে vault-এ আপলোড, সফল হলে `onAnalyze(file)` দিয়ে parent বিশ্লেষণ-ধাপ খোলে
// (আপলোড ব্যর্থ হলে বিশ্লেষণ শুরু হয় না, ফাইলও হারায় না)।
export function DocumentUploadForm({ familyId, targetMemberId, callerMemberId, onUploaded, onAnalyze, onManual, onPrescription }) {
  const [docType, setDocType] = useState("prescription");
  const [date, setDate] = useState(() => localISO());
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

  const submit = useCallback(async (andAnalyze) => {
    setErr(null);
    if (!file) { setErr("একটা ফাইল বেছে নিন।"); return; }
    setBusy(true);
    try {
      await uploadDocument(familyId, targetMemberId, callerMemberId, file, { docType, date, source });
      const uploadedFile = file;
      setFile(null);
      setSource("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded && onUploaded();
      if (andAnalyze === "rx" && onPrescription) onPrescription(uploadedFile);
      else if (andAnalyze && onAnalyze) onAnalyze(uploadedFile);
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? "এই সদস্যের জন্য নথি আপলোড করার অনুমতি আপনার নেই।"
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, file, docType, date, source, onUploaded, onAnalyze, onPrescription]);

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" } },
    React.createElement("p", { style: { fontSize: "14px", color: "#5F716C", margin: "0 0 4px" } }, "ছবি বা PDF — আসল ফাইলই সংরক্ষিত হবে (পরে সম্পূর্ণ ডাউনলোড করা যাবে)।"),
    SelectField("ধরন", docType, setDocType, Object.entries(DOC_TYPE_LABELS).map(([v, l]) => [v, l])),
    DateField("তারিখ (ঐচ্ছিক)", date, setDate),
    React.createElement(
      "div", { style: { marginTop: "8px" } },
      React.createElement("label", { style: { fontSize: "14px", color: "#1F2D2A", display: "block", marginBottom: "4px" } }, "উৎস (ঐচ্ছিক, যেমন: ল্যাবের নাম)"),
      React.createElement("input", {
        type: "text", value: source, onChange: (e) => setSource(e.target.value),
        style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #D3E0D9", borderRadius: "10px", fontSize: "14px" },
      })
    ),
    React.createElement(
      "div", { style: { marginTop: "8px" } },
      React.createElement("label", { style: { fontSize: "14px", color: "#1F2D2A", display: "block", marginBottom: "4px" } }, "ফাইল (ছবি/PDF, সর্বোচ্চ 20MB)"),
      React.createElement("input", {
        ref: fileInputRef, type: "file", accept: "image/*,application/pdf", onChange: onFileChange,
        style: { fontSize: "14px" },
      })
    ),
    file && React.createElement("div", { style: { marginTop: "8px", fontSize: "14px", color: "#0E4B43", fontWeight: 600 } }, "📄 " + file.name),
    err && ErrorBox(err),
    docType === "prescription" && onPrescription
      ? React.createElement(React.Fragment, null,
          PrimaryButton("সংরক্ষণ + ওষুধ শনাক্ত", () => submit("rx"), busy),
          SecondaryButton("শুধু সংরক্ষণ", () => submit(false), busy))
    : docType === "lab-report" && onAnalyze
      ? React.createElement(React.Fragment, null,
          PrimaryButton("সংরক্ষণ + AI/OCR বিশ্লেষণ", () => submit(true), busy),
          SecondaryButton("শুধু সংরক্ষণ", () => submit(false), busy))
      : React.createElement(React.Fragment, null,
          PrimaryButton("সংরক্ষণ করুন", () => submit(false), busy),
          onAnalyze && SecondaryButton("সংরক্ষণ + AI/OCR বিশ্লেষণ", () => submit(true), busy)),
    onManual && SecondaryButton("✍️ হাতে-লেখা রিপোর্ট? সরাসরি লিখুন", onManual, false)
  );
}
