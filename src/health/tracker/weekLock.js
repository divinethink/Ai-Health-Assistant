// সাপ্তাহিক রিভিউ লক — pure (React/Firestore নেই)। শুধু দেখানোর সময়ের নিয়ম, নিরাপত্তা-সীমা নয়; কিছু সংরক্ষণ হয় না।
// খোলা: বৃহস্পতি রাত ৯টা → শনি রাত ১১টা (ফোনের স্থানীয় সময়)। সপ্তাহ = শনি–শুক্র।
import { shiftISO } from "./dateNav.js";
import { weakestMetric, METRIC_LABEL, MIN_LOGGED } from "./reviewInsights.js";

export const OPEN_HOUR = 21; // বৃহস্পতি
export const CLOSE_HOUR = 23; // শনি
const THU = 4, FRI = 5, SAT = 6; // Date#getDay()

const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());

export function isReviewOpen(now) {
  const d = now.getDay(), h = now.getHours();
  return (d === THU && h >= OPEN_HOUR) || d === FRI || (d === SAT && h < CLOSE_HOUR);
}

// → { open, endISO, provisional, opensAt (Date|null), remainMs }
// খোলা বৃহ/শুক্র: চলতি সপ্তাহ (আজ পর্যন্ত, provisional) · খোলা শনি: গতকাল (শুক্র) পর্যন্ত চূড়ান্ত
// লক: সর্বশেষ শেষ-হওয়া শুক্র পর্যন্ত চূড়ান্ত সপ্তাহ
export function reviewWindow(now) {
  const today = iso(now), d = now.getDay();
  if (isReviewOpen(now)) {
    const sat = d === SAT;
    return { open: true, endISO: sat ? shiftISO(today, -1) : today, provisional: !sat, opensAt: null, remainMs: 0 };
  }
  const lastFri = shiftISO(today, -((d + 2) % 7));
  const days = (THU - d + 7) % 7;
  const opensAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, OPEN_HOUR, 0, 0);
  return { open: false, endISO: lastFri, provisional: false, opensAt, remainMs: Math.max(0, opensAt.getTime() - now.getTime()) };
}

// ms → { d, h, m } (মিনিট উপরে গোল — "আর ০ মিনিট" দেখানো এড়াতে)
export function remainParts(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000));
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}

// দুর্বল বিষয়ের ১ লাইনের পরামর্শ (ফিক্সড নিয়ম; AI/রোগনির্ণয় নয়)
export const TIPS = {
  calories: "প্রতিদিনের খাবার লগ করে ক্যালরি লক্ষ্যের কাছাকাছি থাকুন।",
  exercise: "রোজ ১০ মিনিট হাঁটা দিয়ে শুরু করুন।",
  sleep: "রাতে একটু আগে ঘুমাতে যাওয়ার চেষ্টা করুন।",
  water: "খাবারের সময় পাশে এক গ্লাস পানি রাখুন।",
};

// রিপোর্ট থেকে দুর্বল বিষয়ের পরামর্শ-লাইন; দুর্বল না থাকলে বা তথ্য কম হলে null
export function weakTip(rep) {
  if (!rep || !rep.enough) return null;
  const k = weakestMetric(rep.cur.metrics);
  if (!k) return null;
  const m = rep.cur.metrics[k];
  return { key: k, text: METRIC_LABEL[k] + " " + m.hit + "/" + m.logged + " দিন: " + TIPS[k] };
}

// লক-অবস্থার "এক নজরে" কার্ডের উপাদান (রিপোর্ট থেকে; নতুন হিসাব/সংরক্ষণ নেই)
// → { enough, avg, delta (পয়েন্ট|null), best {key,label,hit,logged,pct}|null, weak (একইরকম)|null }
export function lockedSummary(rep) {
  const out = { enough: !!(rep && rep.enough), avg: null, delta: null, best: null, weak: null };
  if (!out.enough) return out;
  const m = rep.cur.metrics;
  const mk = (k) => ({ key: k, label: METRIC_LABEL[k], hit: m[k].hit, logged: m[k].logged, pct: m[k].pct });
  const ks = Object.keys(METRIC_LABEL).filter((k) => m[k] && m[k].logged >= MIN_LOGGED && m[k].pct !== null).sort((a, b) => m[b].pct - m[a].pct);
  if (ks.length) {
    if (m[ks[0]].pct >= 70) out.best = mk(ks[0]);
    const low = ks[ks.length - 1];
    if (m[low].pct < 70) out.weak = mk(low);
  }
  out.avg = rep.cur.avg;
  if (rep.cur.avg !== null && rep.prev.logged >= MIN_LOGGED && rep.prev.avg !== null) out.delta = rep.cur.avg - rep.prev.avg;
  return out;
}
