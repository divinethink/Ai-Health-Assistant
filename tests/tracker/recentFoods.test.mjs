import test from "node:test";
import assert from "node:assert/strict";
import { recentFoodKeys, buildRecentFoodCards, recentDates } from "../../src/health/tracker/recentFoods.js";

const NOW = new Date(2026, 10, 13);
const base = { allergyTags: [], ctx: { age: 30, flags: {}, condKeys: [] }, now: NOW };

test("১৪ দিনের তারিখ, আজ আগে", () => {
  const d = recentDates(14, NOW);
  assert.equal(d.length, 14); assert.equal(d[0], "2026-11-13"); assert.equal(d[13], "2026-10-31");
});
test("১৪ দিনের বাইরের ডক বাদ, নতুন আগে, ডুপ্লিকেট নয়", () => {
  const docs = [
    { date: "2026-11-13", extraFoods: [{ name: "ভাত", kcal: 200, slot: "lunch", key: "rice" }] },
    { date: "2026-11-10", extraFoods: [{ name: "ভাত", kcal: 200, slot: "lunch", key: "rice" }, { name: "কলা", kcal: 90, slot: "snack1", key: "banana" }] },
    { date: "2026-10-01", extraFoods: [{ name: "মুড়ি", kcal: 90, slot: "snack2", key: "muri" }] },
  ];
  assert.deepEqual(recentFoodKeys(docs, { now: NOW }).map((x) => x.key), ["rice", "banana"]);
});
test("অজানা ফ্রি-টেক্সট নাম বাদ; নাম মিললে ধরা", () => {
  const docs = [{ date: "2026-11-13", extraFoods: [{ name: "রহস্য-খাবার", kcal: 100, slot: "lunch" }, { name: "কলা", kcal: 90, slot: "snack1" }] }];
  assert.deepEqual(recentFoodKeys(docs, { now: NOW }).map((x) => x.key), ["banana"]);
});
test("কার্ড: সবুজ → include; হলুদ → avoid (!); এলার্জি → avoid (✕); প্রতিটি ≤৫", () => {
  const docs = [{ date: "2026-11-13", extraFoods: [
    { name: "ভাত", kcal: 200, slot: "lunch", key: "rice" },
    { name: "চা (চিনি ছাড়া)", kcal: 30, slot: "snack2", key: "tea" },
    { name: "ডিম", kcal: 70, slot: "breakfast", key: "egg" },
  ] }];
  const r = buildRecentFoodCards({ ...base, dailyDocs: docs, allergyTags: ["egg"] });
  assert.ok(r.include.some((x) => x.key === "rice"));
  assert.equal(r.avoid.find((x) => x.key === "egg").icon, "✕");
  assert.ok(r.avoid.length <= 5 && r.include.length <= 5);
});
test("ডেটা না থাকলে খালি, ক্র্যাশ নয়", () => {
  assert.deepEqual(buildRecentFoodCards({ ...base, dailyDocs: [] }), { avoid: [], include: [] });
  assert.deepEqual(buildRecentFoodCards({ ...base, dailyDocs: undefined }), { avoid: [], include: [] });
});
test("গেট-ব্লকে শুধু আজ-শুধু খাবার (মিল-টিক নয়)", () => {
  const goal = { calc: { calorieTarget: 1800 } };
  const docs = [{ date: "2026-11-13", mealsEaten: ["lunch"] }];
  assert.deepEqual(buildRecentFoodCards({ ...base, dailyDocs: docs, goal, gateBlocked: true }), { avoid: [], include: [] });
  assert.ok(buildRecentFoodCards({ ...base, dailyDocs: docs, goal, gateBlocked: false }).include.length > 0);
});
