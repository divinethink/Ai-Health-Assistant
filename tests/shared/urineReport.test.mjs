// চালান: node --test tests/shared/*.test.mjs
// প্রস্রাব R/M/E রিপোর্ট (Government Employee Hospital ধাঁচ): আগে PDF-এর পুরো পাতা এক লাইন হতো আর
// "HPF"-সারি-বাদ নিয়মে সবকিছু বাদ পড়ত → "কোনো পরিচিত টেস্ট-মান নেই"।
import test from "node:test";
import assert from "node:assert/strict";
import { parseAndValidateReportText } from "../../src/health/reports/reportParsing.js";
import { withBuiltinTests, BUILTIN_TESTS } from "../../src/health/reports/builtinTests.js";
import { buildPdfLines } from "../../src/health/reports/pdfLines.js";
import { buildLabAlerts, summarizeSaved, alertLine, describeRangeBn } from "../../src/health/reports/labAlerts.js";

const cbcDict = [
  { id: "wbc", canonicalNameEn: "Total WBC Count", synonyms: ["WBC", "TC"], unit: "×10³/µL", referenceRange: { low: 4, high: 11 }, plausibleRange: { low: 0.1, high: 100 } },
  { id: "hb", canonicalNameEn: "Hemoglobin (Hb)", synonyms: ["Hb", "Hgb"], unit: "g/dL", referenceRange: { low: 12, high: 16 }, plausibleRange: { low: 1, high: 25 } },
];
const dict = withBuiltinTests(cbcDict);

const URINE = [
  "DEPARTMENT OF CLINICAL PATHOLOGY REPORT",
  "Patient Name : Md Kamrul Hasan", "Test Name : Urine R/M/E", "Sample : Urine",
  "Collection Date : 21-07-2026 09:39:21 AM",
  "Test is carried out by BT URICELL 1280 and Rechecked Manually",
  "TEST RESULT REFERENCE VALUE", "PHYSICAL EXAMINATION",
  "Color Straw Straw", "Appearance Clear Clear", "S. Gravity 1.015 1.010 - 1.030", "Sediment Nil Nil",
  "CHEMICAL EXAMINATION", "PH 6.0 4.5 - 8.0", "Protein Nil Nil", "Urine Sugar Nil Nil", "Ketone Nil Nil",
  "Bilirubin Nil mg/dl Nil", "Urobilinogen Nil mg/dl Nil", "Nitrite Negative Negative", "Leukocytes Positive Negative",
  "MICROSCOPIC EXAMINATION", "Epithelial Cells 1-2 HPF 0-5", "Pus Cells/WBC 4-5 HPF 0-3", "RBC Nil Nil",
  "Hyline Cast Nil Nil", "Granular Cast Nil Nil", "WBC Cast Nil HPF Nil", "RBC Cast Nil HPF Nil",
  "Tripple Phosphate Nil Nil", "Amorphous Phos Nil /HPF Nil", "Calcium Oxalate Nil /HPF Nil", "Uric Acid Nil /HPF Nil",
  "Yeast Nil /HPF Nil", "Bacteria Nil /HPF Nil", "Spermatozoa Nil /HPF Nil",
].join("\n");

const byId = (res) => Object.fromEntries(res.map((c) => [c.testId, c]));

test("ইউরিন রিপোর্ট: প্রধান টেস্টগুলো শনাক্ত হয়, মোট WBC/Hb ভুল ধরা পড়ে না", () => {
  const res = parseAndValidateReportText(URINE, dict);
  const m = byId(res);
  assert.ok(!m.wbc && !m.hb, "CBC-এর WBC ভুল ধরা পড়েছে");
  assert.equal(m["urine-sg"].value, 1.015);
  assert.equal(m["urine-sg"].refLow, "1.010"); assert.equal(m["urine-sg"].refHigh, "1.030");
  assert.equal(m["urine-ph"].value, 6);
  assert.equal(m["urine-protein"].value, "Nil");
  assert.equal(m["urine-leukocytes"].value, "Positive");
  assert.equal(m["urine-pus"].value, "4-5"); assert.equal(m["urine-pus"].unit, "/HPF");
  assert.equal(m["urine-pus"].refHigh, "3");
  assert.equal(m["urine-epithelial"].value, "1-2");
  assert.equal(m["urine-bilirubin"].value, "Nil"); assert.equal(m["urine-bilirubin"].unit, "mg/dL");
  assert.equal(m["urine-rbc"].value, "Nil"); // "RBC Cast" সারি থেকে নয়
  assert.equal(m["urine-cast-rbc"].value, "Nil");
  assert.equal(m["urine-cast-wbc"].value, "Nil");
  assert.ok(m["urine-triple-phosphate"] && m["urine-amorphous"] && m["urine-bacteria"] && m["urine-yeast"]);
  assert.ok(res.length >= 20, "পাওয়া গেছে " + res.length);
  assert.ok(res.every((c) => c.status === "ok"));
});

test("প্রস্রাব-এন্ট্রি শুধু প্রস্রাব-রিপোর্টে: রক্ত-রিপোর্টের 'Protein'/'PH' ধরা পড়ে না", () => {
  const blood = "Total Protein 7.1 g/dL\nPH 7.4\nSugar 5.5\nHb 13.2 g/dL";
  const ids = parseAndValidateReportText(blood, dict).map((c) => c.testId);
  assert.deepEqual(ids, ["hb"]);
});

test("সতর্কতা: Leukocytes Positive ও Pus Cells ৪-৫ (ল্যাব-রেঞ্জ ০-৩) ধরা; বাকিগুলো সবুজ", () => {
  const res = parseAndValidateReportText(URINE, dict);
  const obs = res.map((c) => ({ type: c.canonicalNameEn, value: String(c.value), unit: c.unit, refLow: c.refLow, refHigh: c.refHigh }));
  const alerts = buildLabAlerts(obs, dict, "male");
  assert.deepEqual(alerts.map((a) => a.testId).sort(), ["urine-leukocytes", "urine-pus"]);
  assert.match(alertLine(alerts.find((a) => a.testId === "urine-pus")), /Urine Pus Cells বেশি — 4-5/);
  const sum = summarizeSaved(obs, dict, "male");
  assert.equal(sum.alerts.length, 2);
  assert.equal(sum.unchecked, 0);
  assert.equal(sum.ok.length, res.length - 2);
});

test("S. Gravity/pH: রেঞ্জের বাইরে হলেই সতর্কতা; রেঞ্জ ৩ দশমিকে দেখায়", () => {
  const sg = dict.find((e) => e.id === "urine-sg");
  assert.equal(describeRangeBn(sg), "১.০১০–১.০৩০");
  const a = buildLabAlerts([{ type: "Urine Specific Gravity", value: "1.035", unit: "" }], dict, null);
  assert.equal(a.length, 1); assert.equal(a[0].level, "high");
  assert.deepEqual(buildLabAlerts([{ type: "Urine Specific Gravity", value: "1.015", unit: "" }], dict, null), []);
  assert.equal(buildLabAlerts([{ type: "Urine pH", value: "9.0", unit: "" }], dict, null)[0].level, "high");
});

test("withBuiltinTests: Firestore-এ একই id থাকলে সেটাই থাকে; মূল তালিকা বদলায় না", () => {
  const own = [{ id: "urine-ph", canonicalNameEn: "X" }];
  const out = withBuiltinTests(own);
  assert.equal(out.filter((e) => e.id === "urine-ph").length, 1);
  assert.equal(out.find((e) => e.id === "urine-ph").canonicalNameEn, "X");
  assert.equal(own.length, 1);
  assert.equal(new Set(BUILTIN_TESTS.map((e) => e.id)).size, BUILTIN_TESTS.length);
});

test("buildPdfLines: একই y-এর item এক সারিতে, x-ক্রমে; ভিন্ন y আলাদা সারি; কলাম-ক্রমে আসা item-ও ঠিক", () => {
  const it = (str, x, y, width = 20) => ({ str, width, transform: [1, 0, 0, 1, x, y] });
  // কলাম-ভিত্তিক ক্রমে (প্রথম কলামের সব, তারপর দ্বিতীয়)
  const items = [it("PH", 50, 700), it("Protein", 50, 680), it("6.0", 250, 700), it("Nil", 250, 680), it("4.5 - 8.0", 400, 700), it("Nil", 400, 680), it(" ", 100, 700)];
  assert.deepEqual(buildPdfLines(items), ["PH 6.0 4.5 - 8.0", "Protein Nil Nil"]);
  assert.deepEqual(buildPdfLines([]), []);
  // ভেঙে যাওয়া শব্দ জোড়া লাগে
  assert.deepEqual(buildPdfLines([it("Epit", 50, 600, 20), it("helial Cells", 70, 600, 60)]), ["Epithelial Cells"]);
});
