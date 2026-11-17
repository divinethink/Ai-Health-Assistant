// চালানো: node --test tests/tracker/foodNewBatch.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "../../src/health/tracker/mealPlanData.js";
import { searchFoods } from "../../src/health/tracker/foodCatalog.js";
import { searchExercises } from "../../src/health/tracker/planPrefs.js";
import { groupedFoodList } from "../../src/health/tracker/foodGroupList.js";

const keys = (q) => searchFoods(FOODS, { query: q, limit: 200 }).map((x) => x.key);

test("সার্চ: ফোন-কিবোর্ডের এক-কোডের ড় (U+09DC) ও দুই-অংশের ড় — দুইভাবেই \"মুড়ি\" মেলে", () => {
  const one = keys("\u09ae\u09c1\u09dc\u09bf"), two = keys("\u09ae\u09c1\u09a1\u09bc\u09bf");
  assert.ok(one.includes("muri") && two.includes("muri"));
  assert.deepEqual(one, two);
});
test("সার্চ: খাদ্য-নির্দেশিকা তালিকা ও ব্যায়াম-সার্চেও একই সমাধান", () => {
  const g = groupedFoodList("\u09ae\u09c1\u09dc\u09bf");
  assert.ok(Array.isArray(g.groups));
  assert.ok(searchExercises("\u09a6\u09cc\u09dc").length >= searchExercises("\u09a6\u09cc\u09a1\u09bc").length);
});
test("নতুন ২০ খাবার: অনুরোধের প্রতিটি নামে সার্চে মেলে", () => {
  const want = { "শুটকি ভর্তা": "shutkiBhorta", "শুটকি": "shutkiTorkari", "মাছ ভর্তা": "machBhorta", "বাদাম ভর্তা": "badamBhorta",
    "নারিকেল লাড্ডু": "narikelLaddu", "নারিকেল": "narikel", "নারকেল": "narikel", "চিকেন চাপ": "chickenChaap", "পরাটা": "porota", "নান রুটি": "nanRuti",
    "তন্দুর রুটি": "tandooriRuti", "ডিম পোচ": "eggPoach", "মিক্স সবজি": "veg", "পাকা পেপে": "papaya", "জলপাই": "jolpai", "আমের আচার": "mangoAchar",
    "জলপাই আচার": "jolpaiAchar", "আচার": "mixAchar", "জেলি": "jellyMix", "মিষ্টি": "misti", "রসমালাই": "rasmalai", "কালোজাম": "kalojam",
    "সন্দেশ": "sondesh", "মাঠা": "matha", "লাবাং": "labang", "লাচ্চি": "lassi", "হালিম": "haleem", "পেয়ারা": "guava" };
  for (const [q, k] of Object.entries(want)) assert.ok(keys(q).includes(k), q + " → " + k);
});
