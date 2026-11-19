// MyCare — "আজকের যত্ন" বাছাই (pure; UI/DB-মুক্ত)। আইটেম আসে শুধু careEngine থেকে, তাই অ্যালার্জি/গর্ভাবস্থা/বয়স-ছাঁকনি আপনাআপনি খাটে।
// সময়-ভাগ (সকাল/রাত/দিনের মাঝে) আইটেমের নিজের "how" লেখা থেকে নেওয়া; তালিকায় না থাকা আইটেম এখানে আসে না।
import { recommend } from "./careEngine.js";

export const ROUTINE_SLOTS = {
  "skin-gentle-cleanser": ["morning", "night"], // "সকাল ও রাতে"
  "skin-sunscreen": ["morning"],                // "বাইরে যাওয়ার আগে"
  "oral-fluoride-brushing": ["morning", "night"], // "দিনে দুবার; রাতে ঘুমানোর আগের ব্রাশ"
  "skin-moisturizer": ["anytime"],
  "oral-clean-between-teeth": ["anytime"],      // "প্রতিদিন"
  "oral-tongue-cleaning": ["anytime"],          // "দিনে একবার"
  "body-foot-care": ["anytime"],                // "পা ধোয়ার পর"
};
const CATS = ["skin", "oral", "body", "seasonal"];
const MAX = { morning: 3, night: 3, anytime: 2 };

// তারিখ → দিনের ক্রমসংখ্যা (স্থানীয় তারিখ; একই দিনে একই ফল)
export function dayIndex(date) {
  const d = date instanceof Date ? date : new Date();
  return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
}

// ফল: { mode: "normal"|"core-only"|"referral", morning:[entry], night:[entry], anytime:[entry], seasonTip: entry|null }
export function pickTodayCare(profile, items, { season, date } = {}) {
  const out = { mode: "normal", morning: [], night: [], anytime: [], seasonTip: null };
  const byId = new Map();
  const seasonal = [];
  for (const category of CATS) {
    const res = recommend(profile, items, { category, season });
    if (res.mode === "referral") return { ...out, mode: "referral" };
    if (res.mode === "core-only") out.mode = "core-only";
    for (const e of res.items) { if (category === "seasonal") seasonal.push(e); else byId.set(e.item.id, e); }
  }
  for (const id of Object.keys(ROUTINE_SLOTS)) {
    const e = byId.get(id);
    if (e) for (const slot of ROUTINE_SLOTS[id]) out[slot].push(e);
  }
  const day = dayIndex(date);
  if (out.anytime.length > MAX.anytime) {
    const n = out.anytime.length, start = day % n;
    out.anytime = Array.from({ length: MAX.anytime }, (_, k) => out.anytime[(start + k) % n]);
  }
  out.morning = out.morning.slice(0, MAX.morning);
  out.night = out.night.slice(0, MAX.night);
  if (seasonal.length) out.seasonTip = seasonal[day % seasonal.length];
  return out;
}

export const isEmptyCare = (c) => !c || c.mode === "referral" || (!c.morning.length && !c.night.length && !c.anytime.length && !c.seasonTip);
