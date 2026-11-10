// ধাপ ৯ — চালানো: node --test tests/tracker/quickAdd.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { QUICK_ITEMS, quickTarget, OBS_PRESETS } from "../../src/health/quickadd/quickAddTargets.js";
import { setQuickIntent, peekQuickIntent, takeQuickIntent } from "../../src/shared/quickIntent.js";

test("৯টা টাইল, id অনন্য, প্রতিটার গন্তব্য আছে", () => {
  assert.equal(QUICK_ITEMS.length, 9);
  assert.equal(new Set(QUICK_ITEMS.map((x) => x.id)).size, 9);
  QUICK_ITEMS.forEach((x) => assert.ok(["home", "tracker", "documents", "aichat"].includes(quickTarget(x.id))));
  assert.equal(quickTarget("nope"), null);
});
test("প্রেসার/সুগার প্রিসেট", () => {
  assert.deepEqual(Object.keys(OBS_PRESETS).sort(), ["bp", "sugar"]);
  assert.equal(OBS_PRESETS.sugar.unit, "mg/dL");
});
test("intent: take একবারই কাজ করে, অন্য ধরন ছোঁয় না", () => {
  setQuickIntent("weight");
  assert.equal(takeQuickIntent(["bp"]), null);
  assert.equal(peekQuickIntent(["weight"]), "weight");
  assert.equal(takeQuickIntent(["weight", "sleep"]), "weight");
  assert.equal(takeQuickIntent(["weight"]), null);
});
test("intent: মেয়াদ (৫ সেকেন্ড) শেষে মুছে যায়", () => {
  const real = Date.now;
  setQuickIntent("food");
  Date.now = () => real() + 6000;
  try { assert.equal(takeQuickIntent(), null); } finally { Date.now = real; }
});
