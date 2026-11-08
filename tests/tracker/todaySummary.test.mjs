// চালানো: node --test tests/tracker/todaySummary.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { ringDash, pctOf, metricsOf, dayHit, streakOf, weekSummary, last30DatesISO, STREAK_MAX } from "../../src/health/tracker/todaySummary.js";

const ctx = { calorieTarget: 2000, exTarget: 30, waterTarget: 8, sleepMinH: 7 };
const doc = (date, o) => ({ date, ...o });
const GOOD = { exerciseMin: 30, waterGlasses: 8 };

test("ringDash: ০–১০০ এ ক্ল্যাম্প, অবৈধ মান ০", () => {
  assert.equal(ringDash(50, 10).dash, ringDash(100, 10).dash / 2);
  assert.equal(ringDash(250, 10).pct, 100);
  assert.equal(ringDash(-5, 10).dash, 0);
  assert.equal(ringDash(NaN, 10).dash, 0);
  assert.equal(pctOf(5, 0), 0);
  assert.equal(pctOf(undefined, 10), 0);
});
test("দিন-হিট: অন্তত ২টি লক্ষ্য; কম ক্যালরি সফল নয়", () => {
  assert.equal(dayHit(GOOD, ctx), true);
  assert.equal(dayHit({ exerciseMin: 30 }, ctx), false);
  assert.equal(dayHit(null, ctx), false);
  assert.deepEqual(metricsOf({ caloriesIn: 900, exerciseMin: 30 }, ctx).met, ["exercise"]);
  assert.deepEqual(metricsOf({ caloriesIn: 1800, exerciseMin: 30 }, ctx).met, ["calories", "exercise"]);
  assert.deepEqual(metricsOf({ caloriesIn: 2300 }, ctx).met, []); // >১১০%
});
test("প্রযোজ্য লক্ষ্য কম হলে (কিডনি: পানি নেই, ক্যালরি নেই) ২টিতেই ধরা", () => {
  const c = { calorieTarget: null, exTarget: 30, waterTarget: null, sleepMinH: 7 };
  assert.equal(dayHit({ exerciseMin: 30, sleepMinutes: 450 }, c), true);
  assert.equal(dayHit({ exerciseMin: 30 }, c), false);
  assert.equal(dayHit({ exerciseMin: 30 }, { ...c, sleepMinH: null }), true);
});
test("স্ট্রিক: আজ বাকি থাকলে ভাঙে না; গতকাল ফাঁক হলে ভাঙে", () => {
  const today = "2026-11-08";
  const docs = [doc("2026-11-07", GOOD), doc("2026-11-06", GOOD), doc("2026-11-04", GOOD)];
  assert.equal(streakOf(docs, today, ctx), 2);
  assert.equal(streakOf([...docs, doc(today, GOOD)], today, ctx), 3);
  assert.equal(streakOf([doc("2026-11-06", GOOD)], today, ctx), 0);
  assert.equal(streakOf([], today, ctx), 0);
});
test("স্ট্রিক সর্বোচ্চ ৩০; মাস/বছর পেরোয়", () => {
  const today = "2026-11-08";
  const docs = last30DatesISO(new Date(2026, 10, 8)).map((d) => doc(d, GOOD));
  assert.equal(docs.length, STREAK_MAX);
  assert.equal(streakOf(docs, today, ctx), 30);
  assert.equal(streakOf([doc("2027-01-01", GOOD), doc("2026-12-31", GOOD)], "2027-01-01", ctx), 2);
});
test("সাপ্তাহিক সারাংশ: hit/miss/today/future ও গণনা", () => {
  const week = ["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
  const s = weekSummary([doc("2026-11-07", GOOD)], week, "2026-11-09", ctx);
  assert.deepEqual(s.days.map((x) => x.state), ["hit", "miss", "today", "future", "future", "future", "future"]);
  assert.equal(s.hitCount, 1);
  assert.equal(weekSummary([doc("2026-11-09", GOOD)], week, "2026-11-09", ctx).days[2].state, "hit");
});
test("last30DatesISO: ৩০টি, পুরনো→নতুন, শেষটি আজ", () => {
  const d = last30DatesISO(new Date(2026, 2, 5));
  assert.equal(d.length, 30);
  assert.equal(d[29], "2026-03-05");
  assert.ok(d[0] < d[1]);
});
