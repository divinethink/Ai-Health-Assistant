// খাদ্য-তালিকা গ্রুপ অনুযায়ী (ধাপ ২) — pure; display-ডেটা বানায়। নতুন খাবার/schema নেই।
import { FOODS } from "./mealPlanData.js";
import { FOOD_GROUPS } from "./foodCatalog.js";
import { FOOD_INFO, AVOID_INFO, infoOf, avoidHarmOf } from "./foodInfo.js";
import { foodMatches } from "../../shared/searchAliases.js";

const norm = (s) => String(s || "").trim().toLowerCase();

function matches(key, f, q) {
  if (!q) return true;
  if (foodMatches(key, f, q)) return true;
  const info = infoOf(key);
  return !!(info && info.n.some((x) => norm(x).includes(q)));
}

// → { groups: [{ id, label, items: [{ key, name, n, w }] }], avoid: [{ id, label, items: [{ key, name, h }] }] }
// শুধু যে গ্রুপে অন্তত একটা মিল আছে সেটাই ফেরে।
export function groupedFoodList(query = "") {
  const q = norm(query);
  const groups = FOOD_GROUPS.map(([id, label]) => ({
    id, label,
    items: Object.keys(FOOD_INFO).filter((k) => FOODS[k] && FOODS[k].g === id && matches(k, FOODS[k], q))
      .map((k) => ({ key: k, name: FOODS[k].n, n: FOOD_INFO[k].n, w: FOOD_INFO[k].w })),
  })).filter((g) => g.items.length);
  const avoid = Object.entries(AVOID_INFO).map(([id, g]) => ({
    id, label: g.label,
    items: g.keys.filter((k) => FOODS[k] && matches(k, FOODS[k], q)).map((k) => ({ key: k, name: FOODS[k].n, h: avoidHarmOf(k) })),
  })).filter((g) => g.items.length);
  return { groups, avoid };
}

// বিস্তারিত-শিটের ডেটা: { key, name, kcalText, n, w, note, harm }
export function foodDetail(key) {
  const f = FOODS[key];
  if (!f) return null;
  const info = infoOf(key);
  return {
    key, name: f.n, kcalText: "এক " + f.u + " ≈ " + f.k + " কিলোক্যালরি (আনুমানিক)",
    n: info ? info.n : [], w: info ? info.w : "", note: info && info.note ? info.note : "", harm: avoidHarmOf(key),
  };
}
