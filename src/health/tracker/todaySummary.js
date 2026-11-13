// আজকের পাতার হিসাব — pure functions (React/Firestore নেই)। ধাপ C।
// "দিন টার্গেটে" = প্রযোজ্য লক্ষ্যগুলোর (ক্যালরি/ব্যায়াম/পানি/ঘুম) অন্তত ২টি পূরণ (প্রযোজ্য ২টির কম হলে সবকটি)।
// ক্যালরি পূরণ = টার্গেটের ৮০%–১১০% — কম খাওয়াকে "সফল" ধরা হয় না।
// ডেটা শুধু ব্যবহারকারীর নিজের দেওয়া; কিছু বানানো হয় না।

import { fastOnDate } from "./fastDay.js";

export const STREAK_MAX = 30; // Firestore `in` সীমা (৩০)

const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());

// গত ৩০ দিন (আজসহ), পুরনো → নতুন
export function last30DatesISO(now = new Date()) {
  return Array.from({ length: STREAK_MAX }, (_, i) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (STREAK_MAX - 1 - i))));
}

// ring: শতাংশ (০–১০০ এ ক্ল্যাম্প) → SVG stroke-dasharray-এর মান
export function ringDash(pct, r) {
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return { circ, dash: (p / 100) * circ, pct: p };
}

// ক্যালরি "পূরণ" = টার্গেটের ৮০%–১১০% — আজ/স্ট্রিক/ট্রেন্ড/স্কোর সবখানে এই একটাই নিয়ম (weeklyTrend-ও এটাই ডাকে)।
export const CAL_MET_LO = 0.8;
export const CAL_MET_HI = 1.1;
export function calorieMet(calories, target) {
  return !!target && calories >= target * CAL_MET_LO && calories <= target * CAL_MET_HI;
}

export function pctOf(value, target) {
  if (!target || target <= 0) return 0;
  return ((value || 0) / target) * 100;
}

// ctx: { calorieTarget|null, exTarget, waterTarget|null, sleepMinH, fastDays? }
// ctx.fastDays (পার্ট ১০): উপবাস-দিনে ক্যালরি-লক্ষ্য প্রযোজ্য নয়। date না দিলে doc.date।
export function metricsOf(doc, ctx, date) {
  const d = doc || {};
  const onFast = fastOnDate(date || d.date, ctx.fastDays, d);
  const applicable = [];
  const met = [];
  const add = (key, ok) => { applicable.push(key); if (ok) met.push(key); };
  if (ctx.calorieTarget && !onFast) add("calories", calorieMet(d.caloriesIn, ctx.calorieTarget));
  if (ctx.exTarget) add("exercise", (d.exerciseMin || 0) >= ctx.exTarget);
  if (ctx.waterTarget) add("water", (d.waterGlasses || 0) >= ctx.waterTarget);
  if (ctx.sleepMinH) add("sleep", (d.sleepMinutes || 0) >= ctx.sleepMinH * 60);
  return { applicable, met };
}

export function dayHit(doc, ctx, date) {
  const { applicable, met } = metricsOf(doc, ctx, date);
  if (!applicable.length || !met.length) return false;
  return met.length >= Math.min(2, applicable.length);
}

function byDateMap(docs) {
  const m = {};
  (docs || []).forEach((d) => { if (d && d.date) m[d.date] = d; });
  return m;
}

// আজ পূরণ না হলেও স্ট্রিক ভাঙে না (দিন এখনো চলছে); গতকাল ফাঁক থাকলে ভাঙে। সর্বোচ্চ STREAK_MAX।
export function streakOf(docs, todayISO, ctx) {
  const m = byDateMap(docs);
  const [y, mo, da] = todayISO.split("-").map(Number);
  let count = 0;
  for (let i = 0; i < STREAK_MAX; i++) {
    const date = iso(new Date(y, mo - 1, da - i));
    if (dayHit(m[date], ctx, date)) count++;
    else if (fastOnDate(date, ctx.fastDays, m[date])) continue; // উপবাস-দিন: গোনাও হয় না, ভাঙেও না
    else if (i > 0) break;
  }
  return count;
}

// weekDates: শনি–শুক্র (৭টি)। state: "hit" | "miss" | "today" | "future" | "fast" (উপবাস-দিন, টার্গেট না হলেও miss নয়)
export function weekSummary(docs, weekDates, todayISO, ctx) {
  const m = byDateMap(docs);
  let hitCount = 0;
  const days = weekDates.map((date) => {
    let state;
    if (date > todayISO) state = "future";
    else if (dayHit(m[date], ctx, date)) { state = "hit"; hitCount++; }
    else if (fastOnDate(date, ctx.fastDays, m[date])) state = "fast"; // উপবাস-দিন: miss নয়
    else state = date === todayISO ? "today" : "miss";
    // metCount: সেই দিন কয়টা লক্ষ্য পূরণ হয়েছে (১টা হলেও দেখানোর জন্য; state/hitCount-এর নিয়ম অপরিবর্তিত)
    const metCount = date > todayISO ? 0 : metricsOf(m[date], ctx, date).met.length;
    return { date, state, metCount };
  });
  return { days, hitCount };
}
