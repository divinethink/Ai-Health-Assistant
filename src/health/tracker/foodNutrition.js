// খাবারের পুষ্টি-তথ্যের একক প্রবেশদ্বার (ধাপ ১ক)। pure data/lookup; UI/SDK-মুক্ত।
// ব্যাচ-ভিত্তিক ফাইল (A: ভাত-রুটি+তরকারি-ডাল; B, C পরের ব্যাচে) এখানে একসাথে হয়।
// যে খাবারের ডেটা নেই তার জন্য nutritionOf() null দেয় — UI তখন আগের মতো শুধু কিলোক্যালরি (foodCatalog-এর k) দেখাবে।

import { FOOD_NUTRITION_A } from "./foodNutritionA.js";

export const NUTRITION_VERSION = 1;
export const FOOD_NUTRITION = { ...FOOD_NUTRITION_A };

export function nutritionOf(key) {
  return Object.prototype.hasOwnProperty.call(FOOD_NUTRITION, key) ? FOOD_NUTRITION[key] : null;
}
