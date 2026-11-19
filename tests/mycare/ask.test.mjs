import test from "node:test";
import assert from "node:assert/strict";
import { buildAskText } from "../../src/health/mycare/careAsk.js";
import { setChatPrefill, peekChatPrefill, clearChatPrefill } from "../../src/shared/chatPrefill.js";

test("প্রশ্ন: বিভাগ + সমস্যা (বাংলা/ইংরেজি)", () => {
  assert.match(buildAskText("skin", "acne", "bn"), /ত্বক-এর সমস্যা: ব্রণ/);
  assert.match(buildAskText("hair", "hairfall", "en"), /My Hair Care concern: Hair fall/);
});
test("প্রশ্ন: সমস্যা ছাড়া শুধু বিভাগ; অজানা বিভাগ = ফাঁকা", () => {
  assert.match(buildAskText("oral", null, "bn"), /দাঁত ও মুখ/);
  assert.equal(buildAskText("nope", null, "bn"), "");
});
test("প্রশ্নে ব্যক্তিগত তথ্যের কোনো জায়গা নেই", () => {
  const t = buildAskText("skin", "acne", "bn");
  assert.ok(!/অ্যালার্জি|গর্ভ|বছর|DOB/.test(t));
});
test("prefill: এক জায়গায় রাখা, peek দিয়ে পড়া, clear-এ মুছে যায়, দৈর্ঘ্য-সীমা", () => {
  setChatPrefill("  হ্যালো  ");
  assert.equal(peekChatPrefill(), "হ্যালো");
  assert.equal(peekChatPrefill(), "হ্যালো");
  clearChatPrefill();
  assert.equal(peekChatPrefill(), "");
  setChatPrefill("ক".repeat(500));
  assert.equal(peekChatPrefill().length, 300);
  setChatPrefill("");
  assert.equal(peekChatPrefill(), "");
});
