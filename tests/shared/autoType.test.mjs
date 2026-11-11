// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { AUTO, kindToVaultType, kindFromChoice, describeDetection, resolveKind } from "../../src/health/doc-ai/autoType.js";

test("kindToVaultType: কার্ড/অজানা → other", () => {
  assert.equal(kindToVaultType("prescription"), "prescription");
  assert.equal(kindToVaultType("lab-report"), "lab-report");
  assert.equal(kindToVaultType("visiting-card"), "other");
  assert.equal(kindToVaultType("unknown"), "other");
});

test("kindFromChoice: হাতে-বাছা", () => {
  assert.equal(kindFromChoice("prescription"), "prescription");
  assert.equal(kindFromChoice("visiting-card"), "visiting-card");
  assert.equal(kindFromChoice("imaging"), "other");
});

test("describeDetection: নিশ্চিত/অনিশ্চিত/অজানা", () => {
  assert.equal(describeDetection({ type: "lab-report", confidence: "high" }).sure, true);
  const low = describeDetection({ type: "prescription", confidence: "low" });
  assert.equal(low.sure, false);
  assert.match(low.text, /হতে পারে/);
  assert.equal(describeDetection({ type: "unknown", confidence: "low" }).kind, "unknown");
  assert.equal(describeDetection(null).kind, "unknown");
});

test("resolveKind: auto হলে শনাক্ত, নইলে হাতে-বাছা", () => {
  const det = { kind: "lab-report" };
  assert.equal(resolveKind(AUTO, det), "lab-report");
  assert.equal(resolveKind(AUTO, null), "unknown");
  assert.equal(resolveKind("prescription", det), "prescription");
});
