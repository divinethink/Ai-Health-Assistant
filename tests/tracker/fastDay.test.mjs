import test from "node:test";
import assert from "node:assert/strict";
import { ateInDaytime, fastOnDate, slotsForDay, fastDefaultSlot } from "../../src/health/tracker/fastDay.js";
import { sanitizeExtraFoods } from "../../src/health/tracker/planPrefs.js";
import { weekSummary } from "../../src/health/tracker/todaySummary.js";

const SUN = "2026-11-08"; // রবি
const x = (slot) => ({ name: "রুটি", kcal: 100, slot });

test("দিনের বেলার লগ/টিক = সিয়াম রাখা হয়নি; সেহরি/ইফতার/রাত বা খালি = সিয়াম", () => {
  assert.equal(fastOnDate(SUN, [1], undefined), true);
  assert.equal(fastOnDate(SUN, [1], { extraFoods: [x("sehri"), x("iftar"), x("dinner")] }), true);
  ["breakfast", "snack1", "lunch", "snack2"].forEach((s) => assert.equal(fastOnDate(SUN, [1], { extraFoods: [x("sehri"), x(s)] }), false));
  assert.equal(fastOnDate(SUN, [1], { mealsEaten: ["lunch"] }), false);
  assert.equal(fastOnDate(SUN, [1], { mealsEaten: ["dinner"] }), true);
  assert.equal(fastOnDate(SUN, [0], { extraFoods: [] }), false); // পরিকল্পিত নয়
  assert.equal(ateInDaytime(null), false);
});
test("ভুল লগ মুছলে আবার সিয়াম", () => {
  assert.equal(fastOnDate(SUN, [1], { extraFoods: [x("lunch")] }), false);
  assert.equal(fastOnDate(SUN, [1], { extraFoods: [] }), true);
});
test("বেলার ক্রম ও extraFoods-এ নতুন বেলা বৈধ", () => {
  assert.deepEqual(slotsForDay(true).map((s) => s.id), ["sehri", "breakfast", "snack1", "lunch", "snack2", "iftar", "dinner"]);
  assert.deepEqual(slotsForDay(false).map((s) => s.id), ["breakfast", "snack1", "lunch", "snack2", "dinner"]);
  assert.equal(sanitizeExtraFoods([x("sehri"), x("iftar"), x("bogus")]).length, 2);
});
test("ডিফল্ট বেলা: শুধু পরিকল্পিত দিনে, সময় অনুযায়ী", () => {
  assert.equal(fastDefaultSlot(false, new Date(2026, 10, 8, 4)), null);
  assert.equal(fastDefaultSlot(true, new Date(2026, 10, 8, 4)), "sehri");
  assert.equal(fastDefaultSlot(true, new Date(2026, 10, 8, 18)), "iftar");
  assert.equal(fastDefaultSlot(true, new Date(2026, 10, 8, 13)), null);
});
test("সাপ্তাহিক বৃত্ত: সিয়াম-দিন 'fast', দিনে খেলে 'miss' (আজ নয়)", () => {
  const ctx = { calorieTarget: 2000, exTarget: 30, waterTarget: 8, sleepMinH: 7, fastDays: [1] };
  const week = ["2026-11-07", SUN, "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
  assert.equal(weekSummary([], week, "2026-11-10", ctx).days[1].state, "fast");
  assert.equal(weekSummary([{ date: SUN, extraFoods: [x("lunch")] }], week, "2026-11-10", ctx).days[1].state, "miss");
});
