// চালান: node --test tests/shared/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildLabAlerts, alertForGroup, alertSig, isAlertAcked } from "../../src/health/reports/labAlerts.js";

const dict = [{ id: "tsh", canonicalNameEn: "TSH", synonyms: ["TSH"], unit: "mIU/L", referenceRange: { low: 0.4, high: 4.0 } }];
const obs = (o = {}) => ({ id: "r1", type: "TSH", value: "8.2", unit: "mIU/L", ...o });

test("সরানোর আগে সতর্কতা আসে; সরানোর পর (স্বাক্ষর মিললে) বাদ", () => {
  assert.equal(buildLabAlerts([obs()], dict, null).length, 1);
  const acked = obs({ alertAck: alertSig(obs()) });
  assert.ok(isAlertAcked(acked));
  assert.equal(buildLabAlerts([acked], dict, null).length, 0);
});
test("সরানোর পর মান বদলালে সতর্কতা আবার আসে", () => {
  const stale = obs({ value: "9.0", alertAck: alertSig(obs()) });
  assert.equal(isAlertAcked(stale), false);
  assert.equal(buildLabAlerts([stale], dict, null).length, 1);
});
test("রেঞ্জ/একক বদলালেও আবার আসে", () => {
  const a = alertSig(obs());
  assert.notEqual(a, alertSig(obs({ refHigh: 10 })));
  assert.notEqual(a, alertSig(obs({ unit: "µIU/mL" })));
});
test("পরিমাপের লাল (alertForGroup) সরানো সতর্কতায় প্রভাবিত নয়", () => {
  const acked = obs({ alertAck: alertSig(obs()) });
  const al = alertForGroup([acked], dict, null);
  assert.ok(al && al.level === "high");
});
test("alertAck নেই = সরানো নয়; ফাঁকা/অন্য স্ট্রিং = সরানো নয়", () => {
  assert.equal(isAlertAcked(obs()), false);
  assert.equal(isAlertAcked(obs({ alertAck: "" })), false);
  assert.equal(isAlertAcked(null), false);
});
