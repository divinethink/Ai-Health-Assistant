// চালান: node --test tests/tracker/gutInsights.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { dayState, gutAlert, looseStreak3, weekBars } from "../../src/health/tracker/gutInsights.js";
import { triggerSearch } from "../../src/health/tracker/reviewInsights.js";

const e = (date, score) => ({ id: date + score, date, score });
const T0 = "2026-11-15";

test("dayState: none / ok(৩–৪) / off(≤২ বা ≥৫)", () => {
  assert.equal(dayState([]), "none");
  assert.equal(dayState([3, 4]), "ok");
  assert.equal(dayState([4, 5]), "off");
  assert.equal(dayState([2]), "off");
});
test("গুট-সতর্কতা: টানা ২ দিন off হলেই", () => {
  assert.equal(gutAlert([e("2026-11-15", 6)], T0), null); // একদিন
  assert.equal(gutAlert([e("2026-11-14", 6), e("2026-11-15", 4)], T0), null); // আজ ভালো
  const a = gutAlert([e("2026-11-14", 6), e("2026-11-15", 5)], T0);
  assert.equal(a.kind, "loose");
  assert.equal(gutAlert([e("2026-11-14", 1), e("2026-11-15", 2)], T0).kind, "hard");
  assert.equal(gutAlert([e("2026-11-14", 1), e("2026-11-15", 6)], T0).kind, "mixed");
});
test("আজ এন্ট্রি না থাকলে গতকাল+তার আগের দিন দেখা হয়", () => {
  const es = [e("2026-11-13", 7), e("2026-11-14", 6)];
  assert.equal(gutAlert(es, T0).kind, "loose");
  assert.equal(gutAlert([e("2026-11-12", 7), e("2026-11-14", 6)], T0), null); // ফাঁক আছে
});
test("looseStreak3: টানা ৩ দিন ≥৬", () => {
  assert.equal(looseStreak3([e("2026-11-13", 6), e("2026-11-14", 7), e("2026-11-15", 6)], T0), true);
  assert.equal(looseStreak3([e("2026-11-13", 5), e("2026-11-14", 7), e("2026-11-15", 6)], T0), false);
});
test("weekBars: অবস্থা ও সবচেয়ে অস্বাভাবিক স্কোর", () => {
  const w = weekBars([e("2026-11-14", 4), e("2026-11-14", 7), e("2026-11-15", 3)], ["2026-11-13", "2026-11-14", "2026-11-15"]);
  assert.deepEqual(w.map((x) => x.state), ["none", "off", "ok"]);
  assert.equal(w[1].score, 7);
  assert.equal(w[0].score, null);
});
test("triggerSearch: max/badHigh ঐচ্ছিক; ডিফল্ট আচরণ অপরিবর্তিত, ≥৫ আলাদা", () => {
  const days = Array.from({ length: 15 }, (_, i) => "2026-11-" + String(i + 1).padStart(2, "0"));
  const badDay = (i) => [2, 6, 10].includes(i); // ১১-০৩, ০৭, ১১: স্কোর ৫ + "দুধ"; বাকি: স্কোর ৪ + "ভাত"
  const docs = days.map((d, i) => ({ date: d, type: "daily", extraFoods: [{ name: badDay(i) ? "দুধ" : "ভাত" }] }));
  const gut = days.map((d, i) => e(d, badDay(i) ? 5 : 4));
  const def = triggerSearch({ docs, gutEntries: gut, endISO: "2026-11-15", days: 15 });
  assert.equal(def.badDays, 0); // ডিফল্টে ৫ = অস্বাভাবিক নয় (আগের আচরণ)
  const r = triggerSearch({ docs, gutEntries: gut, endISO: "2026-11-15", days: 15, max: 5, badHigh: 5 });
  assert.ok(r.enough);
  assert.deepEqual(r.items.map((x) => x.name), ["দুধ"]);
});
