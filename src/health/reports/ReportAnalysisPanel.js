// src/health/reports/ReportAnalysisPanel.js
//
// P5 — Report Intelligence — end-to-end entry point (Roadmap §8 পাইপলাইনের
// প্রথম কয়েকটা ধাপ একত্রে wire করা): file বেছে নেওয়া → text-layer detect →
// (দরকার হলে) client-side OCR → rule-based parse+validate →
// ReportVerificationForm (মাধ্যমিক, বাধ্যতামূলক user-verification)।
//
// **স্বতন্ত্র entry-point (existing Document Upload থেকে ইচ্ছাকৃতভাবে আলাদা):**
// এই panel document-vault-এ কিছু upload করে না (Cloudinary/DocumentUploadForm
// সম্পূর্ণ অপরিবর্তিত, zero-risk) — শুধু in-memory file বিশ্লেষণ করে ও
// ব্যবহারকারী-verified value HealthRecord (Observation) হিসেবে save করে।
// ব্যবহারকারী চাইলে একই ফাইল আলাদাভাবে উপরের Document Upload ফর্মেও (raw-file
// সংরক্ষণের জন্য) আপলোড করতে পারবেন — দুই স্বতন্ত্র উদ্দেশ্য (raw-vault vs
// analyzed-values), তাই আপাতত দুটো আলাদা file-picker (future simplification
// হিসেবে একত্রীকরণ সম্ভব, এই মুহূর্তে minimal-risk অগ্রাধিকার)।
//
// হাতে-লেখা report roadmap §8 অনুযায়ী OCR-এ যাওয়ার কথা না (manual-entry-এ
// routing দরকার) — এই মুহূর্তে automatic handwriting-detection নেই, তাই শুধু
// সতর্কবার্তা দেখানো হচ্ছে; ভুল/অনির্ভরযোগ্য OCR-value ধরার দায়িত্ব পরের ধাপ
// (mandatory verification + needs-review flag)-এর উপর।

import { ErrorBox, SecondaryButton } from "../../shared/ui.js";
import { extractPdfText } from "./pdfTextExtraction.js";
import { ocrImageFile, ocrPdfPages } from "./ocrExtraction.js";
import { fetchTestNameDictionary } from "./testDictionaryData.js";
import { parseAndValidateReportText } from "./reportParsing.js";
import { ReportVerificationForm } from "./ReportVerificationForm.js";
import { ManualReportEntryForm } from "./ManualReportEntryForm.js";

const { useState, useCallback, useRef } = React;

export function ReportAnalysisPanel({ familyId, targetMemberId, callerMemberId }) {
  const [handwrittenMode, setHandwrittenMode] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(""); // "" | "extracting" | "ocr" | "parsing" | "done"
  const [err, setErr] = useState(null);
  const [candidates, setCandidates] = useState(null);
  const [extractionMethod, setExtractionMethod] = useState(null);
  const fileInputRef = useRef(null);

  const onFileChange = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    setErr(null);
    setCandidates(null);
    setFile(f || null);
  }, []);

  const analyze = useCallback(async () => {
    if (!file) { setErr("একটা ছবি বা PDF ফাইল বেছে নিন।"); return; }
    setErr(null);
    setCandidates(null);
    setBusy(true);
    setProgress(0);
    try {
      let rawText = "";
      let method = "ocr";

      if (file.type === "application/pdf") {
        setStage("extracting");
        const { hasTextLayer, text } = await extractPdfText(file);
        if (hasTextLayer) {
          rawText = text;
          method = "direct-text";
        } else {
          setStage("ocr");
          const ocrResult = await ocrPdfPages(file, setProgress);
          rawText = ocrResult.text;
          method = "ocr";
        }
      } else if (file.type && file.type.startsWith("image/")) {
        setStage("ocr");
        const ocrResult = await ocrImageFile(file, setProgress);
        rawText = ocrResult.text;
        method = "ocr";
      } else {
        setErr("শুধু ছবি (jpg/png) বা PDF সমর্থিত।");
        setBusy(false);
        setStage("");
        return;
      }

      setStage("parsing");
      const dict = await fetchTestNameDictionary();
      const parsed = parseAndValidateReportText(rawText, dict);
      setCandidates(parsed);
      setExtractionMethod(method);
      setStage("done");
    } catch (e) {
      setErr(e.message || String(e));
      setStage("");
    } finally {
      setBusy(false);
    }
  }, [file]);

  const stageLabels = {
    extracting: "PDF থেকে text পড়া হচ্ছে...",
    ocr: "OCR চলছে... (" + Math.round(progress * 100) + "%)",
    parsing: "টেস্ট-মান শনাক্ত করা হচ্ছে...",
  };
  const busyLabel = stageLabels[stage] || "চলছে...";

  if (handwrittenMode) {
    return React.createElement(
      "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #CBD5E1", borderRadius: "8px" } },
      React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "হাতে-লেখা রিপোর্ট — সরাসরি লিখুন"),
      SecondaryButton("← OCR/AI বিশ্লেষণে ফিরে যান", () => setHandwrittenMode(false), false),
      React.createElement(ManualReportEntryForm, { familyId, targetMemberId, callerMemberId, onSaved: () => {} })
    );
  }

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #CBD5E1", borderRadius: "8px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "রিপোর্ট বিশ্লেষণ করুন (AI/OCR)"),
    React.createElement("p", { style: { fontSize: "12px", color: "#888", margin: "4px 0" } },
      "ল্যাব-রিপোর্টের ছবি বা PDF দিন — টেস্টের মান স্বয়ংক্রিয়ভাবে শনাক্ত করার চেষ্টা করা হবে (পরের ধাপে আপনাকে যাচাই করতে হবে)।"
    ),
    React.createElement("input", {
      ref: fileInputRef, type: "file", accept: "image/*,application/pdf", onChange: onFileChange,
      style: { fontSize: "13px" },
    }),
    SecondaryButton(busy ? busyLabel : "বিশ্লেষণ করুন", analyze, busy),
    SecondaryButton("এটা হাতে-লেখা রিপোর্ট? সরাসরি লিখুন", () => setHandwrittenMode(true), false),
    err ? ErrorBox(err) : null,
    candidates
      ? React.createElement(ReportVerificationForm, {
          familyId, targetMemberId, callerMemberId, candidates, extractionMethod,
          onSaved: () => setCandidates(null),
        })
      : null
  );
}
