// আজ-ট্যাবের তারিখ-নেভিগেশন (pure functions — React/Firestore নেই)।
// পরিসীমা: গত ৩০ দিন (আজসহ) = TrackerPageSection-এর `recent` যে ৩০ দিন লোড করে। এর বাইরে ডক লোড থাকে না,
// তাই সেখানে লিখলে (ওজন/ব্যায়াম যোগফল ইত্যাদি) ভুল মান বসতে পারত — zero-data-loss নিয়মে সীমা ৩০ দিন।
// ভবিষ্যৎ তারিখে লেখা নয়।

import { STREAK_MAX } from "./todaySummary.js";

const p2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const parse = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(y, m - 1, d); };

// iso-কে n দিন সরায় (n ঋণাত্মক হতে পারে)
export function shiftISO(iso, n) {
  const d = parse(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

// সবচেয়ে পুরনো নির্বাচনযোগ্য তারিখ (আজসহ ৩০ দিন → আজ − ২৯)
export function minDateISO(todayISO) {
  return shiftISO(todayISO, -(STREAK_MAX - 1));
}

export function inRange(iso, todayISO) {
  return iso <= todayISO && iso >= minDateISO(todayISO);
}

// সীমার বাইরে গেলে সীমার ভেতরে টেনে আনে
export function clampISO(iso, todayISO) {
  const min = minDateISO(todayISO);
  if (iso > todayISO) return todayISO;
  if (iso < min) return min;
  return iso;
}

// কোনো মাসের গ্রিড: শনিবার-শুরু (অ্যাপের সপ্তাহ শনি–শুক্র)। সারি = ৭টি; আগে/পরের মাসের ঘর outside:true।
export function monthGrid(year, month /* ০–১১ */) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 1) % 7; // শনি=০ … শুক্র=৬
  const start = new Date(year, month, 1 - lead);
  const total = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { iso: toISO(d), day: d.getDate(), outside: d.getMonth() !== month };
  });
}

// সোয়াইপ: ডানে টানলে আগের দিন, বাঁয়ে টানলে পরের দিন। আড়াআড়ি টান স্পষ্ট ও যথেষ্ট লম্বা হলেই (স্ক্রলকে বাধা দেয় না)।
export function swipeDelta(dx, dy) {
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return 0;
  return dx > 0 ? -1 : 1;
}

// হিজরি তারিখ — ব্রাউজারের Intl (উম্মুল-কুরা) থেকে, আনুমানিক; দেশভেদে ±১ দিন হতে পারে। না পেলে খালি স্ট্রিং।
export function hijriLabel(iso, withDay = true) {
  try {
    const dt = new Date(iso + "T12:00:00Z");
    const parts = new Intl.DateTimeFormat("bn-u-ca-islamic-umalqura-nu-beng", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).formatToParts(dt);
    const get = (t) => (parts.find((x) => x.type === t) || {}).value || "";
    const core = get("month") + " " + get("year") + " হিজরি";
    return withDay ? get("day") + " " + core : core;
  } catch (_e) { return ""; }
}
