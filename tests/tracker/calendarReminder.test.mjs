// ক্যালেন্ডার-নোটিফিকেশন (ফিক্স ১) pure হিসাব। চালান: node --test tests/tracker/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReminders, anyReminderOn, dueCalendarEvents, DEFAULT_REMINDERS } from "../../src/health/tracker/reminderData.js";

const T = "2026-11-10";
const ev = (o) => ({ id: "E1", title: "টিকা — ২য় ডোজ", date: "2026-11-15", memberId: "m1", status: "upcoming", ...o });
const on = (d) => ({ on: true, daysBefore: d });

test("normalize: পুরনো ডকে calendar না থাকলে বন্ধ+ডিফল্ট; অবৈধ daysBefore → ডিফল্ট", () => {
  assert.deepEqual(normalizeReminders(null).calendar, DEFAULT_REMINDERS.calendar);
  assert.deepEqual(normalizeReminders({ meal: { on: true } }).calendar, { on: false, daysBefore: 1 });
  assert.equal(normalizeReminders({ calendar: { on: true, daysBefore: 5 } }).calendar.daysBefore, 1);
  assert.deepEqual(normalizeReminders({ calendar: { on: true, daysBefore: 7 } }).calendar, { on: true, daysBefore: 7 });
});

test("anyReminderOn: শুধু calendar চালু থাকলেও true", () => {
  assert.equal(anyReminderOn(normalizeReminders({ calendar: { on: true } })), true);
  assert.equal(anyReminderOn(normalizeReminders(null)), false);
});

test("daysBefore দিন আগে ও সেই দিন — মাঝের দিনে নয়", () => {
  assert.equal(dueCalendarEvents([ev({ date: "2026-11-15" })], "m1", on(5), T, "09:00").length, 1); // ৫ দিন আগে
  assert.equal(dueCalendarEvents([ev({ date: "2026-11-15" })], "m1", on(1), T, "09:00").length, 0); // ৫ দিন বাকি, daysBefore ১
  assert.equal(dueCalendarEvents([ev({ date: "2026-11-11" })], "m1", on(1), T, "09:00")[0].body, "আগামীকাল");
  assert.equal(dueCalendarEvents([ev({ date: T })], "m1", on(3), T, "09:00")[0].body, "আজ");
});

test("বাদ: সম্পন্ন, পুরনো তারিখ, অন্যের ইভেন্ট; সবার (memberId null) ধরে", () => {
  assert.equal(dueCalendarEvents([ev({ date: T, status: "done" })], "m1", on(1), T, "09:00").length, 0);
  assert.equal(dueCalendarEvents([ev({ date: "2026-11-09" })], "m1", on(1), T, "09:00").length, 0);
  assert.equal(dueCalendarEvents([ev({ date: T, memberId: "m2" })], "m1", on(1), T, "09:00").length, 0);
  assert.equal(dueCalendarEvents([ev({ date: T, memberId: null })], "m1", on(1), T, "09:00").length, 1);
});

test("সেটিং বন্ধ বা সকাল ৮টার আগে বা খালি ইনপুটে কিছু নয়", () => {
  assert.equal(dueCalendarEvents([ev({ date: T })], "m1", { on: false, daysBefore: 1 }, T, "09:00").length, 0);
  assert.equal(dueCalendarEvents([ev({ date: T })], "m1", on(1), T, "07:59").length, 0);
  assert.deepEqual(dueCalendarEvents(null, "m1", on(1), T, "09:00"), []);
  assert.deepEqual(dueCalendarEvents([ev({ date: T })], "m1", null, T, "09:00"), []);
});

test("id দিনভেদে আলাদা (দিনে একবার-গার্ড একই ইভেন্টের 'আগের দিন' ও 'সেই দিন' আলাদা ধরে)", () => {
  const a = dueCalendarEvents([ev({ date: "2026-11-11" })], "m1", on(1), T, "09:00")[0].id;
  const b = dueCalendarEvents([ev({ date: "2026-11-11" })], "m1", on(1), "2026-11-11", "09:00")[0].id;
  assert.notEqual(a, b);
});
