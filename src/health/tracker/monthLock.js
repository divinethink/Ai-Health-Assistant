// মাসিক রিভিউ লক — pure (React/Firestore নেই)। শুধু দেখানোর সময়ের নিয়ম, নিরাপত্তা-সীমা নয়; কিছু সংরক্ষণ হয় না।
// খোলা: মাসের শেষ দিন রাত ৯টা → পরের মাসের ৩ তারিখ রাত ১১টা (ফোনের স্থানীয় সময়)।
import { METRIC_LABEL, MIN_LOGGED } from "./reviewInsights.js";
import { MIN_FILLED } from "./trendScore.js";

export const OPEN_HOUR = 21; // মাসের শেষ দিন
export const CLOSE_DAY = 3; // পরের মাসের ৩ তারিখ
export const CLOSE_HOUR = 23;
const WEAK_BELOW = 70; // এর নিচে হলে "দুর্বল" (সাপ্তাহিক রিভিউর সাথে একই সীমা)
const KEYS = ["calories", "exercise", "sleep", "water"];

// → { open, y, m (০–১১), provisional, opensAt (Date|null), remainMs }
// খোলা + শেষ দিন: চলতি মাস (আজ পর্যন্ত, সাময়িক) · খোলা + ১–৩ তারিখ: আগের মাস (চূড়ান্ত)
// লক: চলতি (চলমান) মাস
export function monthWindow(now) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), h = now.getHours();
  const last = new Date(y, m + 1, 0).getDate();
  if (d === last && h >= OPEN_HOUR) return { open: true, y, m, provisional: true, opensAt: null, remainMs: 0 };
  if (d < CLOSE_DAY || (d === CLOSE_DAY && h < CLOSE_HOUR)) {
    return { open: true, y: m === 0 ? y - 1 : y, m: m === 0 ? 11 : m - 1, provisional: false, opensAt: null, remainMs: 0 };
  }
  const opensAt = new Date(y, m, last, OPEN_HOUR, 0, 0);
  return { open: false, y, m, provisional: false, opensAt, remainMs: Math.max(0, opensAt.getTime() - now.getTime()), lastDay: last };
}

// monthStats()-এর ফল থেকে বিষয়ভিত্তিক লক্ষ্য-পূরণ। শুধু প্রযোজ্য (লক্ষ্য আছে) বিষয় থাকে।
// → { calories?: {logged, hit, pct}, exercise?, sleep?, water? }
export function metricPcts(st) {
  const out = {};
  if (!st) return out;
  const put = (k, logged, hit) => { out[k] = { logged, hit, pct: logged ? Math.round((hit / logged) * 100) : null }; };
  if (st.hasCalTarget) put("calories", st.calDays, st.calHit);
  if (st.hasExTarget) put("exercise", st.loggedDays, st.exHit);
  put("sleep", st.sleepDays, st.sleepHit);
  if (st.hasWaterTarget) put("water", st.waterDays, st.waterHit);
  return out;
}

// সবচেয়ে দুর্বল বিষয় (≥MIN_LOGGED দিন তথ্য, <WEAK_BELOW%); না থাকলে null। সমান হলে KEYS-ক্রম।
export function weakestOf(pcts) {
  let best = null;
  KEYS.forEach((k) => {
    const x = pcts[k];
    if (x && x.logged >= MIN_LOGGED && x.pct !== null && x.pct < WEAK_BELOW && (!best || x.pct < pcts[best].pct)) best = k;
  });
  return best;
}

// লক-অবস্থার ১ লাইন: উন্নতি ও অবনতি। ins = monthInsights() ফল; bn = বাংলা সংখ্যা-ফরম্যাটার।
// → [{ kind: "up"|"down"|"flat"|"more", text }]
export function lockLine(ins, bn) {
  if (ins.needMore > 0 && ins.filled < MIN_FILLED) return [{ kind: "more", text: "আরও " + bn(ins.needMore) + " দিন লিখলে তুলনা আসবে।" }];
  if (ins.delta === null && !ins.improvement && !ins.drop) return [{ kind: "flat", text: "গত মাসের সাথে তুলনার মতো তথ্য এখনো নেই।" }];
  const parts = [];
  const mv = (x) => x.label + " " + bn(x.prev) + "% → " + bn(x.cur) + "%";
  if (ins.improvement) parts.push({ kind: "up", text: "উন্নতি: " + mv(ins.improvement) });
  else if (ins.delta !== null && ins.delta >= 5) parts.push({ kind: "up", text: "উন্নতি: গড় স্কোর " + bn(ins.delta) + " পয়েন্ট বেড়েছে" });
  if (ins.drop) parts.push({ kind: "down", text: "অবনতি: " + mv(ins.drop) });
  else if (ins.delta !== null && ins.delta <= -5) parts.push({ kind: "down", text: "অবনতি: গড় স্কোর " + bn(-ins.delta) + " পয়েন্ট কমেছে" });
  if (!parts.length) parts.push({ kind: "flat", text: "গত মাসের একই সময়ের প্রায় সমান চলছে।" });
  return parts;
}

// বিষয়-অনুযায়ী মাসিক পদক্ষেপ (লক্ষ্যের মান rateCtx থেকে)
function action(k, x) {
  return {
    calories: "প্রতিদিনের খাবার লগ করে ক্যালরি লক্ষ্যের (প্রায় " + (x.calorieTarget || "—") + " kcal) কাছাকাছি রাখার চেষ্টা করুন।",
    exercise: "রোজ " + (x.exTarget || 30) + " মিনিট ব্যায়াম; কঠিন লাগলে ১০ মিনিট হাঁটা দিয়ে শুরু করুন।",
    sleep: "রোজ প্রায় " + (x.sleepMinH || 7) + " ঘণ্টা ঘুমের লক্ষ্য; একই সময়ে শুতে যাওয়ার চেষ্টা করুন।",
    water: "রোজ " + (x.waterTarget || 8) + " গ্লাস পানি; ঘুম থেকে উঠে ১ গ্লাস দিয়ে শুরু করুন।",
  }[k];
}

// এ মাসের লক্ষ্য = আগের (পূর্ণ) মাসের সবচেয়ে দুর্বল বিষয়। সংরক্ষণ হয় না — প্রতিবার ডেটা থেকে একই নিয়মে বের হয়।
// → { key, label, pct, action } | null (সব ঠিক)
export function monthGoal(prevSt, rateCtx) {
  if (!prevSt || prevSt.loggedDays < MIN_FILLED) {
    return { key: "log", label: "নিয়মিত তথ্য লেখা", pct: null, action: "প্রতিদিন অন্তত একটা তথ্য (খাবার, ঘুম, পানি বা ব্যায়াম) লিখুন — ছোট এন্ট্রিই যথেষ্ট।" };
  }
  const pcts = metricPcts(prevSt);
  const k = weakestOf(pcts);
  if (!k) return null;
  return { key: k, label: METRIC_LABEL[k], pct: pcts[k].pct, action: action(k, rateCtx || {}) };
}

// গত মাসের লক্ষ্য এ মাসে কেমন গেল: → { key, label, from, to, kind } | null
export function goalProgress(prevSt, curSt) {
  if (!prevSt || !curSt || prevSt.loggedDays < MIN_FILLED) return null;
  const a = metricPcts(prevSt), b = metricPcts(curSt);
  const k = weakestOf(a);
  if (!k || !b[k] || b[k].logged < MIN_LOGGED || b[k].pct === null) return null;
  const diff = b[k].pct - a[k].pct;
  return { key: k, label: METRIC_LABEL[k], from: a[k].pct, to: b[k].pct, kind: diff >= 10 ? "up" : diff <= -10 ? "down" : "flat" };
}
