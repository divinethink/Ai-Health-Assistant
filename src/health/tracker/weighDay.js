// সাপ্তাহিক ওজনের দিন — pure ফাইল (UI/DB-মুক্ত)। দিন-নম্বর trackerCalc.weekdayIndexOf-এর মতো: ০=শনি … ৬=শুক্র।
// নিয়ম: যেকোনো দিন ওজন দেওয়া যায় ও সংরক্ষিত থাকে (zero-data-loss); কিন্তু ট্রেন্ড/চার্টে শুধু ওজনের দিনের মান ধরা হয়।
// goal-ডকের ঐচ্ছিক `weighDay` (০–৬); না থাকলে শুক্রবার।
import { weekdayIndexOf } from "./trackerCalc.js";

export const DEFAULT_WEIGH_DAY = 6; // শুক্রবার
export const MISSED_GRACE_DAYS = 2; // ওজনের দিন পেরোনোর পর যতদিন হলুদ আভা থাকে (এরপর শান্ত — অযথা চাপ নয়)
export const WEIGH_TIP = "সকালে খালি পেটে, একই কাঁটায় মাপুন";

export function sanitizeWeighDay(v) {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : DEFAULT_WEIGH_DAY;
}
export const weighDayOf = (goal) => sanitizeWeighDay(goal ? goal.weighDay : undefined);
export const isWeighDate = (dateISO, weighDay) => weekdayIndexOf(dateISO) === sanitizeWeighDay(weighDay);

const toUTC = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return Date.UTC(y, (m || 1) - 1, d || 1); };
export const daysBetween = (aISO, bISO) => Math.round((toUTC(bISO) - toUTC(aISO)) / 86400000); // b − a
const shift = (iso, n) => { const t = new Date(toUTC(iso) + n * 86400000); return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0") + "-" + String(t.getUTCDate()).padStart(2, "0"); };

// আজ বা তার আগের সবচেয়ে কাছের ওজনের দিন
export function lastWeighDate(todayISO, weighDay) {
  const wd = sanitizeWeighDay(weighDay);
  const i = weekdayIndexOf(todayISO);
  if (i === null) return null;
  return shift(todayISO, -((i - wd + 7) % 7));
}

// চার্ট/ট্রেন্ডের জন্য: শুধু ওজনের দিনের পয়েন্ট ({date,...})
export const onlyWeighDays = (points, weighDay) => (points || []).filter((p) => p && p.date && isWeighDate(p.date, weighDay));

const round1 = (n) => Math.round(n * 10) / 10;

// docs: দৈনিক ডক-তালিকা ({date, weightKg}); soft = শিশু/গেট-ব্লক সদস্য (লাল/হলুদ আভা নয়, শুধু নরম বার্তা)।
// kind: "due" (আজ ওজনের দিন, বাকি) · "missed" (ওজনের দিন পেরিয়েছে, ≤২ দিন, বাকি) · "done" · "idle"
export function weighState({ today, weighDay, docs, soft = false }) {
  const wd = sanitizeWeighDay(weighDay);
  const byDate = {};
  (docs || []).forEach((d) => { if (d && d.date && d.weightKg > 0) byDate[d.date] = d.weightKg; });
  const dueDate = lastWeighDate(today, wd);
  const since = dueDate ? daysBetween(dueDate, today) : null;
  const done = dueDate ? !!byDate[dueDate] : false;
  let kind = "idle";
  if (dueDate && done) kind = "done";
  else if (dueDate && since === 0) kind = "due";
  else if (dueDate && since > 0 && since <= MISSED_GRACE_DAYS) kind = "missed";
  const dates = Object.keys(byDate).filter((x) => x <= today).sort();
  const lastDate = dates.length ? dates[dates.length - 1] : null;
  const wDates = dates.filter((x) => isWeighDate(x, wd));
  let delta = null;
  if (wDates.length >= 2) { // শুধু সংখ্যার পার্থক্য — ভালো/খারাপ রায় নয়; দুই ওজন-দিনের ব্যবধান ≤১৪ দিন হলে
    const a = wDates[wDates.length - 2], b = wDates[wDates.length - 1];
    if (daysBetween(a, b) <= 14) delta = { kg: round1(byDate[b] - byDate[a]), fromDate: a, toDate: b };
  }
  return {
    kind, soft: !!soft, dueDate, weighDay: wd,
    lastKg: lastDate ? byDate[lastDate] : null, lastDate, daysAgo: lastDate ? daysBetween(lastDate, today) : null,
    delta,
  };
}

export function daysAgoText(n, bn) {
  if (n === null || n === undefined) return "";
  return n <= 0 ? "আজ" : n === 1 ? "গতকাল" : bn(n) + " দিন আগে";
}

// নোটিফিকেশন: ওজনের দিনে, সেট-করা সময়ের পর (cfg = {on,time}); আজ ওজন দেওয়া হয়েছে কিনা runner আলাদা দেখে (ফ্রেশ পড়ে)।
export function weighReminderDue(cfg, weighDay, today, nowHHMM) {
  if (!cfg || !cfg.on || !isWeighDate(today, weighDay) || String(nowHHMM) < String(cfg.time || "09:00")) return null;
  return { id: "weigh", title: "আজ ওজন বসাতে ভুলবেন না", body: "আজ ওজনের দিন — সকালে খালি পেটে মেপে অ্যাপে লিখে রাখুন।" };
}
