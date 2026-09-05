// src/health/reports/ReportVerificationForm.js
//
// P5 — Report Intelligence — Mandatory User Verification UI (Roadmap §8:
// "বাধ্যতামূলক User Verification — skip অযোগ্য")। reportParsing.js-এর output
// (candidate + rule-based validation) নিয়ে ব্যবহারকারীকে প্রতিটা value
// review/edit/confirm করতে দেয় — কোনো extraction/OCR value সরাসরি auto-save
// হয় না, exception নেই।
//
// Save হওয়ার সময় Architecture Plan Part A §2 Observation schema অনুযায়ী
// source/extractionMethod/extractionConfidence/originalOcrValue/userVerified:true
// সংরক্ষিত হয় (healthRecordsData.js buildHealthRecordFields()-এর নতুন
// backward-compatible fields ব্যবহার করে — existing manual-entry flow
// অপ্রভাবিত)।
//
// UI-প্যাটার্ন HealthRecordForm.js/ui.js primitives থেকে reuse করা (Process
// Rule ২: existing pattern reuse, React.createElement style, কোনো নতুন
// component-library না)।

import { TextField, DateField, ErrorBox, SuccessBox, PrimaryButton } from "../../shared/ui.js";
import { createHealthRecord } from "../records/healthRecordsData.js";

const { useState, useCallback } = React;

// candidate-এর flags[]-কে ব্যবহারকারীর জন্য সহজ বাংলা ব্যাখ্যায় রূপান্তর —
// reportParsing.js-এ flag-string ঠিক রেখে শুধু UI-তে label আলাদা রাখা হলো।
const FLAG_LABELS = {
  "outside-plausible-range": "মান অস্বাভাবিক রকম কম/বেশি মনে হচ্ছে — আবার দেখে নিন",
  "possible-decimal-shift(×10)": "দশমিক-বিন্দু ভুল হতে পারে (১০ দিয়ে গুণ করলে স্বাভাবিক রেঞ্জে পড়ে)",
  "possible-decimal-shift(÷10)": "দশমিক-বিন্দু ভুল হতে পারে (১০ দিয়ে ভাগ করলে স্বাভাবিক রেঞ্জে পড়ে)",
  "unit-unconfirmed": "একক (unit) নিশ্চিত করা যায়নি — নিজে যাচাই করে বসান",
  "unit-mismatch": "একক প্রত্যাশিত এককের সাথে মিলছে না — যাচাই করুন",
  "qualitative-test-numeric-value-unexpected": "এই টেস্টের ফলাফল সাধারণত Positive/Negative — এখানে সংখ্যা পাওয়া গেছে, নিজে বসান",
  "dictionary-entry-not-found": "এই টেস্ট আমাদের ডেটাবেসে নেই — নিজে confirm করুন",
};

// needs-review candidate ডিফল্টভাবে un-checked রাখা হয় (safe-default: ambiguity
// → review, ভুল data ভুলবশত save হয়ে যাওয়া ঠেকাতে) — শুধু "ok" status-এর
// candidate ডিফল্টে checked থাকে।
function rowFromCandidate(c) {
  return {
    include: c.status === "ok",
    testId: c.testId,
    canonicalNameEn: c.canonicalNameEn,
    value: String(c.value),
    unit: c.unit || c.capturedUnit || "",
    date: "",
    flags: c.flags || [],
    status: c.status,
    rawValue: c.rawValue,
    referenceRange: c.referenceRange,
  };
}

/**
 * @param {object} props
 * @param {string} props.familyId
 * @param {string} props.targetMemberId
 * @param {string} props.callerMemberId
 * @param {Array<object>} props.candidates - reportParsing.parseAndValidateReportText() output
 * @param {"direct-text"|"ocr"} props.extractionMethod
 * @param {(savedCount: number) => void} [props.onSaved]
 */
export function ReportVerificationForm({ familyId, targetMemberId, callerMemberId, candidates, extractionMethod, onSaved }) {
  const [rows, setRows] = useState(() => candidates.map(rowFromCandidate));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [savedCount, setSavedCount] = useState(0);

  const updateRow = useCallback((idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const submit = useCallback(async () => {
    setErr(null);
    const toSave = rows.filter((r) => r.include);
    if (toSave.length === 0) { setErr("অন্তত একটা মান নির্বাচন করুন।"); return; }
    setBusy(true);
    let count = 0;
    try {
      for (const r of toSave) {
        if (!r.value.trim() || !r.unit.trim()) continue; // ফাঁকা মান/একক নিয়ে save করা হবে না
        await createHealthRecord(familyId, targetMemberId, callerMemberId, "observation", {
          type: r.canonicalNameEn,
          value: r.value,
          unit: r.unit,
          date: r.date,
          source: "lab-upload",
          extractionMethod,
          extractionConfidence: r.status === "ok" ? "high" : "needs-review",
          originalOcrValue: r.rawValue,
          userVerified: true, // এই ফর্ম-ই verification ধাপ — এখানে পৌঁছানো মানেই ব্যবহারকারী দেখে confirm করেছেন
        });
        count++;
      }
      setSavedCount(count);
      onSaved && onSaved(count);
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? "এই সদস্যের জন্য Health Record যোগ করার অনুমতি আপনার নেই।"
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [rows, familyId, targetMemberId, callerMemberId, extractionMethod, onSaved]);

  if (!candidates || candidates.length === 0) {
    return React.createElement(
      "div", { style: { marginTop: "14px", fontSize: "13px", color: "#888" } },
      "রিপোর্ট থেকে কোনো পরিচিত টেস্ট-মান শনাক্ত করা যায়নি। প্রয়োজনে ম্যানুয়ালি Health Record যোগ করুন।"
    );
  }

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "রিপোর্টের মান যাচাই করুন"),
    React.createElement("div", { style: { fontSize: "12px", color: "#666", margin: "4px 0 10px" } },
      "OCR/extraction থেকে পাওয়া মান — Save করার আগে প্রতিটা যাচাই করে নিন। ভুল মনে হলে আনচেক করুন বা সংশোধন করুন।"
    ),
    ...rows.map((r, idx) => React.createElement(
      "div", {
        key: r.testId + "-" + idx,
        style: {
          marginBottom: "10px", padding: "10px", borderRadius: "8px",
          border: "1px solid " + (r.status === "ok" ? "#CBD5E1" : "#E0A72E"),
          background: r.status === "ok" ? "#fff" : "#FFF9EC",
        },
      },
      React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#0E4B43" } },
        React.createElement("input", { type: "checkbox", checked: r.include, onChange: (e) => updateRow(idx, { include: e.target.checked }) }),
        r.canonicalNameEn
      ),
      r.referenceRange
        ? React.createElement("div", { style: { fontSize: "11px", color: "#888", margin: "2px 0 6px" } },
            "স্বাভাবিক রেঞ্জ: " + r.referenceRange.low + "–" + r.referenceRange.high + (r.unit ? " " + r.unit : ""))
        : null,
      TextField("মান", r.value, (v) => updateRow(idx, { value: v })),
      TextField("একক", r.unit, (v) => updateRow(idx, { unit: v })),
      DateField("রিপোর্টের তারিখ (ঐচ্ছিক)", r.date, (v) => updateRow(idx, { date: v })),
      r.flags.length > 0
        ? React.createElement(
            "div", { style: { marginTop: "6px", fontSize: "12px", color: "#8A5A00" } },
            ...r.flags.map((f) => React.createElement("div", { key: f }, "⚠️ " + (FLAG_LABELS[f] || f)))
          )
        : null
    )),
    err && ErrorBox(err),
    savedCount > 0 ? SuccessBox(savedCount + "টা মান সংরক্ষণ করা হয়েছে।") : null,
    PrimaryButton("নির্বাচিত মান Save করুন", submit, busy)
  );
}
