import test from "node:test";
import assert from "node:assert/strict";
import { ALL_ITEMS } from "../../src/health/mycare/data/index.js";
import { buildExplainPayload, buildExplainPrompt, cleanExplanation, validateExplanation, explainWith, FALLBACK } from "../../src/health/mycare/careAiGuard.js";

const get = (id) => ({ item: ALL_ITEMS.find((i) => i.id === id), notes: [] });
const sun = get("skin-sunscreen");   // SPF 30+, "২ ঘণ্টা"
const brush = get("oral-fluoride-brushing"); // "দুবার", "২ মিনিট"

test("payload-এ শুধু আইটেমের লেখা; নাম/DOB/রেকর্ড/প্রোফাইল-কী নেই", () => {
  const p = buildExplainPayload(sun, "bn");
  assert.deepEqual(Object.keys(p).sort(), ["item", "kind"]);
  assert.deepEqual(Object.keys(p.item).sort(), ["how", "name", "redFlagNote", "warnings", "why"]);
  const t = JSON.stringify(p);
  for (const bad of ["dob", "ageYears", "allerg", "memberId", "familyId", "records"]) assert.equal(t.includes(bad), false, bad);
  assert.ok(buildExplainPayload(sun, "en").item.name.includes("sunscreen"));
  assert.ok(buildExplainPrompt("bn").includes("নতুন কোনো সংখ্যা"));
});

test("ভালো উত্তর পাস; শেষের ফলো-আপ প্রশ্ন বাদ", () => {
  const r = validateExplanation("বাইরে যাওয়ার আগে সানস্ক্রিন লাগান। রোদে থাকলে প্রতি ২ ঘণ্টা পরপর আবার লাগান।\nআরও কোনো লক্ষণ আছে কি?", sun);
  assert.equal(r.ok, true);
  assert.equal(r.text.includes("আরও কোনো"), false);
  assert.equal(cleanExplanation("এক\n\n"), "এক");
});

test("নতুন সংখ্যা ব্লক — Latin ও বাংলা অঙ্ক দুটোই; উৎসের সংখ্যা চলে (SPF 30, ২ ঘণ্টা)", () => {
  assert.equal(validateExplanation("প্রতি ৪ ঘণ্টায় লাগান।", sun).reason, "new-number");
  assert.equal(validateExplanation("Apply every 4 hours.", sun).reason, "new-number");
  assert.equal(validateExplanation("SPF 50 নিন।", sun).reason, "new-number");
  assert.equal(validateExplanation("SPF 30 বা বেশি নিন, প্রতি 2 ঘণ্টায় আবার লাগান।", sun).ok, true);
  assert.equal(validateExplanation("২ ঘণ্টা পরপর, ১.৫ কাপ পানি।", sun).reason, "new-number");
});

test("সংখ্যা-শব্দ (তিনবার, দুই ঘণ্টা) উৎসে না থাকলে ব্লক; থাকলে পাস", () => {
  assert.equal(validateExplanation("দিনে তিনবার ব্রাশ করুন।", brush).reason, "new-quantity");
  assert.equal(validateExplanation("Brush three times a day.", brush).reason, "new-quantity");
  assert.equal(validateExplanation("দিনে দুবার ব্রাশ করুন।", brush).ok, true);
});

test("নিষিদ্ধ শব্দ ও নিষিদ্ধ উপাদান ব্লক (বাংলা/ইংরেজি)", () => {
  for (const w of ["এটি ব্রণ নিরাময় করে।", "প্রমাণিত উপায়।", "খুবই কার্যকর।", "It will cure acne.", "This is proven."]) assert.equal(validateExplanation(w, sun).reason, "forbidden-word", w);
  assert.equal(validateExplanation("সঙ্গে রেটিনল ক্রিম লাগান।", sun).reason, "banned-active");
  assert.equal(validateExplanation("", sun).reason, "empty");
  assert.equal(validateExplanation("ক".repeat(1600), sun).reason, "too-long");
});

test("বাংলা যুক্তাক্ষর ভাঙা উত্তরে ভুল-ব্লক হয় না ('জ্বালা' ≠ 'ব্লিচ')", () => {
  assert.equal(validateExplanation("জ্বালা হলে ব্যবহার বন্ধ করুন।", sun).ok, true);
});

test("explainWith: ok / blocked / ব্যর্থ — কখনো throw নয়", async () => {
  const good = await explainWith(async () => ({ content: "বাইরে যাওয়ার আগে সানস্ক্রিন লাগান।", blocked: false }), "f1", sun, "bn");
  assert.equal(good.ok, true);
  const blocked = await explainWith(async () => ({ content: "x", blocked: true }), "f1", sun, "bn");
  assert.deepEqual([blocked.ok, blocked.reason, blocked.fallback], [false, "blocked", FALLBACK]);
  const bad = await explainWith(async () => ({ content: "প্রতি ৯ ঘণ্টায়।" }), "f1", sun, "bn");
  assert.deepEqual([bad.ok, bad.reason], [false, "new-number"]);
  assert.equal(bad.fallback, FALLBACK);
  const down = await explainWith(async () => { throw new Error("ai-error:rate-limited"); }, "f1", sun, "bn");
  assert.deepEqual([down.ok, down.reason], [false, "unavailable"]);
});

test("explainWith: শুধু payload+প্রম্পট পাঠায়, ageYears/প্রোফাইল-অপশন নয়", async () => {
  let seen;
  await explainWith(async (fid, payload, hist, opts) => { seen = { fid, payload, hist, opts }; return { content: "ঠিক আছে।" }; }, "f1", sun, "bn", { maxRetries: 1 });
  assert.equal(seen.fid, "f1");
  assert.equal(seen.payload.kind, "mycare-explain");
  assert.equal(seen.hist.length, 1);
  assert.equal("ageYears" in seen.opts, false);
});
