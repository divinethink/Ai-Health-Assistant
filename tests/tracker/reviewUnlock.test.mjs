import test from "node:test";
import assert from "node:assert/strict";
import { reviewUnlockDue, weekPeriodId } from "../../src/health/tracker/reviewUnlock.js";
import { normalizeReminders } from "../../src/health/tracker/reminderData.js";

const D = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi, 0);
// ২০২৬-১১-১৯ = বৃহস্পতিবার, ২০ = শুক্র, ২১ = শনি

test("সাপ্তাহিক: বৃহস্পতি ২০:৫৯ নেই, ২১:০০ আসে — শিরোনাম ঠিক", () => {
  assert.equal(reviewUnlockDue(D(2026, 11, 19, 20, 59)), null);
  const r = reviewUnlockDue(D(2026, 11, 19, 21, 0));
  assert.equal(r.title, "সাপ্তাহিক রিভিউ আনলক হয়েছে");
  assert.deepEqual(r.ids, ["rv-week-2026-11-19"]);
  assert.match(r.body, /শনিবার রাত ১১টা/);
});

test("সাপ্তাহিক: শুক্র ও শনি ২২:৫৯-এও একই পর্যায়-id (একবারই); শনি ২৩:০০ থেকে নেই", () => {
  assert.equal(weekPeriodId(D(2026, 11, 20, 10)), "rv-week-2026-11-19");
  assert.equal(weekPeriodId(D(2026, 11, 21, 22, 59)), "rv-week-2026-11-19");
  assert.deepEqual(reviewUnlockDue(D(2026, 11, 21, 22, 59)).ids, ["rv-week-2026-11-19"]);
  assert.equal(reviewUnlockDue(D(2026, 11, 21, 23, 0)), null);
  assert.equal(reviewUnlockDue(D(2026, 11, 22, 10)), null); // রবিবার
});

test("জানানো পর্যায় আর আসে না (isSeen)", () => {
  const seen = new Set(["rv-week-2026-11-19"]);
  assert.equal(reviewUnlockDue(D(2026, 11, 20, 9), (id) => seen.has(id)), null);
  assert.ok(reviewUnlockDue(D(2026, 11, 26, 21, 5), (id) => seen.has(id))); // পরের সপ্তাহ
});

test("মাসিক: শেষ দিন ২০:৫৯ নেই, ২১:০০ আসে; ১–৩ তারিখে আগের মাসের id", () => {
  assert.equal(reviewUnlockDue(D(2026, 11, 30, 20, 59)), null);
  const a = reviewUnlockDue(D(2026, 11, 30, 21, 0));
  assert.equal(a.title, "মাসিক রিভিউ আনলক হয়েছে"); assert.deepEqual(a.ids, ["rv-month-2026-11"]);
  const b = reviewUnlockDue(D(2026, 12, 2, 10)); // ২ ডিসেম্বর = বুধ
  assert.deepEqual(b.ids, ["rv-month-2026-11"]); // একই পর্যায় — ৩০ নভেম্বর জানানো হলে এখানে আসে না
  assert.equal(reviewUnlockDue(D(2026, 12, 2, 10), (id) => id === "rv-month-2026-11"), null);
  const late = reviewUnlockDue(D(2026, 12, 3, 23, 0)); // ৩ ডিসেম্বর বৃহস্পতি: সাপ্তাহিক খোলে, মাসিক বন্ধ
  assert.deepEqual(late.ids, ["rv-week-2026-12-03"]);
});

test("একই রাতে দুটোই (৩১ ডিসেম্বর ২০২৬ = বৃহস্পতি): একটাই যুক্ত নোটিফিকেশন", () => {
  const r = reviewUnlockDue(D(2026, 12, 31, 21, 0));
  assert.equal(r.title, "সাপ্তাহিক ও মাসিক রিভিউ আনলক হয়েছে"); assert.equal(r.ids.length, 2);
  assert.ok(r.ids.includes("rv-month-2026-12"));
});

test("যুক্ত নোটিফিকেশনের পর সপ্তাহ শেষ হলে মাসিক আবার আসে না", () => {
  const seen = new Set(["rv-week-2026-12-31", "rv-month-2026-12"]);
  assert.equal(reviewUnlockDue(D(2027, 1, 3, 10), (id) => seen.has(id)), null); // রবিবার, মাসিক এখনো খোলা কিন্তু জানানো
});

test("বছর বদল: ১ জানুয়ারি খোলা মাসের id = ডিসেম্বর", () => {
  assert.deepEqual(reviewUnlockDue(D(2027, 1, 1, 8)).ids.filter((x) => x.startsWith("rv-month")), ["rv-month-2026-12"]);
});

test("normalizeReminders: review ডিফল্ট চালু; বন্ধ করা মান টিকে থাকে; নষ্ট মানে ডিফল্ট", () => {
  assert.equal(normalizeReminders(undefined).review.on, true);
  assert.equal(normalizeReminders({ review: { on: false } }).review.on, false);
  assert.equal(normalizeReminders({ review: { on: "yes" } }).review.on, true);
});
