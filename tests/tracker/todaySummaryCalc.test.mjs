// চালানো: node --test tests/tracker/todaySummaryCalc.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { bnClock, buildTodayDoses, progressPct, headlineOf, upcomingEvents, whenLabel } from "../../src/health/summary/todaySummaryCalc.js";

const M = { id: "m1", name: "আমি" };
const med = (id, name, times, o) => ({ id, resourceType: "medicationStatement", status: "active", genericName: name, reminderTimes: times, ...o });

test("bnClock", () => {
  assert.equal(bnClock("08:00"), "সকাল ৮:০০");
  assert.equal(bnClock("14:00"), "দুপুর ২:০০");
  assert.equal(bnClock("21:00"), "রাত ৯:০০");
  assert.equal(bnClock("x"), "");
});

test("ডোজ: সময়-ক্রম, taken/due, সময়হীন আলাদা, মেয়াদ-শেষ বাদ", () => {
  const recs = [med("A1", "Metformin", ["14:00", "21:00"], { mealTiming: "after" }), med("B2", "Pantoprazole", ["08:00"], { mealTiming: "before" }),
    med("C3", "NoTime", []), med("D4", "Old", ["09:00"], { endDate: "2026-11-01" }), { id: "x", resourceType: "condition", name: "q" }];
  const { doses, noTimeCount } = buildTodayDoses(M, recs, "2026-11-10", "14:05", { B2_0800: true });
  assert.deepEqual(doses.map((d) => d.time), ["08:00", "14:00", "21:00"]);
  assert.equal(doses[0].taken, true);
  assert.equal(doses[1].due, true); assert.equal(doses[2].due, false);
  assert.equal(doses[0].meal, "খাবারের আগে");
  assert.equal(noTimeCount, 1);
});

test("progress ও headline", () => {
  const doses = [{ taken: true, due: true }, { taken: false, due: true }, { taken: false, due: false }];
  assert.equal(progressPct({ doses, water: 5, waterTarget: 8 }), Math.round(((1 + 5) / 11) * 100));
  assert.equal(progressPct({ doses, water: 20, waterTarget: 8 }), Math.round(((1 + 8) / 11) * 100)); // লক্ষ্য ছাড়ালেও ক্যাপ
  assert.equal(progressPct({ doses: [], water: 0, waterTarget: null }), null);
  assert.equal(headlineOf({ doses, water: 0, waterTarget: 8 }), "১টি ওষুধের সময় হয়ে গেছে");
  assert.equal(headlineOf({ doses: [{ taken: true }], water: 8, waterTarget: 8 }), "আজকের সব কাজ হয়েছে");
  assert.equal(headlineOf({ doses: [], water: 0, waterTarget: null }), "আজ কিছু নির্ধারিত নেই");
});

test("আসন্ন ইভেন্ট: নিজের/সবার, সম্পন্ন ও অতীত বাদ, ৩০ দিনের সীমা", () => {
  const ev = [
    { id: 1, date: "2026-11-15", title: "টিকা", memberId: "m1", eventType: "vaccination" },
    { id: 2, date: "2026-11-17", time: "10:00", title: "ফলো-আপ", memberId: null },
    { id: 3, date: "2026-11-12", title: "অন্যের", memberId: "m2" },
    { id: 4, date: "2026-11-09", title: "অতীত", memberId: "m1" },
    { id: 5, date: "2026-11-11", title: "সম্পন্ন", memberId: "m1", status: "done" },
    { id: 6, date: "2027-02-01", title: "দূরে", memberId: "m1" },
  ];
  const r = upcomingEvents(ev, "m1", "2026-11-10");
  assert.deepEqual(r.map((e) => e.id), [1, 2]);
  assert.equal(whenLabel(r[0]), "৫ দিন পরে");
  assert.equal(whenLabel(r[1]), "৭ দিন পরে · সকাল ১০:০০");
});
