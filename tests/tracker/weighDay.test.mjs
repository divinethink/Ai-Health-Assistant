// সাপ্তাহিক ওজনের দিন — চালানো: node --test tests/tracker/weighDay.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeWeighDay, weighDayOf, isWeighDate, lastWeighDate, onlyWeighDays, weighState, daysAgoText, weighReminderDue } from "../../src/health/tracker/weighDay.js";

// ২০২৬-১১-১৩ = শুক্রবার, ১১-১৪ = শনি, ১১-১৫ = রবি, ১১-১২ = বৃহস্পতি
test("ডিফল্ট শুক্রবার (৬); অবৈধ মান ডিফল্টে; বৈধ ০–৬ থাকে", () => {
  assert.equal(weighDayOf(null), 6); assert.equal(weighDayOf({}), 6);
  [null, undefined, "x", 7, -1, 2.5, NaN, ""].forEach((v) => assert.equal(sanitizeWeighDay(v), 6));
  assert.equal(sanitizeWeighDay(0), 0); assert.equal(sanitizeWeighDay("3"), 3); assert.equal(weighDayOf({ weighDay: 2 }), 2);
});
test("isWeighDate / lastWeighDate", () => {
  assert.equal(isWeighDate("2026-11-13", 6), true);
  assert.equal(isWeighDate("2026-11-14", 6), false);
  assert.equal(lastWeighDate("2026-11-13", 6), "2026-11-13");
  assert.equal(lastWeighDate("2026-11-15", 6), "2026-11-13");
  assert.equal(lastWeighDate("2026-11-12", 6), "2026-11-06");
  assert.equal(lastWeighDate("2026-11-15", 1), "2026-11-15"); // রবি = ১
  assert.equal(lastWeighDate("2026-03-01", 6), "2026-02-27"); // মাস/বছর পেরোনো
  assert.equal(lastWeighDate("2027-01-01", 6), "2027-01-01"); // ২০২৭-০১-০১ শুক্রবার
  assert.equal(lastWeighDate("2026-12-31", 6), "2026-12-25"); // বছর পেরোনো
});
test("onlyWeighDays শুধু ওজনের দিনের পয়েন্ট রাখে", () => {
  const pts = [{ date: "2026-11-12", value: 1 }, { date: "2026-11-13", value: 2 }, { date: "2026-11-14", value: 3 }, null, { value: 9 }];
  assert.deepEqual(onlyWeighDays(pts, 6), [{ date: "2026-11-13", value: 2 }]);
  assert.deepEqual(onlyWeighDays(null, 6), []);
});
test("অবস্থা: due → done; অন্য দিনের ওজন due মেটায় না", () => {
  const w = (today, docs, soft) => weighState({ today, weighDay: 6, docs, soft });
  assert.equal(w("2026-11-13", []).kind, "due");
  assert.equal(w("2026-11-13", [{ date: "2026-11-12", weightKg: 62 }]).kind, "due"); // বৃহস্পতির ওজন শুক্রবারের কাজ নয়
  assert.equal(w("2026-11-13", [{ date: "2026-11-13", weightKg: 62 }]).kind, "done");
  assert.equal(w("2026-11-13", [{ date: "2026-11-13", weightKg: 0 }]).kind, "due");
});
test("অবস্থা: ওজনের দিন পেরোলে ≤২ দিন missed, তারপর idle; পরের ওজন-দিনে আবার due", () => {
  const w = (today) => weighState({ today, weighDay: 6, docs: [] }).kind;
  assert.equal(w("2026-11-14"), "missed"); assert.equal(w("2026-11-15"), "missed");
  assert.equal(w("2026-11-16"), "idle"); assert.equal(w("2026-11-19"), "idle");
  assert.equal(w("2026-11-20"), "due");
  // পরে (শনিবারে) গত শুক্রবারের তারিখে ওজন দিলে missed মেটে
  assert.equal(weighState({ today: "2026-11-14", weighDay: 6, docs: [{ date: "2026-11-13", weightKg: 61.8 }] }).kind, "done");
});
test("soft ফ্ল্যাগ পাস হয় (UI আভা বন্ধ রাখতে)", () => {
  assert.equal(weighState({ today: "2026-11-13", weighDay: 6, docs: [], soft: true }).soft, true);
  assert.equal(weighState({ today: "2026-11-13", weighDay: 6, docs: [] }).soft, false);
});
test("শেষ ওজন + কত দিন আগে; ভবিষ্যৎ তারিখ গোনা হয় না", () => {
  const s = weighState({ today: "2026-11-15", weighDay: 6, docs: [{ date: "2026-11-12", weightKg: 62.4 }, { date: "2026-11-20", weightKg: 99 }] });
  assert.equal(s.lastKg, 62.4); assert.equal(s.daysAgo, 3); assert.equal(s.lastDate, "2026-11-12");
  assert.equal(weighState({ today: "2026-11-15", weighDay: 6, docs: [] }).lastKg, null);
});
test("আগের ওজন-দিনের সাথে সংখ্যার পার্থক্য: শুধু ওজন-দিন, ব্যবধান ≤১৪ দিন", () => {
  const docs = [{ date: "2026-11-06", weightKg: 63 }, { date: "2026-11-10", weightKg: 70 }, { date: "2026-11-13", weightKg: 62.4 }];
  const s = weighState({ today: "2026-11-13", weighDay: 6, docs });
  assert.equal(s.delta.kg, -0.6); assert.equal(s.delta.fromDate, "2026-11-06");
  assert.equal(weighState({ today: "2026-11-13", weighDay: 6, docs: [{ date: "2026-10-02", weightKg: 60 }, { date: "2026-11-13", weightKg: 62 }] }).delta, null); // ব্যবধান বেশি
  assert.equal(weighState({ today: "2026-11-13", weighDay: 6, docs: [{ date: "2026-11-13", weightKg: 62 }] }).delta, null);
});
test("কাস্টম ওজনের দিন (সোমবার=২)", () => {
  assert.equal(weighState({ today: "2026-11-16", weighDay: 2, docs: [] }).kind, "due");
  assert.equal(weighState({ today: "2026-11-13", weighDay: 2, docs: [] }).kind, "idle");
});
test("daysAgoText", () => {
  const bn = (n) => "<" + n + ">";
  assert.equal(daysAgoText(0, bn), "আজ"); assert.equal(daysAgoText(1, bn), "গতকাল"); assert.equal(daysAgoText(3, bn), "<3> দিন আগে"); assert.equal(daysAgoText(null, bn), "");
});
test("নোটিফিকেশন: শুধু ওজনের দিনে, সময়ের পর, চালু থাকলে", () => {
  const cfg = { on: true, time: "09:00" };
  assert.equal(weighReminderDue(cfg, 6, "2026-11-13", "08:59"), null);
  assert.equal(weighReminderDue(cfg, 6, "2026-11-13", "09:00").id, "weigh");
  assert.ok(weighReminderDue(cfg, 6, "2026-11-13", "21:30").title.includes("ওজন বসাতে ভুলবেন না"));
  assert.equal(weighReminderDue(cfg, 6, "2026-11-12", "10:00"), null); // বৃহস্পতি
  assert.equal(weighReminderDue({ on: false, time: "09:00" }, 6, "2026-11-13", "10:00"), null);
  assert.equal(weighReminderDue(null, 6, "2026-11-13", "10:00"), null);
});
