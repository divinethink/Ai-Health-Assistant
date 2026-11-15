// সাপ্তাহিক ওজনের দিন — pure ফাইল (UI/DB-মুক্ত)। দিন-নম্বর trackerCalc.weekdayIndexOf-এর মতো: ০=শনি … ৬=শুক্র।
// নিয়ম: যেকোনো দিন ওজন দেওয়া যায় ও সংরক্ষিত থাকে (zero-data-loss); কিন্তু ট্রেন্ড/চার্টে সাপ্তাহিক একটাই ধরা হয়:
// প্রথম মান, তারপর আগের ধরা-মানের অন্তত WEIGH_GAP_DAYS (৫) দিন পরের প্রথম মান — ৫ দিনের মধ্যের বাকিগুলো সংরক্ষিত থাকে কিন্তু চার্টে নয়।
// (শুক্র মিস করে শনিতে দিলেও ধরা হয়; লাল সতর্কতা/রিমাইন্ডার তবু শুক্র-ভিত্তিক, যেন সাপ্তাহিক অভ্যাস হয়।)
// goal-ডকের ঐচ্ছিক `weighDay` (০–৬); না থাকলে শুক্রবার।
import { weekdayIndexOf } from "./trackerCalc.js";

export const DEFAULT_WEIGH_DAY = 6; // শুক্রবার
export const WEIGH_GAP_DAYS = 5; // চার্টে দুই ওজনের ন্যূনতম ব্যবধান (দিন) — রবিতে দেরিতে দিয়ে পরের শুক্রেও নিয়মমতো দিলে সেটা যেন ধরা পড়ে
export const PRE_DUE_TIME = "19:00"; // ওজনের আগের দিন এই সময় থেকেই লাল (owner: বৃহস্পতি সন্ধ্যা ৭টা) — ওজনের দিন সারাদিন, ইনপুট না দেওয়া পর্যন্ত
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

// চার্ট/ট্রেন্ডের জন্য: সাপ্তাহিক-একটা পয়েন্ট ({date,...}); ইনপুটের ক্রম যাই হোক, তারিখ অনুযায়ী সাজানো ফেরত।
// প্রথমটা ধরা হয় (শেষটা নয় — নইলে মান বারবার বদলাত); পরেরটা আগের ধরা-মানের ≥৫ দিন পরে হলে।
export function countedWeighPoints(points) {
  const sorted = (points || []).filter((p) => p && p.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (!last) out.push(p);
    else if (last.date === p.date) continue; // একই তারিখ — প্রথমটাই
    else if (daysBetween(last.date, p.date) >= WEIGH_GAP_DAYS) out.push(p);
  }
  return out;
}
export const onlyWeighDays = (points) => countedWeighPoints(points); // পুরনো নাম (সামঞ্জস্য)

// এই তারিখে ওজন দিলে সেটা চার্টে ধরা হবে কিনা (ইনপুট-শিটের বার্তার জন্য); docs = দৈনিক ডক ({date, weightKg})
export function wouldCountOnChart(dateISO, docs) {
  const pts = (docs || []).filter((d) => d && d.date && d.weightKg > 0 && d.date !== dateISO).map((d) => ({ date: d.date }));
  pts.push({ date: dateISO });
  return countedWeighPoints(pts).some((p) => p.date === dateISO);
}

const round1 = (n) => Math.round(n * 10) / 10;

// docs: দৈনিক ডক-তালিকা ({date, weightKg}); soft = শিশু/গেট-ব্লক সদস্য (লাল আভা নয়, শুধু নরম বার্তা)।
// nowHHMM ("19:05"): দিলে ওজনের আগের দিন PRE_DUE_TIME-এর পর থেকেই "due" (early:true); না দিলে শুধু ওজনের দিন।
// kind: "due" (ওজনের আগের দিন সন্ধ্যা ৭টা থেকে ওজনের দিন শেষ পর্যন্ত, ইনপুট বাকি) · "done" · "idle" (বাকি সময়, শনি/রবিসহ)
// entryDate = ট্যাপে যে তারিখে ওজন বসবে (ওজনের দিন হলে সেই দিন; আগের সন্ধ্যায় আজ)।
export function weighState({ today, weighDay, docs, soft = false, nowHHMM }) {
  const wd = sanitizeWeighDay(weighDay);
  const byDate = {};
  (docs || []).forEach((d) => { if (d && d.date && d.weightKg > 0) byDate[d.date] = d.weightKg; });
  let dueDate = lastWeighDate(today, wd);
  let entryDate = dueDate;
  // আগের দিন সন্ধ্যা ৭টার পর: আগামীকাল ওজনের দিন হলে আজ থেকেই লাল
  const tomorrow = shift(today, 1);
  const early = !!nowHHMM && String(nowHHMM) >= PRE_DUE_TIME && isWeighDate(tomorrow, wd);
  if (early) { dueDate = tomorrow; entryDate = today; }
  const since = dueDate ? daysBetween(dueDate, today) : null;
  // ইনপুট দিলেই শান্ত: ওজনের দিনের মান, বা তার আগের দিনের (বৃহস্পতি সন্ধ্যার) মান
  const done = dueDate ? !!byDate[dueDate] || !!byDate[shift(dueDate, -1)] : false;
  let kind = "idle";
  if (dueDate && done) kind = "done";
  else if (dueDate && since <= 0) kind = "due"; // ওজনের দিনের আগে-সন্ধ্যা বা ওজনের দিন; দিন পেরোলে আর লাল/হলুদ নয়
  const dates = Object.keys(byDate).filter((x) => x <= today).sort();
  const lastDate = dates.length ? dates[dates.length - 1] : null;
  const wDates = countedWeighPoints(dates.map((date) => ({ date }))).map((p) => p.date); // চার্টে ধরা-মান (৫ দিনের ব্যবধান)
  let delta = null;
  if (wDates.length >= 2) { // শুধু সংখ্যার পার্থক্য — ভালো/খারাপ রায় নয়; দুই ওজন-দিনের ব্যবধান ≤১৪ দিন হলে
    const a = wDates[wDates.length - 2], b = wDates[wDates.length - 1];
    if (daysBetween(a, b) <= 14) delta = { kg: round1(byDate[b] - byDate[a]), fromDate: a, toDate: b };
  }
  return {
    kind, soft: !!soft, dueDate, entryDate, early, weighDay: wd,
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
