// খাবার–ওষুধ সময়-নোট (পার্ট ৯) — pure lib (React/Firestore নেই)।
// ⚠ সীমা (সচেতন): Medicine DB এখনো draft — তাই শুধু ডেটাসেটে নিশ্চিত ৩টি জোড়া; নতুন ক্লিনিক্যাল দাবি নয়, ডোজ/বদলের পরামর্শ নয়।
//   ১) থাইরয়েড (Levothyroxine) ↔ ক্যালসিয়াম-উৎস (দুধ/দই/টফু)  — ডেটাসেট: ৪ ঘণ্টা ব্যবধান (§5.7)
//   ২) আয়রন ↔ ক্যালসিয়াম-উৎস                              — ডেটাসেট: ২ ঘণ্টা ব্যবধান
//   ৩) Bisacodyl ↔ দুগ্ধজাত খাবার                           — ডেটাসেট: একসাথে না নেওয়া
// খাবার শুধু বিদ্যমান `medgap` ট্যাগ (১, ২) বা `dairy` এলার্জি-গ্রুপ (৩) থেকে ধরা হয়। সময়ের ঘণ্টা-মেলানো (reminderTimes) এখানে নেই।
// বার্তা সবসময় "ডাক্তার/ফার্মাসিস্টের নির্দেশমতো"; কোনো ডোজ/বদলের কথা নেই।

import { FOODS } from "./mealPlanData.js";

// প্রোফাইলের healthRecords থেকে সক্রিয় ওষুধের নাম (genericName)
export function activeMedNames(records) {
  return (Array.isArray(records) ? records : [])
    .filter((r) => r && r.resourceType === "medicationStatement" && r.status === "active" && typeof r.genericName === "string" && r.genericName.trim())
    .map((r) => r.genericName.trim());
}

const RULES = [
  { id: "thyroid", re: /levothyrox|thyrox|eltroxin|thyronorm|থাইরক্সিন|লিভোথাইরক্সিন/i, food: (f) => hasTag(f, "medgap"),
    text: (m, f) => "আপনার ওষুধ ‘" + m + "’ (থাইরয়েড) চলছে — " + f.n + " ও এই ওষুধের মাঝে ডাক্তার/ফার্মাসিস্টের নির্দেশমতো ব্যবধান রাখুন (সাধারণত ৪ ঘণ্টা)।" },
  { id: "iron", re: /(^|[^a-z])iron([^a-z]|$)|ferrous|ferric|আয়রন|ফেরাস/i, food: (f) => hasTag(f, "medgap"),
    text: (m, f) => "আপনার ওষুধ ‘" + m + "’ (আয়রন) চলছে — " + f.n + " ও এই ওষুধের মাঝে ডাক্তার/ফার্মাসিস্টের নির্দেশমতো ব্যবধান রাখুন (সাধারণত ২ ঘণ্টা)।" },
  { id: "bisacodyl", re: /bisacodyl|dulcolax|বিসাকোডিল/i, food: (f) => f.al === "dairy",
    text: (m, f) => "আপনার ওষুধ ‘" + m + "’ আছে — দুগ্ধজাত খাবারের (" + f.n + ") সাথে একসাথে না নেওয়ার নিয়ম আছে; ডাক্তার/ফার্মাসিস্টের নির্দেশমতো আলাদা সময়ে নিন।" },
];
const hasTag = (f, t) => Array.isArray(f.tg) && f.tg.includes(t);

// meds: নামের তালিকা; foodKey: FOODS-এর key। ফল: [{ rule, med, text }] — মিল না থাকলে [] (অজানা খাবার/ওষুধেও নিরাপদ)।
export function medFoodNotes(meds, foodKey) {
  const f = FOODS[foodKey];
  if (!f || !Array.isArray(meds)) return [];
  const out = [];
  meds.forEach((m) => {
    if (typeof m !== "string") return;
    RULES.forEach((r) => {
      if (r.re.test(m) && r.food(f) && !out.some((o) => o.rule === r.id && o.med === m)) out.push({ rule: r.id, med: m, text: r.text(m, f) });
    });
  });
  return out;
}
