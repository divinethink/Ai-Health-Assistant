import test from "node:test";
import assert from "node:assert/strict";
import { avoidFor, conditionKeysOf, RULES } from "../../src/health/tracker/avoidRules.js";

const ids = (d, ctx) => avoidFor(d, ctx).map((x) => x.id);

test("কোনো শর্ত না থাকলে খালি", () => {
  assert.deepEqual(ids("food", { age: 30 }), []);
  assert.deepEqual(ids("exercise", {}), []);
});
test("ডায়াবেটিস flag → খাবার+ব্যায়াম", () => {
  assert.deepEqual(ids("food", { age: 40, flags: { diabetes: true } }), ["diabetes-food"]);
  assert.deepEqual(ids("exercise", { age: 40, flags: { diabetes: true } }), ["diabetes-ex"]);
});
test("condition নাম থেকে উচ্চ রক্তচাপ/হার্ট/হাঁপানি", () => {
  const k = conditionKeysOf([
    { resourceType: "condition", name: "উচ্চ রক্তচাপ", status: "active" },
    { resourceType: "condition", name: "Asthma", status: "chronic" },
    { resourceType: "condition", name: "Heart disease", status: "resolved" },
    { resourceType: "allergy", name: "heart" },
  ]);
  assert.deepEqual(k.sort(), ["asthma", "hypertension"]);
});
test("বয়স-ভিত্তিক: শিশু ও বৃদ্ধ", () => {
  assert.ok(ids("food", { age: 0 }).includes("infant-food"));
  assert.ok(ids("food", { age: 3 }).includes("young-food"));
  assert.ok(!ids("food", { age: 5 }).includes("young-food"));
  assert.ok(ids("exercise", { age: 10 }).includes("child-ex"));
  assert.ok(ids("exercise", { age: 70 }).includes("elder-ex"));
  assert.ok(!ids("exercise", { age: 64 }).includes("elder-ex"));
});
test("বয়স অজানা (null) হলে বয়স-নিয়ম আসে না", () => {
  assert.deepEqual(ids("food", { age: null }), []);
});
test("প্রতিটি নিয়মে সূত্র ও আইটেম আছে; ডোজ-শব্দ নেই", () => {
  for (const r of RULES) {
    assert.ok(r.src.length > 0 && r.items.length > 0, r.id);
    assert.ok(!/\bmg\b|মিগ্রা|ডোজ/i.test(r.items.join(" ")), r.id);
  }
});
test("গর্ভাবস্থা flag", () => {
  assert.deepEqual(ids("exercise", { age: 28, flags: { pregnant: true } }), ["pregnant-ex"]);
});

import { tagAvoidReason } from "../../src/health/tracker/avoidRules.js";
import { foodStatus } from "../../src/health/tracker/foodStatus.js";

test("IBS/গ্যাস্ট্রিক condition → gut key", () => {
  assert.deepEqual(conditionKeysOf([{ resourceType: "condition", name: "IBS", status: "chronic" }]), ["gut"]);
  assert.deepEqual(conditionKeysOf([{ resourceType: "condition", name: "গ্যাস্ট্রিক আলসার", status: "active" }]), ["gut"]);
  assert.deepEqual(conditionKeysOf([{ resourceType: "condition", name: "Hobbies", status: "active" }]), []);
});
test("gut নিয়ম খাবার+ব্যায়াম দুটোতেই", () => {
  assert.ok(ids("food", { condKeys: ["gut"] }).includes("gut-food"));
  assert.ok(ids("exercise", { condKeys: ["gut"] }).includes("gut-ex"));
});
test("শিশু ও কিডনি/গর্ভাবস্থা নিয়ম আসে", () => {
  assert.ok(ids("food", { age: 8 }).includes("child-food"));
  assert.ok(ids("food", { age: 30, flags: { kidney: true } }).includes("kidney-food"));
  assert.ok(ids("food", { age: 30, flags: { pregnant: true } }).includes("pregnant-food"));
});
test("gut-ট্যাগ খাবার: IBS থাকলে লাল, নইলে হলুদ", () => {
  const f = { tg: ["gut"] };
  assert.equal(foodStatus("samosa", f, { ctx: { condKeys: ["gut"] } }).level, "red");
  assert.equal(foodStatus("samosa", f, { ctx: { condKeys: [] } }).level, "yellow");
  assert.equal(foodStatus("samosa", f).level, "yellow");
});
test("tagAvoidReason: sugar/diabetes, choke/শিশু, caffeine/শিশু", () => {
  assert.ok(tagAvoidReason("sugar", { flags: { diabetes: true } }));
  assert.equal(tagAvoidReason("sugar", { flags: {} }), null);
  assert.ok(tagAvoidReason("choke", { age: 3 }));
  assert.equal(tagAvoidReason("choke", { age: 9 }), null);
  assert.ok(tagAvoidReason("caffeine", { age: 10 }));
  assert.equal(tagAvoidReason("medgap", { condKeys: ["gut"] }), null);
});
