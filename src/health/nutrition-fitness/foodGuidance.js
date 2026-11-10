// একটাই খাদ্য-নিয়মের উৎস (ধাপ ৮, গ৩) — pure (React/Firestore নেই, unit-testable)।
// দুই উৎস মেলায়: (১) Firestore `dietGuidanceRules` (রোগ/BMI/এলার্জি-ট্যাগ) (২) কোডে-বসানো বয়স/অবস্থা-নিয়ম (avoidRules, খাবার-অংশ)।
// ফল সবসময় একই আকার: { avoidFoods, includeFoods, habitTips, avoidSources, byTag, matchedTags }।
// ⚠ শুধু সতর্কবার্তা — কিছু ব্লক করে না; "avoid সবসময় জেতে" (কোনো উৎসে এড়ানোর খাবার অন্য উৎসের "খাবেন" থেকে বাদ)।
// বয়স/গর্ভাবস্থার নিরাপত্তা-নিয়ম আগে দেখায় (শিশুকে মধু-জাতীয় সতর্কতা Firestore-এর ওপর নির্ভর করে না)।

import { avoidFor, conditionKeysOf } from "../tracker/avoidRules.js";
import { detectFlagsFromConditions, effectivePregnant } from "../tracker/trackerCalc.js";

const uniq = (a) => [...new Set(a)];

// ctx: { records, age (বছর|null), goal (ট্র্যাকার-goal|null) } → [{ id, title, items, src }]
export function staticFoodGroups({ records, age = null, goal = null } = {}) {
  const recs = records || [];
  const detected = detectFlagsFromConditions(recs);
  const flags = {
    pregnant: effectivePregnant(goal, recs),
    diabetes: !!(goal && goal.flags && goal.flags.diabetes) || detected.diabetes,
    kidney: !!(goal && goal.flags && goal.flags.kidney) || detected.kidney,
  };
  return avoidFor("food", { age, flags, condKeys: conditionKeysOf(recs) });
}

// কোড-নিয়ম id → Firestore linkedTag.value (ছোট হাতের), যাতে একই রোগ দুবার না দেখায়
const COVERS = {
  "diabetes-food": ["diabetes"],
  "hypertension-food": ["hypertension"],
  "heart-food": ["heart disease", "high cholesterol"],
  "kidney-food": ["kidney disease"],
  "pregnant-food": ["pregnancy"],
  "gut-food": ["ibs", "gastritis", "constipation"],
};

export function mergeFoodGuidance(base, groups) {
  const b = base || { avoidFoods: [], includeFoods: [], habitTips: [], avoidSources: {}, byTag: [], matchedTags: [] };
  if (!groups || !groups.length) return b;
  const byTag = b.byTag.map((x) => ({ ...x, avoid: [...x.avoid] }));
  const matchedTags = [...b.matchedTags];
  const avoidSources = {};
  Object.entries(b.avoidSources || {}).forEach(([k, v]) => { avoidSources[k] = [...v]; });

  groups.forEach((g) => {
    g.items.forEach((it) => { (avoidSources[it] = avoidSources[it] || []).push(g.title); });
    const cover = COVERS[g.id] || [];
    const hit = byTag.find((x) => cover.includes(String(x.tag || "").toLowerCase()));
    if (hit) hit.avoid = uniq([...g.items, ...hit.avoid]);
    else {
      byTag.unshift({ tag: g.title, avoid: g.items, include: [], tips: [] });
      matchedTags.unshift(g.title);
    }
  });

  const avoidFoods = uniq([...groups.flatMap((g) => g.items), ...b.avoidFoods]);
  const avoidSet = new Set(avoidFoods);
  const includeFoods = b.includeFoods.filter((f) => !avoidSet.has(f));
  return { ...b, avoidFoods, includeFoods, avoidSources, byTag, matchedTags };
}
