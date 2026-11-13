// ব্যায়াম-টার্গেট (focusAreas) ও ঘরোয়া (সরঞ্জাম ছাড়া) সাপ্তাহিক প্ল্যান — pure functions (React/Firestore নেই)।
// AI নয়: বাছাই-করা স্থির তালিকা + ফিক্সড নিয়ম। সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।
// ভিত্তি: WHO ২০২০ (সপ্তাহে ১৫০–৩০০ মিনিট মাঝারি + অন্তত ২ দিন পেশির ব্যায়াম); ACSM রেজিস্ট্যান্স-ট্রেনিং নির্দেশিকা
// (প্রতি বড় পেশিগোষ্ঠী সপ্তাহে ২–৩ দিন, মাঝে বিশ্রাম; ২–৩ সেট × ৮–১৫ বার; ধীরে কঠিনতা বাড়ানো)।
// সংরক্ষণ: goal-ডকের ঐচ্ছিক `focusAreas` (≤৩ আইডি)। কার্যকর রুটিন = এই বেস + "আমার প্ল্যান" (planPrefs.exercise) — সম্পাদনা বিদ্যমান পথেই।
// আইটেম-key: প্রথম গোনা-হওয়া "main", এরপর "x2","x3"…, স্ট্রেচিং "stretch" (applyExercisePrefs-এর সাথে মেলে → টিক ভাঙে না)।

import { EXERCISE_TYPES } from "./planPrefs.js";
import { bnNum } from "../../shared/dates.js";

export const MAX_FOCUS = 3;

// id → { label, femaleOnly? }। rules-এর allow-list (firestore.rules trackerPlanFieldsOk) ও এই তালিকা একই রাখতে হবে।
export const FOCUS_AREAS = {
  muscle: { label: "পেশি গঠন" },
  belly: { label: "পেটের চর্বি কমানো" },
  chest: { label: "চেস্ট গঠন" },
  arms: { label: "হাত (বাহু) গঠন" },
  legs: { label: "পা/নিচের শরীর" },
  glute: { label: "বাট (নিতম্ব) গঠন", femaleOnly: true },
  core: { label: "কোর/পেটের পেশি" },
  posture: { label: "স্ট্রেচিং ও শরীরের ভঙ্গি" },
};
export const FOCUS_IDS = Object.keys(FOCUS_AREAS);

// sex দিলে: মহিলা-ছাড়া `femaleOnly` বাদ। sex না দিলে (সংরক্ষণের স্তর) শুধু আইডি-যাচাই। ডুপ্লিকেট বাদ, সর্বোচ্চ MAX_FOCUS।
export function sanitizeFocusAreas(raw, sex) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((id) => {
    if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(FOCUS_AREAS, id) || out.includes(id)) return;
    if (sex !== undefined && FOCUS_AREAS[id].femaleOnly && sex !== "female") return;
    out.push(id);
  });
  return out.slice(0, MAX_FOCUS);
}

// সদস্যের জন্য নির্বাচনযোগ্য তালিকা
export function focusOptions(sex) {
  return FOCUS_IDS.filter((id) => !FOCUS_AREAS[id].femaleOnly || sex === "female").map((id) => ({ id, label: FOCUS_AREAS[id].label }));
}

// প্ল্যানে ব্যবহারের ctx। ১৮ বছরের কম বা গর্ভাবস্থায় টার্গেট-প্ল্যান নয় (null → সাধারণ প্ল্যান)।
// lowImpact = ৬৫+ বা হৃদরোগ/উচ্চ রক্তচাপ/হাঁপানি/কিডনি/পেটের সমস্যা: লাফ/তীব্র/আইসোমেট্রিক-ভারী আইটেম বাদ।
export function focusCtxOf({ goal, sex, age, flags, condKeys }) {
  if (age === null || age === undefined || age < 18 || (flags && flags.pregnant)) return null;
  const areas = sanitizeFocusAreas(goal && goal.focusAreas, sex);
  if (!areas.length) return null;
  const ck = condKeys || [];
  const gut = ck.includes("gut"); // IBS/গ্যাস্ট্রিক: পেটে চাপ পড়া ব্যায়াম বদলে নরম বিকল্প
  const lowImpact = age >= 65 || ck.includes("heart") || ck.includes("hypertension") || ck.includes("asthma") || !!(flags && flags.kidney) || gut;
  return { areas, senior: age >= 65, lowImpact, softCore: gut };
}

// ---------- ব্যায়াম-নির্দেশনা (সেট/বার/টিপ) ----------
const D = (sets, tip) => ({ sets, tip });
export const EXERCISE_DETAIL = {
  squat: D("৩ সেট × ১০–১৫ বার", "পা কাঁধ-সমান চওড়া, হাঁটু পায়ের আঙুলের দিকে, পিঠ সোজা। কঠিন করতে ধীরে নামুন।"),
  pushup: D("৩ সেট × ৮–১২ বার", "শরীর সোজা রাখুন। কঠিন লাগলে হাঁটু মাটিতে বা দেয়ালে হাত রেখে করুন; সহজ হলে পা উঁচুতে রাখুন।"),
  lunges: D("৩ সেট × প্রতি পায়ে ৮–১০ বার", "সামনের হাঁটু পায়ের আঙুলের বেশি এগোবে না। ভারসাম্য না পেলে দেয়াল ধরুন।"),
  mountain: D("৩ সেট × ২০–৩০ সেকেন্ড", "হাত কাঁধের নিচে, কোমর নিচু রাখুন; ধীরে শুরু করুন।"),
  glute: D("৩ সেট × ১২–১৫ বার", "চিত হয়ে হাঁটু ভাঁজ করে কোমর উঁচু করুন, ১–২ সেকেন্ড ধরে নামান; নিতম্বে চাপ অনুভব করুন।"),
  plank: D("৩ সেট × ২০–৪০ সেকেন্ড", "শরীর সোজা, কোমর ঝুলবে না; দম আটকাবেন না। কঠিন লাগলে হাঁটু মাটিতে।"),
  situp: D("৩ সেট × ১০–১৫ বার", "ঘাড়ে টান দেবেন না; পিঠে ব্যথা হলে বাদ দিন।"),
  crunch: D("৩ সেট × ১০–১৫ বার", "ঘাড়ে টান দেবেন না; কোমর মাটিতে লাগিয়ে রাখুন।"),
  bicycle: D("৩ সেট × প্রতি পাশে ১০–১২ বার", "ধীরে ও নিয়ন্ত্রণে করুন; ঘাড় টানবেন না।"),
  legraise: D("৩ সেট × ৮–১২ বার", "কোমর মাটি থেকে উঠতে দেবেন না; পিঠে ব্যথা হলে বাদ দিন।"),
  tricepdip: D("৩ সেট × ৮–১২ বার", "শক্ত চেয়ার/খাটের কিনারায়; কাঁধে ব্যথা হলে থামুন।"),
  wallsit: D("৩ সেট × ২০–৪০ সেকেন্ড", "দেয়ালে পিঠ, হাঁটু প্রায় ৯০°; দম আটকাবেন না।"),
  stepup: D("৩ সেট × প্রতি পায়ে ৮–১০ বার", "মজবুত নিচু ধাপে উঠুন; ধরার কিছু কাছে রাখুন।"),
  superman: D("৩ সেট × ১০–১২ বার", "উপুড় হয়ে হাত-পা ধীরে তুলে ১–২ সেকেন্ড ধরুন; ঘাড় সোজা রাখুন।"),
  birddog: D("৩ সেট × প্রতি পাশে ৮–১০ বার", "চার হাত-পায়ে থেকে উল্টো হাত-পা বাড়ান; কোমর স্থির রাখুন।"),
  chairstand: D("৩ সেট × ৮–১২ বার", "চেয়ারে বসে উঠুন-বসুন; দেয়াল বা টেবিল কাছে রাখুন।"),
  jacks: D("৩ সেট × ৩০ সেকেন্ড", "হাঁটুতে ব্যথা থাকলে বাদ দিন; নরম মেঝেতে করুন।"),
  yoga: D("২০–৩০ মিনিট", "ধীরে, শ্বাস স্বাভাবিক রেখে; ব্যথা হলে থামুন।"),
};
export function exerciseDetail(type) {
  return Object.prototype.hasOwnProperty.call(EXERCISE_DETAIL, type) ? EXERCISE_DETAIL[type] : null;
}

// ---------- নির্বাচন-নিয়ম ----------
// প্রতি টার্গেটের ব্যায়ামের অগ্রাধিকার-তালিকা (শুধু EXERCISE_TYPES-এ থাকা টাইপ)।
const POOLS = {
  muscle: ["pushup", "squat", "lunges", "tricepdip", "plank", "glute", "superman"],
  belly: ["plank", "bicycle", "mountain", "legraise", "crunch"],
  chest: ["pushup", "tricepdip", "plank", "mountain"],
  arms: ["tricepdip", "pushup", "plank", "superman"],
  legs: ["squat", "lunges", "stepup", "wallsit", "glute"],
  glute: ["glute", "squat", "lunges", "stepup", "birddog"],
  core: ["plank", "birddog", "crunch", "legraise", "bicycle", "superman"],
  posture: ["superman", "birddog", "glute", "plank"],
};
const HIGH = new Set(["burpee", "hiit", "jacks", "highknee", "skipping", "mountain", "wallsit"]); // lowImpact-এ বাদ
const SENIOR_MAP = { squat: "chairstand", lunges: "stepup", situp: "birddog", crunch: "birddog", bicycle: "birddog", legraise: "birddog", tricepdip: "superman" };
const SOFT_CORE_MAP = { crunch: "birddog", situp: "birddog", bicycle: "birddog", legraise: "birddog" }; // পেটের সমস্যায় (softCore)
const LOWER = new Set(["squat", "lunges", "stepup", "glute", "chairstand", "wallsit"]);
const UPPER_CORE = new Set(["pushup", "tricepdip", "plank", "superman", "birddog", "crunch", "bicycle", "legraise", "situp", "mountain"]);

const item = (type, min, key) => { const t = EXERCISE_TYPES[type]; return { key, type, label: t.label, min, counted: t.counted }; };

function norm(type, ctx) {
  let t = ctx.senior && SENIOR_MAP[type] ? SENIOR_MAP[type] : type;
  if (ctx.softCore && SOFT_CORE_MAP[t]) t = SOFT_CORE_MAP[t];
  if (ctx.lowImpact && HIGH.has(t)) return null;
  return Object.prototype.hasOwnProperty.call(EXERCISE_TYPES, t) ? t : null;
}

// শক্তির দিনের ব্যায়াম-তালিকা (≤৪, ডুপ্লিকেট নেই)। s = ০,১,২ (সেশন-নম্বর) — তালিকা ঘুরিয়ে বৈচিত্র্য আনে।
export function pickStrength(areas, s, ctx) {
  const pools = areas.map((a) => [...new Set(POOLS[a].map((t) => norm(t, ctx)).filter(Boolean))]);
  const picks = [];
  for (let round = 0; picks.length < 4 && round < 8; round++) {
    for (let k = 0; k < pools.length && picks.length < 4; k++) {
      const p = pools[k];
      if (!p.length) continue;
      const t = p[(s + round) % p.length];
      if (!picks.includes(t)) picks.push(t);
    }
  }
  // ভারসাম্য: অন্তত একটা নিচের শরীরের ও একটা উপরের/কোর ব্যায়াম (এক দিকে ঝোঁক এড়াতে)
  const ensure = (set, fallback) => {
    if (picks.some((t) => set.has(t))) return;
    const f = norm(fallback, ctx);
    if (!f || picks.includes(f)) return;
    if (picks.length >= 4) picks[picks.length - 1] = f; else picks.push(f);
  };
  ensure(LOWER, "squat");
  ensure(UPPER_CORE, "plank");
  return picks;
}

const WARM = 6, SET_MIN = 6, STRETCH_MIN = 10;

// ওজন-লক্ষ্য অনুযায়ী ঝোঁক (goalType: lose/gain/muscle/fit)। না দিলে/fit হলে আগের আচরণ হুবহু।
// lose: কার্ডিও দীর্ঘ (৪০ মি.) + শক্তির ব্যায়াম থাকে (পেশি ধরে রাখতে)। gain/muscle: শক্তির সেশন দীর্ঘ (প্রতি ব্যায়াম ৮ মি.), কার্ডিও হালকা (২০ মি.)।
export const isLoseGoal = (g) => g === "lose";
export const isGainGoal = (g) => g === "gain" || g === "muscle";

// বেস-প্ল্যান (শনি…শুক্র): শনি/সোম/বুধ = শক্তি (মাঝে বিশ্রামসহ), রবি/মঙ্গল = কার্ডিও, বৃহ = হালকা, শুক্র = বিশ্রাম।
export function focusPlan({ areas, senior, lowImpact, softCore, goalType }) {
  const ctx = { senior: !!senior, lowImpact: !!lowImpact, softCore: !!softCore };
  const belly = areas.includes("belly"), posture = areas.includes("posture");
  const lose = isLoseGoal(goalType), gain = isGainGoal(goalType);
  const setMin = gain ? 8 : SET_MIN;
  const stretch = () => item("stretch", STRETCH_MIN, "stretch");
  const strengthDay = (s) => {
    const list = [item("walk", WARM, "main")];
    pickStrength(areas, s, ctx).forEach((t, i) => list.push(item(t, setMin, "x" + (i + 2))));
    list.push(stretch());
    return list;
  };
  const cardio = () => {
    if (lose) return belly && !ctx.lowImpact ? [item("walk", 30, "main"), item("jacks", 10, "x2"), stretch()] : [item("walk", 40, "main"), stretch()];
    if (gain) return [item("walk", 20, "main"), stretch()];
    if (belly && !ctx.lowImpact) return [item("walk", 25, "main"), item("jacks", 10, "x2"), stretch()];
    return [item("walk", belly ? 40 : 30, "main"), stretch()];
  };
  const light = posture ? [item("yoga", 25, "main"), stretch()] : [item("walk", lose || belly ? 30 : 20, "main"), stretch()];
  const routine = [strengthDay(0), cardio(), strengthDay(1), cardio(), strengthDay(2), light, []];
  const names = areas.map((a) => FOCUS_AREAS[a].label).join(", ");
  // লক্ষ্য-মিনিট কখনো রুটিনের আসল মোট মিনিটের বেশি নয় (ব্যাজ/প্রগ্রেস মিথ্যা হবে না)
  const planned = routine.reduce((a, day) => a + day.filter((i) => i.counted).reduce((x, i) => x + i.min, 0), 0);
  const desired = lose ? 180 : belly ? 180 : 150;
  return {
    band: senior ? "senior" : "adult", weeklyTargetMin: Math.min(desired, planned), routine, focus: areas, lowImpact: ctx.lowImpact, softCore: ctx.softCore,
    summary: "আপনার টার্গেট: " + names + "। ঘরে সরঞ্জাম ছাড়া সপ্তাহে ৩ দিন শক্তির ব্যায়াম, ২ দিন কার্ডিও, বাকি হালকা/বিশ্রাম।" + (senior ? " ৬৫+ হলে ধীরে শুরু করুন; হালকা বিকল্প রাখা হয়েছে।" : ""),
  };
}

// "কেন এই প্ল্যান?"-এর জন্য ব্যাখ্যা (বাংলা, সূত্রসহ)
// ওজন-লক্ষ্যের সাথে প্ল্যান কীভাবে মিলেছে — এক লাইন (fit/অজানা হলে null)
export function goalExerciseLine(goalType, weeklyMin) {
  if (isLoseGoal(goalType)) return "আপনার লক্ষ্য ‘ওজন কমানো’: কার্ডিও বেশি (সাপ্তাহিক লক্ষ্য " + (weeklyMin ? bnNum(weeklyMin) + " মিনিট, " : "") + "WHO: ১৫০–৩০০) এবং শক্তির ব্যায়ামও আছে, যাতে ওজন কমার সময় পেশি কম ক্ষয় হয়। ওজন কমার মূল চালিকা মিল-প্ল্যানের ক্যালরি; ব্যায়াম তাতে সাহায্য করে।";
  if (isGainGoal(goalType)) return "আপনার লক্ষ্য ‘" + (goalType === "muscle" ? "পেশি গঠন" : "ওজন বাড়ানো") + "’: শক্তির ব্যায়ামে বেশি সময় (প্রতি ব্যায়ামে বেশি সেট), কার্ডিও হালকা রাখা হয়েছে। পেশি বাড়াতে ক্যালরি সামান্য বেশি ও পর্যাপ্ত প্রোটিন লাগে — মিল-প্ল্যান দেখুন।";
  return null;
}

export function focusExplain(areas, { lowImpact, softCore, goalType, weeklyMin } = {}) {
  const a = sanitizeFocusAreas(areas);
  if (!a.length) return [];
  const out = ["আপনার বাছা টার্গেট: " + a.map((x) => FOCUS_AREAS[x].label).join(", ") + "।"];
  const gl = goalExerciseLine(goalType, weeklyMin);
  if (gl) out.push(gl);
  out.push("সপ্তাহে ৩ দিন (শনি/সোম/বুধ) শক্তির ব্যায়াম, মাঝে বিশ্রাম — ACSM: প্রতি বড় পেশিগোষ্ঠী সপ্তাহে ২–৩ দিন, ২–৩ সেট × ৮–১৫ বার; সহজ হলে সেট/বার/কঠিনতা ধীরে বাড়ান। WHO: সপ্তাহে অন্তত ২ দিন পেশির ব্যায়াম ও ১৫০ মিনিট মাঝারি কার্ডিও।");
  out.push("প্রতিদিন শুরুতে গা-গরম (হালকা হাঁটা), শেষে স্ট্রেচিং। প্রতিটি ব্যায়ামের সেট/বার ও টিপ ‘নির্দেশনা’ ট্যাবে।");
  out.push("এক টার্গেটের সাথে নিচের শরীর ও উপরের শরীর/কোরের একটি করে ব্যায়ামও রাখা হয়, যাতে এক দিকে ঝোঁক না হয়।");
  if (a.includes("belly")) out.push("পেটের চর্বি: এক জায়গার চর্বি আলাদা করে কমানো যায় না (গবেষণায় শুধু পেটের ব্যায়ামে পেটের চর্বি আলাদা কমেনি)। তাই কার্ডিও + কোর + মিল-প্ল্যানের ক্যালরি একসাথে কাজ করে; সাপ্তাহিক লক্ষ্য একটু বেশি (১৮০ মিনিট)।");
  if (a.includes("muscle") || a.includes("chest") || a.includes("arms")) out.push("পেশি বাড়াতে ব্যায়াম ক্লান্তির কাছাকাছি পর্যন্ত করা এবং ধীরে কঠিন করা (যেমন পা উঁচুতে পুশ-আপ, ধীরে নামা) জরুরি। পর্যাপ্ত প্রোটিন ও ঘুমও লাগে — মিল-প্ল্যান দেখুন। আরও ভারী প্রশিক্ষণ লাগলে সরঞ্জাম লাগতে পারে।");
  if (a.includes("glute") || a.includes("legs")) out.push("গ্লুট ব্রিজ, স্কোয়াট, লাঞ্জ ও স্টেপ-আপ নিতম্ব ও পায়ের বড় পেশি কাজ করায়; ধাপে কঠিনতা বাড়ালে সরঞ্জাম ছাড়াও উপকার হয়।");
  if (a.includes("posture")) out.push("ভঙ্গির জন্য পিঠ ও কোরের স্থিতিশীলতার ব্যায়াম (সুপারম্যান, বার্ড-ডগ) ও যোগ/স্ট্রেচিং রাখা হয়েছে। দীর্ঘক্ষণ এক ভঙ্গিতে না বসে মাঝে মাঝে উঠুন।");
  if (lowImpact) out.push("বয়স বা স্বাস্থ্য-অবস্থার (হৃদরোগ, উচ্চ রক্তচাপ, হাঁপানি, কিডনি, পেটের সমস্যা) কারণে লাফ ও তীব্র ব্যায়াম বাদ দিয়ে কম-ধাক্কার বিকল্প রাখা হয়েছে। শুরুর আগে ডাক্তারের সাথে কথা বলুন।");
  if (softCore) out.push("পেটের সমস্যা (IBS/গ্যাস্ট্রিক) থাকায় পেটে চাপ দেওয়া ব্যায়াম (ক্রাঞ্চ, লেগ-রেইজ, সাইকেল) বদলে নরম বিকল্প (বার্ড-ডগ) রাখা হয়েছে। খাওয়ার ঠিক পরে ব্যায়াম নয়।");
  return out;
}
