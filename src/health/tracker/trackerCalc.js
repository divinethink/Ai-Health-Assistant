// হেলথ ট্র্যাকার — ফিক্সড সূত্রের হিসাব (pure functions, AI জড়িত নয়)।
// Mifflin-St Jeor BMR × কার্যকলাপ-গুণক। UI/Firestore থেকে সম্পূর্ণ আলাদা।

export const GOAL_LABELS = { lose: "ওজন কমানো", gain: "ওজন বাড়ানো", fit: "ফিট থাকা", muscle: "পেশি গঠন" };
export const ACTIVITY_LABELS = { low: "কম", medium: "মাঝারি", high: "বেশি" };
const ACTIVITY_FACTOR = { low: 1.2, medium: 1.55, high: 1.725 };
const MIN_KCAL = { female: 1200, male: 1500 };
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
  if (!heightCm || heightCm <= 0) return { error: "প্রোফাইলে উচ্চতা যোগ করুন (হোম → প্রোফাইল)।" };
  if (!weightKg || weightKg <= 0) return { error: "প্রোফাইলে ওজন যোগ করুন (হোম → প্রোফাইল)।" };

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
