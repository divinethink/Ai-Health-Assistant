// চালানো: node --test tests/tracker/foodBatch1121.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";
import { searchFoods } from "../../src/health/tracker/foodCatalog.js";
import { nutritionOf } from "../../src/health/tracker/foodNutrition.js";
import { infoOf, avoidHarmOf } from "../../src/health/tracker/foodInfo.js";
import { FOOD_EN } from "../../src/shared/searchAliases.js";
import { recentFoodKeys } from "../../src/health/tracker/recentFoods.js";

const NEW = ["iceCream", "kalojiraBhorta", "dhoniaBhorta", "toastSweet", "toastPlain", "pabda", "mixFruit", "gingerSharbat",
  "papayaJuice", "mangoJuice", "smoothie", "puiShak", "lalShak", "dataShak", "kolmiShak"];
const keys = (q) => searchFoods(FOODS, { query: q, limit: 300 }).map((x) => x.key);

test("নতুন ১৫ খাবার: ক্যাটালগ, পুষ্টি, তথ্য ও ইংলিশ নাম সব আছে", () => {
  for (const k of NEW) {
    assert.ok(FOODS[k], "ক্যাটালগে নেই: " + k);
    assert.ok(nutritionOf(k), "পুষ্টি নেই: " + k);
    assert.ok(infoOf(k), "তথ্য নেই: " + k);
    assert.ok(FOOD_EN[k], "ইংলিশ নাম নেই: " + k);
  }
});
test("নতুন খাবার: অনুরোধের নামে সার্চে মেলে", () => {
  const want = { "আইসক্রিম": "iceCream", "কালোজিরা ভর্তা": "kalojiraBhorta", "ধনিয়া পাতা ভর্তা": "dhoniaBhorta", "টোস্ট (মিষ্টি)": "toastSweet",
    "টোস্ট (প্লেইন)": "toastPlain", "পাবদা মাছ": "pabda", "মিক্স ফ্রুট": "mixFruit", "আদার শরবত": "gingerSharbat", "পাকা পেপে জুস": "papayaJuice",
    "আমের জুস": "mangoJuice", "স্মুদি": "smoothie", "পুঁই শাক": "puiShak", "লাল শাক": "lalShak", "ডাটা শাক": "dataShak", "কলমি শাক": "kolmiShak" };
  for (const [q, k] of Object.entries(want)) assert.ok(keys(q).includes(k), q + " → " + k);
});
test("নাম-সংশোধন: পাকা কলা, পাকা পেঁপে, লাবান; পুরনো নামেও সার্চ চলে", () => {
  assert.equal(FOODS.banana.n, "পাকা কলা");
  assert.equal(FOODS.papaya.n, "পাকা পেঁপে");
  assert.equal(FOODS.labang.n, "লাবান");
  assert.ok(keys("লাবাং").includes("labang") && keys("লাবান").includes("labang"));
  assert.ok(keys("কলা").includes("banana") && keys("পেঁপে").includes("papaya") && keys("পাকা পেপে").includes("papaya"));
});
test("বিদ্যমান খাবারের পুনরাবৃত্তি নেই: বেগুন ভাজি/লাউ সবজি/লেবুর শরবত (চিনি ছাড়া) পুরনো খাবারেই মেলে", () => {
  assert.ok(keys("বেগুন ভাজি").includes("begunBhaja"));
  assert.ok(keys("লাউ সবজি").includes("lau"));
  assert.ok(keys("লেবুর শরবত (চিনি ছাড়া)").includes("lemonWater"));
  const names = Object.values(FOODS).map((f) => f.n);
  assert.equal(new Set(names).size, names.length, "একই নামে দুই খাবার");
});
test("ক্ষতির তথ্য: আইসক্রিম, জুস, স্মুদি, টোস্ট", () => {
  for (const k of ["iceCream", "mangoJuice", "papayaJuice", "smoothie", "toastSweet", "toastPlain"]) assert.ok(avoidHarmOf(k), k);
});
test("পুরনো লগের ফ্রি-টেক্সট \"কলা\"/\"পেঁপে\" এখনও চেনা যায়", () => {
  const docs = [{ date: "2026-11-13", extraFoods: [{ name: "কলা", kcal: 90, slot: "snack1" }, { name: "পেঁপে", kcal: 60, slot: "snack2" }] }];
  const got = recentFoodKeys(docs, { now: new Date(2026, 10, 14) }).map((x) => x.key).sort();
  assert.deepEqual(got, ["banana", "papaya"]);
});
