// রিভিউ আনলকের নোটিফিকেশন — pure (React/Firestore/localStorage নেই)। সময়ের নিয়ম weekLock.js ও monthLock.js-এর একই (দুই জায়গায় আলাদা হিসাব নেই)।
// সাপ্তাহিক: বৃহস্পতি রাত ৯টা → শনি রাত ১১টা · মাসিক: মাসের শেষ দিন রাত ৯টা → পরের মাসের ৩ তারিখ রাত ১১টা।
// প্রতিটি "পর্যায়" (সপ্তাহ/মাস) শুধু একবার জানানো হয় (isSeen দিয়ে); খোলার পর অ্যাপ প্রথম চালু পেলেই (জানালা বন্ধ হওয়ার আগে) আসে।
import { isReviewOpen } from "./weekLock.js";
import { monthWindow } from "./monthLock.js";
import { shiftISO } from "./dateNav.js";

const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());

// খোলা সাপ্তাহিক জানালার পরিচয় = ওই সপ্তাহের বৃহস্পতিবারের তারিখ (বৃহ/শুক্র/শনি তিন দিনেই একই)
export function weekPeriodId(now) {
  const d = now.getDay(); // বৃহ=৪, শুক্র=৫, শনি=৬
  return "rv-week-" + shiftISO(iso(now), -(d - 4));
}

// → { ids: [পর্যায়-id], title, body } | null — শুধু এখনো-না-জানানো খোলা পর্যায়গুলো। isSeen(id) → boolean।
export function reviewUnlockDue(now, isSeen) {
  const seen = typeof isSeen === "function" ? isSeen : () => false;
  const due = [];
  if (isReviewOpen(now)) { const id = weekPeriodId(now); if (!seen(id)) due.push({ id, kind: "week" }); }
  const mw = monthWindow(now);
  if (mw.open) { const id = "rv-month-" + mw.y + "-" + (mw.m + 1); if (!seen(id)) due.push({ id, kind: "month" }); }
  if (!due.length) return null;
  const week = due.some((x) => x.kind === "week"), month = due.some((x) => x.kind === "month");
  const title = week && month ? "সাপ্তাহিক ও মাসিক রিভিউ আনলক হয়েছে" : week ? "সাপ্তাহিক রিভিউ আনলক হয়েছে" : "মাসিক রিভিউ আনলক হয়েছে";
  const until = week && month ? "সাপ্তাহিক রিভিউ শনি রাত ১১টা, মাসিক রিভিউ ৩ তারিখ রাত ১১টা পর্যন্ত খোলা" : week ? "শনিবার রাত ১১টা পর্যন্ত খোলা থাকবে" : "৩ তারিখ রাত ১১টা পর্যন্ত খোলা থাকবে";
  return { ids: due.map((x) => x.id), title, body: "ট্র্যাকার ▸ রিভিউ-এ দেখুন · " + until };
}
