// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseAndValidateReportText } from "../../src/health/reports/reportParsing.js";
import { withExtraSynonyms } from "../../src/health/reports/testSynonyms.js";

const base = [
  { id: "tsh", canonicalNameEn: "TSH (Thyroid Stimulating Hormone)", synonyms: ["TSH", "Thyrotropin"], unit: "mIU/L", referenceRange: { low: 0.4, high: 4 }, plausibleRange: { low: 0.001, high: 150 } },
  { id: "ft4", canonicalNameEn: "Free T4", synonyms: ["Free T4", "FT4", "Free Thyroxine"], unit: "ng/dL", referenceRange: { low: 0.8, high: 1.8 }, plausibleRange: { low: 0.1, high: 10 } },
];
// SKH হরমোন রিপোর্টের ধাঁচ (আসল রিপোর্ট থেকে)
const report = "Test Name : F-T4, S. TSH\nTEST RESULT REFERENCE VALUE\nF-T4 1.13 ng/dL 0.69-1.78 ng/dL\nS. TSH 7.53 µIU/ml 0.25-5.00 µIU/ml";

test("F-T4 synonym ছাড়া ধরা পড়ে না, যোগের পর পড়ে", () => {
  assert.deepEqual(parseAndValidateReportText(report, base).map((c) => c.testId), ["tsh"]);
  const ids = parseAndValidateReportText(report, withExtraSynonyms(base)).map((c) => c.testId).sort();
  assert.deepEqual(ids, ["ft4", "tsh"]);
});
test("হেডার-লাইন ('F-T4, S. TSH') থেকে ভুল মান আসে না; µIU/ml একক ঠিক মেলে", () => {
  const res = parseAndValidateReportText(report, withExtraSynonyms(base));
  const ft4 = res.find((c) => c.testId === "ft4"), tsh = res.find((c) => c.testId === "tsh");
  assert.equal(ft4.value, 1.13); assert.equal(ft4.status, "ok");
  assert.equal(tsh.value, 7.53); assert.equal(tsh.status, "ok"); // unit-mismatch flag নেই
});
test("withExtraSynonyms মূল তালিকা বদলায় না; অন্য টেস্ট অক্ষত", () => {
  const out = withExtraSynonyms(base);
  assert.ok(out[1].synonyms.includes("F-T4") && !base[1].synonyms.includes("F-T4"));
  assert.strictEqual(out[0], base[0]);
});

test("WBC '7560 cumm' → ৭.৫৬ ×10³/µL, needs-review + unit-converted-cumm flag, rawValue অক্ষত", async () => {
  const { parseAndValidateReportText } = await import("../../src/health/reports/reportParsing.js");
  const dict = [{ id: "wbc", canonicalNameEn: "Total WBC Count", synonyms: ["WBC"], unit: "×10³/µL", referenceRange: { low: 4, high: 11 }, plausibleRange: { low: 0.1, high: 100 } }];
  const [c] = parseAndValidateReportText("Total WBC Count (TC) 7560 cumm", dict);
  assert.equal(c.value, 7.56);
  assert.equal(c.unit, "×10³/µL");
  assert.equal(c.rawValue, "7560");
  assert.equal(c.status, "needs-review");
  assert.ok(c.flags.includes("unit-converted-cumm"));
  assert.ok(!c.flags.includes("unit-mismatch") && !c.flags.includes("outside-plausible-range"));
});

test("RBS রিপোর্ট: হেডার/আইডি/HUMASTAR থেকে ভুল মান নয়; mmol/L মূল এককে; একটাই candidate", async () => {
  const { parseAndValidateReportText } = await import("../../src/health/reports/reportParsing.js");
  const dict = [
    { id: "rbs", canonicalNameEn: "Random Blood Sugar (RBS)", synonyms: ["RBS"], unit: "mg/dL", referenceRange: { low: 70, high: 140 }, plausibleRange: { low: 20, high: 800 } },
    { id: "sgot", canonicalNameEn: "SGOT (AST)", synonyms: ["SGOT", "AST"], unit: "U/L", referenceRange: { low: 8, high: 48 }, plausibleRange: { low: 1, high: 5000 } },
  ];
  const text = [
    "Test Name : RANDOM BLOOD SUGAR (RBS) Sample : Serum Lab ID : 20260721-90066",
    "Test is carried out by HUMASTAR 600",
    "RANDOM BLOOD SUGAR (RBS) 5.8 mmol/l <7.8",
  ].join("\n");
  const out = parseAndValidateReportText(text, dict);
  assert.equal(out.length, 1);
  assert.equal(out[0].testId, "rbs");
  assert.equal(out[0].value, 5.8);
  assert.equal(out[0].unit, "mmol/L");
  assert.equal(out[0].status, "ok");
});

test("Urine মাইক্রোস্কোপি-সারি (Pus Cells/WBC 4-5 /HPF) Total WBC হিসেবে ধরা পড়ে না; আসল CBC সারি ঠিক ধরে", () => {
  const dict = [{ id: "wbc", canonicalNameEn: "Total WBC Count", synonyms: ["WBC", "TC"], unit: "×10³/µL", referenceRange: { low: 4, high: 11 }, plausibleRange: { low: 0.1, high: 100 } }];
  const urine = ["Epithelial Cells 1-2 /HPF 0-5", "Pus Cells/WBC 4-5 /HPF 0-3", "Pus Cells/WBC 4 - 5 HPF", "Pus Cells/WBC 4–5 /HPF", "WBC Cast 2 /HPF", "WBC Cast Nil /HPF"].join("\n");
  assert.deepEqual(parseAndValidateReportText(urine, dict), []);
  const cbc = parseAndValidateReportText("Total WBC Count (TC) 7560 cumm", dict);
  assert.equal(cbc.length, 1); assert.equal(cbc[0].value, 7.56);
});
