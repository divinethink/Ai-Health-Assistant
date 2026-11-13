// ট্রেন্ড: দৈনিক স্কোর, হিটম্যাপ-স্তর, উন্নতি/অবনতি, বারভিত্তিক দুর্বলতা — pure functions (React/Firestore নেই)।
// স্কোর = ওই দিনের দেওয়া তথ্যের লক্ষ্য-পূরণের গড় (০–১০০), ফিক্সড সূত্রে; AI নয়, রোগনির্ণয় বা কারণ-দাবি নেই।
// ক্যালরি: ৮০–১১০% = পূর্ণ; তার নিচে/উপরে আনুপাতিক কমে — কম খাওয়া "সফল" গণ্য হয় না।
// উপবাস-দিন ও গেট-ব্লক সদস্যে ক্যালরি প্রযোজ্য নয় (metricsOf-এর নিয়মই)। পানি এখানে বাদ (ctx.waterTarget = null)।

import { metricsOf } from "./todaySummary.js";
import { hasDayRecord, monthDatesISO } from "./dateNav.js";

export const MIN_DAYS = 3; // এর কম দিনে তুলনা/সিদ্ধান্ত নয়
export const MIN_FILLED = 7; // এর কম রেকর্ডে "আরও N দিন লিখলে তুলনা আসবে"
export const LEVEL_LABELS = ["খালি", "কম", "মাঝারি", "ভালো", "চমৎকার"];
export const WEEKDAYS = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"];

const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const clamp1 = (n) => Math.max(0, Math.min(1, n));
const byDate = (docs) => { const m = {}; (docs || []).forEach((d) => { if (d && d.date) m[d.date] = d; }); return m; };
export const weekdayIdx = (iso) => { const [y, m, d] = iso.split("-").map(Number); return (new Date(y, m - 1, d).getDay() + 1) % 7; }; // শনি=০

function calRatio(v, target) {
  const lo = target * 0.8, hi = target * 1.1;
  if (v >= lo && v <= hi) return 1;
  return v < lo ? clamp1(v / lo) : clamp1(hi / v);
}

// ০–১০০ পূর্ণসংখ্যা; রেকর্ড না থাকলে বা প্রযোজ্য কিছু না থাকলে null।
// ক্যালরি/ঘুম শুধু দেওয়া থাকলে গোনা হয়; ব্যায়াম-লক্ষ্য থাকলে ০ মিনিটও ০ ধরা হয়।
export function dayScore(doc, ctx, date) {
  if (!hasDayRecord(doc)) return null;
  const { applicable } = metricsOf(doc, ctx, date);
  const parts = [];
  applicable.forEach((k) => {
    if (k === "calories") { if (doc.caloriesIn > 0) parts.push(calRatio(doc.caloriesIn, ctx.calorieTarget)); }
    else if (k === "exercise") parts.push(clamp1((doc.exerciseMin || 0) / ctx.exTarget));
    else if (k === "sleep") { if (doc.sleepMinutes > 0) parts.push(clamp1(doc.sleepMinutes / (ctx.sleepMinH * 60))); }
    else if (k === "water") parts.push(clamp1((doc.waterGlasses || 0) / ctx.waterTarget));
  });
  return parts.length ? Math.round(avg(parts) * 100) : null;
}

// ০ = খালি · ১ কম (<৪০) · ২ মাঝারি (৪০–৫৯) · ৩ ভালো (৬০–৭৯) · ৪ চমৎকার (৮০+)
export function scoreLevel(score) {
  if (score === null || score === undefined) return 0;
  return score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;
}

// মাসের (আজ পর্যন্ত) স্কোর-সারি: [{ iso, score, level }] — শুধু স্কোর আছে এমন দিন
export function monthScores(docs, y, m, ctx, todayISO) {
  const by = byDate(docs);
  return monthDatesISO(y, m).filter((d) => d <= todayISO)
    .map((iso) => { const score = dayScore(by[iso], ctx, iso); return { iso, score, level: scoreLevel(score) }; })
    .filter((r) => r.score !== null);
}

export function levelCounts(rows) {
  const c = [0, 0, 0, 0, 0];
  rows.forEach((r) => { c[r.level]++; });
  return c;
}

// মেট্রিকভিত্তিক লক্ষ্য-পূরণ হার (শুধু যে দিনে ওই তথ্য দেওয়া/প্রযোজ্য)
function metricRate(docs, dates, ctx, key) {
  const by = byDate(docs);
  let logged = 0, hit = 0;
  dates.forEach((date) => {
    const doc = by[date];
    if (!hasDayRecord(doc)) return;
    const { applicable, met } = metricsOf(doc, ctx, date);
    if (!applicable.includes(key)) return;
    if (key === "calories" && !(doc.caloriesIn > 0)) return;
    if (key === "sleep" && !(doc.sleepMinutes > 0)) return;
    logged++;
    if (met.includes(key)) hit++;
  });
  return { logged, hit, pct: logged ? Math.round((hit / logged) * 100) : null };
}

const METRIC_NAMES = { calories: "ক্যালরি লক্ষ্য", exercise: "ব্যায়াম", sleep: "ঘুম" };

// গড় স্কোর, আগের মাসের সাথে একই দিন-সংখ্যার তুলনা, সবচেয়ে বড় উন্নতি/অবনতি, দুর্বল বার।
// curDocs/prevDocs: ওই দুই মাসের দৈনিক ডক (prevDocs না থাকলে তুলনা বাদ, বাকিটা চলে)।
export function monthInsights({ curDocs, prevDocs, y, m, ctx, todayISO }) {
  const dates = monthDatesISO(y, m).filter((d) => d <= todayISO);
  const total = new Date(y, m + 1, 0).getDate();
  const rows = monthScores(curDocs, y, m, ctx, todayISO);
  const out = { y, m, elapsed: dates.length, filled: rows.length, avg: rows.length ? Math.round(avg(rows.map((r) => r.score))) : null,
    needMore: Math.max(0, MIN_FILLED - rows.length), prevAvg: null, delta: null, improvement: null, drop: null, weakest: [], counts: levelCounts(rows) };
  if (rows.length < MIN_DAYS) return out;

  // আগের মাস: চলমান মাসে প্রথম N দিন, পূর্ণ মাসে পুরো আগের মাস (দুই ক্ষেত্রেই ≤ আগের মাসের দিন)
  const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1;
  const prevTotal = new Date(py, pm + 1, 0).getDate();
  const n = Math.min(dates.length < total ? dates.length : total, prevTotal);
  const curCmp = dates.slice(0, n);
  const prevCmp = monthDatesISO(py, pm).slice(0, n);
  if (prevDocs) {
    const prevRows = prevCmp.map((iso) => dayScore(byDate(prevDocs)[iso], ctx, iso)).filter((s) => s !== null);
    if (prevRows.length >= MIN_DAYS) {
      out.prevAvg = Math.round(avg(prevRows));
      out.delta = out.avg - out.prevAvg;
      const moves = Object.keys(METRIC_NAMES).map((key) => {
        const a = metricRate(curDocs, curCmp, ctx, key), b = metricRate(prevDocs, prevCmp, ctx, key);
        if (a.logged < MIN_DAYS || b.logged < MIN_DAYS) return null;
        return { key, label: METRIC_NAMES[key], prev: b.pct, cur: a.pct, diff: a.pct - b.pct };
      }).filter(Boolean);
      const best = moves.filter((x) => x.diff >= 10).sort((a, b) => b.diff - a.diff)[0];
      const worst = moves.filter((x) => x.diff <= -10).sort((a, b) => a.diff - b.diff)[0];
      out.improvement = best || null;
      out.drop = worst || null;
    }
  }

  // কোন বারে পিছিয়ে পড়েন (≥৭ দিন রেকর্ড, ≥৪টি বারে তথ্য, সেরা-খারাপে ≥১০ ফারাক)
  if (rows.length >= MIN_FILLED) {
    const sums = Array.from({ length: 7 }, () => []);
    rows.forEach((r) => sums[weekdayIdx(r.iso)].push(r.score));
    const wd = sums.map((a, i) => ({ wd: i, n: a.length, avg: a.length ? Math.round(avg(a)) : null })).filter((x) => x.n >= 1);
    if (wd.length >= 4) {
      const sorted = [...wd].sort((a, b) => a.avg - b.avg || a.wd - b.wd);
      if (sorted[sorted.length - 1].avg - sorted[0].avg >= 10) out.weakest = sorted.slice(0, 2).filter((x) => x.avg - sorted[0].avg <= 5);
      out.weekdays = wd;
    }
  }
  return out;
}

// নরম, উৎসাহমূলক বাক্য — কারণ-দাবি/দোষ/রোগনির্ণয় নেই। bn = বাংলা সংখ্যা-ফরম্যাটার।
export function insightLines(ins, bn) {
  const lines = [];
  if (ins.needMore > 0 && ins.filled < MIN_FILLED) return [{ kind: "more", text: "আরও " + bn(ins.needMore) + " দিন লিখলে তুলনা আসবে। ছোট ছোট এন্ট্রিই যথেষ্ট।" }];
  if (ins.delta !== null) {
    if (ins.delta >= 5) lines.push({ kind: "up", text: "গত মাসের একই সময়ের চেয়ে গড় স্কোর " + bn(ins.delta) + " পয়েন্ট বেড়েছে। চালিয়ে যান।" });
    else if (ins.delta <= -5) lines.push({ kind: "down", text: "গত মাসের একই সময়ের চেয়ে গড় স্কোর " + bn(-ins.delta) + " পয়েন্ট কম। ছোট একটা লক্ষ্য ধরে আবার শুরু করুন।" });
    else lines.push({ kind: "flat", text: "গড় স্কোর প্রায় গত মাসের মতোই আছে।" });
  }
  if (ins.improvement) lines.push({ kind: "up", text: "সবচেয়ে বড় উন্নতি: " + ins.improvement.label + " (" + bn(ins.improvement.prev) + "% → " + bn(ins.improvement.cur) + "%)।" });
  if (ins.drop) lines.push({ kind: "down", text: "আরও মনোযোগ: " + ins.drop.label + " (" + bn(ins.drop.prev) + "% → " + bn(ins.drop.cur) + "%)।" });
  if (ins.weakest.length) lines.push({ kind: "weak", text: ins.weakest.map((x) => WEEKDAYS[x.wd]).join(" ও ") + ": এই " + (ins.weakest.length > 1 ? "দুই" : "") + " দিনে স্কোর সবচেয়ে কম। আগের রাতে একটু প্রস্তুতি রাখুন।" });
  return lines;
}

// ---------- ৩ মাস ----------
// vals: [{pct|null}] পুরনো → নতুন। শেষ দুই তথ্য-আছে মানের ফারাক ≥১০ → "up"/"down", নইলে "flat"; দুটো না থাকলে null।
export function rowArrow(vals) {
  const have = vals.map((v) => v && v.pct).filter((p) => p !== null && p !== undefined);
  if (have.length < 2) return null;
  const d = have[have.length - 1] - have[have.length - 2];
  return d >= 10 ? "up" : d <= -10 ? "down" : "flat";
}

// প্রতি মাসের গড় দৈনিক স্কোর: [{ y, m, avg|null, filled }]; ≥MIN_DAYS দিন না থাকলে avg null
export function monthlyAverages(list, docsByMonth, ctx, todayISO) {
  return list.map(({ y, m }) => {
    const rows = monthScores(docsByMonth(y, m), y, m, ctx, todayISO);
    return { y, m, filled: rows.length, avg: rows.length >= MIN_DAYS ? Math.round(avg(rows.map((r) => r.score))) : null };
  });
}

// "যেখানে মনোযোগ দরকার": তুলনা-সারির (compareMonths, ওজন বাদে) যেগুলোর শেষ মান ৪০%-এর নিচে বা তীর নিচমুখী।
export function attentionRows(rows) {
  return rows.filter((r) => METRIC_NAMES[r.key]).map((r) => {
    const arrow = rowArrow(r.vals);
    const last = r.vals.length ? r.vals[r.vals.length - 1].pct : null;
    const seq = r.vals.map((v) => v.pct).filter((p) => p !== null && p !== undefined);
    return { key: r.key, label: r.label, arrow, last, seq };
  }).filter((r) => r.last !== null && (r.arrow === "down" || r.last < 40));
}
