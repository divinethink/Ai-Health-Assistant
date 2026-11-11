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
import { StepIndicator } from "./StepIndicator.js";
import { PrescriptionSavedScreen } from "./PrescriptionSavedScreen.js";
import { PrescriptionNextSteps } from "../nextstep/NextStepCard.js";
import { extractFollowUpDate } from "../nextstep/nextStepCalc.js";
import { localISO } from "../../shared/dates.js";
import { AiAssistBar } from "../doc-ai/AiAssistBar.js";
import { shouldTryAi, mergeMedicines } from "../doc-ai/aiAdapters.js";

const { useState, useEffect, useCallback } = React;
const h = React.createElement;
const note = (bg, color, text) => h("div", { style: { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", background: bg, color, fontSize: "14px", lineHeight: 1.5 } }, text);

export function PrescriptionPanel({ familyId, targetMemberId, callerMemberId, file, preOcr, onDone, onClose, closeLabel }) {
  const [stage, setStage] = useState("extracting"); // extracting | ocr | parsing | done | error
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);
  const [res, setRes] = useState(null); // { items, ctx, notes, ocrPercent, text, followUp }
  const [saved, setSaved] = useState(null); // সংরক্ষণের পর { res, finals } — "এরপর কী?" কার্ডের জন্য

  const run = useCallback(async () => {
    setErr(null); setRes(null); setSaved(null); setStage("extracting"); setProgress(0);
    try {
      let text = "", ocr = null;
      if (preOcr) { text = preOcr.text; ocr = preOcr.ocr; } // ধাপ ৪-ঙ: আপলোডে আগেই পড়া — দুবার OCR নয়
      else if (file.type === "application/pdf") {
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
      let suspectHandwriting = false;
      if (ocr) {
        if (ocr.quality.reasons.length > 0) notes.push(["#FFF6E5", "#8A5A00", "📷 " + ocr.quality.reasons.map((r) => QUALITY_MESSAGES[r]).join(", ") + " — আলোতে, সোজা করে আরেকবার তুললে ভালো পড়া যাবে।"]);
        suspectHandwriting = assessOcr({ confidence: ocr.confidence, matchedCount: items.length, textLength: text.length }).suspectHandwriting;
        if (suspectHandwriting) {
          notes.push(["#FFF6E5", "#8A5A00", "✍️ এটা হাতে-লেখা হতে পারে — মেশিন ঠিকভাবে পড়তে পারে না। নিচের মান নিজে মিলিয়ে ঠিক করুন, বা স্বাস্থ্য প্রোফাইল → ওষুধ অংশে হাতে লিখে যোগ করুন।"]);
        }
      }
      setRes({ items, ctx, notes, ocrPercent: ocr ? Math.round(ocr.confidence) : null, text, followUp: extractFollowUpDate(text, localISO()),
        aiWanted: shouldTryAi("prescription", { text, itemsCount: items.length, suspectHandwriting }) }); // ধাপ ৪-ঘ
      setStage("done");
    } catch (e) { setErr(e.message || String(e)); setStage("error"); }
  }, [file, preOcr, familyId, targetMemberId]);

  useEffect(() => { run(); }, []); // শুধু mount-এ একবার; ব্যর্থ হলে "আবার চেষ্টা"

  // ধাপ ৪-ঘ: AI-র ফল শুধু প্রস্তাব — বিদ্যমান ভুক্তি অক্ষত, নতুন/খালি ঘরে হলুদ ট্যাগসহ; সেভ নয়
  const onAiSettled = useCallback(({ result, message }) => {
    setRes((r) => {
      if (!r) return r;
      const next = { ...r, aiWanted: false, notes: [...r.notes] };
      if (result && !result.empty) {
        const m = mergeMedicines(r.items, result.items, r.text);
        next.items = m.items;
        next.notes.push(["#FFF8E1", "#8A5A00", "🤖 AI " + (m.added ? m.added + "টি ওষুধ যোগ" : "") + (m.added && m.filledCells ? " ও " : "") + (m.filledCells ? m.filledCells + "টি খালি ঘর পূরণ" : "") + (m.added || m.filledCells ? " করেছে — হলুদ চিহ্নিত অংশ নিজে মিলিয়ে নিন।" : "-ও নতুন কিছু পায়নি।")]);
      } else if (message) next.notes.push(["#F7F6F1", "#4B5C57", "ℹ️ " + message]);
      return next;
    });
  }, []);

  const savedOk = !!(saved && saved.res.saved.length > 0); // কিছু সংরক্ষিত হলেই ৩/৩ স্ক্রিন
  const step = savedOk ? 3 : (stage === "done" ? 2 : 1);
  const bar = h(StepIndicator, { step });
  if (stage === "error") return h("div", null, bar, ErrorBox(err), SecondaryButton("আবার চেষ্টা করুন", run, false));
  if (stage !== "done" || !res) {
    const label = { extracting: "ফাইল পড়া হচ্ছে...", ocr: "OCR চলছে... (" + Math.round(progress * 100) + "%)", parsing: "ওষুধ শনাক্ত করা হচ্ছে..." }[stage];
    return h("div", null, bar, h("p", { role: "status", style: { fontSize: "14px", color: "#5F716C", margin: "12px 0" } }, "📄 " + file.name + " — " + label));
  }
  if (savedOk) {
    return h("div", null, bar,
      h(PrescriptionSavedScreen, { familyId, callerMemberId, res: saved.res, onClose, closeLabel }),
      h(PrescriptionNextSteps, { familyId, targetMemberId, callerMemberId, saved, followUp: res.followUp }));
  }
  return h("div", null, bar,
    res.notes.map(([bg, c, t], i) => h("div", { key: i }, note(bg, c, t))),
    res.aiWanted
      ? h(AiAssistBar, { familyId, docType: "prescription", ocrText: res.text, onSettled: onAiSettled, label: res.items.length === 0 ? "কোনো ওষুধ পড়া যায়নি — AI-র সাহায্য নেবেন?" : "হাতে-লেখা মনে হচ্ছে — AI-র সাহায্য নেবেন?" })
      : res.items.length === 0
      ? h("div", null,
          note("#FFF6E5", "#8A5A00", "কোনো ওষুধ শনাক্ত করা যায়নি। স্বাস্থ্য প্রোফাইল → ওষুধ অংশে হাতে যোগ করুন।"),
          res.text.trim() && h("details", { style: { marginTop: "8px", fontSize: "13px", color: "#5F716C" } }, h("summary", { style: { minHeight: "44px", display: "flex", alignItems: "center", cursor: "pointer" } }, "মেশিন যা পড়েছে দেখুন"), h("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, res.text)))
      : h("div", null,
          h(PrescriptionReviewForm, { familyId, targetMemberId, callerMemberId, items: res.items, allergies: res.ctx.allergies, records: res.ctx.records, ocrPercent: res.ocrPercent, onDone, onSaved: setSaved }),
          saved && h(PrescriptionNextSteps, { familyId, targetMemberId, callerMemberId, saved, followUp: res.followUp })));
}
