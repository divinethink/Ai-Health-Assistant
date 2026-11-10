// "ওষুধ খেয়েছি" pure helper (ধাপ ২)। চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { doseKey, isDoseKey, sanitizeTaken, legacyTakenToKeys, recordIdOfDoseKey, MAX_MED_TAKEN } from "../../src/health/records/medTaken.js";

test("doseKey: ':' বাদ, রেকর্ড-ID + HHMM", () => {
  assert.equal(doseKey("AbC123", "08:00"), "AbC123_0800");
  assert.equal(doseKey("AbC123", "21:30"), "AbC123_2130");
});
test("isDoseKey: বৈধ/অবৈধ", () => {
  assert.equal(isDoseKey("AbC123_0800"), true);
  assert.equal(isDoseKey("AbC123_08:00"), false);
  assert.equal(isDoseKey("AbC123"), false);
  assert.equal(isDoseKey("a.b_0800"), false);
  assert.equal(isDoseKey(null), false);
});
test("sanitizeTaken: শুধু বৈধ key ও মান true", () => {
  assert.deepEqual(sanitizeTaken({ A1_0800: true, A2_0900: false, "bad key": true, A3_0700: "yes" }), { A1_0800: true });
  assert.deepEqual(sanitizeTaken(null), {});
  assert.deepEqual(sanitizeTaken("x"), {});
});
test("sanitizeTaken: সর্বোচ্চ সীমা", () => {
  const big = {};
  for (let i = 0; i < 100; i++) big["R" + i + "_0800"] = true;
  assert.equal(Object.keys(sanitizeTaken(big)).length, MAX_MED_TAKEN);
});
test("legacyTakenToKeys: পুরনো key রূপান্তর, ভুল/false বাদ, ডুপ্লিকেট নয়", () => {
  const out = legacyTakenToKeys({ "AbC_08:00": true, "AbC_0800": true, "XyZ_21:30": true, "Q_07:00": false, "bad": true });
  assert.deepEqual(out.sort(), ["AbC_0800", "XyZ_2130"]);
  assert.deepEqual(legacyTakenToKeys(null), []);
});
test("recordIdOfDoseKey", () => {
  assert.equal(recordIdOfDoseKey("AbC123_0800"), "AbC123");
});
