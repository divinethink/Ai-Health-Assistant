// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { runDocExtract } from "../../src/health/doc-ai/docExtractCore.js";

const RX = "Patient Name: Rahim Uddin\nMobile: 01711223344\nRx\n1. Tab. Napa 500 mg 1+0+1 5 days\n2. Cap. Omeprazole 20mg 1+0+1 7 days";
const base = { docType: "prescription", ocrText: RX, familyId: "f1", baseUrl: "https://w.test", getIdToken: async () => "tok", sleep: async () => {} };
const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("সফল: মাস্ক-করা লেখা যায়, grounding-ব্যর্থ ওষুধ বাদ", async () => {
  let sent;
  const r = await runDocExtract({ ...base, fetchFn: async (u, o) => { sent = JSON.parse(o.body); return reply(200, { provider: "groq", data: { medicines: [{ name: "Napa", strength: "500 mg", pattern: "1+0+1", days: 5 }, { name: "Ghost", strength: null }] } })(); } });
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.droppedItems, 1);
  assert.equal(r.provider, "groq");
  assert.ok(!sent.text.includes("Rahim") && !sent.text.includes("01711223344"));
  assert.ok(sent.text.includes("Napa 500 mg"));
  assert.equal(sent.docType, "prescription");
});
test("কার্ড: ফল fields আকারে, বানানো ঘর খালি", async () => {
  const card = "ডাঃ রহিম উদ্দিন\nMBBS FCPS\nSquare Hospital Dhaka\nসিরিয়াল 01711223344";
  const r = await runDocExtract({ ...base, docType: "visiting-card", ocrText: card, fetchFn: reply(200, { data: { name: "ডাঃ রহিম উদ্দিন", hospital: "Square Hospital", area: "Mars" } }) });
  assert.equal(r.fields.hospital, "Square Hospital");
  assert.equal(r.fields.area, "");
  assert.equal(r.empty, false);
});
test("সব ভুয়া হলে empty=true", async () => {
  const r = await runDocExtract({ ...base, fetchFn: reply(200, { data: { medicines: [{ name: "Zzzzz" }] } }) });
  assert.equal(r.ok, true); assert.equal(r.empty, true);
});
test("429-এ retry, তারপর সফল", async () => {
  let n = 0, retries = 0;
  const r = await runDocExtract({ ...base, options: { onRetry: () => retries++ }, fetchFn: async () => (++n < 3 ? reply(429, { error: "429" })() : reply(200, { data: { medicines: [{ name: "Napa" }] } })()) });
  assert.equal(r.ok, true); assert.equal(n, 3); assert.equal(retries, 2);
});
test("retry শেষে ব্যর্থ; daily-limit-এ retry নয়", async () => {
  let n = 0;
  const r1 = await runDocExtract({ ...base, fetchFn: async () => { n++; return reply(429, { error: "429" })(); } });
  assert.deepEqual([r1.ok, r1.reason, n], [false, "429", 3]);
  n = 0;
  const r2 = await runDocExtract({ ...base, fetchFn: async () => { n++; return reply(429, { error: "daily-limit" })(); } });
  assert.deepEqual([r2.reason, n], ["daily-limit", 1]);
});
test("নীরব ব্যর্থতা: network/ভাঙা JSON/অসমর্থিত ধরন/ছোট লেখা/টোকেন নেই — কখনো throw নয়", async () => {
  assert.equal((await runDocExtract({ ...base, fetchFn: async () => { throw new Error("x"); } })).reason, "network");
  assert.equal((await runDocExtract({ ...base, fetchFn: reply(200, { data: "not-json" }) })).reason, "bad-json");
  assert.equal((await runDocExtract({ ...base, docType: "imaging", fetchFn: reply(200, {}) })).reason, "unsupported-type");
  assert.equal((await runDocExtract({ ...base, ocrText: "hi", fetchFn: reply(200, {}) })).reason, "text-too-short");
  assert.equal((await runDocExtract({ ...base, getIdToken: async () => null, fetchFn: reply(200, {}) })).reason, "not-signed-in");
  assert.equal((await runDocExtract({ ...base, baseUrl: "", fetchFn: reply(200, {}) })).reason, "not-configured");
  assert.equal((await runDocExtract({ ...base, getIdToken: async () => { throw new Error("boom"); }, fetchFn: reply(200, {}) })).reason, "error");
});
test("সার্ভার-ত্রুটি কোড ফেরত যায়", async () => {
  assert.equal((await runDocExtract({ ...base, fetchFn: reply(403, { error: "forbidden" }) })).reason, "forbidden");
  assert.equal((await runDocExtract({ ...base, fetchFn: reply(502, { error: "bad-json" }) })).reason, "bad-json");
});
