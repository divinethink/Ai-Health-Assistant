// src/health/reports/ManualReportEntryForm.js
//
// P5 — Report Intelligence — হাতে-লেখা report-এর জন্য manual entry form
// (Roadmap §8: "হাতে লেখা হলে: OCR স্কিপ, manual entry form")। এখানে OCR
// সম্পূর্ণ bypass — ব্যবহারকারী রিপোর্ট দেখে নিজে test-name (dictionary
// থেকে বাছাই বা custom নাম) + মান + একক + তারিখ টাইপ করেন।
//
// generic HealthRecordForm.js (Condition/Observation/Medication/Allergy সব
// resourceType-এর জন্য সাধারণ ফর্ম) থেকে এই ফর্ম আলাদা কেন: এখানে
// testNameDictionary থেকে dropdown+auto-unit+reference-range সুবিধা আছে
// (রিপোর্ট থেকে একসাথে একাধিক মান দ্রুত লেখার জন্য), এবং schema-level
// `extractionMethod: "manual-entry"` + `source: "lab-upload"` চিহ্নিত হয়
// (Architecture Plan Part A §2) — যাতে ভবিষ্যতে এই ডেটা "রিপোর্ট থেকে
// এসেছে" হিসেবে আলাদা করা যায়, generic manual health-record থেকে।

import { TextField, DateField, SelectField, ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { createHealthRecord } from "../records/healthRecordsData.js";
import { fetchTestNameDictionary } from "./testDictionaryData.js";

const { useState, useEffect, useCallback } = React;

const CUSTOM_OPTION = "__custom__";

function emptyRow() {
  return { testId: "", customName: "", value: "", unit: "", date: "" };
}

export function ManualReportEntryForm({ familyId, targetMemberId, callerMemberId, onSaved }) {
  const [dict, setDict] = useState([]);
  const [rows, setRows] = useState([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    fetchTestNameDictionary().then(setDict).catch(() => setDict([]));
  }, []);

  const testOptions = [[CUSTOM_OPTION, "— অন্য/কাস্টম টেস্ট —"], ...dict.map((d) => [d.id, d.canonicalNameEn])];

  const updateRow = useCallback((idx, patch) => {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, ...patch };
      // dictionary থেকে টেস্ট বাছাই করলে unit auto-fill (ব্যবহারকারী পরে চাইলে edit করতে পারবেন)
      if (patch.testId && patch.testId !== CUSTOM_OPTION) {
        const entry = dict.find((d) => d.id === patch.testId);
        if (entry) next.unit = entry.unit && entry.unit.startsWith("qualitative") ? "" : entry.unit;
      }
      return next;
    }));
  }, [dict]);

  const addRow = useCallback(() => setRows((prev) => [...prev, emptyRow()]), []);
  const removeRow = useCallback((idx) => setRows((prev) => prev.filter((_, i) => i !== idx)), []);

  const submit = useCallback(async () => {
    setErr(null);
    const usable = rows.filter((r) => (r.testId || r.customName.trim()) && r.value.trim() && r.unit.trim());
    if (usable.length === 0) { setErr("অন্তত একটা টেস্টের নাম, মান ও একক পূরণ করুন।"); return; }
    setBusy(true);
    let count = 0;
    try {
      for (const r of usable) {
        const dictEntry = r.testId && r.testId !== CUSTOM_OPTION ? dict.find((d) => d.id === r.testId) : null;
        const name = dictEntry ? dictEntry.canonicalNameEn : r.customName.trim();
        await createHealthRecord(familyId, targetMemberId, callerMemberId, "observation", {
          type: name,
          value: r.value,
          unit: r.unit,
          date: r.date,
          source: "lab-upload",
          extractionMethod: "manual-entry",
          extractionConfidence: "high", // OCR/uncertainty জড়িত না, ব্যবহারকারী সরাসরি রিপোর্ট দেখে টাইপ করেছেন
          originalOcrValue: null,
          userVerified: true,
        });
        count++;
      }
      setSavedCount(count);
      setRows([emptyRow()]);
      onSaved && onSaved(count);
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? "এই সদস্যের জন্য Health Record যোগ করার অনুমতি আপনার নেই।"
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [rows, dict, familyId, targetMemberId, callerMemberId, onSaved]);

  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    React.createElement("p", { style: { fontSize: "12px", color: "#888", margin: "4px 0" } },
      "হাতে-লেখা রিপোর্টে OCR নির্ভরযোগ্য না — রিপোর্ট দেখে সরাসরি মান লিখুন।"
    ),
    ...rows.map((r, idx) => React.createElement(
      "div", { key: idx, style: { marginBottom: "10px", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "8px" } },
      SelectField("টেস্ট", r.testId, (v) => updateRow(idx, { testId: v }), testOptions),
      r.testId === CUSTOM_OPTION || !r.testId
        ? TextField("টেস্টের নাম", r.customName, (v) => updateRow(idx, { customName: v }), "যেমন: Vitamin D")
        : null,
      TextField("মান", r.value, (v) => updateRow(idx, { value: v })),
      TextField("একক", r.unit, (v) => updateRow(idx, { unit: v })),
      DateField("রিপোর্টের তারিখ (ঐচ্ছিক)", r.date, (v) => updateRow(idx, { date: v })),
      rows.length > 1 ? SecondaryButton("এই সারি বাদ দিন", () => removeRow(idx), false) : null
    )),
    SecondaryButton("+ আরেকটা টেস্ট যোগ করুন", addRow, false),
    err ? ErrorBox(err) : null,
    savedCount > 0 ? SuccessBox(savedCount + "টা মান সংরক্ষণ করা হয়েছে।") : null,
    PrimaryButton("Save করুন", submit, busy)
  );
}
