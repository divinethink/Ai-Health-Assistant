// আজ ট্যাবের ছোট ইনপুট-শিটের (ওজন · স্টেপ · ঘুম) যাচাই — pure, UI/SDK-মুক্ত।
// সীমা InputTab-এর সাথে মেলে: ওজন ২–৪০০ কেজি, স্টেপ ০–১,০০,০০০ (পূর্ণসংখ্যা), ঘুম = শোয়া+ওঠা (HH:MM)।
// ফল: { value } অথবা { error } (বাংলা বার্তা)।

import { sleepMinutes } from "./trackerCalc.js";

export const WEIGHT_MIN = 2;
export const WEIGHT_MAX = 400;
export const STEPS_MAX = 100000;

function parseNum(v) {
  if (v === null || v === undefined || !String(v).trim()) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}

export function checkWeightInput(v) {
  const n = parseNum(v);
  if (n === null || Number.isNaN(n) || n < WEIGHT_MIN || n > WEIGHT_MAX) return { error: "ওজন সঠিক সংখ্যা দিন।" };
  return { value: Math.round(n * 10) / 10 };
}

export function checkStepsInput(v) {
  const n = parseNum(v);
  if (n === null || Number.isNaN(n) || n < 0 || n > STEPS_MAX || !Number.isInteger(n)) return { error: "স্টেপ সঠিক সংখ্যা দিন।" };
  return { value: n };
}

// quality: ০/null = দেওয়া হয়নি, ১–৫। ফল value = saveDaily-র { sleep, sleepMinutes }।
export function checkSleepInput(bed, wake, quality) {
  const m = sleepMinutes(bed, wake);
  if (!m) return { error: "ঘুমের জন্য শোয়ার ও ওঠার সময় দুটোই দিন।" };
  const q = Number(quality);
  return { value: { sleep: { bed, wake, quality: Number.isInteger(q) && q >= 1 && q <= 5 ? q : null }, sleepMinutes: m } };
}
