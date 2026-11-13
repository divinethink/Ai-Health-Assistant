import test from "node:test";
import assert from "node:assert/strict";
import { isValidPin, newSaltB64, hashPin, safeEqual, lockoutUntil, FREE_TRIES, BASE_LOCKOUT_MS, MAX_LOCKOUT_MS } from "../../src/shared/passcode.js";

test("PIN শুধু ৪ অঙ্ক", () => {
  assert.equal(isValidPin("1234"), true);
  for (const bad of ["123", "12345", "12a4", "", " 123", null, 1234]) assert.equal(isValidPin(bad), false);
});

test("hash: একই PIN+salt = একই, ভিন্ন PIN/salt = ভিন্ন; PIN plain নয়", async () => {
  const salt = newSaltB64();
  const a = await hashPin("1234", salt, 1000);
  assert.equal(await hashPin("1234", salt, 1000), a);
  assert.notEqual(await hashPin("1235", salt, 1000), a);
  assert.notEqual(await hashPin("1234", newSaltB64(), 1000), a);
  assert.ok(!a.includes("1234"));
});

test("safeEqual", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "ab"), false);
});

test("lockoutUntil: প্রথম ৫টা ভুলে অপেক্ষা নেই, তারপর ৩০স → দ্বিগুণ → সর্বোচ্চ ১৫ মি.", () => {
  const now = 1000;
  for (let c = 1; c < FREE_TRIES; c++) assert.equal(lockoutUntil(c, now), 0);
  assert.equal(lockoutUntil(FREE_TRIES, now), now + BASE_LOCKOUT_MS);
  assert.equal(lockoutUntil(FREE_TRIES + 5, now), now + BASE_LOCKOUT_MS * 2);
  assert.equal(lockoutUntil(500, now), now + MAX_LOCKOUT_MS);
});
