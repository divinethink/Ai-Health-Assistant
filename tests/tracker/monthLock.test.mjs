import test from "node:test";
import assert from "node:assert/strict";
import { monthWindow, metricPcts, weakestOf, lockLine, monthGoal, goalProgress } from "../../src/health/tracker/monthLock.js";
import { attentionItems } from "../../src/health/tracker/monthAdvice.js";
import { monthStats } from "../../src/health/tracker/trendRange.js";
import { monthInsights } from "../../src/health/tracker/trendScore.js";
import { monthDatesISO } from "../../src/health/tracker/dateNav.js";

const bn = (n) => String(n);
const rateCtx = { calorieTarget: 2000, exTarget: 30, waterTarget: 8, sleepMinH: 7, fastDays: [] };
const scoreCtx = { ...rateCtx, waterTarget: null };
const D = (y, m, d, h = 12, mi = 0) => new Date(y, m, d, h, mi, 0);

test("খোলার সময়: মাসের শেষ দিন ২০:৫৯ লক, ২১:০০ খোলা (সাময়িক, চলতি মাস)", () => {
  const a = monthWindow(D(2026, 10, 30, 20, 59));
  assert.equal(a.open, false); assert.equal(a.m, 10); assert.equal(a.lastDay, 30);
  assert.equal(a.opensAt.getTime(), D(2026, 10, 30, 21, 0).getTime());
  const b = monthWindow(D(2026, 10, 30, 21, 0));
  assert.deepEqual([b.open, b.y, b.m, b.provisional], [true, 2026, 10, true]);
});

test("১ ও ২ তারিখ খোলা, ৩ তারিখ ২২:৫৯ খোলা, ২৩:০০ বন্ধ — আগের মাস, চূড়ান্ত", () => {
  const a = monthWindow(D(2026, 11, 1, 0, 0));
  assert.deepEqual([a.open, a.y, a.m, a.provisional], [true, 2026, 10, false]);
  assert.equal(monthWindow(D(2026, 11, 3, 22, 59)).open, true);
  const c = monthWindow(D(2026, 11, 3, 23, 0));
  assert.deepEqual([c.open, c.m], [false, 11]);
  assert.equal(c.lastDay, 31);
});

test("বছর বদল: ১ জানুয়ারি খোলা → আগের মাস ডিসেম্বর (আগের বছর); ৩১ ডিসেম্বর ২১:০০ খোলা", () => {
  const a = monthWindow(D(2027, 0, 2, 10, 0));
  assert.deepEqual([a.open, a.y, a.m], [true, 2026, 11]);
  const b = monthWindow(D(2026, 11, 31, 21, 30));
  assert.deepEqual([b.open, b.y, b.m, b.provisional], [true, 2026, 11, true]);
});

test("ফেব্রুয়ারি: লিপ-ইয়ার (২৯) ও সাধারণ (২৮) শেষ দিন", () => {
  assert.equal(monthWindow(D(2028, 1, 10)).lastDay, 29);
  assert.equal(monthWindow(D(2027, 1, 10)).lastDay, 28);
  assert.equal(monthWindow(D(2027, 1, 28, 21, 0)).open, true);
  assert.equal(monthWindow(D(2028, 1, 28, 21, 0)).open, false); // ২৯-এর আগে
});

test("লক অবস্থায় remainMs = খোলার সময় পর্যন্ত", () => {
  const w = monthWindow(D(2026, 10, 30, 19, 0));
  assert.equal(w.remainMs, 2 * 3600 * 1000);
});

const day = (date, o) => ({ date, ...o });
const mk = (y, m, n, fn) => monthDatesISO(y, m).slice(0, n).map((d, i) => day(d, fn(i)));
const TODAY = "2026-12-31";

test("monthGoal: আগের মাসে তথ্য কম হলে 'নিয়মিত তথ্য লেখা'; ঘুম দুর্বল হলে ঘুম", () => {
  assert.equal(monthGoal(null, rateCtx).key, "log");
  const docs = mk(2026, 10, 20, () => ({ caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 240, waterGlasses: 8 }));
  const st = monthStats(docs, 2026, 10, rateCtx, TODAY);
  const g = monthGoal(st, rateCtx);
  assert.equal(g.key, "sleep"); assert.equal(g.pct, 0); assert.match(g.action, /7 ঘণ্টা/);
});

test("monthGoal: সব ঠিক থাকলে null", () => {
  const docs = mk(2026, 10, 20, () => ({ caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 450, waterGlasses: 8 }));
  assert.equal(monthGoal(monthStats(docs, 2026, 10, rateCtx, TODAY), rateCtx), null);
});

test("goalProgress: গত মাসের দুর্বল বিষয় এ মাসে উন্নত হলে 'up'", () => {
  const prev = monthStats(mk(2026, 9, 20, () => ({ sleepMinutes: 240, exerciseMin: 30 })), 2026, 9, rateCtx, TODAY);
  const cur = monthStats(mk(2026, 10, 20, () => ({ sleepMinutes: 450, exerciseMin: 30 })), 2026, 10, rateCtx, TODAY);
  const p = goalProgress(prev, cur);
  assert.equal(p.key, "sleep"); assert.equal(p.kind, "up"); assert.equal(p.from, 0); assert.equal(p.to, 100);
  assert.equal(goalProgress(null, cur), null);
});

test("lockLine: তথ্য কম / তুলনা নেই / উন্নতি+অবনতি", () => {
  assert.equal(lockLine({ needMore: 4, filled: 3, delta: null, improvement: null, drop: null }, bn)[0].kind, "more");
  assert.equal(lockLine({ needMore: 0, filled: 9, delta: null, improvement: null, drop: null }, bn)[0].kind, "flat");
  const l = lockLine({ needMore: 0, filled: 9, delta: 2, improvement: { label: "ঘুম", prev: 30, cur: 60 }, drop: { label: "পানি", prev: 80, cur: 50 } }, bn);
  assert.deepEqual(l.map((x) => x.kind), ["up", "down"]);
  assert.match(l[0].text, /ঘুম 30% → 60%/);
});

test("lockLine: monthInsights-এর আসল ফলের সাথে", () => {
  const prev = mk(2026, 9, 20, () => ({ sleepMinutes: 450, exerciseMin: 0 }));
  const cur = mk(2026, 10, 20, () => ({ sleepMinutes: 240, exerciseMin: 30 }));
  const ins = monthInsights({ curDocs: cur, prevDocs: prev, y: 2026, m: 10, ctx: scoreCtx, todayISO: "2026-11-20" });
  const l = lockLine(ins, bn);
  assert.ok(l.some((x) => x.kind === "up") && l.some((x) => x.kind === "down"));
});

test("attentionItems: দুর্বল বিষয়ের কারণ ও প্রতিকার; তথ্য-লেখা কম হলে আলাদা সারি", () => {
  const docs = mk(2026, 10, 12, () => ({ sleepMinutes: 240, exerciseMin: 30 }));
  const st = monthStats(docs, 2026, 10, rateCtx, "2026-11-30");
  const a = attentionItems({ st, prevSt: null, monthDocs: docs, docs, endISO: "2026-11-30", rateCtx, bn });
  const sleep = a.items.find((x) => x.key === "sleep");
  assert.ok(sleep); assert.equal(sleep.pct, 0);
  assert.ok(sleep.causes.some((c) => /গড় ঘুম 4 ঘণ্টা/.test(c)));
  assert.match(sleep.remedy, /একই সময়ে/);
  assert.ok(a.logging); // ৩০ দিনের ১২ দিন = ৪০%
});

test("attentionItems: সব ঠিক থাকলে খালি", () => {
  const docs = mk(2026, 10, 20, () => ({ caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 450, waterGlasses: 8 }));
  const st = monthStats(docs, 2026, 10, rateCtx, "2026-11-20");
  const a = attentionItems({ st, prevSt: null, monthDocs: docs, docs, endISO: "2026-11-20", rateCtx, bn });
  assert.equal(a.items.length, 0); assert.equal(a.logging, null);
});

test("metricPcts/weakestOf: লক্ষ্য না থাকা বিষয় বাদ", () => {
  const docs = mk(2026, 10, 10, () => ({ sleepMinutes: 450 }));
  const st = monthStats(docs, 2026, 10, { sleepMinH: 7 }, "2026-11-30");
  const p = metricPcts(st);
  assert.deepEqual(Object.keys(p), ["sleep"]);
  assert.equal(weakestOf(p), null);
});
