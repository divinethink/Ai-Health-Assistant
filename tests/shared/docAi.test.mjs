// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { classifyDocument } from "../../src/health/doc-ai/docClassify.js";
import { maskPii } from "../../src/health/doc-ai/piiMask.js";
import { parseAiJson, validatePrescriptionAi, validateLabAi, validateCardAi } from "../../src/health/doc-ai/aiResultValidate.js";
import { mergeIntoEmpty, mergeList, medicineKey } from "../../src/health/doc-ai/mergeFill.js";

const RX = `Dr. Karim MBBS\nRx\n1. Tab. Napa 500 mg 1+0+1 ৫ দিন খাবারের পরে\n2. Cap. Omeprazole 20mg 1+0+1 7 days\nAdvice: rest`;
const LAB = `Popular Diagnostic Centre\nTest Name  Result  Reference Range\nHemoglobin 12.5 g/dL 13-17\nWBC 7200 /cumm 4000-11000\nCreatinine 0.9 mg/dL 0.6-1.2`;
const CARD = `ডাঃ রহিম উদ্দিন\nMBBS, FCPS (Medicine)\nমেডিসিন বিশেষজ্ঞ\nSquare Hospital, Dhaka\nচেম্বার: ধানমন্ডি\nসিরিয়াল: 01711223344`;

test("ধরন-চেনা: প্রেসক্রিপশন/ল্যাব/কার্ড", () => {
  assert.equal(classifyDocument(RX).type, "prescription");
  assert.equal(classifyDocument(LAB).type, "lab-report");
  assert.equal(classifyDocument(CARD).type, "visiting-card");
});
test("ধরন-চেনা: ছোট/অর্থহীন লেখায় unknown", () => {
  assert.equal(classifyDocument("").type, "unknown");
  assert.equal(classifyDocument("abc\nxyz").type, "unknown");
  assert.equal(classifyDocument("hello world this is a letter\nabout nothing in particular at all").type, "unknown");
});

test("মাস্ক: রোগীর নাম/বয়স/ফোন/ইমেইল/ID মুছে, ডাক্তার ও ওষুধ অক্ষত", () => {
  const t = `Patient Name: Rahim Uddin\nAge: 35 Y  Sex: M\nMobile: 01711-223344\nEmail: a.b@mail.com\nNID: 1234567890123\nDr. Karim\nTab. Napa 500 mg 1+0+1 5 days`;
  const { text, masked } = maskPii(t, "prescription");
  assert.ok(masked >= 5);
  for (const bad of ["Rahim", "35", "01711", "a.b@mail", "1234567890123"]) assert.ok(!text.includes(bad), bad);
  assert.ok(text.includes("Dr. Karim") && text.includes("Napa 500 mg 1+0+1 5 days"));
});
test("মাস্ক: বাংলা অঙ্কের ফোন, Mr. নাম; ল্যাব-মান অক্ষত", () => {
  const { text } = maskPii("Mr. Karim Hossain, 40Y/M\nফোন ০১৭১১২২৩৩৪৪\nHemoglobin 12.5 g/dL", "lab-report");
  assert.ok(!text.includes("Karim") && !text.includes("০১৭১১") && !text.includes("40Y"));
  assert.ok(text.includes("Hemoglobin 12.5 g/dL"));
});
test("মাস্ক: ভিজিটিং কার্ডে অপরিবর্তিত; Ref by ডাক্তার রাখে", () => {
  assert.equal(maskPii(CARD, "visiting-card").text, CARD);
  assert.ok(maskPii("Ref by: Dr. Salam", "lab-report").text.includes("Dr. Salam"));
});

test("parseAiJson: বেড়া ও আশেপাশের লেখা সহ্য করে, ভাঙা হলে null", () => {
  assert.deepEqual(parseAiJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseAiJson('Here: {"a":1} done'), { a: 1 });
  assert.equal(parseAiJson("not json"), null);
  assert.equal(parseAiJson(""), null);
});

test("প্রেসক্রিপশন grounding: বানানো ওষুধ বাদ, বানানো ডোজ/দিন null", () => {
  const ai = { medicines: [
    { name: "Napa", strength: "500 mg", pattern: "1+0+1", days: 5, meal: "after" },
    { name: "Omeprazole", strength: "40 mg", pattern: "1+1+1", days: 30 },
    { name: "Fakemedin", strength: "10 mg", pattern: "1+0+0", days: 3 },
  ] };
  const { items, droppedItems } = validatePrescriptionAi(ai, RX);
  assert.equal(droppedItems, 1);
  assert.equal(items.length, 2);
  assert.deepEqual([items[0].strength, items[0].patternRaw, items[0].days], ["500 mg", "1+0+1", 5]);
  assert.deepEqual([items[1].strength, items[1].patternRaw, items[1].days], [null, null, null]);
  assert.deepEqual(items[1].dropped.sort(), ["days", "pattern", "strength"]);
});
test("প্রেসক্রিপশন: কাঠামো ভুল হলে খালি", () => {
  assert.deepEqual(validatePrescriptionAi(null, RX).items, []);
  assert.deepEqual(validatePrescriptionAi({ medicines: "x" }, RX).items, []);
});

test("ল্যাব grounding: নাম+সংখ্যা একই লাইনে থাকলেই গ্রহণ", () => {
  const ai = { results: [
    { name: "Hemoglobin", value: 12.5, unit: "g/dL" },
    { name: "Creatinine", value: 1.9, unit: "mg/dL" },
    { name: "Glucose", value: 5.5 },
    { name: "WBC", value: "7200", unit: "xx" },
  ] };
  const { items, droppedItems } = validateLabAi(ai, LAB);
  assert.deepEqual(items.map((i) => i.name), ["Hemoglobin", "WBC"]);
  assert.equal(items[1].unit, null);
  assert.equal(droppedItems, 2);
});

test("কার্ড grounding: ফোন/নাম টেক্সটে থাকলে রাখে, বানানো ঘর খালি", () => {
  const ai = { name: "ডাঃ রহিম উদ্দিন", phone: "+8801711223344", hospital: "Square Hospital", area: "Gulshan", chamberAddress: "" };
  const { fields, dropped } = validateCardAi(ai, CARD);
  assert.equal(fields.name, "ডাঃ রহিম উদ্দিন");
  assert.equal(fields.phone, "+8801711223344");
  assert.equal(fields.hospital, "Square Hospital");
  assert.equal(fields.area, "");
  assert.deepEqual(dropped, ["area"]);
});

test("mergeIntoEmpty: শুধু খালি ঘর ভরে, আগের মান অক্ষত, ইনপুট অপরিবর্তিত", () => {
  const cur = { name: "Dr. A", phone: "", hospital: "  " };
  const { merged, filled } = mergeIntoEmpty(cur, { name: "Dr. B", phone: "017", hospital: "X", area: "" }, ["name", "phone", "hospital", "area"]);
  assert.deepEqual(merged, { name: "Dr. A", phone: "017", hospital: "X" });
  assert.deepEqual(filled, ["phone", "hospital"]);
  assert.equal(cur.phone, "");
});
test("mergeList: নতুন ভুক্তি যোগ, বিদ্যমানের শুধু খালি ঘর ভরে", () => {
  const existing = [{ name: "Napa", strength: null, days: 5 }];
  const incoming = [{ name: "napa", strength: "500 mg", days: 9 }, { name: "Omeprazole", strength: "20 mg" }, { name: "" }];
  const r = mergeList(existing, incoming, medicineKey, ["strength", "days"]);
  assert.equal(r.added, 1);
  assert.equal(r.items[0].strength, "500 mg");
  assert.equal(r.items[0].days, 5);
  assert.deepEqual(r.items[0].aiFilled, ["strength"]);
  assert.equal(existing[0].strength, null);
});
