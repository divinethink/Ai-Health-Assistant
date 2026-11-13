// "কেন এই প্ল্যান?" — pure ব্যাখ্যা-লাইন (UI/Firestore জড়িত নয়)। ধাপ A২।
// শুধু বিদ্যমান হিসাব (goal.calc, exercisePlan) থেকে পাঠযোগ্য লাইন বানায়; কোনো নতুন হিসাব/ডেটা নয়।

import { bnNum } from "../../shared/dates.js";
import { focusExplain } from "./homeWorkout.js";
import { GOAL_LABELS, ACTIVITY_LABELS, ACTIVITY_FACTOR } from "./trackerCalc.js";

const BAND_LABELS = { under5: "৫ বছরের কম", child: "শিশু-কিশোর (৫–১৭)", adult: "প্রাপ্তবয়স্ক (১৮–৬৪)", senior: "প্রবীণ (৬৫+)" };

// goal: সংরক্ষিত লক্ষ্য-ডক (calc সহ)। ব্যাখ্যা করার মতো calc না থাকলে null।
export function explainMeal({ goal, age, weightKg, heightCm, allergyTags }) {
  const calc = goal && goal.calc;
  if (!calc || !calc.bmr || !calc.tdee || !calc.calorieTarget) return null;
  const lines = [];
  const prof = [];
  if (weightKg) prof.push(bnNum(weightKg) + " কেজি");
  if (heightCm) prof.push(bnNum(heightCm) + " সেমি");
  if (age !== null && age !== undefined) prof.push(bnNum(age) + " বছর");
  if (prof.length) lines.push("প্রোফাইল: " + prof.join(" · "));
  lines.push("বিশ্রামে শরীরের প্রয়োজন (BMR, Mifflin-St Jeor সূত্র): " + bnNum(calc.bmr) + " কিলোক্যালরি");
  const f = ACTIVITY_FACTOR[goal.activity];
  lines.push("দৈনিক কার্যকলাপ (" + (ACTIVITY_LABELS[goal.activity] || "—") + (f ? ", গুণক " + bnNum(f) : "") + ") ধরে মোট প্রয়োজন: " + bnNum(calc.tdee) + " কিলোক্যালরি");
  const diff = calc.calorieTarget - calc.tdee;
  const label = GOAL_LABELS[goal.goalType] || "";
  if (Math.abs(diff) < 5) lines.push("লক্ষ্য (" + label + "): প্রয়োজনের সমান খাওয়া");
  else lines.push("লক্ষ্য (" + label + "): প্রতিদিন প্রায় " + bnNum(Math.abs(Math.round(diff))) + " কিলোক্যালরি " + (diff < 0 ? "কম" : "বেশি") + " খাওয়া");
  (calc.notes || []).forEach((n) => lines.push(n));
  lines.push("টার্গেট: " + bnNum(calc.calorieTarget) + " কিলোক্যালরি/দিন");
  lines.push("মেনু: স্থির বাংলাদেশি বেস-মেনু থেকে ভাত, রুটি, ডাল, কলা, মুড়ির পরিমাণ ধাপে ধাপে বাড়িয়ে-কমিয়ে টার্গেটের কাছে আনা হয়েছে; ক্যালরি আনুমানিক।");
  if (allergyTags && allergyTags.length) lines.push("প্রোফাইলের অ্যালার্জি অনুযায়ী মিলে যাওয়া খাবার বদলানো/বাদ দেওয়া হয়েছে।");
  return lines;
}

// plan: exercisePlan() এর ফল।
export function explainExercise({ plan, age, goalType }) {
  if (!plan) return null;
  // আলাদা সারাংশ-বাক্য এখানেই (WHO-ভিত্তিক বাক্য plan.summary-তে)
  const lines = [plan.summary || "বয়স-ব্যান্ড অনুযায়ী সাপ্তাহিক লক্ষ্য ঠিক হয়েছে।"];
  if (BAND_LABELS[plan.band]) lines.push("আপনার বয়স-ব্যান্ড" + (age !== null && age !== undefined ? " (" + bnNum(age) + " বছর)" : "") + ": " + BAND_LABELS[plan.band]);
  if (plan.focus && plan.focus.length) {
    focusExplain(plan.focus, { lowImpact: !!plan.lowImpact }).forEach((l) => lines.push(l));
    return lines;
  }
  if (plan.routine && (plan.band === "adult" || plan.band === "senior")) {
    lines.push(goalType === "muscle"
      ? "লক্ষ্য ‘পেশি গঠন’ হওয়ায় সপ্তাহে ৩ দিন শক্তির ব্যায়াম রাখা হয়েছে।"
      : "সপ্তাহে ২ দিন শক্তির ব্যায়াম, বাকি দিনে দ্রুত হাঁটা ও স্ট্রেচিং; শুক্রবার বিশ্রাম।");
    lines.push("স্ট্রেচিং সাপ্তাহিক মিনিটে গোনা হয় না।");
  }
  return lines;
}
