// পার্ট ১১ — চালানো: node --test tests/tracker/gutLog.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { cleanScore, gutEntries, entriesOn, checkGutAdd, buildGutRecord, gutFoodCount, gutWeek, GUT_TYPE, MAX_GUT_PER_DAY } from "../../src/health/tracker/gutLog.js";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";

const obs = (id, date, value, type = GUT_TYPE, rt = "observation") => ({ id, resourceType: rt, type, value, date });

test("cleanScore: শুধু ১–৭ পূর্ণসংখ্যা", () => {
  [1, 4, 7, "1", "7"].forEach((v) => assert.notEqual(cleanScore(v), null));
  [0, 8, 3.5, "3.5", "", "abc", null, undefined, NaN, -1, "০"].forEach((v) => assert.equal(cleanScore(v), null));
});

test("gutEntries: শুধু বৈধ stool-bristol Observation; অন্য type/resourceType/ভুল মান/তারিখ বাদ; নতুন আগে", () => {
  const recs = [obs("a", "2026-11-01", "3"), obs("b", "2026-11-05", "6"), obs("c", "2026-11-03", "9"), obs("d", "2026-11-04", "4", "weight"),
    obs("e", "2026-11-04", "4", GUT_TYPE, "condition"), obs("f", "bad", "4"), obs("g", "2026-11-05", "2")];
  const out = gutEntries(recs);
  assert.deepEqual(out.map((x) => x.id).sort(), ["a", "b", "g"]);
  assert.equal(out[0].date, "2026-11-05");
  assert.deepEqual(gutEntries(null), []);
  assert.deepEqual(gutEntries(undefined), []);
});

test("entriesOn ও gutWeek", () => {
  const e = gutEntries([obs("a", "2026-11-05", "3"), obs("b", "2026-11-05", "4"), obs("c", "2026-11-04", "7")]);
  assert.equal(entriesOn(e, "2026-11-05").length, 2);
  const w = gutWeek(e, ["2026-11-04", "2026-11-05", "2026-11-06"]);
  assert.deepEqual(w.map((x) => x.scores.length), [1, 2, 0]);
});

test("checkGutAdd: সীমা ও অবৈধ স্কোর", () => {
  assert.equal(checkGutAdd(4, 0), null);
  assert.equal(checkGutAdd(4, MAX_GUT_PER_DAY - 1), null);
  assert.ok(checkGutAdd(4, MAX_GUT_PER_DAY));
  assert.ok(checkGutAdd(0, 0));
  assert.ok(checkGutAdd("x", 0));
});

test("buildGutRecord: Observation-ফিল্ড (মান স্ট্রিং, unit অ-খালি)", () => {
  const r = buildGutRecord(5, "2026-11-08");
  assert.deepEqual(r, { type: GUT_TYPE, value: "5", unit: "Bristol", date: "2026-11-08" });
  assert.throws(() => buildGutRecord(9, "2026-11-08"), /./);
});

test("gutFoodCount: টিক-করা স্লট + নাম-মিলানো extras; অটিক/অজানা/null নিরাপদ", () => {
  const gutKey = Object.keys(FOODS).find((k) => (FOODS[k].tg || []).includes("gut"));
  const plainKey = Object.keys(FOODS).find((k) => !(FOODS[k].tg || []).includes("gut"));
  const plan = { slots: [{ id: "breakfast", items: [{ key: gutKey }, { key: plainKey }] }, { id: "lunch", items: [{ key: gutKey }] }] };
  assert.equal(gutFoodCount(plan, ["breakfast"], []), 1);
  assert.equal(gutFoodCount(plan, ["breakfast", "lunch"], []), 2);
  assert.equal(gutFoodCount(plan, [], []), 0);
  assert.equal(gutFoodCount(plan, ["breakfast"], [{ name: FOODS[gutKey].n }, { name: "অজানা খাবার" }]), 2);
  assert.equal(gutFoodCount(null, null, null), 0);
  assert.equal(gutFoodCount(null, [], [{ name: FOODS[gutKey].n }]), 1);
});
