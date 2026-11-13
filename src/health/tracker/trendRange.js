// ট্রেন্ড: হিটম্যাপ, মাসিক রিভিউ, ৩ মাসের তুলনা — pure functions (React/Firestore নেই)।
// ডেটা শুধু ব্যবহারকারীর নিজের দেওয়া; মন্তব্য ফিক্সড নিয়মে, AI নয়। পানি এখানে ইচ্ছাকৃতভাবে বাদ (ctx.waterTarget = null পাঠান)।
// "টার্গেট-পূরণ" নিয়ম todaySummary.metricsOf/dayHit-এর সাথে একই (এক সূত্র)।

import { metricsOf, dayHit } from "./todaySummary.js";
import { hasDayRecord, monthDatesISO } from "./dateNav.js";

const r1 = (n) => Math.round(n * 10) / 10;
const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

export const monthKey = (y, m) => y + "-" + m;

// শেষ n মাস (চলতি মাসসহ), পুরনো → নতুন। m ০–১১।
export function lastNMonths(now = new Date(), n = 3) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
}

// মাস ±১ (সীমা: ১৯৯০-০১ … চলতি মাস)। সীমার বাইরে গেলে অপরিবর্তিত।
export function shiftMonth(ym, n, now = new Date()) {
  const d = new Date(ym.y, ym.m + n, 1);
  const k = d.getFullYear() * 12 + d.getMonth();
  if (k < 1990 * 12 || k > now.getFullYear() * 12 + now.getMonth()) return ym;
  return { y: d.getFullYear(), m: d.getMonth() };
}

// ---------- হিটম্যাপ ----------
// স্তর: ০ = রেকর্ড নেই · ১ = রেকর্ড আছে, লক্ষ্য পূরণ নয় · ২ = কিছু লক্ষ্য পূরণ · ৩ = টার্গেট-দিন (dayHit)
export function heatLevel(doc, ctx, date) {
  if (!hasDayRecord(doc)) return 0;
  const { met } = metricsOf(doc, ctx, date);
  if (!met.length) return 1;
  return dayHit(doc, ctx, date) ? 3 : 2;
}

// startISO-এর সপ্তাহের শনিবার থেকে todayISO-র সপ্তাহের শুক্রবার পর্যন্ত — সপ্তাহ-কলাম, প্রতিটিতে ৭ ঘর (শনি…শুক্র)।
// ঘর: { iso, level, out } — out = শুরুর আগে বা আজকের পরে (ফাঁকা দেখায়)।
export function heatWeeks(docs, ctx, startISO, todayISO) {
  const by = {};
  (docs || []).forEach((d) => { if (d && d.date) by[d.date] = d; });
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const t = new Date(ty, tm - 1, td);
  const from = new Date(s.getFullYear(), s.getMonth(), s.getDate() - ((s.getDay() + 1) % 7));
  const to = new Date(t.getFullYear(), t.getMonth(), t.getDate() + (6 - ((t.getDay() + 1) % 7)));
  const weeks = [];
  for (let d = from; d <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const day = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
      const out = day < startISO || day > todayISO;
      return { iso: day, out, level: out ? 0 : heatLevel(by[day], ctx, day) };
    }));
  }
  return weeks;
}

// ---------- মাসের পরিসংখ্যান ----------
// docs: ওই মাসের দৈনিক ডক। আজের পরের দিন গোনা হয় না। ctx: targetCtxFor() (waterTarget: null দিয়ে)।
export function monthStats(docs, y, m, ctx, todayISO) {
  const by = {};
  (docs || []).forEach((d) => { if (d && d.date) by[d.date] = d; });
  const dates = monthDatesISO(y, m).filter((d) => d <= todayISO);
  const st = { y, m, days: dates.length, loggedDays: 0, weights: [], calDays: 0, calHit: 0, exTotal: 0, exActive: 0, exHit: 0, sleepDays: 0, sleepHit: 0, sleepSum: 0, hitDays: 0 };
  dates.forEach((date) => {
    const doc = by[date];
    if (!hasDayRecord(doc)) return;
    st.loggedDays++;
    const { applicable, met } = metricsOf(doc, ctx, date);
    if (doc.weightKg > 0) st.weights.push(doc.weightKg);
    if (doc.caloriesIn > 0 && applicable.includes("calories")) { st.calDays++; if (met.includes("calories")) st.calHit++; }
    st.exTotal += doc.exerciseMin || 0;
    if ((doc.exerciseMin || 0) > 0) st.exActive++;
    if (met.includes("exercise")) st.exHit++;
    if (doc.sleepMinutes > 0) { st.sleepDays++; st.sleepSum += doc.sleepMinutes; if (met.includes("sleep")) st.sleepHit++; }
    if (dayHit(doc, ctx, date)) st.hitDays++;
  });
  st.weightAvg = st.weights.length ? r1(avg(st.weights)) : null;
  st.weightChange = st.weights.length >= 2 ? r1(st.weights[st.weights.length - 1] - st.weights[0]) : null;
  st.sleepAvgH = st.sleepDays ? r1(st.sleepSum / st.sleepDays / 60) : null;
  st.hasExTarget = !!ctx.exTarget;
  st.hasCalTarget = !!ctx.calorieTarget;
  return st;
}

// মাসিক রিভিউ — বাংলা সংখ্যা-ফরম্যাটার bn পাঠানো হয় (UI-নির্ভরতা এড়াতে)।
export function monthReview(st, bn) {
  const points = [];
  if (st.weightChange !== null) points.push(st.weightChange === 0 ? "ওজন অপরিবর্তিত (গড় " + bn(st.weightAvg) + " কেজি)" : "ওজন " + bn(Math.abs(st.weightChange)) + " কেজি " + (st.weightChange < 0 ? "কমেছে" : "বেড়েছে") + " (গড় " + bn(st.weightAvg) + " কেজি)");
  else if (st.weightAvg !== null) points.push("ওজন " + bn(st.weightAvg) + " কেজি (একবারই মাপা)");
  if (st.hasCalTarget && st.calDays > 0) points.push(bn(st.calHit) + "/" + bn(st.calDays) + " দিন ক্যালরি লক্ষ্যের মধ্যে");
  if (st.loggedDays > 0) points.push("ব্যায়াম মোট " + bn(st.exTotal) + " মিনিট, " + bn(st.exActive) + " দিন" + (st.hasExTarget ? "; লক্ষ্য পূরণ " + bn(st.exHit) + " দিন" : ""));
  if (st.sleepDays > 0) points.push("গড় ঘুম " + bn(st.sleepAvgH) + " ঘণ্টা; " + bn(st.sleepDays - st.sleepHit) + " দিন লক্ষ্যের নিচে");
  const comment = [];
  if (st.loggedDays < 5) return { points, comment: ["এই মাসে তথ্য কম আছে। রোজ ইনপুট দিলে রিভিউ আরও কাজের হবে।"] };
  if (st.sleepDays >= 5 && (st.sleepDays - st.sleepHit) * 2 >= st.sleepDays) comment.push("বেশিরভাগ দিন ঘুম লক্ষ্যের নিচে। রাতে একটু আগে ঘুমাতে যাওয়ার চেষ্টা করুন।");
  if (st.hasExTarget && st.exHit * 3 < st.loggedDays) comment.push("ব্যায়ামের লক্ষ্য পূরণ কম দিনে হয়েছে। ছোট করে শুরু করে ধীরে বাড়ান।");
  if (st.hasCalTarget && st.calDays >= 5 && st.calHit * 2 < st.calDays) comment.push("বেশিরভাগ দিন ক্যালরি লক্ষ্যের বাইরে ছিল; মিল-প্ল্যান অনুসরণ করে দেখুন।");
  if (st.weightChange !== null && Math.abs(st.weightChange) >= 4) comment.push("এক মাসে ওজনের বড় পরিবর্তন হয়েছে। অস্বাভাবিক মনে হলে ডাক্তার দেখান।");
  if (!comment.length) comment.push("এই মাসে বড় কোনো সমস্যা চোখে পড়েনি। এভাবেই চালিয়ে যান।");
  return { points, comment };
}

// ---------- ৩ মাসের তুলনা (ওজন, ক্যালরি, ব্যায়াম, ঘুম — পানি বাদ) ----------
// list: monthStats()-এর ফল (পুরনো → নতুন)। প্রতিটি সারি: { key, label, vals:[{pct|null, text}] }
// pct = বারের দৈর্ঘ্য (০–১০০) — ওজনে মাসগুলোর মধ্যে আপেক্ষিক, বাকিতে "লক্ষ্য-পূরণ দিন ÷ তথ্যের দিন"।
export function compareMonths(list, bn) {
  const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
  const rows = [];
  const ws = list.map((s) => s.weightAvg);
  const maxW = Math.max(0, ...ws.filter((v) => v !== null));
  rows.push({ key: "weight", label: "ওজন (গড়, কেজি)", vals: list.map((s) => ({
    pct: s.weightAvg !== null && maxW > 0 ? Math.round((s.weightAvg / maxW) * 100) : null,
    text: s.weightAvg !== null ? bn(s.weightAvg) : "—" })) });
  if (list.some((s) => s.hasCalTarget)) {
    rows.push({ key: "calories", label: "ক্যালরি লক্ষ্যের মধ্যে", vals: list.map((s) => ({ pct: pctOf(s.calHit, s.calDays), text: s.calDays ? bn(s.calHit) + "/" + bn(s.calDays) + " দিন" : "—" })) });
  }
  rows.push({ key: "exercise", label: "ব্যায়াম", vals: list.map((s) => s.hasExTarget
    ? { pct: pctOf(s.exHit, s.loggedDays), text: s.loggedDays ? bn(s.exHit) + "/" + bn(s.loggedDays) + " দিন" : "—" }
    : { pct: pctOf(s.exActive, s.loggedDays), text: s.loggedDays ? bn(s.exActive) + "/" + bn(s.loggedDays) + " দিন" : "—" }) });
  rows.push({ key: "sleep", label: "ঘুম লক্ষ্যের মধ্যে", vals: list.map((s) => ({ pct: pctOf(s.sleepHit, s.sleepDays), text: s.sleepDays ? bn(s.sleepHit) + "/" + bn(s.sleepDays) + " দিন" : "—" })) });
  return rows;
}

// শেষ মাস বনাম আগের মাস — ১৫ শতাংশ-পয়েন্ট বা বেশি ফারাকে ছোট নোট (ওজন বাদ; ওজনের ভালো/খারাপ লক্ষ্যভেদে আলাদা)।
export function compareNotes(rows) {
  const names = { calories: "ক্যালরি লক্ষ্য", exercise: "ব্যায়াম", sleep: "ঘুম" };
  const out = [];
  rows.forEach((r) => {
    if (!names[r.key] || r.vals.length < 2) return;
    const a = r.vals[r.vals.length - 2].pct, b = r.vals[r.vals.length - 1].pct;
    if (a === null || b === null || Math.abs(b - a) < 15) return;
    out.push(names[r.key] + (b > a ? " আগের মাসের চেয়ে ভালো হয়েছে" : " আগের মাসের চেয়ে কম পূরণ হয়েছে"));
  });
  return out;
}
