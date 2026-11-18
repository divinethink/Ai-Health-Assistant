// মাসিক রিভিউ: "মনোযোগ দরকার" — দুর্বল বিষয়, সম্ভাব্য কারণ ও প্রতিকার। pure; ফিক্সড নিয়ম, AI/রোগনির্ণয় নয়।
// কারণ = সদস্যের নিজের লগের মিল ("সম্ভাব্য"), প্রমাণ নয়। কিছু সংরক্ষণ হয় না।
import { METRIC_LABEL, MIN_LOGGED, habitPatterns } from "./reviewInsights.js";
import { metricPcts, weakestOf } from "./monthLock.js";

const KEYS = ["calories", "exercise", "sleep", "water"];
const WEAK_BELOW = 70;
export const MAX_ITEMS = 3;

const REMEDY = {
  calories: "খাবারের লগ নিয়মিত করুন এবং মিল-প্ল্যানের বেলা-বরাদ্দ অনুসরণ করে দেখুন। বড় বদল নয়, প্রতিদিন একটা বেলা ঠিক রাখুন।",
  exercise: "ছোট করে শুরু করুন: রোজ ১০ মিনিট হাঁটা। একটা নির্দিষ্ট সময় ঠিক করলে অভ্যাস সহজে গড়ে ওঠে; সপ্তাহে একটু একটু বাড়ান।",
  sleep: "রোজ একই সময়ে শুতে যান, শোয়ার আগে মোবাইল কমান এবং সন্ধ্যার পর চা-কফি এড়ান। প্রতিদিন ১৫ মিনিট এগিয়ে শুরু করুন।",
  water: "ঘুম থেকে উঠে ১ গ্লাস, প্রতি খাবারের সময় ১ গ্লাস — এভাবে পানি খাওয়ার সময় ঠিক করে ফেলুন। ফোনে রিমাইন্ডার রাখতে পারেন।",
};

function causes(k, { st, monthDocs, rateCtx, patterns, bn }) {
  const out = [];
  const wd = patterns.weakDays.find((w) => w.key === k);
  if (wd) out.push(wd.day + " লক্ষ্য বেশি ফসকায় (ওই বারে " + bn(wd.hit) + "/" + bn(wd.logged) + " দিন লক্ষ্যে; মাসের গড় " + bn(wd.overall) + "%)।");
  if (k === "sleep") {
    if (st.sleepAvgH !== null && st.sleepAvgH < (rateCtx.sleepMinH || 7)) out.push("গড় ঘুম " + bn(st.sleepAvgH) + " ঘণ্টা, লক্ষ্য প্রায় " + bn(rateCtx.sleepMinH || 7) + " ঘণ্টা। দেরিতে শোয়া বা শোয়ার সময় অনিয়মিত হলে এমন হতে পারে।");
  } else if (k === "exercise") {
    if (st.loggedDays > 0 && st.exActive * 2 < st.loggedDays) out.push("অর্ধেকের বেশি দিন ব্যায়ামের তথ্য নেই বা ০ মিনিট।");
    else if (st.exActive > st.exHit) out.push("ব্যায়াম করেছেন, কিন্তু অনেক দিন লক্ষ্যের মিনিটের কম হয়েছে। লক্ষ্য একটু বড় লাগছে কি না ভেবে দেখতে পারেন।");
  } else if (k === "calories") {
    const v = (monthDocs || []).filter((d) => d && d.caloriesIn > 0).map((d) => d.caloriesIn);
    const t = rateCtx.calorieTarget;
    if (v.length >= MIN_LOGGED && t) {
      const a = Math.round(v.reduce((x, y) => x + y, 0) / v.length);
      if (a > t * 1.1) out.push("লগ-করা দিনগুলোর গড় ক্যালরি প্রায় " + bn(a) + " kcal — লক্ষ্যের (" + bn(t) + ") চেয়ে বেশি।");
      else if (a < t * 0.8) out.push("লগ-করা দিনগুলোর গড় ক্যালরি প্রায় " + bn(a) + " kcal — লক্ষ্যের (" + bn(t) + ") চেয়ে কম। কিছু বেলার খাবার লগ বাদ পড়ে থাকতে পারে।");
      else out.push("গড় ক্যালরি লক্ষ্যের কাছাকাছি, কিন্তু দিনে দিনে ওঠানামা বেশি।");
    }
    if (st.loggedDays >= 7 && st.calDays * 10 < st.loggedDays * 6) out.push("অনেক দিন খাবার লগ হয়নি, তাই হিসাব অসম্পূর্ণ।");
  } else if (k === "water") {
    if (st.loggedDays >= 7 && st.waterDays * 10 < st.loggedDays * 6) out.push("অনেক দিন পানির হিসাব লেখা হয়নি, তাই সংখ্যা কম দেখাতে পারে।");
    else out.push("পানি খাওয়ার কথা ভুলে যাওয়া এর একটি সাধারণ কারণ।");
  }
  return out.slice(0, 2);
}

// st/prevSt: monthStats()-এর ফল (rateCtx সহ — পানি ধরা); monthDocs: ওই মাসের ডক; docs: সব মাসের মিলিত ডক
// → { items: [{ key, label, pct, prev, causes, remedy }], logging: {text, missDay}|null }
export function attentionItems({ st, prevSt, monthDocs, docs, endISO, rateCtx, bn }) {
  const x = rateCtx || {};
  const cur = metricPcts(st), prev = metricPcts(prevSt);
  const patterns = habitPatterns({ docs, endISO, rateCtx: x });
  const items = KEYS.filter((k) => cur[k] && cur[k].logged >= MIN_LOGGED && cur[k].pct !== null && cur[k].pct < WEAK_BELOW)
    .sort((a, b) => cur[a].pct - cur[b].pct)
    .slice(0, MAX_ITEMS)
    .map((k) => ({
      key: k, label: METRIC_LABEL[k], pct: cur[k].pct,
      prev: prev[k] && prev[k].logged >= MIN_LOGGED ? prev[k].pct : null,
      causes: causes(k, { st, monthDocs, rateCtx: x, patterns, bn }),
      remedy: REMEDY[k],
    }));
  let logging = null;
  if (st.days >= 7 && st.loggedDays * 10 < st.days * 6) {
    const md = patterns.missDay;
    logging = { text: "এ মাসে " + bn(st.days) + " দিনের মধ্যে " + bn(st.loggedDays) + " দিন তথ্য লেখা হয়েছে। কম তথ্যে হিসাব পুরো ছবি দেখায় না।" + (md ? " " + md.day + " প্রায়ই ফাঁকা থাকে।" : ""),
      remedy: "রাতে ঘুমের আগে ৩০ সেকেন্ড — অন্তত পানি, ঘুম বা একটা খাবার লিখে রাখুন।" };
  }
  return { items, logging, weakest: weakestOf(cur) };
}
