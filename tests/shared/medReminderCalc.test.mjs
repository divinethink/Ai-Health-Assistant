// ওষুধ-রিমাইন্ডার pure হিসাব (ধাপ ৩)। চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildActiveMeds, daysLeft, dueMedDoses, endingSoonMeds } from "../../src/health/records/medReminderCalc.js";

const member = { id: "m1", name: "রহিম" };
const rec = (o) => ({ id: "R1", resourceType: "medicationStatement", status: "active", genericName: "Metformin", reminderTimes: ["08:00", "21:00"], ...o });

test("buildActiveMeds: শুধু সক্রিয় medicationStatement; অন্য ধরন/বন্ধ/নামহীন বাদ", () => {
  const out = buildActiveMeds(member, [
    rec({ id: "A" }),
    rec({ id: "B", status: "completed" }),
    rec({ id: "C", resourceType: "condition" }),
    rec({ id: "D", genericName: "" }),
    rec({ id: "E", reminderTimes: undefined, endDate: "2026-11-12", mealTiming: "after" }),
  ]);
  assert.deepEqual(out.map((m) => m.recordId), ["A", "E"]);
  assert.deepEqual(out[1].reminderTimes, []);
  assert.equal(out[1].endDate, "2026-11-12");
  assert.equal(out[0].memberName, "রহিম");
});

test("daysLeft", () => {
  assert.equal(daysLeft("2026-11-12", "2026-11-10"), 2);
  assert.equal(daysLeft("2026-11-10", "2026-11-10"), 0);
  assert.equal(daysLeft("2026-11-09", "2026-11-10"), -1);
  assert.equal(daysLeft(null, "2026-11-10"), null);
});

test("dueMedDoses: সময় মিললে ডোজ, key ':'-ছাড়া, বডিতে সদস্য+ওষুধ+খাবার-সময়", () => {
  const meds = buildActiveMeds(member, [rec({ mealTiming: "after" })]);
  const d = dueMedDoses(meds, "08:00", "2026-11-10");
  assert.equal(d.length, 1);
  assert.equal(d[0].key, "R1_0800");
  assert.equal(d[0].id, "med_R1_0800");
  assert.equal(d[0].memberId, "m1");
  assert.equal(d[0].body, "রহিম — Metformin (খাবারের পরে)");
  assert.deepEqual(dueMedDoses(meds, "09:00", "2026-11-10"), []);
});

test("dueMedDoses: mealTiming any/নেই হলে বন্ধনী নেই", () => {
  const a = dueMedDoses(buildActiveMeds(member, [rec({ mealTiming: "any" })]), "08:00", "2026-11-10");
  const b = dueMedDoses(buildActiveMeds(member, [rec({})]), "08:00", "2026-11-10");
  assert.equal(a[0].body, "রহিম — Metformin");
  assert.equal(b[0].body, "রহিম — Metformin");
});

test("dueMedDoses: কোর্স শেষ (endDate < আজ) বা শুরু হয়নি (startDate > আজ) হলে নয়; শেষ দিনে হ্যাঁ", () => {
  const today = "2026-11-10";
  assert.equal(dueMedDoses(buildActiveMeds(member, [rec({ endDate: "2026-11-09" })]), "08:00", today).length, 0);
  assert.equal(dueMedDoses(buildActiveMeds(member, [rec({ endDate: "2026-11-10" })]), "08:00", today).length, 1);
  assert.equal(dueMedDoses(buildActiveMeds(member, [rec({ startDate: "2026-11-11" })]), "08:00", today).length, 0);
  assert.equal(dueMedDoses(buildActiveMeds(member, [rec({ startDate: "2026-11-10" })]), "08:00", today).length, 1);
});

test("dueMedDoses: একাধিক সদস্য/ওষুধ একই মিনিটে — আলাদা id", () => {
  const meds = [
    ...buildActiveMeds(member, [rec({ id: "R1" })]),
    ...buildActiveMeds({ id: "m2", name: "করিম" }, [rec({ id: "R2", reminderTimes: ["08:00"] })]),
  ];
  const d = dueMedDoses(meds, "08:00", "2026-11-10");
  assert.deepEqual(d.map((x) => x.id).sort(), ["med_R1_0800", "med_R2_0800"]);
});

test("endingSoonMeds: আজ/১/২ দিন বাকি = হ্যাঁ; ৩+ বা শেষ বা endDate নেই = না", () => {
  const today = "2026-11-10";
  const mk = (id, endDate) => buildActiveMeds(member, [rec({ id, endDate })])[0];
  const out = endingSoonMeds([mk("a", "2026-11-10"), mk("b", "2026-11-11"), mk("c", "2026-11-12"), mk("d", "2026-11-13"), mk("e", "2026-11-09"), mk("f", null)], today);
  assert.deepEqual(out.map((x) => x.recordId), ["a", "b", "c"]);
  assert.match(out[0].body, /আজ শেষ দিন/);
  assert.match(out[1].body, /আর ১ দিন বাকি/);
});
