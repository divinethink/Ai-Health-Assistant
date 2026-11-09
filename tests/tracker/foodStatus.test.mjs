import test from "node:test";
import assert from "node:assert/strict";
import { foodStatus } from "../../src/health/tracker/foodStatus.js";

test("সাধারণ খাবার সবুজ", () => {
  const s = foodStatus("rice", { n: "ভাত" });
  assert.equal(s.level, "green"); assert.equal(s.icon, "✓"); assert.deepEqual(s.reasons, []);
});
test("এলার্জি মিললে লাল, কারণসহ", () => {
  const s = foodStatus("egg", { al: "egg" }, { allergyTags: ["egg"] });
  assert.equal(s.level, "red"); assert.equal(s.icon, "✕"); assert.equal(s.reasons.length, 1);
});
test("এলার্জি না মিললে লাল নয়", () => {
  assert.equal(foodStatus("egg", { al: "egg" }, { allergyTags: ["fish"] }).level, "green");
});
test("সতর্কতা-ট্যাগে হলুদ", () => {
  const s = foodStatus("redTea", { tg: ["caffeine"] });
  assert.equal(s.level, "yellow"); assert.equal(s.icon, "!"); assert.equal(s.reasons.length, 1);
});
test("avoidMap-এ থাকলে লাল (হলুদের চেয়ে কড়া)", () => {
  const s = foodStatus("redTea", { tg: ["caffeine"] }, { avoidMap: { redTea: "উচ্চ রক্তচাপে সীমিত" } });
  assert.equal(s.level, "red"); assert.deepEqual(s.reasons, ["উচ্চ রক্তচাপে সীমিত"]);
});
test("অজানা ট্যাগ উপেক্ষা, খাবার না থাকলে ক্র্যাশ নয়", () => {
  assert.equal(foodStatus("x", { tg: ["nope"] }).level, "green");
  assert.equal(foodStatus("x", null).level, "green");
});
