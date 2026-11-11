import test from "node:test";
import assert from "node:assert/strict";
import { resolveDoseForMember } from "../../src/legacy/doseEnforcement.js";

const base = { genericName: "Calcium", tier: "otc-self-care", interactsWith: ["Levothyroxine — ৪ ঘণ্টা gap"], dosingRules: [{ ageMin: 12, ageMax: null, fixedDose: "500 mg", frequency: "দিনে ১ বার" }] };

test("মাঝারি interaction: dose দেখায় + interactionWarnings", () => {
  const r = resolveDoseForMember({ medicineEntry: base, ageYears: 30, activeMedicationNames: ["Levothyroxine"] });
  assert.equal(r.blocked, false);
  assert.equal(r.dose, "500 mg");
  assert.equal(r.interactionWarnings.length, 1);
});
test("গুরুতর interaction (Azithromycin): এখনো block", () => {
  const e = { ...base, genericName: "Domperidone", interactsWith: ["Azithromycin — QT"] };
  const r = resolveDoseForMember({ medicineEntry: e, ageYears: 30, activeMedicationNames: ["Azithromycin"] });
  assert.equal(r.blocked, true);
  assert.equal(r.reason, "interaction-flag");
});
test("Tier 2 ও highRisk: এখনো block", () => {
  assert.equal(resolveDoseForMember({ medicineEntry: { ...base, tier: "requires-consult" }, ageYears: 30 }).blocked, true);
  assert.equal(resolveDoseForMember({ medicineEntry: { ...base, interactsWith: [], highRiskFlag: true }, ageYears: 30 }).blocked, true);
});
