// পেট ডায়েরির সতর্কতা/সারাংশ — pure lib (React/Firestore নেই)। শুধু ব্যবহারকারীর নিজের দেওয়া ব্রিস্টল-স্কোর থেকে।
// ⚠ সীমা: রোগনির্ণয়/কারণ-দাবি নয়; ভাষা "লক্ষণ/মিল দেখা গেছে" ধরনের — "খাওয়া যাবে না" নয়।
import { shiftISO } from "./dateNav.js";
import { entriesOn } from "./gutLog.js";

export const ALERT_LOW = 2;   // ≤২ = শক্ত/কষ্টকর
export const ALERT_HIGH = 5;  // ≥৫ = নরম থেকে তরল
export const isOffScore = (s) => s <= ALERT_LOW || s >= ALERT_HIGH;

const scoresOn = (entries, date) => entriesOn(entries, date).map((e) => e.score);

// দিনের অবস্থা: none (এন্ট্রি নেই) | ok (সব ৩–৪) | off (কোনো স্কোর ≤২ বা ≥৫)
export function dayState(scores) {
  if (!scores || !scores.length) return "none";
  return scores.some(isOffScore) ? "off" : "ok";
}

// টানা ২ দিন "off" হলে সতর্কতা। আজ এন্ট্রি থাকলে আজ+গতকাল, নইলে গতকাল+তার আগের দিন।
// → null | { kind: "hard"|"loose"|"mixed", dates: [d1, d2] }
export function gutAlert(entries, today) {
  const anchor = scoresOn(entries, today).length ? today : shiftISO(today, -1);
  const prev = shiftISO(anchor, -1);
  const a = scoresOn(entries, anchor), b = scoresOn(entries, prev);
  if (dayState(a) !== "off" || dayState(b) !== "off") return null;
  const off = [...a, ...b].filter(isOffScore);
  const kind = off.every((s) => s >= ALERT_HIGH) ? "loose" : off.every((s) => s <= ALERT_LOW) ? "hard" : "mixed";
  return { kind, dates: [prev, anchor] };
}

// টানা ৩ দিন প্রতিদিন কোনো স্কোর ≥৬ (তরল-ধরন) → পানিশূন্যতা-সতর্কতার সাধারণ পরামর্শ
export function looseStreak3(entries, today) {
  const anchor = scoresOn(entries, today).length ? today : shiftISO(today, -1);
  return [0, 1, 2].every((i) => scoresOn(entries, shiftISO(anchor, -i)).some((s) => s >= 6));
}

// সপ্তাহ-বার: [{ date, state, score }] — score = ওই দিনের সবচেয়ে "অস্বাভাবিক" স্কোর (৪ থেকে সবচেয়ে দূরের)
export function weekBars(entries, dates) {
  return (dates || []).map((date) => {
    const sc = scoresOn(entries, date);
    const far = sc.slice().sort((x, y) => Math.abs(y - 4) - Math.abs(x - 4))[0];
    return { date, state: dayState(sc), score: sc.length ? far : null };
  });
}
