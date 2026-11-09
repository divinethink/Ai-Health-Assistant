// চালানো: node --test tests/doctor/doctorSuggest.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeName, normalizePhone, doctorKey, isDuplicate, buildCandidates, suggestDoctors, pickPatch } from "../../src/health/doctor-details/doctorSuggest.js";

test("normalizeName: ডা./ডাঃ/Dr. উপসর্গ ও case-fold", () => {
  assert.equal(normalizeName("ডা. রহিম উদ্দিন"), "রহিম উদ্দিন");
  assert.equal(normalizeName("ডাঃ রহিম উদ্দিন"), "রহিম উদ্দিন");
  assert.equal(normalizeName("Dr. Rahim  Uddin"), "rahim uddin");
  assert.equal(normalizeName("DR Rahim"), "rahim");
  assert.equal(normalizeName("  "), "");
  assert.equal(normalizeName(null), "");
});
test("normalizePhone: বাংলা অঙ্ক ও +880", () => {
  assert.equal(normalizePhone("০১৭১২-৩৪৫৬৭৮"), "01712345678");
  assert.equal(normalizePhone("+880 1712 345678"), "01712345678");
});
test("doctorKey: ডা. উপসর্গ ও ফরম্যাট নির্বিশেষে এক", () => {
  assert.equal(doctorKey("ডা. রহিম", "+8801712345678"), doctorKey("রহিম", "01712-345678"));
});
test("isDuplicate: ফোন ভিন্ন হলে আলাদা, একটায় না থাকলে নাম-মিলই duplicate", () => {
  assert.equal(isDuplicate({ name: "Dr. Rahim", phone: "01711111111" }, { name: "rahim", phone: "01722222222" }), false);
  assert.equal(isDuplicate({ name: "Dr. Rahim", phone: "01711111111" }, { name: "rahim", phone: "" }), true);
  assert.equal(isDuplicate({ name: "করিম" }, { name: "রহিম" }), false);
});
const docs = [
  { id: "d1", name: "ডা. রহিম উদ্দিন", specialtyCategory: "medicine", hospital: "ঢাকা মেডিকেল", phone: "01711111111" },
  { id: "d2", name: "Dr. Karim", specialtyCategory: "cardiology-neurology", hospital: "Square Hospital", phone: "01722222222" },
];
const recs = [
  { treatingPhysician: { name: "রহিম উদ্দিন", chamberContact: "+8801711111111", hospital: "ঢাকা মেডিকেল" } },
  { treatingPhysician: { name: "Dr. Salma", chamberContact: "01733333333", hospital: "Labaid", specialtyCategory: "obgyn" } },
  { treatingPhysician: null },
  {},
];
test("buildCandidates: duplicate বাদ, ডিরেক্টরি আগে, নাম-ছাড়া বাদ", () => {
  const c = buildCandidates(docs, recs);
  assert.equal(c.length, 3);
  assert.equal(c[0].source, "directory");
  assert.equal(c[2].name, "Dr. Salma");
  assert.deepEqual(buildCandidates(null, null), []);
});
test("suggestDoctors: নাম prefix (বাংলা/ইংরেজি, উপসর্গসহ)", () => {
  const c = buildCandidates(docs, recs);
  assert.deepEqual(suggestDoctors(c, { query: "ডা. র" }).map((x) => x.id), ["d1"]);
  assert.deepEqual(suggestDoctors(c, { query: "kar" }).map((x) => x.id), ["d2"]);
  assert.deepEqual(suggestDoctors(c, { query: "sal" }).map((x) => x.name), ["Dr. Salma"]);
});
test("suggestDoctors: প্রতিষ্ঠান-মিল, ক্যাটেগরি filter, খালি query", () => {
  const c = buildCandidates(docs, recs);
  assert.deepEqual(suggestDoctors(c, { query: "square" }).map((x) => x.id), ["d2"]);
  assert.deepEqual(suggestDoctors(c, { query: "", category: "cardiology-neurology" }).map((x) => x.id), ["d2"]);
  assert.deepEqual(suggestDoctors(c, { query: "র", category: "cardiology-neurology" }), []);
  assert.deepEqual(suggestDoctors(c, { query: "" }), []);
});
test("pickPatch: শুধু অ-খালি ফিল্ড, doctorId সহ", () => {
  const p = pickPatch({ id: "d1", name: "X", hospital: "H", phone: "", area: "" });
  assert.deepEqual(p, { name: "X", hospital: "H", doctorId: "d1" });
});
