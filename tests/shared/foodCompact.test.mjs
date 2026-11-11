import { test } from "node:test";
import assert from "node:assert/strict";
import { compactGuidance } from "../../src/health/nutrition-fitness/foodCompact.js";

const avoid = [
  "ভাজাপোড়া, বেশি তেল-ঝাল-মসলা ও ফাস্টফুড সীমিত রাখুন",
  "চা-কফি, কার্বনেটেড/চিনিযুক্ত পানীয় সীমিত রাখুন",
  "যে খাবারে আপনার উপসর্গ বাড়ে তা লিখে রাখুন ও এড়ান; ডাক্তার/ডায়েটিশিয়ানের সাথে আলোচনা করুন",
  "উচ্চ-ক্যালরি প্রসেসড/ভাজাপোড়া খাবার",
  "চিনি-যুক্ত পানীয়/মিষ্টি",
  "অতিরিক্ত ভাজাপোড়া, তেল-চর্বিযুক্ত ও ঝাল-মসলাদার খাবার",
  "অতিরিক্ত চা/কফি ও গ্যাসযুক্ত (কার্বনেটেড) পানীয়",
  "সরবিটল/কৃত্রিম মিষ্টি (সুগার-ফ্রি গাম/ক্যান্ডি) ও অ্যালকোহল",
  "যে খাবারে উপসর্গ বাড়ে (যেমন বেশি পেঁয়াজ-রসুন, শিম/ডাল, দুধ, বেশি ফল) সেগুলো কমিয়ে দেখুন",
];
const tips = ["প্রতিবার নিয়ন্ত্রিত পরিমাণে খাওয়া (portion-control)", "নিয়মিত সময়ে ছোট-ছোট পরিমাণে ধীরে ধীরে খাওয়া", "খাবার বাদ না দেওয়া, অনেকক্ষণ না-খেয়ে না থাকা", "কোন খাবারে উপসর্গ বাড়ে তা খাদ্য-ডায়েরিতে লিখে রাখা"];

test("একই ধরনের বাক্য এক লাইনে; নিরাপত্তা/উদাহরণ-বাক্য অক্ষত", () => {
  const r = compactGuidance({ avoidFoods: avoid, habitTips: tips, avoidSources: {}, includeFoods: ["x"], byTag: [1] });
  assert.equal(r.avoidFoods.length, 5);
  assert.ok(r.avoidFoods.some((x) => x.includes("সরবিটল") && x.includes("অ্যালকোহল")));
  assert.ok(r.avoidFoods.some((x) => x.includes("পেঁয়াজ-রসুন")));
  assert.equal(r.avoidFoods.filter((x) => /ভাজাপোড়া/.test(x)).length, 1);
  assert.equal(r.habitTips.filter((x) => /উপসর্গ/.test(x)).length, 1);
  assert.equal(r.habitTips.filter((x) => /অল্প অল্প/.test(x)).length, 1);
  assert.deepEqual(r.includeFoods, ["x"]);
  assert.deepEqual(r.byTag, [1]);
});

test("একটাই বাক্য থাকলে মূল বাক্য বদলায় না; বিশেষ-শর্তের বাক্য মেলে না", () => {
  const one = ["ভাজাপোড়া ও ঝাল খাবার", "আয়রন-সমৃদ্ধ খাবারের সাথে সাথে চা/কফি (absorption কমায়)", "অ্যালকোহল (সম্পূর্ণ বাদ)"];
  const r = compactGuidance({ avoidFoods: one, habitTips: [], avoidSources: {} });
  assert.deepEqual(r.avoidFoods, one);
});
