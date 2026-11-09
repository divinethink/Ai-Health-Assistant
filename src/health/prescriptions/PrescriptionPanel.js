// src/health/prescriptions/PrescriptionPanel.js
//
// ধাপ ৬ — নথি আপলোডে ধরন "প্রেসক্রিপশন" + "সংরক্ষণ + ঔষধ শনাক্ত" চাপলে খোলে (ফাইল আগেই vault-এ সংরক্ষিত)।
// PDF-এ text থাকলে সরাসরি, নইলে ধাপ ৪-এর OCR → নিয়মভিত্তিক পার্স (prescriptionParsing.js, AI নেই)
// → PrescriptionReviewForm। হাতের লেখা/ঝাপসা ছবিতে নরম সতর্কতা (থামায় না); কিছু শনাক্ত না হলে
// OCR-এর পড়া টেক্সট দেখায় ও হাতে যোগের পথ বলে।

import { ErrorBox, SecondaryButton } from "../../shared/ui.js";
import { extractPdfText } from "../reports/pdfTextExtraction.js";
import { ocrImageFile, ocrPdfPages } from "../reports/ocrExtraction.js";
import { assessOcr, QUALITY_MESSAGES } from "../reports/ocrQuality.js";
import { parsePrescriptionText } from "./prescriptionParsing.js";
import { loadPrescriptionContext } from "./prescriptionData.js";
import { PrescriptionReviewForm } from "./PrescriptionReviewForm.js";

const { useState, useEffect, useCallback } = React;
const h = React.createElement;
const note = (bg, color, text) => h("div", { style: { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", background: bg, color, fontSize: "14px", lineHeight: 1.5 } }, text);

export function PrescriptionPanel({ familyId, targetMemberId, callerMemberId, file, onDone }) {
  const [stage, setStage] = useState("extracting"); // extracting | ocr | parsing | done | error
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);
  const [res, setRes] = useState(null); // { items, ctx, notes, ocrPercent, text }

  const run = useCallback(async () => {
    setErr(null); setRes(null); setStage("extracting"); setProgress(0);
    try {
      let text = "", ocr = null;
      if (file.type === "application/pdf") {
        const pdf = await extractPdfText(file);
        if (pdf.hasTextLayer) text = pdf.text;
        else { setStage("ocr"); ocr = await ocrPdfPages(file, setProgress); text = ocr.text; }
      } else if (file.type && file.type.startsWith("image/")) {
        setStage("ocr"); ocr = await ocrImageFile(file, setProgress); text = ocr.text;
      } else { throw new Error("শুধু ছবি (jpg/png) বা PDF সমর্থিত।"); }
      setStage("parsing");
      const items = parsePrescriptionText(text);
      const ctx = await loadPrescriptionContext(familyId, targetMemberId);
      const notes = [];
      if (ocr) {
        if (ocr.quality.reasons.length > 0) notes.push(["#FFF6E5", "#8A5A00", "📷 " + ocr.quality.reasons.map((r) => QUALITY_MESSAGES[r]).join(", ") + " — আলোতে, সোজা করে আরেকবার তুললে ভালো পড়া যাবে।"]);
        if (assessOcr({ confidence: ocr.confidence, matchedCount: items.length, textLength: text.length }).suspectHandwriting) {
          notes.push(["#FFF6E5", "#8A5A00", "✍️ এটা হাতে-লেখা হতে পারে — মেশিন ঠিকভাবে পড়তে পারে না। নিচের মান নিজে মিলিয়ে ঠিক করুন, বা স্বাস্থ্য তথ্য → প্রেসক্রিপশন/রিপোর্ট-এ হাতে লিখে যোগ করুন।"]);
        }
      }
      setRes({ items, ctx, notes, ocrPercent: ocr ? Math.round(ocr.confidence) : null, text });
      setStage("done");
    } catch (e) { setErr(e.message || String(e)); setStage("error"); }
  }, [file, familyId, targetMemberId]);

  useEffect(() => { run(); }, []); // শুধু mount-এ একবার; ব্যর্থ হলে "আবার চেষ্টা"

  if (stage === "error") return h("div", null, ErrorBox(err), SecondaryButton("আবার চেষ্টা করুন", run, false));
  if (stage !== "done" || !res) {
    const label = { extracting: "ফাইল পড়া হচ্ছে...", ocr: "OCR চলছে... (" + Math.round(progress * 100) + "%)", parsing: "ওষুধ শনাক্ত করা হচ্ছে..." }[stage];
    return h("p", { role: "status", style: { fontSize: "14px", color: "#5F716C", margin: "12px 0" } }, "📄 " + file.name + " — " + label);
  }
  return h("div", null,
    res.notes.map(([bg, c, t], i) => h("div", { key: i }, note(bg, c, t))),
    res.items.length === 0
      ? h("div", null,
          note("#FFF6E5", "#8A5A00", "কোনো ওষুধ শনাক্ত করা যায়নি। স্বাস্থ্য তথ্য → প্রেসক্রিপশন/রিপোর্ট-এ হাতে যোগ করুন।"),
          res.text.trim() && h("details", { style: { marginTop: "8px", fontSize: "13px", color: "#5F716C" } }, h("summary", { style: { minHeight: "44px", display: "flex", alignItems: "center", cursor: "pointer" } }, "মেশিন যা পড়েছে দেখুন"), h("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, res.text)))
      : h(PrescriptionReviewForm, { familyId, targetMemberId, callerMemberId, items: res.items, allergies: res.ctx.allergies, records: res.ctx.records, ocrPercent: res.ocrPercent, onDone }));
}
