// ট্র্যাকার রিমাইন্ডার — pure functions (ধাপ ৩)। সেটিং goal-ডকের `reminders` ফিল্ডে (rules-এ আগেই allowlisted)।
// expandReminders() গোটা দিনের [{id,time,title,body}] তালিকা দেয় — এখন ব্রাউজার-নোটিফিকেশন চালায়,
// ধাপ ০-র পর native Local Notification-ও এই একই তালিকা থেকে schedule করবে (স্ক্রিন/ডেটা বদলাবে না)।
// ঔষধ-রিমাইন্ডার আলাদা (MedicationReminders) — এখানে নয়।

import { MEAL_SLOTS, buildMealPlan, allergyTagsOf } from "./mealPlanData.js";
import { exercisePlan, bdDayIndex } from "./exercisePlanData.js";
import { applyMealPrefs, applyExercisePrefs } from "./planPrefs.js";
import { ageYears, safetyGate, sleepTargetHours, detectFlagsFromConditions } from "./trackerCalc.js";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MEAL_TITLES = {
  breakfast: "সকালের নাস্তার সময়", snack1: "স্ন্যাকসের সময়", lunch: "দুপুরের খাবারের সময়",
  snack2: "বিকালের নাস্তার সময়", dinner: "রাতের খাবারের সময়",
};

export const DEFAULT_REMINDERS = {
  meal: { on: false, times: Object.fromEntries(MEAL_SLOTS.map((s) => [s.id, s.time])) },
  water: { on: false, everyHours: 2, from: "08:00", to: "20:00" },
  exercise: { on: false, time: "17:00" },
  sleep: { on: false, time: "22:30" },
};

const okTime = (v, fb) => (typeof v === "string" && HHMM.test(v) ? v : fb);

// পুরনো/অসম্পূর্ণ/নষ্ট ডেটা সামলে সবসময় বৈধ সেটিং ফেরত দেয়।
export function normalizeReminders(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const D = DEFAULT_REMINDERS;
  const mealTimes = {};
  MEAL_SLOTS.forEach((s) => { mealTimes[s.id] = okTime(r.meal && r.meal.times && r.meal.times[s.id], D.meal.times[s.id]); });
  const eh = Number(r.water && r.water.everyHours);
  const from = okTime(r.water && r.water.from, D.water.from);
  const to = okTime(r.water && r.water.to, D.water.to);
  return {
    meal: { on: !!(r.meal && r.meal.on), times: mealTimes },
    water: { on: !!(r.water && r.water.on), everyHours: Number.isInteger(eh) && eh >= 1 && eh <= 6 ? eh : D.water.everyHours, from, to: to > from ? to : D.water.to > from ? D.water.to : "23:00" },
    exercise: { on: !!(r.exercise && r.exercise.on), time: okTime(r.exercise && r.exercise.time, D.exercise.time) },
    sleep: { on: !!(r.sleep && r.sleep.on), time: okTime(r.sleep && r.sleep.time, D.sleep.time) },
  };
}

export const anyReminderOn = (s) => !!(s.meal.on || s.water.on || s.exercise.on || s.sleep.on);

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const fromMin = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

// ctx: { mealPlan|null, exerciseToday: [{label,min,counted}]|null (null=প্ল্যান নেই), sleepRange:[a,b]|null, kidney:boolean }
export function expandReminders(settings, ctx) {
  const s = normalizeReminders(settings);
  const out = [];
  if (s.meal.on) {
    MEAL_SLOTS.forEach((slot) => {
      const planSlot = ctx.mealPlan && ctx.mealPlan.slots.find((x) => x.id === slot.id);
      out.push({ id: "meal_" + slot.id, time: s.meal.times[slot.id], title: MEAL_TITLES[slot.id], body: planSlot ? planSlot.items.map((i) => i.text).join(", ") : "" });
    });
  }
  if (s.water.on && !ctx.kidney) {
    for (let m = toMin(s.water.from); m <= toMin(s.water.to); m += s.water.everyHours * 60) {
      out.push({ id: "water_" + fromMin(m), time: fromMin(m), title: "এক গ্লাস পানি পান করুন", body: "" });
    }
  }
  if (s.exercise.on && ctx.exerciseToday && ctx.exerciseToday.length) {
    const main = ctx.exerciseToday.find((i) => i.counted) || ctx.exerciseToday[0];
    out.push({ id: "exercise", time: s.exercise.time, title: "ব্যায়ামের সময়", body: main.label + " · " + main.min + " মিনিট" });
  }
  if (s.sleep.on) {
    out.push({ id: "sleep", time: s.sleep.time, title: "ঘুমাতে যাওয়ার সময়", body: ctx.sleepRange ? "লক্ষ্য: " + ctx.sleepRange[0] + "–" + ctx.sleepRange[1] + " ঘণ্টা ঘুম" : "" });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

// goal-ডক + প্রোফাইলের রেকর্ড + সদস্য → ctx (প্ল্যান/গেট আগের ধাপের একই pure ফাংশন থেকে)
export function buildReminderContext({ goal, records, member, now = new Date() }) {
  const age = member ? ageYears(member.dob, now) : null;
  const detected = detectFlagsFromConditions(records);
  const flags = {
    pregnant: !!(goal && goal.flags && goal.flags.pregnant),
    diabetes: !!(goal && goal.flags && goal.flags.diabetes) || detected.diabetes,
    kidney: !!(goal && goal.flags && goal.flags.kidney) || detected.kidney,
  };
  const gate = safetyGate({ age, flags });
  const allergyTags = allergyTagsOf((records || []).filter((r) => r.resourceType === "allergy").map((r) => r.substance));
  // "আমার প্ল্যান" (planPrefs) থাকলে রিমাইন্ডারও সেই কার্যকর প্ল্যান পড়ে; গেট বন্ধ হলে prefs উপেক্ষিত (নিরাপত্তা)।
  const prefs = goal ? goal.planPrefs : null;
  const mealPlan = !gate.blocked && goal && goal.calc ? applyMealPrefs(buildMealPlan(goal.calc.calorieTarget, allergyTags, prefs), prefs, allergyTags) : null;
  const base = exercisePlan(age, goal ? goal.goalType : null);
  const plan = gate.blocked ? base : applyExercisePrefs(base, prefs);
  const exerciseToday = plan && plan.routine ? plan.routine[bdDayIndex(now)] : null;
  return { mealPlan, exerciseToday, sleepRange: age === null ? null : sleepTargetHours(age), kidney: flags.kidney };
}
