import test from "node:test";
import assert from "node:assert/strict";
import { macroTargets } from "../../src/health/tracker/macroTargets.js";

test("সাধারণ ১৮+ : ২০/৫০/৩০ + ফাইবার", () => {
  const m = macroTargets({ kcal: 2040, age: 34, weightKg: 70, flags: {} });
  assert.deepEqual([m.mode, m.p, m.c, m.f, m.fiber], ["target", 102, 255, 68, 29]);
});
test("ডায়াবেটিস: কার্ব ৪৫%, ফ্যাট ৩৫%", () => {
  const m = macroTargets({ kcal: 2000, age: 40, flags: { diabetes: true } });
  assert.deepEqual([m.mode, m.p, m.c, m.f], ["target", 100, 225, 78]);
});
test("<১৮: সর্বোচ্চ সীমা (৪–১৮)", () => {
  const m = macroTargets({ kcal: 2000, age: 12, flags: {} });
  assert.deepEqual([m.mode, m.p, m.c, m.f], ["max", 150, 325, 78]);
});
test("গর্ভাবস্থা: সর্বোচ্চ সীমা", () => {
  const m = macroTargets({ kcal: 2200, age: 28, flags: { pregnant: true } });
  assert.deepEqual([m.mode, m.p, m.c, m.f], ["max", 193, 358, 86]);
});
test("কিডনি: প্রোটিন ০.৮ গ্রাম/কেজি; ওজন না থাকলে প্রোটিন-সীমা নেই", () => {
  const a = macroTargets({ kcal: 2000, age: 50, weightKg: 70, flags: { kidney: true } });
  assert.deepEqual([a.mode, a.p], ["max", 56]);
  const b = macroTargets({ kcal: 2000, age: 50, flags: { kidney: true } });
  assert.equal(b.p, null);
});
test("একাধিক: ছোটটাই (গর্ভবতী+কিডনি+ডায়াবেটিস)", () => {
  const m = macroTargets({ kcal: 2000, age: 30, weightKg: 60, flags: { pregnant: true, kidney: true, diabetes: true } });
  assert.deepEqual([m.p, m.c, m.f], [48, 225, 78]);
});
test("kcal/বয়স না থাকলে null", () => {
  assert.equal(macroTargets({ kcal: 0, age: 30 }), null);
  assert.equal(macroTargets({ kcal: 2000, age: null }), null);
});
