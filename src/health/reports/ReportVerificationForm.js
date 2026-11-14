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

import { DateField, ErrorBox, SuccessBox, PrimaryButton } from "../../shared/ui.js";
import { createHealthRecord } from "../records/healthRecordsData.js";
import { fetchTestNameDictionary } from "./testDictionaryData.js";
import { buildLabAlerts, summarizeSaved, describeRangeBn, parseLabNumber } from "./labAlerts.js";
import { fetchMemberSex } from "../records/memberSex.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { AiBadge, AI_COLORS } from "../doc-ai/AiAssistBar.js";

const { useState, useCallback, useEffect } = React;
const bnN = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);

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
  const [saved, setSaved] = useState([]); // এই রিপোর্ট থেকে আগে সংরক্ষিত মান (আবার-বিশ্লেষণে তুলনার জন্য)
  const savedFor = (r) => saved.find((o) => o.type === r.canonicalNameEn) || null; // নতুন→পুরনো ক্রমে প্রথমটাই সর্বশেষ
  const sameAs = (r, o) => !!o && String(o.value).trim() === String(r.value).trim() && String(o.unit || "").trim() === String(r.unit || "").trim();
  useEffect(() => {
    if (!sourceDoc) return;
    listHealthRecords(familyId, targetMemberId, { fresh: true })
      .then((all) => {
        const mine = all.filter((o) => o.resourceType === "observation" && o.sourceDocId === sourceDoc.id);
        setSaved(mine);
        // আগের মতো একই মান আবার সেভ করে ডুপ্লিকেট না হতে ডিফল্টে টিক-ছাড়া
        setRows((prev) => prev.map((r) => { const o = mine.find((x) => x.type === r.canonicalNameEn); return o && sameAs(r, o) ? { ...r, include: false } : r; }));
      })
      .catch(() => {});
    // eslint-disable-next-line
  }, [familyId, targetMemberId, sourceDoc && sourceDoc.id]);
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

  // ---- নতুন কমপ্যাক্ট UI (শুধু presentation; সেভ/যাচাই-লজিক অপরিবর্তিত) ----
  const G = "var(--hs-primary, #0E4B43)", MUTED = "#5F716C";
  const chosen = rows.filter((r) => r.include).length;
  const chip = (text, color, bg, border) => React.createElement("span", { style: { fontSize: "12.5px", fontWeight: 700, color, background: bg, border: "1px solid " + border, borderRadius: "999px", padding: "2px 9px", whiteSpace: "nowrap" } }, text);
  const inputStyle = { width: "100%", boxSizing: "border-box", minHeight: "44px", padding: "8px 12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "16px", fontFamily: "inherit", background: "#fff", color: "#1F2D2A" };
  const small = (label, value, onChange, ph, extra) => React.createElement("label", { style: { display: "block", minWidth: 0 } },
    React.createElement("span", { style: { display: "block", fontSize: "12.5px", fontWeight: 600, color: MUTED, marginBottom: "3px" } }, label),
    React.createElement("input", { value, placeholder: ph || "", inputMode: extra && extra.inputMode, onChange: (e) => onChange(e.target.value), style: inputStyle }));
  const grid2 = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "10px" };

  const rowCard = (r, idx) => {
    const ai = r.source === "ai", ok = r.status === "ok";
    const stripe = ai ? AI_COLORS.border : ok ? "#2E8B6A" : "#E0A72E";
    const entry = dict.find((d) => (d.id || d.testId) === r.testId);
    const rangeLine = (entry && describeRangeBn(entry)) || (r.referenceRange ? r.referenceRange.low + "–" + r.referenceRange.high + (r.unit ? " " + r.unit : "") : null);
    const o = savedFor(r);
    return React.createElement("div", { key: r.testId + "-" + idx, style: { marginBottom: "10px", borderRadius: "16px", background: "#fff", border: "1px solid #DCE6E0", borderLeft: "5px solid " + stripe, boxShadow: "0 1px 3px rgba(14,75,67,0.06)", padding: "4px 12px 12px", opacity: r.include ? 1 : 0.92 } },
      React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "10px", minHeight: "48px", cursor: "pointer" } },
        React.createElement("input", { type: "checkbox", checked: r.include, onChange: (e) => updateRow(idx, { include: e.target.checked }), style: { width: "22px", height: "22px", flexShrink: 0, accentColor: "#0E4B43" } }),
        React.createElement("span", { style: { flex: 1, minWidth: 0, fontSize: "16px", fontWeight: 700, color: "#1F2D2A", overflowWrap: "anywhere" } }, r.canonicalNameEn),
        ai ? chip("🤖 AI", AI_COLORS.text, AI_COLORS.bg, AI_COLORS.border) : !ok ? chip("যাচাই দরকার", "#8A5A00", "#FFF6E5", "#E0A72E") : null),
      rangeLine && React.createElement("div", { style: { fontSize: "13.5px", color: MUTED, margin: "-2px 0 8px 32px" } }, "স্বাভাবিক রেঞ্জ: " + rangeLine),
      React.createElement("div", { style: grid2 },
        small("মান", r.value, (v) => updateRow(idx, { value: v }), "", { inputMode: "decimal" }),
        small("একক", r.unit, (v) => updateRow(idx, { unit: v }))),
      r.flags.length > 0 && React.createElement("div", { style: { marginTop: "8px", padding: "8px 10px", borderRadius: "10px", background: "#FFF6E5", color: "#8A5A00", fontSize: "13.5px", lineHeight: 1.45 } },
        r.flags.map((f) => React.createElement("div", { key: f }, "⚠️ " + (FLAG_LABELS[f] || f)))),
      o && React.createElement("div", { style: { marginTop: "8px", fontSize: "13.5px", lineHeight: 1.45, color: sameAs(r, o) ? "#1E8A57" : "#8A5A00" } },
        sameAs(r, o) ? "✅ এই রিপোর্ট থেকে আগেই সংরক্ষিত — একই মান (ডুপ্লিকেট এড়াতে টিক-ছাড়া)"
          : "🔄 আগে সংরক্ষিত: " + o.value + (o.unit ? " " + o.unit : "") + " → নতুন: " + r.value + (r.unit ? " " + r.unit : "") + "। টিক দিয়ে সেভ করলে নতুন মান যোগ হবে (পুরনোটা ইতিহাসে থাকবে)।"),
      React.createElement("details", { style: { marginTop: "8px" } },
        React.createElement("summary", { style: { cursor: "pointer", minHeight: "40px", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 600, color: G } }, "রেঞ্জ ও তারিখ (ঐচ্ছিক)"),
        React.createElement("div", { style: { ...grid2, marginTop: "4px" } },
          small("রেঞ্জ — নিম্ন", r.refLow, (v) => updateRow(idx, { refLow: v }), "যেমন: 0", { inputMode: "decimal" }),
          small("রেঞ্জ — উচ্চ", r.refHigh, (v) => updateRow(idx, { refHigh: v }), "যেমন: 7.8", { inputMode: "decimal" })),
        React.createElement("div", { style: { fontSize: "12.5px", color: MUTED, margin: "4px 0 0" } }, "রিপোর্টের Reference Value থেকে দিলে সতর্কতা সেই রেঞ্জ ধরে হবে।"),
        DateField("রিপোর্টের তারিখ", r.date, (v) => updateRow(idx, { date: v }))));
  };

  return React.createElement(
    "div", { style: { marginTop: "16px" } },
    React.createElement("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" } },
      React.createElement("h4", { style: { fontSize: "17px", fontWeight: 800, color: "#1F2D2A", margin: 0 } }, "পাওয়া মান যাচাই করুন"),
      React.createElement("span", { style: { fontSize: "12.5px", fontWeight: 600, color: MUTED, background: "#E9F0EC", borderRadius: "999px", padding: "2px 10px", whiteSpace: "nowrap" } }, rows.length + "টি পাওয়া গেছে")),
    React.createElement("div", { style: { fontSize: "14px", color: "#4B5C57", margin: "4px 0 12px", lineHeight: 1.5 } },
      "অ্যাপ রিপোর্ট থেকে যা পড়েছে তা নিচে। ঠিক থাকলে টিক রাখুন; ভুল হলে মান ঠিক করুন বা টিক তুলে দিন।"),
    ...rows.map(rowCard),
    err && ErrorBox(err),
    savedCount > 0 ? SuccessBox(savedCount + "টা মান সংরক্ষণ করা হয়েছে।") : null,
    React.createElement("div", { style: { position: "sticky", bottom: 0, margin: "0 -12px", padding: "8px 12px 4px", background: "linear-gradient(180deg, rgba(255,255,255,0), var(--hs-canvas, #F1F6F2) 28%)" } },
      PrimaryButton(chosen > 0 ? "নির্বাচিত " + bnN(chosen) + "টি মান সংরক্ষণ করুন" : "সংরক্ষণ করুন", submit, busy, chosen === 0))
  );
}
