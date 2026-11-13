import test from "node:test";
import assert from "node:assert/strict";
import { FOOD_INFO, AVOID_INFO, infoOf, avoidHarmOf } from "../../src/health/tracker/foodInfo.js";
import { groupedFoodList, foodDetail } from "../../src/health/tracker/foodGroupList.js";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";

test("প্রতিটি তথ্য-key ক্যাটালগে আছে; n ও w খালি নয়", () => {
  Object.entries(FOOD_INFO).forEach(([k, v]) => {
    assert.ok(FOODS[k], "ক্যাটালগে নেই: " + k);
    assert.ok(Array.isArray(v.n) && v.n.length > 0 && v.w, k);
  });
});
test("প্রসেসড/ভাজাপোড়া key ক্যাটালগে আছে ও ক্ষতির লাইন আছে", () => {
  Object.values(AVOID_INFO).forEach((g) => g.keys.forEach((k) => { assert.ok(FOODS[k], k); assert.ok(avoidHarmOf(k), k); }));
});
test("কার্যকারিতা-দাবির নিষিদ্ধ শব্দ নেই; গ্রাম/সংখ্যা-দাবি নেই", () => {
  const bad = /নিরাময়|প্রমাণিত|সমাধান|রোগ সারায়|বাড়ায়\b/;
  Object.entries(FOOD_INFO).forEach(([k, v]) => {
    assert.ok(!bad.test(v.w + (v.note || "")), k);
    assert.ok(!/[0-9০-৯]+\s*(গ্রাম|মিগ্রা|mg|g)\b/.test(v.n.join(" ") + v.w), k);
  });
});
test("গ্রুপ-তালিকা: শুধু মিল-থাকা গ্রুপ; সার্চ কাজ করে (নাম/পুষ্টি/ইংলিশ)", () => {
  const all = groupedFoodList("");
  assert.ok(all.groups.length >= 5 && all.avoid.length === 3);
  const va = groupedFoodList("ভিটামিন এ");
  assert.ok(va.groups.flatMap((g) => g.items).some((x) => x.key === "chotoMach"));
  assert.deepEqual(groupedFoodList("zzzz-নেই").groups, []);
  assert.ok(groupedFoodList("banana").groups.flatMap((g) => g.items).some((x) => x.key === "banana"));
});
test("foodDetail: তথ্যসহ ও তথ্যহীন খাবারে ক্র্যাশ নয়", () => {
  const d = foodDetail("chotoMach"); assert.ok(d.kcalText.includes("কিলোক্যালরি") && d.n.length);
  assert.equal(foodDetail("singara").harm.length > 10, true);
  assert.equal(foodDetail("nope"), null);
  assert.equal(infoOf("nope"), null);
});
