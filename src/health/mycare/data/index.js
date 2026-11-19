// MyCare — স্ট্যাটিক আইটেম-তালিকা (যাচাইকৃত তালিকা; Firestore-এ নয়)।
// draft আইটেম ডিফল্টে UI-তে লুকানো (careEngine)। Oral/Body/Seasonal/Natural পরের ধাপে যোগ হবে।
import { SKIN_ITEMS } from "./skinItems.js";
import { HAIR_ITEMS } from "./hairItems.js";

export const ALL_ITEMS = [...SKIN_ITEMS, ...HAIR_ITEMS];
