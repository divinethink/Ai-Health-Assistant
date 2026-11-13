// খাদ্য-পাতার "সাম্প্রতিক খাবার" (ধাপ ১) — সদস্যের নিজের লগ করা খাবার (আজ শুধু + টিক-করা মিল), গত ১৪ দিন।
// pure ফাইল: নতুন Firestore read/schema নেই; ডেটা আসে বিদ্যমান daily ডক থেকে।
// রঙ ঠিক করে বিদ্যমান foodStatus(): লাল ✕ / হলুদ ! → ❌ কার্ড; সবুজ ✓ → ✅ কার্ড। কিছু ব্লক করে না।
// ক্যাটালগে মেলে না এমন ফ্রি-টেক্সট নাম বাদ (অজানা খাবারে ভুল ✓/✕ দাবি নয়)।
// টিক-করা মিলের খাবার = সদস্যের বর্তমান প্ল্যান থেকে (আগের দিনের প্ল্যান আলাদা সংরক্ষিত নেই — আনুমানিক)।

import { FOODS, MEAL_SLOTS, buildMealPlan } from "./mealPlanData.js";
import { applyMealPrefs, sanitizeExtraFoods } from "./planPrefs.js";
import { foodStatus } from "./foodStatus.js";
import { localISO } from "../../shared/dates.js";

export const RECENT_DAYS = 14;
export const RECENT_LIMIT = 5;

// আজসহ গত `days` দিনের তারিখ (নতুন → পুরনো), `in` সীমা ৩০-এর মধ্যে।
export function recentDates(days = RECENT_DAYS, now = new Date()) {
  return Array.from({ length: days }, (_, i) => localISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
}

function resolveKey(x) {
  if (x.key && FOODS[x.key]) return x.key;
  const hit = Object.keys(FOODS).find((k) => FOODS[k].n === x.name);
  return hit || null;
}

// → [{ key, date }] নতুন আগে, ডুপ্লিকেট নয়। plan = বর্তমান মিল-প্ল্যান বা null।
export function recentFoodKeys(dailyDocs, { plan = null, days = RECENT_DAYS, now = new Date() } = {}) {
  const dates = recentDates(days, now);
  const byDate = new Map();
  (Array.isArray(dailyDocs) ? dailyDocs : []).forEach((d) => { if (d && typeof d.date === "string") byDate.set(d.date, d); });
  const slotOrder = MEAL_SLOTS.map((s) => s.id).reverse(); // রাত → সকাল
  const seen = new Set();
  const out = [];
  const add = (key, date) => { if (key && !seen.has(key)) { seen.add(key); out.push({ key, date }); } };
  dates.forEach((date) => {
    const d = byDate.get(date);
    if (!d) return;
    sanitizeExtraFoods(d.extraFoods).slice().reverse().forEach((x) => add(resolveKey(x), date));
    const eaten = new Set(Array.isArray(d.mealsEaten) ? d.mealsEaten : []);
    if (plan) {
      slotOrder.forEach((id) => {
        const s = plan.slots.find((p) => p.id === id);
        if (s && eaten.has(id)) s.items.slice().reverse().forEach((it) => add(it.key && FOODS[it.key] ? it.key : null, date));
      });
    }
  });
  return out;
}

// ফল: { avoid: [{key,name,level,icon,reasons}], include: [...] } — প্রতিটি সর্বোচ্চ `limit`
export function buildRecentFoodCards({ dailyDocs, goal, allergyTags, ctx, gateBlocked, now, limit = RECENT_LIMIT } = {}) {
  let plan = null;
  if (!gateBlocked && goal && goal.calc && goal.calc.calorieTarget) {
    try { plan = applyMealPrefs(buildMealPlan(goal.calc.calorieTarget, allergyTags, goal.planPrefs), goal.planPrefs, allergyTags); } catch (e) { plan = null; }
  }
  const avoid = [];
  const include = [];
  recentFoodKeys(dailyDocs, { plan, now }).forEach(({ key }) => {
    const f = FOODS[key];
    const st = foodStatus(key, f, { allergyTags, ctx });
    const row = { key, name: f.n, level: st.level, icon: st.icon, reasons: st.reasons };
    if (st.level === "green") { if (include.length < limit) include.push(row); }
    else if (avoid.length < limit) avoid.push(row);
  });
  return { avoid, include };
}
