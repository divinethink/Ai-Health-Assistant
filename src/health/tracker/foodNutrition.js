// খাবারের পুষ্টি-তথ্যের একক প্রবেশদ্বার (ধাপ ১ক)। pure data/lookup; UI/SDK-মুক্ত।
// ব্যাচ-ভিত্তিক ফাইল (A: ভাত-রুটি+তরকারি-ডাল; B: মাছ-মাংস-ডিম+ফল; C: নাস্তা-মিষ্টি+পানীয়) এখানে একসাথে হয়।
// যে খাবারের ডেটা নেই তার জন্য nutritionOf() null দেয় — UI তখন আগের মতো শুধু কিলোক্যালরি (foodCatalog-এর k) দেখাবে।

import { FOOD_NUTRITION_A } from "./foodNutritionA.js";
import { FOOD_NUTRITION_B } from "./foodNutritionB.js";
import { FOOD_NUTRITION_C } from "./foodNutritionC.js";

export const NUTRITION_VERSION = 1;
export const FOOD_NUTRITION = { ...FOOD_NUTRITION_A, ...FOOD_NUTRITION_B, ...FOOD_NUTRITION_C };

export function nutritionOf(key) {
  return Object.prototype.hasOwnProperty.call(FOOD_NUTRITION, key) ? FOOD_NUTRITION[key] : null;
}
