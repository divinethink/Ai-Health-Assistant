// চালানো: node --test tests/tracker/trendScore.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { dayScore, scoreLevel, monthScores, monthInsights, insightLines, rowArrow, attentionRows, monthlyAverages, weekdayIdx } from "../../src/health/tracker/trendScore.js";

const ctx = { calorieTarget: 2000, exTarget: 30, waterTarget: null, sleepMinH: 7 };
const bn = (n) => String(n);
const GOOD = { caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 480 };
const iso = (m, d) => "2026-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
const mk = (m, d, o) => ({ date: iso(m, d), ...o });

test("dayScore: পূর্ণ দিন ১০০, রেকর্ড নেই null", () => {
  assert.equal(dayScore(mk(11, 1, GOOD), ctx, iso(11, 1)), 100);
  assert.equal(dayScore(null, ctx, iso(11, 1)), null);
});
test("dayScore: কম খাওয়া পূর্ণ নম্বর পায় না; বেশি খেলেও কমে", () => {
  const low = dayScore(mk(11, 1, { caloriesIn: 1000 }), ctx, iso(11, 1));
  assert.ok(low < 50);
  assert.ok(dayScore(mk(11, 1, { caloriesIn: 3000 }), ctx, iso(11, 1)) < 100);
  assert.equal(dayScore(mk(11, 1, { caloriesIn: 1600 }), ctx, iso(11, 1)) >= 50, true); // ৮০% সীমা = ক্যালরি পূর্ণ, ব্যায়াম ০
});
test("dayScore: ঘুম না দিলে গোনা হয় না; ব্যায়াম ০ গোনা হয়", () => {
  assert.equal(dayScore(mk(11, 1, { caloriesIn: 2000 }), ctx, iso(11, 1)), 50);
  assert.equal(dayScore(mk(11, 1, { caloriesIn: 2000, exerciseMin: 30 }), ctx, iso(11, 1)), 100);
});
test("dayScore: গেট-ব্লক (ক্যালরি-টার্গেট null) ও উপবাস-দিনে ক্যালরি বাদ", () => {
  const gated = { ...ctx, calorieTarget: null };
  assert.equal(dayScore(mk(11, 1, { caloriesIn: 500, exerciseMin: 30 }), gated, iso(11, 1)), 100);
  const fast = { ...ctx, fastDays: [0, 1, 2, 3, 4, 5, 6] };
  assert.equal(dayScore(mk(11, 1, { caloriesIn: 300, exerciseMin: 30 }), fast, iso(11, 1)), 100);
});
test("scoreLevel: সীমা", () => {
  assert.deepEqual([null, 10, 40, 60, 80, 100].map(scoreLevel), [0, 1, 2, 3, 4, 4]);
});
test("weekdayIdx: শনি=০, শুক্র=৬ (২০২৬-১১-১৩ শুক্র)", () => {
  assert.equal(weekdayIdx("2026-11-13"), 6);
  assert.equal(weekdayIdx("2026-11-07"), 0);
});
test("monthScores: আজের পরের দিন বাদ", () => {
  const r = monthScores([mk(11, 1, GOOD), mk(11, 20, GOOD)], 2026, 10, ctx, iso(11, 13));
  assert.equal(r.length, 1);
  assert.equal(r[0].level, 4);
});
test("monthInsights: কম রেকর্ডে needMore ও তুলনা নেই", () => {
  const ins = monthInsights({ curDocs: [mk(11, 1, GOOD), mk(11, 2, GOOD)], prevDocs: [], y: 2026, m: 10, ctx, todayISO: iso(11, 13) });
  assert.equal(ins.delta, null);
  assert.equal(ins.needMore, 5);
  const l = insightLines(ins, bn);
  assert.equal(l[0].kind, "more");
  assert.match(l[0].text, /আরও 5 দিন/);
});
test("monthInsights: গত মাসের চেয়ে উন্নতি, ব্যায়ামে বড় উন্নতি, দুর্বল বার", () => {
  const prev = [], cur = [];
  for (let d = 1; d <= 12; d++) prev.push(mk(10, d, { caloriesIn: 2000, exerciseMin: 0, sleepMinutes: 480 }));
  for (let d = 1; d <= 12; d++) cur.push(mk(11, d, { caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 480 }));
  const ins = monthInsights({ curDocs: cur, prevDocs: prev, y: 2026, m: 10, ctx, todayISO: iso(11, 13) });
  assert.ok(ins.delta >= 5);
  assert.equal(ins.improvement.key, "exercise");
  assert.equal(ins.drop, null);
  const kinds = insightLines(ins, bn).map((x) => x.kind);
  assert.ok(kinds.includes("up"));
});
test("monthInsights: দুর্বল বার শনাক্ত (দুই দিন কম)", () => {
  const cur = [];
  for (let d = 1; d <= 13; d++) {
    const wd = weekdayIdx(iso(11, d));
    cur.push(mk(11, d, wd === 4 || wd === 5 ? { caloriesIn: 2000, exerciseMin: 0, sleepMinutes: 200 } : GOOD));
  }
  const ins = monthInsights({ curDocs: cur, prevDocs: null, y: 2026, m: 10, ctx, todayISO: iso(11, 13) });
  assert.deepEqual(ins.weakest.map((x) => x.wd).sort(), [4, 5]);
  assert.match(insightLines(ins, bn).find((x) => x.kind === "weak").text, /বুধবার ও বৃহস্পতিবার/);
});
test("rowArrow ও attentionRows", () => {
  assert.equal(rowArrow([{ pct: 50 }, { pct: 70 }]), "up");
  assert.equal(rowArrow([{ pct: 70 }, { pct: 40 }]), "down");
  assert.equal(rowArrow([{ pct: 70 }, { pct: 72 }]), "flat");
  assert.equal(rowArrow([{ pct: null }, { pct: 72 }]), null);
  const rows = [{ key: "weight", label: "ওজন", vals: [{ pct: 90 }, { pct: 10 }] }, { key: "exercise", label: "ব্যায়াম", vals: [{ pct: 50 }, { pct: 20 }] }, { key: "sleep", label: "ঘুম", vals: [{ pct: 80 }, { pct: 85 }] }];
  assert.deepEqual(attentionRows(rows).map((x) => x.key), ["exercise"]);
});
test("monthlyAverages: কম দিনে avg null", () => {
  const get = (y, m) => (m === 10 ? [mk(11, 1, GOOD), mk(11, 2, GOOD), mk(11, 3, GOOD)] : [mk(10, 1, GOOD)]);
  const r = monthlyAverages([{ y: 2026, m: 9 }, { y: 2026, m: 10 }], get, ctx, iso(11, 13));
  assert.equal(r[0].avg, null);
  assert.equal(r[1].avg, 100);
});
import { weekBuckets, rowNote } from "../../src/health/tracker/trendScore.js";
test("weekBuckets: ৪ ভাগ, আজের পরের দিন বাদ, আগের মাসের সাথে তুলনা", () => {
  const cur = [mk(11, 2, GOOD), mk(11, 9, { caloriesIn: 1000 })];
  const prev = [mk(10, 3, GOOD)];
  const b = weekBuckets({ curDocs: cur, prevDocs: prev, y: 2026, m: 10, ctx, todayISO: iso(11, 13) });
  assert.equal(b.length, 4);
  assert.equal(b[0].cur, 100); assert.equal(b[0].prev, 100);
  assert.ok(b[1].cur < 50); assert.equal(b[2].cur, null); assert.equal(b[3].cur, null);
});
test("rowNote: পয়েন্ট-ফারাক বাক্য", () => {
  assert.equal(rowNote([{ pct: 50 }, { pct: 70 }], bn), "আগের চেয়ে 20 পয়েন্ট বেড়েছে");
  assert.equal(rowNote([{ pct: 50 }, { pct: 52 }], bn), "মোটামুটি একই ধারায়");
  assert.equal(rowNote([{ pct: null }, { pct: 52 }], bn), "");
});
