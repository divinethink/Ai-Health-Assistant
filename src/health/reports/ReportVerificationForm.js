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
import { fetchTestNameDictionary } from "./testDictionaryData.js";
import { buildLabAlerts, summarizeSaved, describeRangeBn, parseLabNumber } from "./labAlerts.js";
import { fetchMemberSex } from "../records/memberSex.js";
import { AiBadge, AI_COLORS } from "../doc-ai/AiAssistBar.js";

const { useState, useCallback, useEffect } = React;

// candidate-এর flags[]-কে ব্যবহারকারীর জন্য সহজ বাংলা ব্যাখ্যায় রূপান্তর —
// reportParsing.js-এ flag-string ঠিক রেখে শুধু UI-তে label আলাদা রাখা হলো।
const FLAG_LABELS = {
  "outside-plausible-range": "মান অস্বাভাবিক রকম কম/বেশি মনে হচ্ছে — আবার দেখে নিন",
  "possible-decimal-shift(×10)": "দশমিক-বিন্দু ভুল হতে পারে (১০ দিয়ে গুণ করলে স্বাভাবিক রেঞ্জে পড়ে)",
  "possible-decimal-shift(÷10)": "দশমিক-বিন্দু ভুল হতে পারে (১০ দিয়ে ভাগ করলে স্বাভাবিক রেঞ্জে পড়ে)",
  "unit-unconfirmed": "একক (unit) নিশ্চিত করা যায়নি — নিজে যাচাই করে বসান",
  "unit-converted-cumm": "রিপোর্টে একক /cumm ছিল — অ্যাপের এককে (×10³/µL) ১০০০ দিয়ে ভাগ করে বসানো হয়েছে; রিপোর্টের সাথে মিলিয়ে নিন",
  "unit-mismatch": "একক প্রত্যাশিত এককের সাথে মিলছে না — যাচাই করুন",
  "qualitative-test-numeric-value-unexpected": "এই টেস্টের ফলাফল সাধারণত Positive/Negative — এখানে সংখ্যা পাওয়া গেছে, নিজে বসান",
  "dictionary-entry-not-found": "এই টেস্ট আমাদের ডেটাবেসে নেই — নিজে confirm করুন",
};

// needs-review candidate ডিফল্টভাবে un-checked রাখা হয় (safe-default: ambiguity
// → review, ভুল data ভুলবশত save হয়ে যাওয়া ঠেকাতে) — শুধু "ok" status-এর
// candidate ডিফল্টে checked থাকে।
function rowFromCandidate(c) {
  return {
    include: c.status === "ok" && c.source !== "ai", // AI-মান ডিফল্টে টিক-ছাড়া: যাচাই করে টিক দেবেন
    source: c.source || null,
    testId: c.testId,
    canonicalNameEn: c.canonicalNameEn,
    value: String(c.value),
    unit: c.unit || c.capturedUnit || "",
    date: "",
    refLow: "",
    refHigh: "",
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
 * @param {{id: string, name: string}|null} [props.sourceDoc] - আপলোড-করা রিপোর্ট-নথি; সেভ-করা প্রতিটা মানে sourceDocId/sourceDocName (উৎস-লিংক)
 * @param {"direct-text"|"ocr"} props.extractionMethod
 * @param {(savedCount: number, alerts: Array<object>, summary: {alerts: object[], ok: object[], unchecked: number}) => void} [props.onSaved] - alerts/summary: সেভ-করা মান থেকে labAlerts.js-এর ফল
 */
export function ReportVerificationForm({ familyId, targetMemberId, callerMemberId, candidates, extractionMethod, onSaved, sourceDoc }) {
  const [rows, setRows] = useState(() => candidates.map(rowFromCandidate));
  const [dict, setDict] = useState([]); // রেঞ্জ-লাইনের জন্য (পুরুষ/নারী আলাদা); না এলে আগের সাধারণ রেঞ্জই দেখায়
  const [sex, setSex] = useState(null);
  useEffect(() => {
    fetchTestNameDictionary().then(setDict).catch(() => setDict([]));
    fetchMemberSex(familyId, targetMemberId).then(setSex);
  }, [familyId, targetMemberId]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [savedCount, setSavedCount] = useState(0);

  const updateRow = useCallback((idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const submit = useCallback(async () => {
    setErr(null);
    const toSave = rows.filter((r) => r.include);
    if (toSave.length === 0) { setErr("অন্তত একটা মান বেছে নিন।"); return; }
    const badRange = toSave.find((r) => { if (!r.refLow.trim() && !r.refHigh.trim()) return false; const lo = parseLabNumber(r.refLow), hi = parseLabNumber(r.refHigh); return lo === null || hi === null || lo > hi; });
    if (badRange) { setErr(badRange.canonicalNameEn + ": রেঞ্জের নিম্ন ও উচ্চ দুটোই সংখ্যায় দিন (নিম্ন ≤ উচ্চ), নয়তো দুটোই ফাঁকা রাখুন। (\"<7.8\" হলে নিম্ন ০, উচ্চ ৭.৮)"); return; }
    setBusy(true);
    let count = 0;
    const savedObs = [];
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
          sourceDocId: sourceDoc ? sourceDoc.id : null,
          sourceDocName: sourceDoc ? sourceDoc.name : null,
          refLow: r.refLow, refHigh: r.refHigh,
        });
        savedObs.push({ type: r.canonicalNameEn, value: r.value, unit: r.unit, refLow: r.refLow.trim() || null, refHigh: r.refHigh.trim() || null, sourceDocId: sourceDoc ? sourceDoc.id : null, sourceDocName: sourceDoc ? sourceDoc.name : null });
        count++;
      }
      setSavedCount(count);
      // সতর্কতা শুধু দেখানোর জন্য — dictionary না এলে নীরবে বাদ, সেভ-সফলতা প্রভাবিত নয়
      const dictNow = await fetchTestNameDictionary().catch(() => []);
      onSaved && onSaved(count, buildLabAlerts(savedObs, dictNow, sex), summarizeSaved(savedObs, dictNow, sex));
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? "এই সদস্যের জন্য স্বাস্থ্য রেকর্ড যোগ করার অনুমতি আপনার নেই।"
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [rows, familyId, targetMemberId, callerMemberId, extractionMethod, onSaved, sourceDoc, sex]);

  if (!candidates || candidates.length === 0) {
    return React.createElement(
      "div", { style: { marginTop: "14px", fontSize: "14px", color: "#5F716C" } },
      "রিপোর্ট থেকে কোনো পরিচিত টেস্ট-মান শনাক্ত করা যায়নি। প্রয়োজনে ম্যানুয়ালি Health Record যোগ করুন।"
    );
  }

  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)", margin: 0 } }, "রিপোর্টের মান যাচাই করুন"),
    React.createElement("div", { style: { fontSize: "14px", color: "#4B5C57", margin: "4px 0 10px" } },
      "OCR/extraction থেকে পাওয়া মান — Save করার আগে প্রতিটা যাচাই করে নিন। ভুল মনে হলে আনচেক করুন বা সংশোধন করুন।"
    ),
    ...rows.map((r, idx) => React.createElement(
      "div", {
        key: r.testId + "-" + idx,
        style: {
          marginBottom: "10px", padding: "10px", borderRadius: "14px",
          border: "1px solid " + (r.status === "ok" ? "#D3E0D9" : "#E0A72E"),
          borderLeft: r.source === "ai" ? "5px solid " + AI_COLORS.border : undefined,
          background: r.source === "ai" ? AI_COLORS.soft : r.status === "ok" ? "#fff" : "#FFF9EC",
        },
      },
      r.source === "ai" ? React.createElement("div", { style: { marginBottom: "6px" } }, AiBadge("AI বসিয়েছে — যাচাই করুন")) : null,
      React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, color: "var(--hs-primary, #0E4B43)" } },
        React.createElement("input", { type: "checkbox", checked: r.include, onChange: (e) => updateRow(idx, { include: e.target.checked }) }),
        r.canonicalNameEn
      ),
      (() => {
        const entry = dict.find((d) => (d.id || d.testId) === r.testId);
        const line = entry && describeRangeBn(entry);
        if (line) return React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", margin: "2px 0 6px" } }, "স্বাভাবিক রেঞ্জ: " + line);
        return r.referenceRange
          ? React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", margin: "2px 0 6px" } },
              "স্বাভাবিক রেঞ্জ: " + r.referenceRange.low + "–" + r.referenceRange.high + (r.unit ? " " + r.unit : ""))
          : null;
      })(),
      TextField("মান", r.value, (v) => updateRow(idx, { value: v })),
      TextField("একক", r.unit, (v) => updateRow(idx, { unit: v })),
      TextField("রেঞ্জ — নিম্ন (ঐচ্ছিক, রিপোর্টের Reference Value থেকে)", r.refLow, (v) => updateRow(idx, { refLow: v }), "যেমন: 0"),
      TextField("রেঞ্জ — উচ্চ (ঐচ্ছিক)", r.refHigh, (v) => updateRow(idx, { refHigh: v }), "যেমন: 7.8"),
      DateField("রিপোর্টের তারিখ (ঐচ্ছিক)", r.date, (v) => updateRow(idx, { date: v })),
      r.flags.length > 0
        ? React.createElement(
            "div", { style: { marginTop: "6px", fontSize: "14px", color: "#8A5A00" } },
            ...r.flags.map((f) => React.createElement("div", { key: f }, "⚠️ " + (FLAG_LABELS[f] || f)))
          )
        : null
    )),
    err && ErrorBox(err),
    savedCount > 0 ? SuccessBox(savedCount + "টা মান সংরক্ষণ করা হয়েছে।") : null,
    PrimaryButton("নির্বাচিত মান Save করুন", submit, busy)
  );
}
