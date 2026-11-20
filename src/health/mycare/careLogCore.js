// MyCare — রুটিন চেকলিস্ট ও streak-এর pure লজিক (React/Firestore-মুক্ত)।
// সংরক্ষণ: families/{fid}/careLog/{memberId}, ফিল্ড `days` = { "YYYY-MM-DD": ["আইটেম-id/slot", ..., "all"?] }।
// "all" চিহ্ন = ওই দিনের দেখানো সব ধাপ টিক হয়েছে (পরে আইটেম বদলালেও streak ঠিক থাকে)। সীমা firestore.rules-এর সাথে মেলানো।
export const LOG_DAYS_MAX = 60;
export const DAY_TICKS_MAX = 12;
export const ALL = "all";
const SLOTS = ["morning", "night", "anytime"];
const TICK_RE = /^[a-z0-9][a-z0-9-]{0,59}\/(morning|night|anytime)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const p2 = (n) => String(n).padStart(2, "0");
export const isoOf = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const fromISO = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const shiftISO = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return isoOf(d); };

export const tickKey = (itemId, slot) => itemId + "/" + slot;
export const isTickKey = (k) => typeof k === "string" && TICK_RE.test(k);

// এক দিনের তালিকা: শুধু বৈধ টিক (ডুপ্লিকেট নয়, ≤ DAY_TICKS_MAX); "all" থাকলে সবশেষে
export function sanitizeDay(v) {
  if (!Array.isArray(v)) return [];
  const ticks = [...new Set(v.filter(isTickKey))].slice(0, DAY_TICKS_MAX);
  return v.includes(ALL) && ticks.length > 0 ? [...ticks, ALL] : ticks;
}

// পুরো days: বৈধ তারিখ-key ও বৈধ টিক; খালি দিন বাদ; সবচেয়ে নতুন LOG_DAYS_MAX দিন
export function sanitizeDays(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  Object.keys(raw).filter((k) => DATE_RE.test(k)).sort().reverse().slice(0, LOG_DAYS_MAX).forEach((k) => {
    const t = sanitizeDay(raw[k]);
    if (t.length) out[k] = t;
  });
  return out;
}

// সীমার বাইরে পুরনো দিনের key (সেভের সময় মোছা হবে)
export function overflowDates(days) {
  return Object.keys(days || {}).filter((k) => DATE_RE.test(k)).sort().reverse().slice(LOG_DAYS_MAX);
}

// ট্র্যাকার-টাস্ক (পানি/পেট ডায়েরি): আজকের যত্নের কার্ডে হাতে টিক; একই careLog-এ জমা হয়, ট্র্যাকারের রিভিউ এখান থেকে পড়ে
export const TASK_WATER = "tracker-water/anytime";
export const TASK_GUT = "tracker-gut/anytime";
export const taskKeysFor = (showGut) => (showGut ? [TASK_WATER, TASK_GUT] : [TASK_WATER]);

// আজকের দেখানো ধাপ → টিক-key তালিকা (tasks = অতিরিক্ত টাস্ক-key)
export function plannedKeys(care, tasks) {
  if (!care) return [];
  const out = [];
  for (const slot of SLOTS) for (const e of care[slot] || []) { const k = tickKey(e.item.id, slot); if (!out.includes(k)) out.push(k); }
  (Array.isArray(tasks) ? tasks : []).forEach((k) => { if (isTickKey(k) && !out.includes(k)) out.push(k); });
  return out;
}

// টিক বদল: আছে = সরানো; নেই = যোগ। পরে "all" ঠিক করা (সব দেখানো ধাপ টিক হলেই)
export function toggleTick(dayTicks, key, planned) {
  if (!isTickKey(key)) return sanitizeDay(dayTicks);
  const cur = sanitizeDay(dayTicks).filter((k) => k !== ALL);
  const next = cur.includes(key) ? cur.filter((k) => k !== key) : cur.length >= DAY_TICKS_MAX ? cur : [...cur, key];
  const pl = Array.isArray(planned) ? planned : [];
  const complete = next.length > 0 && pl.length > 0 && pl.every((k) => next.includes(k));
  return complete ? [...next, ALL] : next;
}

// এক ট্যাপে "আজকের যত্ন সম্পন্ন": দেখানো সব ধাপ + "all"; ফাঁকা planned হলে খালি
export function dayDone(planned) {
  const ks = [...new Set((Array.isArray(planned) ? planned : []).filter(isTickKey))].slice(0, DAY_TICKS_MAX);
  return ks.length ? [...ks, ALL] : [];
}

export const tickCount = (dayTicks) => sanitizeDay(dayTicks).filter((k) => k !== ALL).length;
export const isDayComplete = (dayTicks) => sanitizeDay(dayTicks).includes(ALL);

// সপ্তাহের শুরু = শনিবার (হোমের "এই সপ্তাহ"-এর মতো, শনি–শুক্র)
export function weekStartISO(iso) {
  const d = fromISO(iso);
  return shiftISO(iso, -((d.getDay() + 1) % 7));
}

// ৭টি ঘর: state = "done" | "part" | "none" | "future"
export function weekCells(days, todayISO) {
  const start = weekStartISO(todayISO);
  return Array.from({ length: 7 }, (_, i) => {
    const iso = shiftISO(start, i);
    const t = (days || {})[iso];
    const count = tickCount(t);
    const state = iso > todayISO ? "future" : isDayComplete(t) ? "done" : count > 0 ? "part" : "none";
    return { iso, index: i, count, state, today: iso === todayISO };
  });
}

export function weekDoneCount(days, todayISO) {
  return weekCells(days, todayISO).filter((c) => c.state === "done").length;
}

// streak = আজ (বা আজ বাকি থাকলে গতকাল) থেকে পেছনে টানা পূর্ণ দিন
export function streakOf(days, todayISO) {
  let iso = isDayComplete((days || {})[todayISO]) ? todayISO : shiftISO(todayISO, -1);
  let n = 0;
  while (n <= LOG_DAYS_MAX && isDayComplete((days || {})[iso])) { n += 1; iso = shiftISO(iso, -1); }
  return n;
}
