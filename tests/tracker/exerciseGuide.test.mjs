import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISE_GUIDE, GUIDE_GROUPS, GUIDE_TYPES, COND_LABEL, guideStatus, riskLists, guideTypesMissingFromCatalog } from "../../src/health/tracker/exerciseGuide.js";
import { conditionKeysOf, avoidFor } from "../../src/health/tracker/avoidRules.js";

test("সব গাইড-ধরন EXERCISE_TYPES-এ আছে, ডুপ্লিকেট নেই, ডেটা সম্পূর্ণ", () => {
  assert.deepEqual(guideTypesMissingFromCatalog(), []);
  assert.equal(new Set(GUIDE_TYPES).size, GUIDE_TYPES.length);
  assert.ok(GUIDE_GROUPS.length >= 5);
  for (const t of GUIDE_TYPES) {
    const g = EXERCISE_GUIDE[t];
    assert.ok(g, t);
    assert.ok(g.intro && g.benefit && g.caution, t);
    for (const k of [...g.risk.red, ...g.risk.yellow]) assert.ok(COND_LABEL[k], t + ":" + k);
    assert.ok(!g.risk.red.some((k) => g.risk.yellow.includes(k)), t + " red/yellow overlap");
  }
});

test("guideStatus: অবস্থা মিললে লাল/হলুদ, নইলে সবুজ; লাল জেতে", () => {
  assert.equal(guideStatus("crunch", {}).level, "green");
  assert.equal(guideStatus("crunch", { condKeys: ["gut"] }).level, "yellow");
  assert.equal(guideStatus("crunch", { condKeys: ["gut", "hernia"] }).level, "red");
  assert.deepEqual(guideStatus("crunch", { condKeys: ["hernia"] }).reasons, ["হার্নিয়া"]);
  assert.equal(guideStatus("burpee", { age: 70 }).level, "red");
  assert.equal(guideStatus("burpee", { age: 30, condKeys: ["hypertension"] }).level, "yellow");
  assert.equal(guideStatus("skipping", { flags: { pregnant: true } }).level, "red");
  assert.equal(guideStatus("plank", { flags: { kidney: true } }).level, "yellow");
  assert.equal(guideStatus("walk", { condKeys: ["heart", "gut"], age: 80 }).level, "green");
  assert.equal(guideStatus("unknown", { condKeys: ["heart"] }).level, "green");
});

test("riskLists: সদস্য-নিরপেক্ষ লেবেল", () => {
  const r = riskLists("situp");
  assert.ok(r.avoid.includes("হার্নিয়া"));
  assert.ok(r.careful.includes("গর্ভাবস্থা"));
  assert.deepEqual(riskLists("nope"), { avoid: [], careful: [] });
});

test("নতুন অবস্থা-শনাক্তকরণ (কোমর/হাঁটু/হার্নিয়া) ও ব্যায়াম-সতর্কতা কার্ড", () => {
  const c = (name) => conditionKeysOf([{ resourceType: "condition", name, status: "active" }]);
  assert.deepEqual(c("Lower back pain"), ["back"]);
  assert.deepEqual(c("কোমর ব্যথা"), ["back"]);
  assert.deepEqual(c("Knee osteoarthritis"), ["joint"]);
  assert.deepEqual(c("Hernia"), ["hernia"]);
  assert.deepEqual(c("Discharge"), []);
  assert.ok(avoidFor("exercise", { condKeys: ["hernia"] }).some((g) => g.id === "hernia-ex"));
  assert.equal(avoidFor("food", { condKeys: ["back", "joint", "hernia"] }).length, 0);
});
