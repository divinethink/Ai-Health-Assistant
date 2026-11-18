import test from "node:test";
import assert from "node:assert/strict";
import { isReviewOpen, reviewWindow, remainParts, weakTip, lockedSummary } from "../../src/health/tracker/weekLock.js";

// ২০২৬-১১-১২ বৃহস্পতি; ১৩ শুক্র; ১৪ শনি; ১৫ রবি
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m);

test("খোলা/বন্ধ সীমা", () => {
  assert.equal(isReviewOpen(at(12, 20, 59)), false);
  assert.equal(isReviewOpen(at(12, 21)), true);
  assert.equal(isReviewOpen(at(13, 3)), true);
  assert.equal(isReviewOpen(at(14, 22, 59)), true);
  assert.equal(isReviewOpen(at(14, 23)), false);
  assert.equal(isReviewOpen(at(15, 10)), false);
  assert.equal(isReviewOpen(at(11, 12)), false);
});

test("বৃহস্পতি রাত/শুক্র: চলতি (provisional), আজ পর্যন্ত", () => {
  const w = reviewWindow(at(12, 21, 30));
  assert.deepEqual([w.open, w.endISO, w.provisional], [true, "2026-11-12", true]);
  const f = reviewWindow(at(13, 18));
  assert.deepEqual([f.open, f.endISO, f.provisional], [true, "2026-11-13", true]);
});

test("শনি (রাত ১১টার আগে): গত শুক্র পর্যন্ত চূড়ান্ত", () => {
  const w = reviewWindow(at(14, 9));
  assert.deepEqual([w.open, w.endISO, w.provisional], [true, "2026-11-13", false]);
});

test("লক: সর্বশেষ শুক্র পর্যন্ত চূড়ান্ত; খোলার সময় = পরের বৃহস্পতি রাত ৯টা", () => {
  const sat = reviewWindow(at(14, 23, 30));
  assert.equal(sat.open, false); assert.equal(sat.endISO, "2026-11-13");
  assert.equal(sat.opensAt.getTime(), at(19, 21).getTime());
  const sun = reviewWindow(at(15, 8));
  assert.equal(sun.endISO, "2026-11-13");
  const wed = reviewWindow(at(18, 10));
  assert.equal(wed.endISO, "2026-11-13"); assert.equal(wed.opensAt.getTime(), at(19, 21).getTime());
  const thu = reviewWindow(at(19, 20));
  assert.equal(thu.endISO, "2026-11-13"); assert.equal(thu.opensAt.getTime(), at(19, 21).getTime());
});

test("remainParts", () => {
  assert.deepEqual(remainParts(60 * 60000 * 25 + 5 * 60000), { d: 1, h: 1, m: 5 });
  assert.deepEqual(remainParts(10), { d: 0, h: 0, m: 1 });
});

const rep = (cur, extra) => ({ enough: true, cur: { metrics: cur, avg: 79 }, prev: { logged: 5, avg: 67 }, lines: [], ...extra });
const M = { calories: { logged: 6, hit: 5, pct: 83 }, exercise: { logged: 0, hit: 0, pct: null }, sleep: { logged: 0, hit: 0, pct: null }, water: { logged: 6, hit: 2, pct: 33 } };

test("weakTip ও lockedSummary", () => {
  assert.match(weakTip(rep(M)).text, /পানি 2\/6 দিন: খাবারের সময়/);
  const s = lockedSummary(rep(M));
  assert.equal(s.best.label, "ক্যালরি লক্ষ্য"); assert.equal(s.weak.key, "water");
  assert.equal(s.avg, 79); assert.equal(s.delta, 12);
  assert.equal(weakTip({ enough: false }), null);
  assert.deepEqual(lockedSummary({ enough: false }), { enough: false, avg: null, delta: null, best: null, weak: null });
});

test("lockedSummary: সবই ভালো হলে weak নেই; আগের সপ্তাহে তথ্য কম হলে delta নেই", () => {
  const good = { calories: { logged: 6, hit: 6, pct: 100 }, exercise: { logged: 5, hit: 4, pct: 80 }, sleep: { logged: 0, hit: 0, pct: null }, water: { logged: 0, hit: 0, pct: null } };
  const s = lockedSummary(rep(good, { prev: { logged: 1, avg: null } }));
  assert.equal(s.weak, null); assert.equal(s.delta, null); assert.equal(s.best.key, "calories");
});
