// ধাপ ৮ — চালানো: node --test tests/tracker/foodGuidance.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { staticFoodGroups, mergeFoodGuidance } from "../../src/health/nutrition-fitness/foodGuidance.js";

const emptyBase = { avoidFoods: [], includeFoods: [], habitTips: [], avoidSources: {}, byTag: [], matchedTags: [] };

test("শর্ত না থাকলে base অপরিবর্তিত", () => {
  assert.equal(mergeFoodGuidance(emptyBase, []), emptyBase);
  assert.deepEqual(staticFoodGroups({ records: [], age: 30 }), []);
});
test("শিশুর বয়স-নিয়ম Firestore ছাড়াই আসে (base খালি/null হলেও)", () => {
  const g = staticFoodGroups({ records: [], age: 0.5 });
  const r = mergeFoodGuidance(null, g);
  assert.ok(r.avoidFoods.some((x) => x.includes("মধু")));
  assert.ok(r.matchedTags.includes("১ বছরের কম বয়স"));
});
test("গর্ভাবস্থা: সক্রিয় pregnancy রেকর্ড/goal flag থেকে", () => {
  const g = staticFoodGroups({ records: [], age: 30, goal: { flags: { pregnant: true } } });
  assert.deepEqual(g.map((x) => x.id), ["pregnant-food"]);
});
test("একই রোগ দুবার নয়: Firestore diabetes ট্যাগ থাকলে কোড-নিয়ম তাতেই মিশে যায়", () => {
  const base = { ...emptyBase, avoidFoods: ["চিনি/মিষ্টি জাতীয় খাবার"], includeFoods: ["ডাল"], matchedTags: ["diabetes"], byTag: [{ tag: "diabetes", avoid: ["চিনি/মিষ্টি জাতীয় খাবার"], include: ["ডাল"], tips: [] }], avoidSources: { "চিনি/মিষ্টি জাতীয় খাবার": ["diabetes"] } };
  const g = staticFoodGroups({ records: [{ resourceType: "condition", name: "Diabetes", status: "active" }], age: 40 });
  const r = mergeFoodGuidance(base, g);
  assert.deepEqual(r.matchedTags, ["diabetes"]);
  assert.equal(r.byTag.length, 1);
  assert.ok(r.byTag[0].avoid.length >= 3);
  assert.equal(r.avoidFoods[0], g[0].items[0]); // নিরাপত্তা-নিয়ম আগে
});
test("avoid সবসময় জেতে: কোড-নিয়মের avoid অন্য উৎসের include থেকে বাদ", () => {
  const base = { ...emptyBase, includeFoods: ["মধু দেবেন না", "ডাল"], matchedTags: ["x"], byTag: [{ tag: "x", avoid: [], include: ["ডাল"], tips: [] }] };
  const r = mergeFoodGuidance(base, staticFoodGroups({ records: [], age: 0.5 }));
  assert.ok(!r.includeFoods.includes("মধু দেবেন না"));
  assert.ok(r.includeFoods.includes("ডাল"));
});
test("মূল base অবজেক্ট বদলায় না (immutable)", () => {
  const base = { ...emptyBase, byTag: [{ tag: "diabetes", avoid: ["ক"], include: [], tips: [] }], matchedTags: ["diabetes"] };
  mergeFoodGuidance(base, staticFoodGroups({ records: [], age: 40, goal: { flags: { diabetes: true } } }));
  assert.deepEqual(base.byTag[0].avoid, ["ক"]);
});
