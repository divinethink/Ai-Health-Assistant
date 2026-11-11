// আজ ট্যাবের ছোট ইনপুট-শিটের (ওজন · স্টেপ · ঘুম) যাচাই — pure, UI/SDK-মুক্ত।
// সীমা InputTab-এর সাথে মেলে: ওজন ২–৪০০ কেজি, স্টেপ ০–১,০০,০০০ (পূর্ণসংখ্যা), ঘুম = শোয়া+ওঠা (HH:MM)।
// ফল: { value } অথবা { error } (বাংলা বার্তা)।

import { sleepMinutes } from "./trackerCalc.js";

export const WEIGHT_MIN = 2;
export const WEIGHT_MAX = 400;
export const STEPS_MAX = 100000;
export const HEIGHT_MIN = 30;
export const HEIGHT_MAX = 250;

function parseNum(v) {
  if (v === null || v === undefined || !String(v).trim()) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}

export function checkWeightInput(v) {
  const n = parseNum(v);
  if (n === null || Number.isNaN(n) || n < WEIGHT_MIN || n > WEIGHT_MAX) return { error: "ওজন ঠিকভাবে লিখুন (যেমন ৬৮.৫)।" };
  return { value: Math.round(n * 10) / 10 };
}

// উচ্চতা (সেমি): ৩০–২৫০, এক দশমিক পর্যন্ত। ফুট/ইঞ্চি → সেমি: cmFromFtIn।
export function checkHeightInput(v) {
  const n = parseNum(v);
  if (n === null || Number.isNaN(n) || n < HEIGHT_MIN || n > HEIGHT_MAX) return { error: "উচ্চতা ঠিকভাবে লিখুন (" + HEIGHT_MIN + "–" + HEIGHT_MAX + " সেমি)।" };
  return { value: Math.round(n * 10) / 10 };
}
export function cmFromFtIn(ft, inch) {
  const f = parseNum(ft), i = parseNum(inch);
  if (f === null && i === null) return null;
  if (Number.isNaN(f) || Number.isNaN(i)) return NaN;
  return (f || 0) * 30.48 + (i || 0) * 2.54;
}

export function checkStepsInput(v) {
  const n = parseNum(v);
  if (n === null || Number.isNaN(n) || n < 0 || n > STEPS_MAX || !Number.isInteger(n)) return { error: "স্টেপ ঠিকভাবে লিখুন (শুধু পূর্ণ সংখ্যা)।" };
  return { value: n };
}

// quality: ০/null = দেওয়া হয়নি, ১–৫। ফল value = saveDaily-র { sleep, sleepMinutes }।
export function checkSleepInput(bed, wake, quality) {
  const m = sleepMinutes(bed, wake);
  if (!m) return { error: "ঘুমের জন্য শোয়ার ও ওঠার সময় দুটোই দিন।" };
  const q = Number(quality);
  return { value: { sleep: { bed, wake, quality: Number.isInteger(q) && q >= 1 && q <= 5 ? q : null }, sleepMinutes: m } };
}
