// পেটের লক্ষণ-লগ (পার্ট ১১) — pure lib (React/Firestore নেই)।
// সংরক্ষণ: বিদ্যমান `healthRecords` Observation (type "stool-bristol", মান "১"–"৭", তারিখ) — নতুন collection/rules নেই।
// ⚠ সীমা (সচেতন): শুধু ব্যবহারকারীর নিজের দেওয়া সংখ্যা; কারণ-দাবি, রোগ-নির্ণয় বা "স্বাভাবিক/অস্বাভাবিক" রায় নেই।
//   খাবার-সম্পর্ক = শুধু পাশাপাশি দেখানো (আজকের `gut`-ট্যাগ খাবারের সংখ্যা ও আজকের স্কোর)।

import { FOODS } from "./mealPlanData.js";

export const GUT_TYPE = "stool-bristol";
export const GUT_UNIT = "Bristol";
export const MAX_GUT_PER_DAY = 8;

// ব্রিস্টল স্কেল ১–৭ — শুধু আকৃতির বর্ণনা (মূল্যায়ন নয়)
export const BRISTOL = [
  [1, "আলাদা শক্ত দলা"],
  [2, "দলা-দলা, সসেজ-আকৃতি"],
  [3, "সসেজ-আকৃতি, গায়ে ফাটা দাগ"],
  [4, "মসৃণ, সসেজ/সাপের মতো"],
  [5, "নরম টুকরো, স্পষ্ট কিনারা"],
  [6, "তুলতুলে, কাদা-কাদা"],
  [7, "পানির মতো তরল"],
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ১–৭ পূর্ণসংখ্যা (সংখ্যা বা সংখ্যা-স্ট্রিং) → সংখ্যা; নাহলে null
export function cleanScore(v) {
  const n = typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
}

// healthRecords → [{ id, date, score }] (বৈধ গুলোই; নতুন তারিখ আগে)
export function gutEntries(records) {
  return (Array.isArray(records) ? records : [])
    .filter((r) => r && r.resourceType === "observation" && r.type === GUT_TYPE && typeof r.date === "string" && ISO.test(r.date) && cleanScore(r.value) !== null)
    .map((r) => ({ id: r.id, date: r.date, score: cleanScore(r.value) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export const entriesOn = (entries, date) => (Array.isArray(entries) ? entries : []).filter((e) => e.date === date);

// যোগ করার আগে যাচাই; ত্রুটি-বার্তা অথবা null
export function checkGutAdd(score, countToday) {
  if (cleanScore(score) === null) return "ব্রিস্টল স্কেল ১ থেকে ৭-এর মধ্যে বাছুন।";
  if (countToday >= MAX_GUT_PER_DAY) return "একদিনে সর্বোচ্চ " + MAX_GUT_PER_DAY + "টি এন্ট্রি রাখা যায়।";
  return null;
}

// createHealthRecord("observation")-এর fields
export function buildGutRecord(score, date) {
  const n = cleanScore(score);
  if (n === null) throw new Error("ব্রিস্টল স্কোর ১–৭ হতে হবে");
  return { type: GUT_TYPE, value: String(n), unit: GUT_UNIT, date };
}

// আজ খাওয়া `gut`-ট্যাগ খাবারের সংখ্যা: টিক-করা স্লটের আইটেম + "আজ শুধু" খাবার (নাম ক্যাটালগের সাথে হুবহু মিললে)।
// plan = { slots: [{ id, items: [{ key }] }] } অথবা null।
export function gutFoodCount(plan, eatenIds, extras) {
  const isGut = (f) => !!f && Array.isArray(f.tg) && f.tg.includes("gut");
  const eaten = new Set(Array.isArray(eatenIds) ? eatenIds : []);
  let n = 0;
  if (plan && Array.isArray(plan.slots)) {
    plan.slots.filter((s) => eaten.has(s.id)).forEach((s) => (s.items || []).forEach((i) => { if (isGut(FOODS[i.key])) n += 1; }));
  }
  const byName = new Map(Object.values(FOODS).map((f) => [f.n, f]));
  (Array.isArray(extras) ? extras : []).forEach((x) => { if (x && isGut(byName.get(x.name))) n += 1; });
  return n;
}

// গত দিনগুলোর (dates, পুরনো → নতুন) প্রতিদিনের স্কোর-তালিকা: [{ date, scores: [..] }]
export function gutWeek(entries, dates) {
  return (Array.isArray(dates) ? dates : []).map((date) => ({ date, scores: entriesOn(entries, date).map((e) => e.score) }));
}
