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
