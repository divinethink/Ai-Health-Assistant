import test from "node:test";
import assert from "node:assert/strict";
import { isReviewOpen, reviewWindow, remainParts, weakTip, lockedSplit } from "../../src/health/tracker/weekLock.js";

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

const rep = (cur, lines, focusProgress) => ({ enough: true, cur: { metrics: cur }, lines, focusProgress });

test("weakTip ও lockedSplit", () => {
  const r = rep({ calories: { logged: 6, hit: 5, pct: 83 }, exercise: { logged: 0, hit: 0, pct: null }, sleep: { logged: 0, hit: 0, pct: null }, water: { logged: 6, hit: 2, pct: 33 } },
    [{ kind: "up", text: "ভালো ছিল: ক্যালরি" }, { kind: "down", text: "দুর্বল ছিল: পানি" }, { kind: "flat", text: "ওজন" }],
    { label: "পানি", from: 20, to: 33, kind: "up" });
  assert.match(weakTip(r).text, /পানি 2\/6 দিন: খাবারের সময়/);
  const s = lockedSplit(r);
  assert.equal(s.good.length, 2); assert.equal(s.bad.length, 1);
  assert.equal(weakTip({ enough: false }), null);
  assert.deepEqual(lockedSplit({ enough: false }), { good: [], bad: [] });
});
