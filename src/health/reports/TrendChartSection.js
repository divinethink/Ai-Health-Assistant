// src/health/reports/TrendChartSection.js
//
// P5 — Report Intelligence — Trend Chart wrapper (Roadmap §8/§11.1)। শুধু
// `userVerified === true` Observation ব্যবহার করা হয় (Architecture Plan
// Part A §2 নোট: "userVerified true না হলে trend/AI interpretation-এ
// ব্যবহার হবে না" — bright-line, এখানে অক্ষুণ্ণ রাখা হলো)।
//
// existing listHealthRecords()/fetchTestNameDictionary() query-layer reuse —
// কোনো নতুন Firestore query/index লাগেনি।

import { SelectField, ErrorBox } from "../../shared/ui.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { fetchTestNameDictionary } from "./testDictionaryData.js";
import { TrendChart } from "./TrendChart.js";

const { useState, useEffect, useMemo } = React;

export function TrendChartSection({ familyId, targetMemberId, refreshTick }) {
  const [records, setRecords] = useState(null);
  const [dict, setDict] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setRecords(null);
    setErr(null);
    Promise.all([listHealthRecords(familyId, targetMemberId), fetchTestNameDictionary()])
      .then(([recs, dictEntries]) => {
        setRecords(recs.filter((r) => r.resourceType === "observation" && r.userVerified === true));
        setDict(dictEntries);
      })
      .catch((e) => setErr(e.message || String(e)));
  }, [familyId, targetMemberId, refreshTick]);

  const typeOptions = useMemo(() => {
    if (!records) return [];
    return [...new Set(records.map((r) => r.type).filter(Boolean))].sort();
  }, [records]);

  useEffect(() => {
    if (typeOptions.length > 0 && !typeOptions.includes(selectedType)) setSelectedType(typeOptions[0]);
    if (typeOptions.length === 0) setSelectedType(null);
  }, [typeOptions, selectedType]);

  if (err) return ErrorBox(err);
  if (!records) return React.createElement("p", { style: { color: "#888", fontSize: "14px" } }, "লোড হচ্ছে...");
  if (typeOptions.length === 0) {
    return React.createElement(
      "div", { style: { marginTop: "20px" } },
      React.createElement("h3", { style: { fontSize: "16px", fontWeight: 800, color: "#0E4B43" } }, "Trend Chart"),
      React.createElement("p", { style: { color: "#888", fontSize: "14px" } },
        "এখনো কোনো যাচাই-করা পরিমাপ নেই — রিপোর্ট বিশ্লেষণ বা হাতে লিখে অন্তত একটা মান সংরক্ষণ ও যাচাই করুন।")
    );
  }

  const points = records
    .filter((r) => r.type === selectedType && r.date)
    .map((r) => ({ date: r.date, value: parseFloat(r.value) }))
    .filter((p) => !Number.isNaN(p.value))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const dictEntry = dict.find((d) => d.canonicalNameEn === selectedType);
  const unit = (dictEntry && dictEntry.unit) || ((records.find((r) => r.type === selectedType) || {}).unit) || "";

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "16px", fontWeight: 800, color: "#0E4B43", margin: "0 0 6px" } }, "Trend Chart"),
    SelectField("", selectedType, setSelectedType, typeOptions.map((t) => { const nm = t.charAt(0).toUpperCase() + t.slice(1); return [t, t === selectedType ? nm + " (Change)" : nm]; })),
    points.length < 2
      ? React.createElement("p", { style: { color: "#888", fontSize: "14px" } }, "ধারা (ট্রেন্ড) দেখাতে অন্তত ২টা তারিখসহ যাচাই-করা মান দরকার।")
      : React.createElement(TrendChart, { unit, referenceRange: dictEntry ? dictEntry.referenceRange : null, points })
  );
}
