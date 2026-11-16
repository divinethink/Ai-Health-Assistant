import test from "node:test";
import assert from "node:assert/strict";
import { careDoseView } from "../../src/health/commonCare/careDose.js";
import { COMMON_CARE_DEFAULTS } from "../../src/health/commonCare/commonCareList.js";

const para = { genericName: "Paracetamol", tier: "otc-self-care", source: ["WHO-EML"], contraindications: ["x"], interactsWith: [],
  dosingRules: [{ ageMin: 0.25, ageMax: 12, dosePerKg: "10-15mg/kg", frequency: "every 4-6h", maxDurationDays: 3 }, { ageMin: 12, ageMax: null, fixedDose: "500-1000mg", frequency: "every 4-6h", maxDailyDose: "4000mg/day" }] };

test("প্রাপ্তবয়স্ক: DB-র ডোজই দেখায়", () => {
  const v = careDoseView({ entry: para, ageYears: 30 });
  assert.equal(v.blocked, false);
  assert.ok(v.lines[0].includes("500-1000mg"));
});
test("শিশু: mg/kg আসে, ওজন-নোটসহ", () => {
  const v = careDoseView({ entry: para, ageYears: 5 });
  assert.ok(v.lines[0].includes("10-15mg/kg") && v.lines[0].includes("ওজন"));
});
test("entry নেই / Tier-২ / বয়স অজানা → ডোজ নেই", () => {
  assert.equal(careDoseView({ entry: null, ageYears: 30 }).blocked, true);
  assert.equal(careDoseView({ entry: { ...para, tier: "requires-consult" }, ageYears: 30 }).blocked, true);
  assert.equal(careDoseView({ entry: para, ageYears: null }).blocked, true);
});
test("গুরুতর interaction → block; এলার্জি → সতর্কতা", () => {
  const e = { ...para, interactsWith: ["warfarin (caution)"] };
  assert.equal(careDoseView({ entry: e, ageYears: 30, activeMedicationNames: ["warfarin"] }).blocked, true);
  const v = careDoseView({ entry: para, ageYears: 30, allergySubstances: ["paracetamol"] });
  assert.ok(v.warnings.some((w) => w.includes("এলার্জি")));
});
test("dbName থাকলে সেটি unique ও খালি নয়", () => {
  COMMON_CARE_DEFAULTS.filter((d) => d.dbName).forEach((d) => assert.ok(d.dbName.length > 3));
});
