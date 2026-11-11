// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { findDictEntry, evaluateLabValue, buildLabAlerts, alertForGroup, alertLine, summarizeAlerts, parseLabNumber, summarizeSaved } from "../../src/health/reports/labAlerts.js";

const Q = "qualitative (Positive/Negative)";
const dict = [
  { id: "tsh", canonicalNameEn: "TSH (Thyroid Stimulating Hormone)", synonyms: ["TSH", "Thyrotropin"], unit: "mIU/L", referenceRange: { low: 0.4, high: 4.0 } },
  { id: "fbs", canonicalNameEn: "Fasting Blood Sugar (FBS)", synonyms: ["FBS", "FPG"], unit: "mg/dL", referenceRange: { low: 70, high: 99 } },
  { id: "hdl", canonicalNameEn: "HDL Cholesterol", synonyms: ["HDL"], unit: "mg/dL", referenceRange: { low: 40, high: 60 } },
  { id: "egfr", canonicalNameEn: "eGFR", synonyms: ["eGFR"], unit: "mL/min/1.73m²", referenceRange: { low: 90, high: 120 } },
  { id: "hba1c", canonicalNameEn: "HbA1c (Glycated Hemoglobin)", synonyms: ["HbA1c"], unit: "%", referenceRange: { low: 4.0, high: 5.6 } },
  { id: "dengue-ns1", canonicalNameEn: "Dengue NS1 Antigen", synonyms: ["Dengue NS1", "NS1"], unit: Q, referenceRange: null },
];
const ev = (type, value, unit) => evaluateLabValue({ type, value, unit }, findDictEntry(type, dict));

test("নাম/synonym হুবহু মিল; weight বা আংশিক নামে মিল নয়", () => {
  assert.equal(findDictEntry("tsh", dict).id, "tsh");
  assert.equal(findDictEntry("TSH (Thyroid Stimulating Hormone)", dict).id, "tsh");
  assert.equal(findDictEntry("weight", dict), null);
  assert.equal(findDictEntry("TSH level", dict), null);
});
test("বেশি/কম/স্বাভাবিক", () => {
  assert.equal(ev("TSH", "8.2", "mIU/L").level, "high");
  assert.equal(ev("TSH", "0.1", "mIU/L").level, "low");
  assert.equal(ev("TSH", "2.5", "mIU/L"), null);
  assert.equal(ev("TSH", "4.0", "mIU/L"), null); // সীমায় = স্বাভাবিক
});
test("বাংলা সংখ্যা ও কমা-দশমিক", () => {
  assert.equal(parseLabNumber("৮.২"), 8.2);
  assert.equal(parseLabNumber("8,2"), 8.2);
  assert.equal(ev("TSH", "৮.২", "mIU/L").level, "high");
});
test("সমতুল্য একক µIU/mL", () => assert.equal(ev("TSH", "8.2", "µIU/mL").level, "high"));
test("অমিল একক বা ফাঁকা একক বা অ-সংখ্যা → চুপ", () => {
  assert.equal(ev("TSH", "8.2", "pg/mL"), null);
  assert.equal(ev("TSH", "8.2", ""), null);
  assert.equal(ev("TSH", "<0.5", "mIU/L"), null);
  assert.equal(ev("TSH", "abc", "mIU/L"), null);
});
test("গ্লুকোজ mmol/L রূপান্তর, রেঞ্জ mmol/L-এ দেখায়", () => {
  const a = ev("FBS", "7.8", "mmol/L");
  assert.equal(a.level, "high");
  assert.deepEqual(a.range, { low: 3.9, high: 5.5 });
  assert.equal(ev("FBS", "5.0", "mmol/L"), null);
  assert.equal(ev("HbA1c", "5.4", "mmol/L"), null); // শুধু গ্লুকোজে রূপান্তর
});
test("HDL/eGFR-এ উচ্চমান সতর্কতা নয়, নিচু হলে হয়", () => {
  assert.equal(ev("HDL", "75", "mg/dL"), null);
  assert.equal(ev("HDL", "30", "mg/dL").level, "low");
  assert.equal(ev("eGFR", "130", "mL/min/1.73m²"), null);
  assert.equal(ev("eGFR", "45", "mL/min/1.73m²").level, "low");
});
test("Positive/Reactive সবসময় লাল; Negative/Non-reactive নয়", () => {
  for (const v of ["Positive", "positive", "Reactive", "পজিটিভ", "Weakly Positive", "Detected"]) assert.equal(ev("Dengue NS1", v, "").level, "positive", v);
  for (const v of ["Negative", "Non-reactive", "Non reactive", "Not detected", "নেগেটিভ", ""]) assert.equal(ev("Dengue NS1", v, ""), null, v);
});
test("alertLine", () => {
  assert.equal(alertLine(ev("TSH", "8.2", "mIU/L")), "TSH বেশি — ৮.২ (০.৪–৪.০)");
  assert.equal(alertLine(ev("FBS", "7.8", "mmol/L")), "FBS বেশি — ৭.৮ (৩.৯–৫.৫)");
  assert.equal(alertLine(ev("Dengue NS1", "Positive", "")), "Dengue NS1 — Positive");
  assert.equal(alertLine(ev("HDL", "30", "mg/dL")), "HDL কম — ৩০ (৪০–৬০)");
});
test("buildLabAlerts + summarizeAlerts: ৩টার বেশি হলে 'আরও N টি'", () => {
  const obs = [{ type: "TSH", value: "8", unit: "mIU/L" }, { type: "FBS", value: "150", unit: "mg/dL" }, { type: "HDL", value: "20", unit: "mg/dL" },
    { type: "Dengue NS1", value: "Positive", unit: Q }, { type: "weight", value: "66", unit: "kg" }, { type: "HbA1c", value: "5", unit: "%" }];
  const al = buildLabAlerts(obs, dict);
  assert.equal(al.length, 4);
  const s = summarizeAlerts(al, 3);
  assert.equal(s.shown.length, 3); assert.equal(s.more, 1);
  assert.deepEqual(summarizeAlerts([], 3), { total: 0, shown: [], more: 0 });
});
test("alertForGroup শুধু সর্বশেষ মান দেখে", () => {
  assert.equal(alertForGroup([{ type: "TSH", value: "2", unit: "mIU/L" }, { type: "TSH", value: "9", unit: "mIU/L" }], dict), null);
  assert.equal(alertForGroup([{ type: "TSH", value: "9", unit: "mIU/L" }], dict).level, "high");
  assert.equal(alertForGroup([], dict), null);
});
test("dictionary ফাঁকা/অনুপস্থিত হলে ক্র্যাশ নয়", () => {
  assert.deepEqual(buildLabAlerts([{ type: "TSH", value: "9", unit: "mIU/L" }], []), []);
  assert.deepEqual(buildLabAlerts(null, null), []);
});

test("summarizeSaved: 🔴/🟢/অযাচাইযোগ্য আলাদা", () => {
  const r = summarizeSaved([
    { type: "TSH", value: "8.2", unit: "mIU/L" },        // 🔴
    { type: "FBS", value: "85", unit: "mg/dL" },         // 🟢
    { type: "Dengue NS1", value: "Negative", unit: Q },  // 🟢
    { type: "HbA1c", value: "5.0", unit: "mg/dL" },      // একক মেলে না → যাচাইহীন
    { type: "weight", value: "68", unit: "kg" },         // dictionary-তে নেই
  ], dict);
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].testId, "tsh");
  assert.equal(r.ok.length, 2);
  assert.equal(r.unchecked, 2);
  assert.deepEqual(summarizeSaved(null, dict), { alerts: [], ok: [], unchecked: 0 });
});
