// পার্ট ৭ — চালানো: node --test tests/tracker/partSeven.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { waterTargetFor } from "../../src/health/tracker/trackerCalc.js";
import { metricsOf } from "../../src/health/tracker/todaySummary.js";
import { recentExtraFoods } from "../../src/health/tracker/planPrefs.js";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";
import { POS_TAGS, POS_TAG_FOODS, posTagsOf, tagsOf, TAGS } from "../../src/health/tracker/foodCatalog.js";

test("পানির লক্ষ্য: ব্যান্ডের সীমা", () => {
  const t = (a, f) => waterTargetFor(a, f);
  assert.equal(t(0), null);
  assert.equal(t(1), null);
  assert.equal(t(2), 4);
  assert.equal(t(4), 4);
  assert.equal(t(5), 6);
  assert.equal(t(12), 6);
  assert.equal(t(13), 8);
  assert.equal(t(40), 8);
  assert.equal(t(70), 8);
});
test("পানির লক্ষ্য: কিডনি সবসময় null; বয়স অজানা = ৮ (আগের আচরণ); flags ঐচ্ছিক", () => {
  assert.equal(waterTargetFor(30, { kidney: true }), null);
  assert.equal(waterTargetFor(3, { kidney: true }), null);
  assert.equal(waterTargetFor(null, {}), 8);
  assert.equal(waterTargetFor(undefined), 8);
  assert.equal(waterTargetFor(30, { diabetes: true, pregnant: true }), 8);
});
test("সামঞ্জস্য: todaySummary একই লক্ষ্য পড়ে; null হলে পানি প্রযোজ্য নয়", () => {
  const w = waterTargetFor(3, {});
  const base = { calorieTarget: null, exTarget: 60, waterTarget: w, sleepMinH: 10 };
  assert.ok(metricsOf({ waterGlasses: 4 }, base).met.includes("water"));
  assert.ok(!metricsOf({ waterGlasses: 3 }, base).met.includes("water"));
  const none = metricsOf({ waterGlasses: 9 }, { ...base, waterTarget: waterTargetFor(1, {}) });
  assert.ok(!none.applicable.includes("water"));
});

const NOW = new Date(2026, 10, 8); // ২০২৬-১১-০৮
const ex = (name, kcal, slot = "snack1") => ({ name, kcal, slot });
test("সাম্প্রতিক খাবার: ফ্রিকোয়েন্সি-ক্রম, ৭ দিনের বাইরে বাদ, নাম-মিলানো, সর্বশেষ kcal", () => {
  const docs = [
    { date: "2026-11-08", extraFoods: [ex("সিঙ্গারা", 260), ex("চা", 50)] },
    { date: "2026-11-07", extraFoods: [ex("সিঙ্গারা ", 250), ex("কেক", 300)] },
    { date: "2026-11-05", extraFoods: [ex("কেক", 280)] },
    { date: "2026-11-01", extraFoods: [ex("পুরনো", 100), ex("কেক", 999)] }, // ৭ দিনের বাইরে
  ];
  const r = recentExtraFoods(docs, { now: NOW });
  assert.deepEqual(r.map((x) => x.name), ["সিঙ্গারা", "কেক", "চা"]);
  assert.equal(r[0].count, 2);
  assert.equal(r[0].kcal, 260); // নতুনতম
  assert.equal(r[1].count, 2);
  assert.equal(r[1].kcal, 300); // নভেম্বর ৭-এর মান (১ নভেম্বরেরটি বাদ)
  assert.ok(!r.some((x) => x.name === "পুরনো"));
});
test("সাম্প্রতিক খাবার: সীমা ৮, অবৈধ ইনপুটে নিরাপদ, খালি = []", () => {
  const many = Array.from({ length: 12 }, (_, i) => ex("খাবার" + i, 10 + i));
  assert.equal(recentExtraFoods([{ date: "2026-11-08", extraFoods: many }], { now: NOW }).length, 8);
  assert.deepEqual(recentExtraFoods(null, { now: NOW }), []);
  assert.deepEqual(recentExtraFoods([null, {}, { date: "2026-11-08", extraFoods: "x" }, { date: "2026-11-08", extraFoods: [{ name: 5 }, ex("", 1), ex("ভুল", 99999), ex("ঠিক", 5, "bogus")] }], { now: NOW }), []);
  assert.deepEqual(recentExtraFoods([{ date: "2026-11-08", extraFoods: [ex("ক", 1)] }], { now: NOW, limit: 0 }), []);
});
test("সাম্প্রতিক খাবার: মাস-সীমা পেরিয়ে ৭ দিন (৩ নভেম্বর → ২৮ অক্টোবর..৩ নভেম্বর)", () => {
  const now = new Date(2026, 10, 3);
  const r = recentExtraFoods([{ date: "2026-10-28", extraFoods: [ex("আম", 100)] }, { date: "2026-10-27", extraFoods: [ex("লিচু", 50)] }], { now });
  assert.deepEqual(r.map((x) => x.name), ["আম"]);
});

test("ইতিবাচক ট্যাগ: সব key বৈধ খাবার, শুধু protein/fibre, সতর্কতা-ট্যাগের সাথে সংঘর্ষ নেই", () => {
  assert.deepEqual(Object.keys(POS_TAGS).sort(), ["fibre", "protein"]);
  Object.entries(POS_TAG_FOODS).forEach(([tag, keys]) => {
    assert.equal(new Set(keys).size, keys.length, tag + " ডুপ্লিকেট");
    keys.forEach((k) => assert.ok(FOODS[k], tag + ": অজানা খাবার " + k));
  });
  Object.keys(POS_TAGS).forEach((t) => assert.ok(!(t in TAGS)));
  assert.deepEqual(posTagsOf("dal"), ["protein", "fibre"]);
  assert.deepEqual(posTagsOf("hilshaBhaja"), ["protein"]);
  assert.deepEqual(posTagsOf("shak"), ["fibre"]);
  assert.deepEqual(posTagsOf("cake"), []);
  assert.deepEqual(posTagsOf("nope"), []);
});
test("সতর্কতা-ট্যাগ অপরিবর্তিত", () => {
  assert.deepEqual(tagsOf(FOODS.milk), ["gut", "medgap"]);
  assert.deepEqual(tagsOf(FOODS.cake), ["sugar"]);
  assert.deepEqual(tagsOf(FOODS.apple), ["gut"]);
});
