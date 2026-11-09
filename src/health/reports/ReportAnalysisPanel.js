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
// হাতে-লেখা report roadmap §8 অনুযায়ী OCR-এ যাওয়ার কথা না। ধাপ ৪: কম আত্মবিশ্বাস +
// কম নাম-মিল হলে "হাতের লেখা হতে পারে" নরম পরামর্শ ও ম্যানুয়াল ফর্মের বাটন দেখানো হয়;
// ঝাপসা/অন্ধকার ছবিতে "আরেকবার তুলুন"; ডোজ-প্যাটার্নের O/0-গোলমাল শুধু হাইলাইট
// (চুপচাপ ঠিক করা হয় না)। চূড়ান্ত যাচাই আগের মতোই mandatory user-verification-এ।

import { ErrorBox, SuccessBox, SecondaryButton } from "../../shared/ui.js";
import { extractPdfText } from "./pdfTextExtraction.js";
import { ocrImageFile, ocrPdfPages } from "./ocrExtraction.js";
import { assessOcr, findDoseConfusions, QUALITY_MESSAGES } from "./ocrQuality.js";
import { fetchTestNameDictionary } from "./testDictionaryData.js";
import { parseAndValidateReportText } from "./reportParsing.js";
import { ReportVerificationForm } from "./ReportVerificationForm.js";
import { ManualReportEntryForm } from "./ManualReportEntryForm.js";

const { useState, useCallback, useRef, useEffect } = React;

// নথিপত্র-ট্যাবের একীভূত ফ্লো: `presetFile` দিলে নিজস্ব file-picker লুকানো থাকে ও
// mount-এ স্বয়ংক্রিয় বিশ্লেষণ শুরু হয় (ফাইল আগেই vault-এ সংরক্ষিত)। `initialManual`
// হলে সরাসরি হাতে-লেখা ফর্মে খোলে। দুটোই ঐচ্ছিক — না দিলে আগের আচরণই বহাল।
// OCR-নোট: নরম সতর্কতা (থামায় না) — ছবির মান, হাতের লেখার সন্দেহ, ডোজ-প্যাটার্নের O/0-সন্দেহ
function ocrNotesView(n, openManual) {
  const note = (bg, color, children) => React.createElement("div", { style: { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", background: bg, color, fontSize: "14px", lineHeight: 1.5 } }, children);
  const items = [];
  if (n.qualityReasons.length > 0) {
    items.push(note("#FFF6E5", "#8A5A00", "📷 " + n.qualityReasons.map((r) => QUALITY_MESSAGES[r]).join(", ") + " — আলোতে, সোজা করে আরেকবার তুললে ভালো পড়া যাবে।"));
  }
  if (n.suspectHandwriting) {
    items.push(note("#FFF6E5", "#8A5A00", React.createElement(React.Fragment, null,
      "✍️ এটা হাতে-লেখা হতে পারে — মেশিন ঠিকভাবে পড়তে পারে না। হাতে লিখে এন্ট্রি দেওয়াই নিরাপদ।",
      React.createElement("button", { onClick: openManual, style: { display: "block", width: "100%", minHeight: "44px", marginTop: "8px", borderRadius: "12px", border: "1px solid #8A5A00", background: "#fff", color: "#8A5A00", fontSize: "14px", fontWeight: 600, cursor: "pointer" } }, "✍️ সরাসরি লিখুন"))));
  }
  if (n.confusions.length > 0) {
    items.push(note("#FDF0EE", "#7A1F14", React.createElement(React.Fragment, null,
      "⚠️ ডোজে অক্ষর-ডিজিট গোলমাল হতে পারে — নিজে মিলিয়ে নিন (অ্যাপ নিজে বদলায়নি):",
      n.confusions.map((c, i) => React.createElement("div", { key: i, style: { marginTop: "4px" } }, React.createElement("mark", { style: { background: "#FFE08A", padding: "0 4px", borderRadius: "4px" } }, c.raw), " → \"" + c.suggestion + "\" হতে পারে")))));
  }
  return items.length > 0 ? React.createElement(React.Fragment, null, items.map((x, i) => React.cloneElement(x, { key: i }))) : null;
}

export function ReportAnalysisPanel({ familyId, targetMemberId, callerMemberId, presetFile, initialManual }) {
  const [handwrittenMode, setHandwrittenMode] = useState(!!initialManual);
  const [file, setFile] = useState(presetFile || null);
  const [savedCount, setSavedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(""); // "" | "extracting" | "ocr" | "parsing" | "done"
  const [err, setErr] = useState(null);
  const [candidates, setCandidates] = useState(null);
  const [extractionMethod, setExtractionMethod] = useState(null);
  const [ocrNotes, setOcrNotes] = useState(null); // { qualityReasons, suspectHandwriting, confusions } — শুধু OCR হলে
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
    setOcrNotes(null);
    setBusy(true);
    setProgress(0);
    try {
      let rawText = "";
      let method = "ocr";
      let ocrResult = null;
      // dictionary আগে আনা হয় — OCR-এর দ্বিতীয়-চেষ্টায় "কয়টা টেস্ট-নাম মিলল" গোনার জন্য
      const dict = await fetchTestNameDictionary();
      const scoreText = (txt) => parseAndValidateReportText(txt, dict).length;

      if (file.type === "application/pdf") {
        setStage("extracting");
        const { hasTextLayer, text } = await extractPdfText(file);
        if (hasTextLayer) {
          rawText = text;
          method = "direct-text";
        } else {
          setStage("ocr");
          ocrResult = await ocrPdfPages(file, setProgress, { scoreText });
          rawText = ocrResult.text;
          method = "ocr";
        }
      } else if (file.type && file.type.startsWith("image/")) {
        setStage("ocr");
        ocrResult = await ocrImageFile(file, setProgress, { scoreText });
        rawText = ocrResult.text;
        method = "ocr";
      } else {
        setErr("শুধু ছবি (jpg/png) বা PDF সমর্থিত।");
        setBusy(false);
        setStage("");
        return;
      }

      setStage("parsing");
      const parsed = parseAndValidateReportText(rawText, dict);
      if (ocrResult) {
        const a = assessOcr({ confidence: ocrResult.confidence, matchedCount: parsed.length, textLength: rawText.length });
        setOcrNotes({ qualityReasons: ocrResult.quality.reasons, suspectHandwriting: a.suspectHandwriting, confusions: findDoseConfusions(rawText) });
      }
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

  useEffect(() => {
    if (presetFile) analyze();
    // শুধু mount-এ একবার
  }, []);

  const stageLabels = {
    extracting: "PDF থেকে text পড়া হচ্ছে...",
    ocr: "OCR চলছে... (" + Math.round(progress * 100) + "%)",
    parsing: "টেস্ট-মান শনাক্ত করা হচ্ছে...",
  };
  const busyLabel = stageLabels[stage] || "চলছে...";

  if (handwrittenMode) {
    return React.createElement(
      "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" } },
      React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "হাতে-লেখা রিপোর্ট — সরাসরি লিখুন"),
      SecondaryButton("← OCR/AI বিশ্লেষণে ফিরে যান", () => setHandwrittenMode(false), false),
      React.createElement(ManualReportEntryForm, { familyId, targetMemberId, callerMemberId, onSaved: () => {} })
    );
  }

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "রিপোর্ট বিশ্লেষণ করুন (AI/OCR)"),
    React.createElement("p", { style: { fontSize: "14px", color: "#5F716C", margin: "4px 0" } },
      "ল্যাব-রিপোর্টের ছবি বা PDF দিন — টেস্টের মান স্বয়ংক্রিয়ভাবে শনাক্ত করার চেষ্টা করা হবে (পরের ধাপে আপনাকে যাচাই করতে হবে)।"
    ),
    presetFile
      ? React.createElement("div", { style: { fontSize: "14px", color: "#0E4B43", fontWeight: 600, margin: "6px 0" } }, "📄 " + presetFile.name)
      : React.createElement("input", {
          ref: fileInputRef, type: "file", accept: "image/*,application/pdf", onChange: onFileChange,
          style: { fontSize: "14px" },
        }),
    SecondaryButton(busy ? busyLabel : (presetFile ? "আবার বিশ্লেষণ করুন" : "বিশ্লেষণ করুন"), analyze, busy),
    SecondaryButton("এটা হাতে-লেখা রিপোর্ট? সরাসরি লিখুন", () => setHandwrittenMode(true), false),
    err ? ErrorBox(err) : null,
    ocrNotes && ocrNotesView(ocrNotes, () => setHandwrittenMode(true)),
    candidates
      ? React.createElement(ReportVerificationForm, {
          familyId, targetMemberId, callerMemberId, candidates, extractionMethod,
          onSaved: (n) => { setCandidates(null); setSavedCount(n || 0); },
        })
      : null,
    savedCount > 0 ? SuccessBox(savedCount + "টা মান সংরক্ষণ করা হয়েছে।") : null
  );
}
