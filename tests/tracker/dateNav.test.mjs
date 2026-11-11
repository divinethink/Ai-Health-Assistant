import test from "node:test";
import assert from "node:assert/strict";
import { shiftISO, minDateISO, inRange, clampISO, monthGrid, swipeDelta, hijriLabel } from "../../src/health/tracker/dateNav.js";

test("shiftISO: মাস/বছর পার", () => {
  assert.equal(shiftISO("2026-11-01", -1), "2026-10-31");
  assert.equal(shiftISO("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftISO("2026-03-01", -1), "2026-02-28");
});
test("পরিসীমা: আজসহ ৩০ দিন", () => {
  assert.equal(minDateISO("2026-11-11"), "1990-01-01");
  assert.ok(inRange("2026-11-11", "2026-11-11"));
  assert.ok(inRange("2016-11-11", "2026-11-11"));
  assert.ok(!inRange("1989-12-31", "2026-11-11"));
  assert.ok(!inRange("2026-11-12", "2026-11-11"));
});
test("clampISO", () => {
  assert.equal(clampISO("2026-12-01", "2026-11-11"), "2026-11-11");
  assert.equal(clampISO("2025-01-01", "2026-11-11"), "2025-01-01");
  assert.equal(clampISO("1980-01-01", "2026-11-11"), "1990-01-01");
  assert.equal(clampISO("2026-11-05", "2026-11-11"), "2026-11-05");
});
test("monthGrid: নভেম্বর ২০২৬ (১ তারিখ রবিবার, শনি-শুরু)", () => {
  const g = monthGrid(2026, 10);
  assert.equal(g.length % 7, 0);
  assert.equal(g[0].iso, "2026-10-31");
  assert.ok(g[0].outside);
  assert.equal(g[1].iso, "2026-11-01");
  assert.ok(!g[1].outside);
  assert.equal(g.filter((x) => !x.outside).length, 30);
});
test("swipeDelta", () => {
  assert.equal(swipeDelta(100, 10), -1);
  assert.equal(swipeDelta(-100, 10), 1);
  assert.equal(swipeDelta(40, 0), 0);
  assert.equal(swipeDelta(100, 80), 0);
});
test("hijriLabel: ক্র্যাশ করে না", () => {
  assert.equal(typeof hijriLabel("2026-11-11"), "string");
});
