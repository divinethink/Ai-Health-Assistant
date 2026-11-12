// সিয়াম/ফাস্টিং-এর দিন: পরিকল্পিত (goal.fastDays) বনাম বাস্তব। pure — UI/DB নেই।
// নিয়ম: পরিকল্পিত দিনে সকাল/স্ন্যাকস/দুপুর/বিকালের কোনো খাবার লগ বা প্ল্যান-টিক থাকলে সিয়াম রাখা হয়নি ধরা হয়।
// সেহরি/ইফতার/রাতের লগ বা কিছুই না থাকলে সিয়াম। ভুল লগ মুছলেই আবার সিয়াম — আলাদা সেভ/ফিল্ড নেই।

import { isFastDate } from "./trackerCalc.js";
import { MEAL_SLOTS, FAST_SLOTS, DAYTIME_SLOT_IDS, FAST_SLOT_IDS } from "./mealPlanData.js";

export function ateInDaytime(doc) {
  const d = doc || {};
  const extras = Array.isArray(d.extraFoods) && d.extraFoods.some((x) => x && DAYTIME_SLOT_IDS.includes(x.slot));
  const ticked = Array.isArray(d.mealsEaten) && d.mealsEaten.some((id) => DAYTIME_SLOT_IDS.includes(id));
  return extras || ticked;
}

// doc না থাকলে (ভবিষ্যৎ/খালি দিন) পরিকল্পনাই ধরা হয়।
export function fastOnDate(date, fastDays, doc) {
  return isFastDate(date, fastDays) && !ateInDaytime(doc);
}

// সেহরি/ইফতারের কোনো লগ বা টিক আছে কিনা (ateInDaytime-এর জোড়া)
export function ateInFastSlot(doc) {
  const d = doc || {};
  return (Array.isArray(d.extraFoods) && d.extraFoods.some((x) => x && FAST_SLOT_IDS.includes(x.slot))) || (Array.isArray(d.mealsEaten) && d.mealsEaten.some((id) => FAST_SLOT_IDS.includes(id)));
}

// পরিকল্পিত সিয়ামের দিনে বেলার ক্রম: সেহরি, সকাল…বিকাল, ইফতার, রাত। অন্য দিনে অপরিবর্তিত।
// doc দিলে: শুধু দিনের বেলার লগ → সেহরি/ইফতার দেখানো নয় (সিয়াম নয়); শুধু সেহরি/ইফতারের লগ → সকাল–বিকাল দেখানো নয়।
// দুই ধরনেরই লগ থাকলে বা কিছুই না থাকলে সব বেলা (লগ-করা তথ্য কখনো লুকায় না)।
export function slotsForDay(plannedFast, doc) {
  if (!plannedFast) return MEAL_SLOTS;
  const day = ateInDaytime(doc), fast = ateInFastSlot(doc);
  if (day && !fast) return MEAL_SLOTS;
  const sehri = FAST_SLOTS.find((s) => s.id === "sehri");
  const iftar = FAST_SLOTS.find((s) => s.id === "iftar");
  const out = [sehri];
  MEAL_SLOTS.forEach((s) => { if (s.id === "dinner") out.push(iftar); if (!(fast && !day && DAYTIME_SLOT_IDS.includes(s.id))) out.push(s); });
  return out;
}

// "＋ খাবার" সরাসরি চাপলে সময় অনুযায়ী ডিফল্ট বেলা (পরিকল্পিত সিয়ামের দিনে); অন্যথায় null (বিদ্যমান আচরণ)।
export function fastDefaultSlot(plannedFast, now = new Date()) {
  if (!plannedFast) return null;
  const h = now.getHours();
  if (h < 7) return "sehri";
  if (h >= 17 && h < 20) return "iftar";
  return null;
}
