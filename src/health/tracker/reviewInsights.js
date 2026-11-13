// অ্যাক্টিভিটি রিভিউ: সাপ্তাহিক রিপোর্ট কার্ড · ১টি ফোকাস · অভ্যাস-প্যাটার্ন · সম্ভাব্য ট্রিগার — pure functions।
// শুধু সদস্যের নিজের দেওয়া তথ্য থেকে ফিক্সড নিয়মে হিসাব; AI নয়, রোগনির্ণয়/কারণ-দাবি নয়, কোনো সংরক্ষণ নেই।
// ফোকাস সংরক্ষণ হয় না: গত সপ্তাহের সবচেয়ে দুর্বল বিষয়টা প্রতিবার একই নিয়মে বের হয়,
// তাই "গত সপ্তাহের ফোকাসে এ সপ্তাহে কী হলো" ডেটা থেকেই হিসাব করা যায় (নতুন ফিল্ড/rules লাগে না)।

import { metricsOf } from "./todaySummary.js";
import { dayScore } from "./trendScore.js";
import { hasDayRecord, shiftISO } from "./dateNav.js";

export const MIN_LOGGED = 3; // এর কম দিনের তথ্যে তুলনা/সিদ্ধান্ত নয়
const WEAK_BELOW = 70; // এর নিচে হলে "দুর্বল" (ফোকাস-যোগ্য)
const KEYS = ["calories", "exercise", "sleep", "water"];
export const METRIC_LABEL = { calories: "ক্যালরি লক্ষ্য", exercise: "ব্যায়াম", sleep: "ঘুম", water: "পানি" };
const WEEKDAY = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"];
const wdIdx = (iso) => { const [y, m, d] = iso.split("-").map(Number); return (new Date(y, m - 1, d).getDay() + 1) % 7; }; // শনি=০

const byDate = (docs) => { const m = {}; (docs || []).forEach((d) => { if (d && d.date) m[d.date] = d; }); return m; };
// endISO-তে শেষ হওয়া n দিন, পুরনো → নতুন
export const windowDates = (endISO, n) => Array.from({ length: n }, (_, i) => shiftISO(endISO, i - (n - 1)));

function metricRates(by, dates, ctx) {
  const out = {};
  KEYS.forEach((k) => { out[k] = { logged: 0, hit: 0, pct: null }; });
  dates.forEach((date) => {
    const doc = by[date];
    if (!hasDayRecord(doc)) return;
    const { applicable, met } = metricsOf(doc, ctx, date);
    applicable.forEach((k) => {
      if (k === "calories" && !(doc.caloriesIn > 0)) return;
      if (k === "sleep" && !(doc.sleepMinutes > 0)) return;
      out[k].logged++;
      if (met.includes(k)) out[k].hit++;
    });
  });
  KEYS.forEach((k) => { if (out[k].logged) out[k].pct = Math.round((out[k].hit / out[k].logged) * 100); });
  return out;
}

function windowStats(by, dates, scoreCtx, rateCtx) {
  const scores = [];
  let logged = 0;
  dates.forEach((date) => {
    if (hasDayRecord(by[date])) logged++;
    const s = dayScore(by[date], scoreCtx, date);
    if (s !== null) scores.push(s);
  });
  const weights = dates.map((d) => (by[d] && by[d].weightKg > 0 ? { date: d, kg: by[d].weightKg } : null)).filter(Boolean);
  return { logged, avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, metrics: metricRates(by, dates, rateCtx), weights };
}

// সবচেয়ে দুর্বল বিষয় (≥MIN_LOGGED দিন তথ্য, <WEAK_BELOW%); না থাকলে null। সমান হলে KEYS-ক্রম।
export function weakestMetric(metrics) {
  let best = null;
  KEYS.forEach((k) => {
    const m = metrics[k];
    if (m && m.logged >= MIN_LOGGED && m.pct !== null && m.pct < WEAK_BELOW && (!best || m.pct < metrics[best].pct)) best = k;
  });
  return best;
}

// docs: দৈনিক ডক (যেকোনো মাসের মিলিত); endISO: সপ্তাহের শেষ দিন; scoreCtx: ট্রেন্ডের ctx (পানি বাদ); rateCtx: পানিসহ পূর্ণ ctx
export function weeklyReport({ docs, endISO, scoreCtx, rateCtx }) {
  const by = byDate(docs);
  const cur = windowStats(by, windowDates(endISO, 7), scoreCtx, rateCtx);
  const prevEnd = shiftISO(endISO, -7);
  const prev = windowStats(by, windowDates(prevEnd, 7), scoreCtx, rateCtx);
  const enough = cur.logged >= MIN_LOGGED;
  const lines = [];
  if (enough) {
    if (cur.avg !== null && prev.logged >= MIN_LOGGED && prev.avg !== null) {
      const d = cur.avg - prev.avg;
      lines.push({ kind: d >= 5 ? "up" : d <= -5 ? "down" : "flat", text: "গড় স্কোর " + prev.avg + "% → " + cur.avg + "%" + (d >= 5 ? " (উন্নতি)" : d <= -5 ? " (কমেছে)" : " (প্রায় একই)") });
    } else if (cur.avg !== null) lines.push({ kind: "flat", text: "এ সপ্তাহের গড় স্কোর " + cur.avg + "%" });
    const ranked = KEYS.filter((k) => cur.metrics[k].logged >= MIN_LOGGED).sort((a, b) => cur.metrics[b].pct - cur.metrics[a].pct);
    if (ranked.length) {
      const top = ranked[0], low = ranked[ranked.length - 1];
      if (cur.metrics[top].pct >= 70) lines.push({ kind: "up", text: "ভালো ছিল: " + METRIC_LABEL[top] + " (" + cur.metrics[top].hit + "/" + cur.metrics[top].logged + " দিন লক্ষ্যে)" });
      if (low !== top && cur.metrics[low].pct < WEAK_BELOW) lines.push({ kind: "down", text: "দুর্বল ছিল: " + METRIC_LABEL[low] + " (" + cur.metrics[low].hit + "/" + cur.metrics[low].logged + " দিন লক্ষ্যে)" });
      else if (low === top && cur.metrics[low].pct < WEAK_BELOW) lines.push({ kind: "down", text: "দুর্বল ছিল: " + METRIC_LABEL[low] + " (" + cur.metrics[low].hit + "/" + cur.metrics[low].logged + " দিন লক্ষ্যে)" });
    }
    if (cur.weights.length >= 2) {
      const a = cur.weights[0], b = cur.weights[cur.weights.length - 1];
      lines.push({ kind: "flat", text: "ওজন: " + a.kg + " → " + b.kg + " কেজি (" + (b.kg - a.kg >= 0 ? "+" : "−") + Math.abs(Math.round((b.kg - a.kg) * 10) / 10) + ")" });
    }
  }
  // গত সপ্তাহের ফোকাস (= গত সপ্তাহের সবচেয়ে দুর্বল বিষয়) এ সপ্তাহে কেমন গেল
  const lastFocus = prev.logged >= MIN_LOGGED ? weakestMetric(prev.metrics) : null;
  let focusProgress = null;
  if (lastFocus && cur.metrics[lastFocus].logged >= MIN_LOGGED) {
    const a = prev.metrics[lastFocus].pct, b = cur.metrics[lastFocus].pct;
    focusProgress = { key: lastFocus, label: METRIC_LABEL[lastFocus], from: a, to: b, kind: b - a >= 10 ? "up" : b - a <= -10 ? "down" : "flat" };
  }
  return { cur, prev, enough, lines, focusProgress, need: Math.max(0, MIN_LOGGED - cur.logged) };
}

// আগামী সপ্তাহের ১টি ফোকাস। ctx: লক্ষ্যের মান (exTarget, sleepMinH, waterTarget, calorieTarget)।
// → { key, label, pct, action } | { key: "log", ... } | null (সবই ঠিক/তথ্য কম)
export function pickFocus(report, rateCtx) {
  if (!report.enough) return { key: "log", label: "নিয়মিত তথ্য লেখা", pct: null, action: "প্রতিদিন অন্তত একটা তথ্য (খাবার, ঘুম, পানি বা ব্যায়াম) লিখুন — ছোট এন্ট্রিই যথেষ্ট।" };
  const k = weakestMetric(report.cur.metrics);
  if (!k) return null;
  const x = rateCtx || {};
  const action = {
    calories: "প্রতিদিনের খাবার লগ করে ক্যালরি লক্ষ্যের (প্রায় " + (x.calorieTarget || "—") + " kcal) কাছাকাছি রাখার চেষ্টা করুন।",
    exercise: "রোজ " + (x.exTarget || 30) + " মিনিট ব্যায়াম; কঠিন লাগলে ১০ মিনিট হাঁটা দিয়ে শুরু করুন।",
    sleep: "রোজ প্রায় " + (x.sleepMinH || 7) + " ঘণ্টা ঘুমের লক্ষ্য; একই সময়ে শুতে যাওয়ার চেষ্টা করুন।",
    water: "রোজ " + (x.waterTarget || 8) + " গ্লাস পানি; ঘুম থেকে উঠে ১ গ্লাস দিয়ে শুরু করুন।",
  }[k];
  return { key: k, label: METRIC_LABEL[k], pct: report.cur.metrics[k].pct, action };
}

// গত n দিনে (endISO পর্যন্ত): কোন বারে তথ্য-লেখা মিস হয়, আর কোন বারে কোন লক্ষ্য বেশি ফসকায়
export function habitPatterns({ docs, endISO, rateCtx, days = 28 }) {
  const by = byDate(docs);
  const dates = windowDates(endISO, days);
  const slots = WEEKDAY.map(() => ({ total: 0, missed: 0 }));
  dates.forEach((d) => { const i = wdIdx(d); slots[i].total++; if (!hasDayRecord(by[d])) slots[i].missed++; });
  const recorded = dates.filter((d) => hasDayRecord(by[d])).length;
  const out = { recorded, days, missDay: null, weakDays: [] };
  if (recorded < 7) return out; // অল্প তথ্যে প্যাটার্ন বানানো হয় না
  let worst = null;
  slots.forEach((s, i) => { if (s.total >= 3 && s.missed / s.total >= 0.5 && (!worst || s.missed / s.total > worst.rate)) worst = { idx: i, day: WEEKDAY[i], missed: s.missed, total: s.total, rate: s.missed / s.total }; });
  out.missDay = worst;
  KEYS.forEach((k) => {
    const per = WEEKDAY.map(() => ({ logged: 0, hit: 0 }));
    let L = 0, H = 0;
    dates.forEach((d) => {
      const doc = by[d];
      if (!hasDayRecord(doc)) return;
      const { applicable, met } = metricsOf(doc, rateCtx, d);
      if (!applicable.includes(k)) return;
      if (k === "calories" && !(doc.caloriesIn > 0)) return;
      if (k === "sleep" && !(doc.sleepMinutes > 0)) return;
      const i = wdIdx(d);
      per[i].logged++; L++;
      if (met.includes(k)) { per[i].hit++; H++; }
    });
    if (L < 8) return;
    const overall = Math.round((H / L) * 100);
    let low = null;
    per.forEach((p, i) => { if (p.logged >= 2) { const pct = Math.round((p.hit / p.logged) * 100); if (!low || pct < low.pct) low = { idx: i, day: WEEKDAY[i], pct, logged: p.logged, hit: p.hit }; } });
    if (low && overall - low.pct >= 30) out.weakDays.push({ key: k, label: METRIC_LABEL[k], day: low.day, pct: low.pct, hit: low.hit, logged: low.logged, overall });
  });
  out.weakDays.sort((a, b) => (b.overall - b.pct) - (a.overall - a.pct));
  out.weakDays = out.weakDays.slice(0, 2);
  return out;
}

// সম্ভাব্য ট্রিগার: পেটের লক্ষণ-লগ (Bristol) × খাবার-লগ (extraFoods)। শুধু পাশাপাশি মিল — কারণ/রোগনির্ণয় নয়।
// "অস্বস্তির দিন" = ওই দিনে Bristol ১–২ বা ৬–৭ আছে; "স্বাভাবিক দিন" = সব এন্ট্রি ৩–৫। প্রতিটি দিনের জন্য ওই দিন ও আগের দিনের খাবার দেখা হয়।
export function triggerSearch({ docs, gutEntries, endISO, days = 35 }) {
  const by = byDate(docs);
  const dates = new Set(windowDates(endISO, days));
  const perDay = {};
  (gutEntries || []).forEach((e) => { if (e && dates.has(e.date)) (perDay[e.date] = perDay[e.date] || []).push(e.score); });
  const dayKeys = Object.keys(perDay);
  const foodsOn = (date) => {
    const names = new Set();
    [date, shiftISO(date, -1)].forEach((d) => { const doc = by[d]; (doc && Array.isArray(doc.extraFoods) ? doc.extraFoods : []).forEach((f) => { if (f && typeof f.name === "string" && f.name.trim()) names.add(f.name.trim()); }); });
    return names;
  };
  let badDays = 0, okDays = 0;
  const stat = {};
  dayKeys.forEach((date) => {
    const sc = perDay[date];
    const bad = sc.some((s) => s <= 2 || s >= 6);
    const ok = !bad && sc.every((s) => s >= 3 && s <= 5);
    if (!bad && !ok) return;
    const foods = foodsOn(date);
    if (!foods.size) return; // ওই দিনে খাবার-লগ নেই → তুলনায় ধরা হয় না
    if (bad) badDays++; else okDays++;
    foods.forEach((n) => { const s = stat[n] || (stat[n] = { bad: 0, ok: 0 }); if (bad) s.bad++; else s.ok++; });
  });
  const compared = badDays + okDays;
  const out = { badDays, okDays, compared, enough: badDays >= 2 && compared >= 7, items: [] };
  if (!out.enough) return out;
  out.items = Object.entries(stat)
    .map(([name, s]) => ({ name, bad: s.bad, ok: s.ok, total: s.bad + s.ok, rate: s.bad / (s.bad + s.ok) }))
    .filter((x) => x.bad >= 2 && x.total >= 3 && x.rate >= 0.5 && x.rate >= (badDays / compared) + 0.2)
    .sort((a, b) => b.rate - a.rate || b.bad - a.bad)
    .slice(0, 3);
  return out;
}
