// অ্যাক্টিভিটি রিভিউ (ক্যালেন্ডারের নিচের অংশ): আজকের রিভিউ · সাপ্তাহিক ব্যায়াম-ঘর · ঘুম/ক্যালরির রায় · সতর্কতা-তালিকা।
// pure (React/Firestore নেই); ফিক্সড নিয়ম, AI/রোগনির্ণয় নয়; শুধু সদস্যের নিজের দেওয়া তথ্য। কিছু সংরক্ষণ হয় না।
import { metricsOf } from "./todaySummary.js";
import { hasDayRecord, shiftISO } from "./dateNav.js";
import { medFoodNotes } from "./medFoodNotes.js";
import { avoidFor } from "./avoidRules.js";

export const FINAL_HOUR = 21; // এর পর "আজকের রিভিউ"; আগে "সাময়িক"
export const MAX_GOOD = 2;
export const MAX_IMPROVE = 2;
export const MAX_ALERTS = 3;
const ORDER = ["calories", "exercise", "sleep", "water"];
export const LABEL = { calories: "ক্যালরি", exercise: "ব্যায়াম", sleep: "ঘুম", water: "পানি" };
const r1 = (n) => Math.round(n * 10) / 10;

// ক্যালরির রায়: লক্ষ্যের ৮০–১১০% ঠিক (metricsOf/calorieMet-এর সাথে একই সীমা)
export function calVerdict(v, target) {
  if (!target) return null;
  if (!(v > 0)) return { key: "missing", word: "লেখা হয়নি" };
  const ratio = v / target;
  if (ratio < 0.8) return { key: "low", word: "একটু কম" };
  if (ratio > 1.1) return { key: "high", word: "একটু বেশি" };
  return { key: "good", word: "ঠিক আছে" };
}

// ঘুমের রায় (ঘণ্টা)। minH = লক্ষ্যের সর্বনিম্ন।
export function sleepVerdict(hours, minH) {
  if (!minH) return null;
  if (!(hours > 0)) return { key: "missing", word: "লেখা হয়নি" };
  if (hours >= minH) return { key: "good", word: "ভালো" };
  if (hours >= minH - 1) return { key: "low", word: "একটু কম" };
  return { key: "low", word: "কম" };
}

const TOMORROW = {
  calories_low: "কাল প্রতিটি বেলার খাবার লিখে রাখুন, আর মিল-প্ল্যান ধরে খান।",
  calories_high: "কাল বড় বেলায় ভাত বা ভাজাপোড়া একটু কম নিন।",
  calories_missing: "কাল প্রতিটি বেলার খাবার লিখে রাখুন।",
  exercise: "কাল ১০ মিনিট হাঁটা দিয়ে শুরু করুন।",
  sleep: "আজ একটু আগে শুয়ে পড়ুন; মোবাইল শোয়ার আগে সরিয়ে রাখুন।",
  sleep_missing: "কাল সকালে আগের রাতের ঘুম লিখে রাখুন।",
  water: "কাল ঘুম থেকে উঠে ১ গ্লাস পানি দিয়ে শুরু করুন।",
};

// আজকের রিভিউ। doc = আজকের দৈনিক ডক (বা null); ctx = targetCtxFor() (পানিসহ); bn = বাংলা সংখ্যা-ফরম্যাটার।
// → { hasData, final, good:[{key,label,text}], improve:[{key,label,text,gap}], tomorrow }
export function dayReview({ doc, ctx, date, now, bn }) {
  const out = { hasData: hasDayRecord(doc), final: (now || new Date()).getHours() >= FINAL_HOUR, good: [], improve: [], tomorrow: null };
  if (!out.hasData) return out;
  const { applicable, met } = metricsOf(doc, ctx, date || doc.date);
  const ok = (k) => met.includes(k);
  const items = [];
  applicable.forEach((k) => {
    if (k === "calories") {
      const v = calVerdict(doc.caloriesIn, ctx.calorieTarget);
      const txt = "ক্যালরি " + bn(doc.caloriesIn || 0) + " / " + bn(ctx.calorieTarget) + " kcal";
      if (v.key === "good") items.push({ key: k, good: true, text: txt });
      else items.push({ key: k, good: false, text: v.key === "missing" ? "খাবার এখনো লেখা হয়নি" : txt + " — " + v.word, gap: v.key === "missing" ? 1 : Math.abs(1 - doc.caloriesIn / ctx.calorieTarget), tip: v.key === "missing" ? "calories_missing" : "calories_" + v.key });
    } else if (k === "exercise") {
      const m = doc.exerciseMin || 0;
      if (ok(k)) items.push({ key: k, good: true, text: "ব্যায়াম " + bn(m) + " মিনিট (লক্ষ্য " + bn(ctx.exTarget) + ")" });
      else items.push({ key: k, good: false, text: "ব্যায়াম " + bn(m) + "/" + bn(ctx.exTarget) + " মিনিট — আর " + bn(ctx.exTarget - m) + " মিনিট বাকি", gap: (ctx.exTarget - m) / ctx.exTarget, tip: "exercise" });
    } else if (k === "sleep") {
      const mins = doc.sleepMinutes || 0;
      if (!(mins > 0)) items.push({ key: k, good: false, text: "ঘুম এখনো লেখা হয়নি", gap: 0.9, tip: "sleep_missing" });
      else if (ok(k)) items.push({ key: k, good: true, text: "ঘুম " + bn(r1(mins / 60)) + " ঘণ্টা (লক্ষ্য " + bn(ctx.sleepMinH) + ")" });
      else items.push({ key: k, good: false, text: "ঘুম " + bn(r1(mins / 60)) + " ঘণ্টা — লক্ষ্য " + bn(ctx.sleepMinH), gap: 1 - mins / (ctx.sleepMinH * 60), tip: "sleep" });
    } else if (k === "water") {
      const g = doc.waterGlasses || 0;
      if (ok(k)) items.push({ key: k, good: true, text: "পানি " + bn(g) + " গ্লাস (লক্ষ্য " + bn(ctx.waterTarget) + ")" });
      else items.push({ key: k, good: false, text: "পানি " + bn(g) + "/" + bn(ctx.waterTarget) + " গ্লাস — আর " + bn(ctx.waterTarget - g) + " গ্লাস বাকি", gap: (ctx.waterTarget - g) / ctx.waterTarget, tip: "water" });
    }
  });
  const ix = (k) => ORDER.indexOf(k);
  out.good = items.filter((x) => x.good).sort((a, b) => ix(a.key) - ix(b.key)).slice(0, MAX_GOOD).map((x) => ({ key: x.key, label: LABEL[x.key], text: x.text }));
  const bad = items.filter((x) => !x.good).sort((a, b) => b.gap - a.gap || ix(a.key) - ix(b.key));
  out.improve = bad.slice(0, MAX_IMPROVE).map((x) => ({ key: x.key, label: LABEL[x.key], text: x.text, gap: x.gap }));
  out.tomorrow = bad.length ? TOMORROW[bad[0].tip] : (items.length ? "সব লক্ষ্য ঠিক আছে — এভাবেই চালিয়ে যান।" : null);
  return out;
}

// সাপ্তাহিক ব্যায়াম-ঘর। weekDates = শনি→শুক্র (৭টি ISO); by = date → doc; target = সাপ্তাহিক লক্ষ্য-মিনিট (null হলে null ফেরে)।
// → { days:[{iso,min,isToday,future}], total, target, remaining, pct, done, daysLeft, perDay }
export function exerciseWeek({ weekDates, by, todayISO, target }) {
  if (!target || !Array.isArray(weekDates) || weekDates.length !== 7) return null;
  const days = weekDates.map((iso) => ({ iso, min: iso > todayISO ? 0 : Math.max(0, Math.round(((by[iso] && by[iso].exerciseMin) || 0))), isToday: iso === todayISO, future: iso > todayISO }));
  const total = days.reduce((a, d) => a + d.min, 0);
  const remaining = Math.max(0, target - total);
  const daysLeft = days.filter((d) => d.iso >= todayISO).length; // আজসহ
  const perDay = remaining > 0 && daysLeft > 0 ? Math.ceil(remaining / daysLeft / 5) * 5 : 0; // ৫-এর গুণিতকে ওপরে (সহজ পড়ার জন্য)
  return { days, total, target, remaining, pct: Math.min(100, Math.round((total / target) * 100)), done: remaining === 0, daysLeft, perDay };
}

// গত ৭ দিন (endISO সহ): ঘুম/ক্যালরির বার-ডেটা ও আজকের রায়
// → { dates, sleepH:[n|null], cal:[n|null], todaySleepH, todayCal, sleepAvg, sleepV, calV }
export function restView({ by, endISO, calorieTarget, sleepMinH }) {
  const dates = Array.from({ length: 7 }, (_, i) => shiftISO(endISO, i - 6));
  const sleepH = dates.map((d) => { const m = by[d] && by[d].sleepMinutes; return m > 0 ? r1(m / 60) : null; });
  const cal = dates.map((d) => { const c = by[d] && by[d].caloriesIn; return c > 0 ? c : null; });
  const sl = sleepH.filter((x) => x !== null);
  const sleepAvg = sl.length ? r1(sl.reduce((a, b) => a + b, 0) / sl.length) : null;
  const todaySleepH = sleepH[6], todayCal = cal[6];
  return { dates, sleepH, cal, todaySleepH, todayCal, sleepAvg, sleepV: sleepVerdict(todaySleepH, sleepMinH), calV: calVerdict(todayCal, calorieTarget), hasSleep: sl.length > 0, hasCal: cal.some((x) => x !== null) };
}

// সতর্কতা-তালিকা (গুরুতর আগে): গেট-বার্তা → আজকের খাবার × ওষুধ-নোট → রোগ/বয়সের খাবার ও ব্যায়াম-সতর্কতা।
// → [{ id, level:"high"|"info", title, lines:[...] }] — সব; দেখানোর সীমা UI-তে (MAX_ALERTS)
export function alertList({ gate, activeMeds, extraFoods, age, flags, condKeys }) {
  const out = [];
  if (gate && (gate.blocked || gate.warn) && gate.reason) out.push({ id: "gate", level: "high", title: "ক্যালরি-টার্গেট", lines: [gate.reason.replace(/^⚠\s*/, "")] });
  const seen = new Set();
  (Array.isArray(extraFoods) ? extraFoods : []).forEach((f) => {
    if (!f || typeof f.key !== "string") return;
    medFoodNotes(activeMeds, f.key).forEach((n) => { const k = n.rule + n.med; if (!seen.has(k)) { seen.add(k); out.push({ id: "med-" + k, level: "high", title: "খাবার ও ওষুধ", lines: [n.text] }); } });
  });
  [["food", "খাবারে সতর্কতা"], ["exercise", "ব্যায়ামে সতর্কতা"]].forEach(([dom, ttl]) => {
    avoidFor(dom, { age, flags, condKeys }).forEach((g) => out.push({ id: dom + "-" + g.id, level: "info", title: ttl + " — " + g.title, lines: g.items }));
  });
  return out;
}
