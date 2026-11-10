// ধাপ ৭ — চালানো: node --test tests/tracker/timelineExtras.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { calendarEntries, trackerWeekEntry } from "../../src/health/timeline/timelineExtras.js";

const today = "2026-11-10";
const ev = [
  { id: "a", memberId: "m1", date: "2026-11-15", title: "টিকা — ২য় ডোজ", eventType: "vaccination", status: "upcoming" },
  { id: "b", memberId: null, date: "2026-11-17", title: "ডাক্তার ফলো-আপ", eventType: "appointment" },
  { id: "c", memberId: "m2", date: "2026-11-12", title: "অন্যের", eventType: "appointment" },
  { id: "d", memberId: "m1", date: "2026-11-06", title: "টিকা — ১ম ডোজ", eventType: "vaccination", status: "done" },
  { id: "e", memberId: "m1", date: "2027-03-01", title: "অনেক দূরে", eventType: "checkup" },
  { id: "f", memberId: "m1", date: "2026-11-01", title: "পুরনো", eventType: "appointment", status: "upcoming" },
  { id: "g", memberId: "m1", date: "", title: "তারিখহীন" },
];
test("সদস্য/সবার ইভেন্ট, দূরের ভবিষ্যৎ বাদ, তারিখহীন বাদ", () => {
  const r = calendarEntries(ev, "m1", today);
  assert.deepEqual(r.map((x) => x.id).sort(), ["cal-a", "cal-b", "cal-d", "cal-f"]);
});
test("ক্যাটাগরি ও অবস্থা", () => {
  const r = Object.fromEntries(calendarEntries(ev, "m1", today).map((x) => [x.id, x]));
  assert.equal(r["cal-a"].category, "vaccine");
  assert.equal(r["cal-a"].description, "আসন্ন · ৫ দিন পরে");
  assert.equal(r["cal-b"].category, "calendar");
  assert.equal(r["cal-d"].description, "সম্পন্ন");
  assert.equal(r["cal-f"].description, "তারিখ পেরিয়েছে");
});
test("null/খালি ইনপুটে ক্র্যাশ নয়", () => {
  assert.deepEqual(calendarEntries(null, "m1", today), []);
  assert.equal(trackerWeekEntry(null), null);
  assert.equal(trackerWeekEntry([]), null);
  assert.equal(trackerWeekEntry([{ date: "2026-11-09", waterGlasses: 5 }]), null); // দেখানোর মতো সংখ্যা নেই
});
test("ট্র্যাকার-সপ্তাহ: গড়/যোগফল, শেষ তারিখে বসে", () => {
  const e = trackerWeekEntry([
    { date: "2026-11-05", sleepMinutes: 360, steps: 4000, exerciseMin: 20 },
    { date: "2026-11-09", sleepMinutes: 420, steps: 5000, exerciseMin: 10, caloriesIn: 1800 },
  ]);
  assert.equal(e.id, "tracker-week-2026-11-09");
  assert.equal(e.category, "tracker");
  assert.equal(e.description, "গড় ঘুম ৬.৫ ঘণ্টা · গড় স্টেপ ৪,৫০০ · গড় ক্যালরি ১৮০০ · ব্যায়াম ৩০ মিনিট");
});
