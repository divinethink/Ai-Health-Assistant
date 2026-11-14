import test from "node:test";
import assert from "node:assert/strict";
import { foodStatus } from "../../src/health/tracker/foodStatus.js";

test("সাধারণ খাবার সবুজ", () => {
  const s = foodStatus("rice", { n: "ভাত" });
  assert.equal(s.level, "green"); assert.equal(s.icon, "✓"); assert.deepEqual(s.reasons, []);
});
test("অ্যালার্জি মিললে লাল, কারণসহ", () => {
  const s = foodStatus("egg", { al: "egg" }, { allergyTags: ["egg"] });
  assert.equal(s.level, "red"); assert.equal(s.icon, "✕"); assert.equal(s.reasons.length, 1);
});
test("অ্যালার্জি না মিললে লাল নয়", () => {
  assert.equal(foodStatus("egg", { al: "egg" }, { allergyTags: ["fish"] }).level, "green");
});
test("সতর্কতা-ট্যাগে হলুদ (চিনি — সাধারণ সতর্কতা)", () => {
  const s = foodStatus("laddu", { tg: ["sugar"] });
  assert.equal(s.level, "yellow"); assert.equal(s.icon, "!"); assert.equal(s.reasons.length, 1);
});
test("ক্যাফেইন: প্রাপ্তবয়স্কে সতর্কতা নেই, শিশুতে লাল", () => {
  assert.equal(foodStatus("redTea", { tg: ["caffeine"] }, { ctx: { age: 34 } }).level, "green");
  assert.equal(foodStatus("redTea", { tg: ["caffeine"] }, { ctx: { age: 8 } }).level, "red");
});
test("ওষুধ-সময় নোট: শুধু থাইরয়েড/আয়রন ওষুধ চললে হলুদ", () => {
  assert.equal(foodStatus("tokDoi", { tg: ["medgap"] }).level, "green");
  assert.equal(foodStatus("tokDoi", { tg: ["medgap"] }, { ctx: { age: 34, activeMeds: ["Levothyroxine"] } }).level, "yellow");
});
test("avoidMap-এ থাকলে লাল (হলুদের চেয়ে কড়া)", () => {
  const s = foodStatus("redTea", { tg: ["caffeine"] }, { avoidMap: { redTea: "উচ্চ রক্তচাপে সীমিত" } });
  assert.equal(s.level, "red"); assert.deepEqual(s.reasons, ["উচ্চ রক্তচাপে সীমিত"]);
});
test("অজানা ট্যাগ উপেক্ষা, খাবার না থাকলে ক্র্যাশ নয়", () => {
  assert.equal(foodStatus("x", { tg: ["nope"] }).level, "green");
  assert.equal(foodStatus("x", null).level, "green");
});
