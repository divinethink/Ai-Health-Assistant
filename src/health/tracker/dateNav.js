// আজ-ট্যাবের তারিখ-নেভিগেশন (pure functions — React/Firestore নেই)।
// পরিসীমা: ১৯৯০-০১-০১ থেকে আজ পর্যন্ত। গত ৩০ দিনের বাইরের দিনের ডক TodayTab আলাদা করে লোড করে
// (শেষ না হওয়া পর্যন্ত লেখা বন্ধ — ভুল মান বসার ঝুঁকি নেই)। ভবিষ্যৎ তারিখে লেখা নয়।

const p2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const parse = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(y, m - 1, d); };

// iso-কে n দিন সরায় (n ঋণাত্মক হতে পারে)
export function shiftISO(iso, n) {
  const d = parse(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export const MIN_DATE_ISO = "1990-01-01";
export const MIN_YEAR = 1990;

// সবচেয়ে পুরনো নির্বাচনযোগ্য তারিখ
export function minDateISO(_todayISO) {
  return MIN_DATE_ISO;
}

export function inRange(iso, todayISO) {
  return iso <= todayISO && iso >= MIN_DATE_ISO;
}

// দিনে কোনো রেকর্ড আছে কিনা (ক্যালেন্ডারের সবুজ ডট)
export function hasDayRecord(x) {
  return !!(x && x.date && ((x.caloriesIn || 0) > 0 || (x.waterGlasses || 0) > 0 || (x.steps || 0) > 0 || (x.exerciseMin || 0) > 0 || (x.sleepMinutes || 0) > 0 || (x.weightKg || 0) > 0 || (Array.isArray(x.extraFoods) && x.extraFoods.length > 0)));
}

// মাসের সব তারিখ (ISO) — month ০–১১
export function monthDatesISO(year, month) {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => toISO(new Date(year, month, i + 1)));
}

// সীমার বাইরে গেলে সীমার ভেতরে টেনে আনে
export function clampISO(iso, todayISO) {
  if (iso > todayISO) return todayISO;
  if (iso < MIN_DATE_ISO) return MIN_DATE_ISO;
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
