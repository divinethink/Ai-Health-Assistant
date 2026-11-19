// MyCare — স্ট্যাটিক আইটেম-তালিকা (যাচাইকৃত তালিকা; Firestore-এ নয়)।
// draft আইটেম ডিফল্টে UI-তে লুকানো (careEngine); `status` "verified" ও `lastReviewed` বসালে তবেই দেখায়।
import { SKIN_ITEMS } from "./skinItems.js";
import { HAIR_ITEMS } from "./hairItems.js";
import { ORAL_ITEMS } from "./oralItems.js";
import { BODY_ITEMS } from "./bodyItems.js";
import { SEASONAL_ITEMS } from "./seasonalItems.js";
import { NATURAL_ITEMS } from "./naturalItems.js";

export const ALL_ITEMS = [...SKIN_ITEMS, ...HAIR_ITEMS, ...ORAL_ITEMS, ...BODY_ITEMS, ...SEASONAL_ITEMS, ...NATURAL_ITEMS];
