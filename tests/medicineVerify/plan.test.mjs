import test from "node:test";
import assert from "node:assert/strict";
import { validateOpts, planVerification } from "../../scripts/lib/medicineVerifyPlan.js";
const docs = [
  { id: "paracetamol", data: { genericName: "Paracetamol", status: "draft", tier: "otc-self-care" } },
  { id: "ibuprofen", data: { genericName: "Ibuprofen", status: "verified", tier: "otc-self-care" } },
  { id: "aspirin-bystander", data: { genericName: "Aspirin (Suspected Heart-Attack — Emergency Bystander First-Aid)", status: "draft", tier: "otc-self-care" } },
  { id: "zinc-sulfate", data: { genericName: "Zinc Sulfate", status: "draft", tier: "otc-self-care" } },
];
test("validateOpts", () => {
  assert.ok(validateOpts({ role: "x", date: "2026-11-16" }));
  assert.ok(validateOpts({ role: "pharmacist", date: "16-11-2026" }));
  assert.ok(validateOpts({ role: "pharmacist", date: "2027-01-01", today: "2026-11-16", all: true }));
  assert.ok(validateOpts({ role: "pharmacist", date: "2026-11-16" }));
  assert.equal(validateOpts({ role: "physician", date: "2026-11-16", today: "2026-11-16", all: true }), null);
});
test("শুধু draft verify; verified skip; নাম না মিললে জানায়", () => {
  const r = planVerification(docs, { names: ["paracetamol", "Ibuprofen", "Nope"], role: "pharmacist" });
  assert.deepEqual(r.toVerify.map((x) => x.id), ["paracetamol"]);
  assert.equal(r.skipped[0].id, "ibuprofen");
  assert.deepEqual(r.unmatched, ["nope"]);
});
test("--all: Aspirin pharmacist-এ skip, physician-এ verify", () => {
  const a = planVerification(docs, { all: true, role: "pharmacist" });
  assert.ok(!a.toVerify.some((x) => x.id === "aspirin-bystander"));
  const b = planVerification(docs, { all: true, role: "physician" });
  assert.ok(b.toVerify.some((x) => x.id === "aspirin-bystander"));
});
