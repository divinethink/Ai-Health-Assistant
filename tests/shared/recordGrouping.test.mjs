// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { groupObservations, obsTrend } from "../../src/health/records/recordGrouping.js";

const o = (id, type, value, date, unit = "kg") => ({ id, resourceType: "observation", type, value, date, unit });

test("ধরন অনুযায়ী গ্রুপ; weight/ওজন এক গ্রুপ; নতুন আগে", () => {
  const g = groupObservations([
    o("1", "weight", "67", "2026-10-01"), o("2", "ওজন", "66", "2026-11-09"),
    o("3", "TSH", "8.2", "2026-11-07", "µIU/mL"), { id: "x", resourceType: "condition", name: "IBS" },
  ]);
  assert.equal(g.length, 2);
  const w = g.find((x) => x.key === "weight");
  assert.equal(w.label, "ওজন");
  assert.deepEqual(w.items.map((r) => r.id), ["2", "1"]);
});
test("ট্রেন্ড: নিচে/উপরে/সমান/অসংখ্যা/একটাই", () => {
  assert.deepEqual(obsTrend([o("a", "w", "66", "2"), o("b", "w", "67", "1")]), { dir: "down", diff: 1 });
  assert.deepEqual(obsTrend([o("a", "w", "8.2", "2"), o("b", "w", "7.0", "1")]), { dir: "up", diff: 1.2 });
  assert.equal(obsTrend([o("a", "w", "66", "2"), o("b", "w", "66", "1")]), null);
  assert.equal(obsTrend([o("a", "w", "Bristol 6", "2"), o("b", "w", "5", "1")]), null);
  assert.equal(obsTrend([o("a", "w", "66", "2")]), null);
});
