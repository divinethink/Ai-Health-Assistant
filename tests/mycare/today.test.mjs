import test from "node:test";
import assert from "node:assert/strict";
import { pickTodayCare, isEmptyCare, ROUTINE_SLOTS, dayIndex } from "../../src/health/mycare/careToday.js";
import { ALL_ITEMS } from "../../src/health/mycare/data/index.js";

const adult = { ageYears: 30, sex: "male", allergies: [], pregnant: false, breastfeeding: false, kidney: false, liver: false, skinType: "normal", hairType: "normal", avoidIngredients: [], preferences: [] };
const D = new Date(2026, 10, 19);
const ids = (c) => [...c.morning, ...c.night, ...c.anytime].map((e) => e.item.id);

test("প্রাপ্তবয়স্ক, তথ্য জানা: সকাল/রাতে মূল রুটিন আসে", () => {
  const c = pickTodayCare(adult, ALL_ITEMS, { season: "hemonto", date: D });
  assert.ok(c.morning.some((e) => e.item.id === "skin-sunscreen"));
  assert.ok(c.night.some((e) => e.item.id === "oral-fluoride-brushing"));
  assert.ok(c.anytime.length <= 2 && c.morning.length <= 3 && c.night.length <= 3);
});
test("২ বছরের নিচে = রেফার; কার্ড ফাঁকা", () => {
  const c = pickTodayCare({ ...adult, ageYears: 1 }, ALL_ITEMS, { season: "shit", date: D });
  assert.equal(c.mode, "referral"); assert.equal(isEmptyCare(c), true);
});
test("অ্যালার্জি-মেলা আইটেম কখনো আসে না", () => {
  const base = ids(pickTodayCare(adult, ALL_ITEMS, { season: "shit", date: D }));
  assert.ok(base.includes("skin-moisturizer") || base.length > 0);
  const hit = ALL_ITEMS.find((i) => i.id === "skin-sunscreen");
  const tok = (hit.ingredientAliases && hit.ingredientAliases[0]) || hit.name.en;
  const c = pickTodayCare({ ...adult, allergies: [tok] }, ALL_ITEMS, { season: "shit", date: D });
  assert.ok(!ids(c).includes("skin-sunscreen"));
});
test("অজানা তথ্য/১৮-র নিচে = শুধু মূল নিরাপদ সেট", () => {
  for (const p of [{ ...adult, allergies: null }, { ...adult, ageYears: 15 }]) {
    const c = pickTodayCare(p, ALL_ITEMS, { season: "shit", date: D });
    assert.equal(c.mode, "core-only");
    for (const e of [...c.morning, ...c.night, ...c.anytime]) assert.equal(e.item.isCoreSafe, true);
  }
});
test("একই দিনে একই ফল; ROUTINE_SLOTS-এর সব আইটেম বাস্তবে আছে", () => {
  const a = JSON.stringify(ids(pickTodayCare(adult, ALL_ITEMS, { season: "grishmo", date: D })));
  const b = JSON.stringify(ids(pickTodayCare(adult, ALL_ITEMS, { season: "grishmo", date: D })));
  assert.equal(a, b);
  for (const id of Object.keys(ROUTINE_SLOTS)) assert.ok(ALL_ITEMS.some((i) => i.id === id), id);
  assert.equal(dayIndex(D), dayIndex(new Date(2026, 10, 19, 23, 59)));
});
test("draft আইটেম রুটিনে আসে না", () => {
  const items = ALL_ITEMS.map((i) => (i.id === "skin-sunscreen" ? { ...i, status: "draft" } : i));
  assert.ok(!ids(pickTodayCare(adult, items, { season: "shit", date: D })).includes("skin-sunscreen"));
});
