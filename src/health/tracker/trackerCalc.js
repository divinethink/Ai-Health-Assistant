// হেলথ ট্র্যাকার — ফিক্সড সূত্রের হিসাব (pure functions, AI জড়িত নয়)।
// Mifflin-St Jeor BMR × কার্যকলাপ-গুণক। UI/Firestore থেকে সম্পূর্ণ আলাদা।

export const GOAL_LABELS = { lose: "ওজন কমানো", gain: "ওজন বাড়ানো", fit: "ফিট থাকা", muscle: "পেশি গঠন" };
export const ACTIVITY_LABELS = { low: "কম", medium: "মাঝারি", high: "বেশি" };
export const ACTIVITY_FACTOR = { low: 1.2, medium: 1.55, high: 1.725 };
export const MIN_KCAL = { female: 1200, male: 1500 };
const KCAL_PER_KG = 7700;
const MAX_LOSS_KG_WEEK = 0.5;
const MAX_GAIN_KG_WEEK = 0.25;

export function ageYears(dobISO, now = new Date()) {
  if (!dobISO) return null;
  const d = new Date(dobISO + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

export function bmiOf(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  return weightKg / Math.pow(heightCm / 100, 2);
}

// নিরাপত্তা-গেট: শিশু/কিশোর (<১৮), গর্ভবতী/দুগ্ধদানকারী, ৬৫+, ডায়াবেটিস, কিডনি রোগ
// → কোনো ক্যালরি-টার্গেট দেওয়া হবে না; শুধু সাধারণ গাইড + ডাক্তারের পরামর্শ।
export function safetyGate({ age, flags }) {
  const f = flags || {};
  if (age === null || age === undefined) return { blocked: true, reason: "বয়স জানা নেই — প্রোফাইলে জন্মতারিখ দিন।" };
  if (age < 18) return { blocked: true, reason: "শিশু/কিশোরদের জন্য অ্যাপ ক্যালরি কমানোর বা বাড়ানোর টার্গেট দেয় না।" };
  if (f.pregnant) return { blocked: true, reason: "গর্ভাবস্থা/দুগ্ধদানকালে ক্যালরির টার্গেট ডাক্তারের সাথে ঠিক করুন।" };
  if (f.diabetes || f.kidney) return { blocked: true, reason: "ডায়াবেটিস/কিডনি রোগে খাদ্য ও ক্যালরির টার্গেট ডাক্তারের সাথে ঠিক করুন।" };
  if (age >= 65) return { blocked: true, reason: "৬৫+ বয়সে ক্যালরির টার্গেট ডাক্তারের সাথে ঠিক করুন।" };
  return { blocked: false, reason: null };
}

export function computeGoal({ goalType, activity, sex, age, heightCm, weightKg, targetWeightKg, weeks, flags }) {
  const gate = safetyGate({ age, flags });
  if (gate.blocked) return { blocked: true, reason: gate.reason };
  if (!GOAL_LABELS[goalType]) return { error: "লক্ষ্য বাছুন।" };
  if (!ACTIVITY_FACTOR[activity]) return { error: "কার্যকলাপ বাছুন।" };
  if (sex !== "male" && sex !== "female") return { error: "প্রোফাইলে লিঙ্গ (পুরুষ/মহিলা) দিন।" };
  if (!heightCm || heightCm <= 0) return { error: "প্রোফাইলে উচ্চতা যোগ করুন (Health → প্রোফাইল)।" };
  if (!weightKg || weightKg <= 0) return { error: "প্রোফাইলে ওজন যোগ করুন (Health → প্রোফাইল)।" };

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[activity];
  const notes = [];
  let weeklyRateKg = 0;
  let target = tdee;

  if (goalType === "lose" || goalType === "gain") {
    const tw = Number(targetWeightKg);
    const wk = Number(weeks);
    if (!tw || tw <= 0 || !wk || wk <= 0) return { error: "লক্ষ্য ওজন ও সময় (সপ্তাহ) দিন।" };
    if (goalType === "lose") {
      const bmiNow = bmiOf(weightKg, heightCm);
      if (bmiNow < 18.5) return { blocked: true, reason: "আপনার ওজন ইতিমধ্যে কম। ওজন কমানোর টার্গেট দেওয়া হবে না।" };
      if (tw >= weightKg) return { error: "লক্ষ্য ওজন বর্তমান ওজনের চেয়ে কম হতে হবে।" };
      if (bmiOf(tw, heightCm) < 18.5) return { error: "লক্ষ্য ওজন কম-ওজনের সীমায় পড়ে। একটু বেশি ওজন দিন।" };
      const cap = Math.min(MAX_LOSS_KG_WEEK, weightKg * 0.01);
      const wanted = (weightKg - tw) / wk;
      weeklyRateKg = Math.min(wanted, cap);
      if (wanted > cap) notes.push("টার্গেট নিরাপদ সীমায় আনা হয়েছে: প্রতি সপ্তাহে সর্বোচ্চ " + (Math.round(cap * 100) / 100) + " কেজি।");
      target = tdee - (weeklyRateKg * KCAL_PER_KG) / 7;
    } else {
      if (tw <= weightKg) return { error: "লক্ষ্য ওজন বর্তমান ওজনের চেয়ে বেশি হতে হবে।" };
      if (bmiOf(tw, heightCm) >= 25) return { error: "লক্ষ্য ওজন অতিরিক্ত-ওজনের সীমায় পড়ে। একটু কম ওজন দিন।" };
      const wanted = (tw - weightKg) / wk;
      weeklyRateKg = Math.min(wanted, MAX_GAIN_KG_WEEK);
      if (wanted > MAX_GAIN_KG_WEEK) notes.push("টার্গেট নিরাপদ সীমায় আনা হয়েছে: প্রতি সপ্তাহে সর্বোচ্চ " + MAX_GAIN_KG_WEEK + " কেজি।");
      target = tdee + (weeklyRateKg * KCAL_PER_KG) / 7;
    }
  } else if (goalType === "muscle") {
    target = tdee + 250;
    weeklyRateKg = 0.25;
  }

  const floor = MIN_KCAL[sex];
  if (target < floor) {
    target = floor;
    notes.push("ন্যূনতম নিরাপদ ক্যালরির (" + floor + ") নিচে টার্গেট যায় না।");
  }
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee),
    calorieTarget: Math.round(target / 10) * 10,
    weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
    notes,
  };
}

// বয়সভিত্তিক সাধারণ ঘুমের ঘণ্টা (সাধারণ গাইড, রোগ নির্ণয় নয়)
export function sleepTargetHours(age) {
  if (age === null || age === undefined) return [7, 9];
  if (age < 3) return [11, 14];
  if (age < 6) return [10, 13];
  if (age < 13) return [9, 12];
  if (age < 18) return [8, 10];
  if (age < 65) return [7, 9];
  return [7, 8];
}

// বয়সভিত্তিক সাধারণ পানির লক্ষ্য (গ্লাস/দিন) — সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।
// কিডনি রোগ বা <২ বছর → null (লক্ষ্য নেই: ডাক্তার/শিশুর দুধের নির্দেশ) — ব্যক্তিগত ওভাররাইডও এটা এড়াতে পারে না।
// বয়স অজানা → ৮ (আগের আচরণ)। ব্যান্ড: ২–৪ = ৪, ৫–১২ = ৬, ১৩+ = ৮।
// override (ঐচ্ছিক, goal.waterTarget): ১–২০ পূর্ণসংখ্যা হলে ব্যান্ডের বদলে সেটা; অবৈধ হলে উপেক্ষা (ব্যান্ডই চলে)।
export const WATER_TARGET_MIN = 1;
export const WATER_TARGET_MAX = 20;
export function sanitizeWaterTarget(raw) {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return Number.isInteger(n) && n >= WATER_TARGET_MIN && n <= WATER_TARGET_MAX ? n : null;
}
export function checkWaterTargetInput(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null; // খালি = ডিফল্ট
  return sanitizeWaterTarget(raw) === null ? "পানির লক্ষ্য " + WATER_TARGET_MIN + "–" + WATER_TARGET_MAX + " এর মধ্যে পূর্ণসংখ্যা দিন।" : null;
}
export function waterTargetFor(age, flags, override) {
  if (flags && flags.kidney) return null;
  const hasAge = !(age === null || age === undefined || Number.isNaN(age));
  if (hasAge && age < 2) return null;
  const o = sanitizeWaterTarget(override);
  if (o !== null) return o;
  if (!hasAge) return 8;
  if (age < 5) return 4;
  if (age < 13) return 6;
  return 8;
}

// ---------- উপবাস-দিবস মোড (পার্ট ১০) ----------
// goal.fastDays = সর্বোচ্চ ২টি সপ্তাহ-দিনের সূচক, শনি=০ … শুক্র=৬ (exercisePlanData.bdDayIndex-এর মতো)।
// সেফটি-গেট ব্লক হলে (<১৮, গর্ভবতী, ডায়াবেটিস, কিডনি, ৬৫+, বয়স অজানা) মোড বন্ধ — সেভ-যাচাই ও পড়া, দুই পথেই; UI এড়াতে পারে না।
export const MAX_FAST_DAYS = 2;
// Approved Deviation (১০ নভেম্বর ২০২৬, owner): সিয়াম/ফাস্টিং মোড সবার জন্য খোলা; আগের ব্লক-গ্রুপে শুধু সতর্কতা।
export const FAST_WARN_REASON = "⚠ আপনার ক্ষেত্রে (বয়স/শারীরিক অবস্থা) সিয়াম/ফাস্টিং-এর আগে ডাক্তারের পরামর্শ নিন। শরীর খারাপ লাগলে সিয়াম/ফাস্টিং ভাঙুন।";

export function sanitizeFastDays(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((x) => { if (Number.isInteger(x) && x >= 0 && x <= 6 && !out.includes(x)) out.push(x); });
  return out.sort((a, b) => a - b).slice(0, MAX_FAST_DAYS);
}
export function fastModeGate({ age, flags }) {
  const g = safetyGate({ age, flags });
  return g.blocked ? { blocked: false, warn: true, reason: FAST_WARN_REASON } : { blocked: false, warn: false, reason: null };
}
// পড়ার পথ: গেট ব্লক হলে সংরক্ষিত মান থাকলেও [] (পরে ডায়াবেটিস/বয়স ইত্যাদি বদলালে আপনা-আপনি বন্ধ)
export function activeFastDays(goal, { age, flags }) {
  return sanitizeFastDays(goal && goal.fastDays);
}
// সেভের আগে যাচাই: ত্রুটি-বার্তা অথবা null। খালি তালিকা (মোড বন্ধ করা) সবসময় বৈধ।
export function checkFastDaysInput(raw, { age, flags }) {
  if (!Array.isArray(raw)) return "সিয়াম/ফাস্টিং-এর দিন বাছুন।";
  if (raw.length === 0) return null;
  if (raw.length > MAX_FAST_DAYS) return "সর্বোচ্চ " + MAX_FAST_DAYS + " দিন বাছা যায়।";
  if (sanitizeFastDays(raw).length !== raw.length) return "অবৈধ দিন।";
  return null;
}
// dateISO "YYYY-MM-DD" → শনি=০ … শুক্র=৬
export function weekdayIndexOf(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : (d.getDay() + 1) % 7;
}
export function isFastDate(dateISO, fastDays) {
  if (!Array.isArray(fastDays) || fastDays.length === 0) return false;
  const i = weekdayIndexOf(dateISO);
  return i !== null && fastDays.includes(i);
}

// WHO সাধারণ গাইড: প্রাপ্তবয়স্ক সপ্তাহে ১৫০ মিনিট (দৈনিক ~৩০), শিশু-কিশোর দৈনিক ৬০ মিনিট
export function exerciseTargetMinPerDay(age) {
  return age !== null && age !== undefined && age < 18 ? 60 : 30;
}
export function stepsTarget(age) {
  return age !== null && age !== undefined && age >= 18 ? 7000 : null;
}

export function sleepMinutes(bed, wake) {
  if (!/^\d{2}:\d{2}$/.test(bed || "") || !/^\d{2}:\d{2}$/.test(wake || "")) return null;
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  let diff = (wh * 60 + wm) - (bh * 60 + bm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

// গর্ভাবস্থা/বুকের দুধ (ধাপ ৬): একবার প্রোফাইলে condition-রেকর্ড হিসেবে সেভ হয় — ট্র্যাকার, খাবার-নিয়ম, AI ও ডাক্তার-রিপোর্ট সবাই এটাই পড়ে।
// নাম মেলানো ইচ্ছাকৃতভাবে সংকীর্ণ ("গর্ভাশয়ের সিস্ট" ইত্যাদি যেন ভুলে না মেলে); ডায়েট-নিয়মের alias-এর সাথে সংগতিপূর্ণ।
export const PREGNANCY_NAME_RE = /গর্ভাবস্থা|গর্ভবতী|গর্ভকালীন|প্রেগন্যান্ট|pregnan|breast\s*-?\s*feed|lactat|বুকের দুধ|দুগ্ধদান|স্তন্যদান/i;
export const PREGNANCY_CONDITION_NAME = "গর্ভাবস্থা / বুকের দুধ";
export function pregnancyRecordsOf(records) {
  return (records || []).filter((r) => r.resourceType === "condition" && PREGNANCY_NAME_RE.test(r.name || ""));
}
// রেকর্ড আছে (যেকোনো অবস্থায়) → রেকর্ডই সত্য (resolved = বন্ধ)। রেকর্ড কখনো না থাকলে পুরনো ট্র্যাকার-টগল (goal.flags.pregnant) — যাতে
// স্থানান্তরের আগে সুরক্ষা হারায় না, আর স্থানান্তরের পর টগল বন্ধ করা যায়।
export function effectivePregnant(goal, records) {
  const recs = pregnancyRecordsOf(records);
  if (recs.length) return recs.some((r) => r.status !== "resolved");
  return !!(goal && goal.flags && goal.flags.pregnant);
}

// প্রোফাইলের রোগ-তালিকা থেকে ডায়াবেটিস/কিডনি আগে-থেকে-টিক (ব্যবহারকারী বদলাতে পারবেন)
export function detectFlagsFromConditions(records) {
  const flags = { diabetes: false, kidney: false };
  (records || []).forEach((r) => {
    if (r.resourceType !== "condition" || r.status === "resolved") return;
    const n = (r.name || "").toLowerCase();
    if (/diabet|ডায়াবেটিস|বহুমূত্র|sugar/.test(n)) flags.diabetes = true;
    if (/kidney|renal|ckd|কিডনি|বৃক্ক/.test(n)) flags.kidney = true;
  });
  return flags;
}
