import test from "node:test";
import assert from "node:assert/strict";
import { weeklyReport, pickFocus, weakestMetric, habitPatterns, triggerSearch, windowDates } from "../../src/health/tracker/reviewInsights.js";

const rateCtx = { calorieTarget: 2000, exTarget: 30, waterTarget: 8, sleepMinH: 7, fastDays: [] };
const scoreCtx = { ...rateCtx, waterTarget: null };
const END = "2026-11-14"; // শনিবার
const doc = (date, o) => ({ date, ...o });
const good = (date) => doc(date, { caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 450, waterGlasses: 8 });
const lowSleep = (date) => doc(date, { caloriesIn: 2000, exerciseMin: 30, sleepMinutes: 240, waterGlasses: 8 });

test("windowDates: ৭ দিন, পুরনো → নতুন, শেষে END", () => {
  const w = windowDates(END, 7);
  assert.equal(w.length, 7); assert.equal(w[6], END); assert.equal(w[0], "2026-11-08");
});

test("তথ্য কম (<৩ দিন): রিপোর্ট নেই, ফোকাস = তথ্য লেখা", () => {
  const rep = weeklyReport({ docs: [good("2026-11-14")], endISO: END, scoreCtx, rateCtx });
  assert.equal(rep.enough, false); assert.equal(rep.need, 2); assert.deepEqual(rep.lines, []);
  assert.equal(pickFocus(rep, rateCtx).key, "log");
});

test("দুর্বল বিষয় = ফোকাস; উন্নতি/অবনতি লাইন; গত সপ্তাহের ফোকাসের অগ্রগতি", () => {
  const prevDays = windowDates("2026-11-07", 7).slice(0, 5).map(lowSleep); // গত সপ্তাহ: ঘুম ০%
  const curDays = windowDates(END, 7).slice(0, 5).map((d, i) => (i < 2 ? good(d) : lowSleep(d))); // এ সপ্তাহ: ঘুম ২/৫
  const rep = weeklyReport({ docs: [...prevDays, ...curDays], endISO: END, scoreCtx, rateCtx });
  assert.equal(rep.enough, true);
  assert.equal(weakestMetric(rep.cur.metrics), "sleep");
  const f = pickFocus(rep, rateCtx);
  assert.equal(f.key, "sleep"); assert.match(f.action, /7 ঘণ্টা/);
  assert.equal(rep.focusProgress.key, "sleep");
  assert.equal(rep.focusProgress.from, 0); assert.equal(rep.focusProgress.to, 40); assert.equal(rep.focusProgress.kind, "up");
  assert.ok(rep.lines.some((l) => l.text.includes("দুর্বল ছিল: ঘুম")));
  assert.ok(rep.lines.some((l) => l.kind === "up" && l.text.includes("গড় স্কোর")));
});

test("সবই ঠিক থাকলে ফোকাস null", () => {
  const rep = weeklyReport({ docs: windowDates(END, 7).map(good), endISO: END, scoreCtx, rateCtx });
  assert.equal(pickFocus(rep, rateCtx), null);
});

test("ওজন-লাইন: প্রথম ও শেষ ওজন", () => {
  const docs = windowDates(END, 7).map((d, i) => ({ ...good(d), ...(i === 0 ? { weightKg: 72 } : i === 6 ? { weightKg: 71.5 } : {}) }));
  const rep = weeklyReport({ docs, endISO: END, scoreCtx, rateCtx });
  assert.ok(rep.lines.some((l) => l.text.includes("72 → 71.5")));
});

test("অভ্যাস-প্যাটার্ন: ≥৭ দিন না হলে নেই; শুক্রবার ফাঁকা ধরা পড়ে", () => {
  assert.equal(habitPatterns({ docs: [good("2026-11-14")], endISO: END, rateCtx }).missDay, null);
  const days = windowDates(END, 28);
  const docs = days.filter((d) => ![...Array(4)].some((_, i) => d === windowDates(END, 28).filter((x) => new Date(x + "T00:00:00").getDay() === 5)[i])).map(good);
  const p = habitPatterns({ docs, endISO: END, rateCtx });
  assert.ok(p.recorded >= 7);
  assert.equal(p.missDay.day, "শুক্রবার"); assert.equal(p.missDay.missed, p.missDay.total);
});

test("ট্রিগার: যথেষ্ট তথ্য না থাকলে enough=false", () => {
  const t = triggerSearch({ docs: [], gutEntries: [{ date: "2026-11-13", score: 7 }], endISO: END });
  assert.equal(t.enough, false); assert.deepEqual(t.items, []);
});

test("ট্রিগার: অস্বস্তির দিনে বারবার থাকা খাবার ধরা পড়ে, স্বাভাবিক দিনের খাবার নয়", () => {
  const dates = windowDates(END, 20);
  const docs = [], gut = [];
  dates.forEach((d, i) => {
    const bad = i % 4 === 0; // ৫টি অস্বস্তির দিন
    docs.push(doc(d, { extraFoods: bad ? [{ name: "ডাল-ভাজি", kcal: 100, slot: "lunch" }, { name: "ভাত", kcal: 200, slot: "lunch" }] : [{ name: "ভাত", kcal: 200, slot: "lunch" }] }));
    gut.push({ date: d, score: bad ? 7 : 4 });
  });
  const t = triggerSearch({ docs, gutEntries: gut, endISO: END });
  assert.equal(t.enough, true);
  assert.ok(t.items.some((x) => x.name === "ডাল-ভাজি"));
  assert.ok(!t.items.some((x) => x.name === "ভাত")); // সব দিনে থাকে → বাড়তি সম্পর্ক নেই
});
