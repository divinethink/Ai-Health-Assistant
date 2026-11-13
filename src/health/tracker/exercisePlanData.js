// ব্যায়াম-প্ল্যান — pure functions। ধাপ ২। WHO সাধারণ গাইড (রোগ নির্ণয়/চিকিৎসা নয়)।
// বাংলাদেশি সপ্তাহ: শনিবার থেকে শুরু। day-index: শনি=০ … শুক্র=৬।
// counted=true মানে সাপ্তাহিক লক্ষ্যে মিনিট গোনা হয়।
// ধাপ B: ৩য় আর্গুমেন্ট `focus` ({areas, senior, lowImpact} — homeWorkout.focusCtxOf) থাকলে প্রাপ্তবয়স্কদের জন্য টার্গেট-ভিত্তিক ঘরোয়া প্ল্যান।

import { focusPlan, isLoseGoal, isGainGoal } from "./homeWorkout.js";

export const DAY_LABELS = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"];

export function bdDayIndex(date = new Date()) {
  return (date.getDay() + 1) % 7; // JS: রবি=০ … শনি=৬
}

const STRETCH = { key: "stretch", label: "স্ট্রেচিং", min: 10, counted: false };
const walk = { key: "main", label: "দ্রুত হাঁটা", min: 30, counted: true };
const strength = (text) => ({ key: "main", label: "শক্তির ব্যায়াম (" + text + ")", min: 30, counted: true });
const rest = [];

const STRENGTH_ADULT = "১০ মি. হাঁটা + ২০ মি. স্কোয়াট, দেয়াল-পুশআপ, প্ল্যাংক";
const STRENGTH_SENIOR = "১০ মি. হাঁটা + ২০ মি. চেয়ার-স্ট্যান্ড, হালকা ওজন, এক পায়ে ভারসাম্য";

// age → { band, weeklyTargetMin, summary, routine[7] } | null (বয়স না জানলে)
export function exercisePlan(age, goalType, focus) {
  if (age === null || age === undefined) return null;
  if (age < 5) {
    return { band: "under5", weeklyTargetMin: null, routine: null,
      summary: "ছোট শিশুরা সারাদিন খেলাধুলা ও চলাফেরায় সক্রিয় থাকুক। দীর্ঘ সময় স্ক্রিন বা এক জায়গায় বসিয়ে রাখা এড়ান।" };
  }
  if (age < 18) {
    const play = { key: "main", label: "খেলাধুলা/সাইকেল/দৌড়ঝাঁপ", min: 60, counted: true };
    const bone = { key: "main", label: "খেলাধুলা + দড়ি-লাফ/লাফানো (হাড়-পেশির জন্য)", min: 60, counted: true };
    return { band: "child", weeklyTargetMin: 420,
      summary: "WHO: শিশু-কিশোরদের দৈনিক গড়ে ৬০ মিনিট, সপ্তাহে ৩ দিন হাড়-পেশি শক্ত করার খেলা।",
      routine: [bone, play, bone, play, bone, play, play].map((m) => [m]) };
  }
  const senior = age >= 65;
  if (focus && Array.isArray(focus.areas) && focus.areas.length) return focusPlan({ areas: focus.areas, senior, lowImpact: !!focus.lowImpact, goalType });
  const str = strength(senior ? STRENGTH_SENIOR : STRENGTH_ADULT);
  const muscle = isGainGoal(goalType); // পেশি গঠন/ওজন বাড়ানো: ৩ দিন শক্তি
  const lose = isLoseGoal(goalType); // ওজন কমানো: কার্ডিও ৪০ মি. (সাপ্তাহিক ১৮০)
  const w = lose ? { ...walk, min: 40 } : walk;
  // শনি রবি সোম মঙ্গল বুধ বৃহ শুক্র
  const pattern = muscle
    ? [[walk, STRETCH], [str, STRETCH], [walk, STRETCH], [str, STRETCH], [STRETCH], [str, STRETCH], rest]
    : [[w, STRETCH], [str, STRETCH], [w, STRETCH], [str, STRETCH], [w, STRETCH], [STRETCH], rest];
  return { band: senior ? "senior" : "adult", weeklyTargetMin: lose ? 180 : 150, routine: pattern,
    summary: "WHO: প্রাপ্তবয়স্কদের সপ্তাহে ১৫০ মিনিট মাঝারি ব্যায়াম ও অন্তত ২ দিন পেশির ব্যায়াম।" +
      (senior ? " ৬৫+ হলে ভারসাম্যের ব্যায়ামও রাখুন; ধীরে শুরু করুন।" : "") };
}

// ব্যায়ামের ধরন (UI-র রঙ-ডটের জন্য): "cardio" | "strength" | "flex"। type না থাকলে (সাধারণ প্ল্যান) key/label থেকে।
const FLEX = new Set(["stretch", "yoga", "pilates"]);
const STRENGTH = new Set(["gym", "squat", "pushup", "lunges", "glute", "plank", "situp", "crunch", "bicycle", "legraise", "tricepdip", "wallsit", "stepup", "superman", "birddog", "chairstand"]);
export function exerciseKind(it) {
  if (!it) return "cardio";
  const t = it.type;
  if (t) return FLEX.has(t) ? "flex" : STRENGTH.has(t) ? "strength" : "cardio";
  if (it.key === "stretch") return "flex";
  return String(it.label || "").startsWith("শক্তির") ? "strength" : "cardio";
}

export function plannedWeeklyMinutes(plan) {
  if (!plan || !plan.routine) return 0;
  return plan.routine.reduce((a, day) => a + day.filter((i) => i.counted).reduce((x, i) => x + i.min, 0), 0);
}

// সাপ্তাহিক তারিখ (শনি–শুক্র), ISO "YYYY-MM-DD"
export function weekDatesISO(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - bdDayIndex(now));
  const p = (n) => String(n).padStart(2, "0");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  });
}
