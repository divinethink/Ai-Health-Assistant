// Deterministic Triage Engine (roadmap §9, Architecture Plan Part B §4)।
//
// P3 প্রথম sub-step — শুধু non-bypassable emergency red-flag স্তর:
//   ১. WHO IMCI General Danger Signs (pediatric, ageGroup: neonate/infant/child)
//   ২. Adult/Elderly Emergency Warning Signs + FAST protocol (stroke)
// রোগ-নির্দিষ্ট IMCI rule (Fever/Diarrhea/Pneumonia ইত্যাদি batch, Architecture
// Plan Part B §4.1/§4.1.1-এ আগে থেকেই ডকুমেন্টেড) পরবর্তী ধাপে এখানে যোগ হবে —
// Multi-Rule Priority (max-severity-wins, roadmap §9.1) নীতি মেনে নতুন rule
// শুধু runTriage()-এর triggered-list-এ যোগ হবে, এই ফাইলের বাইরের কোনো কোড
// বদলাতে হবে না।
//
// Pure function/data — কোনো Firebase/network dependency নেই, তাই স্বাধীনভাবে
// (Firestore/React ছাড়াই) unit-testable। Process ফাইল Rule ৫ (Medical Safety —
// deterministic, non-bypassable) ও Rule ১১ (state/logic core-layer-এ) অনুযায়ী।

export function deriveAgeGroup(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  const ageDays = (now - birth) / (1000 * 60 * 60 * 24);
  const ageYears = ageDays / 365.25;
  if (ageDays < 28) return "neonate";
  if (ageYears < 2) return "infant";
  if (ageYears < 18) return "child";
  if (ageYears < 65) return "adult";
  return "elderly";
}

export function isPediatricAgeGroup(ageGroup) {
  return ageGroup === "neonate" || ageGroup === "infant" || ageGroup === "child";
}

// WHO IMCI General Danger Signs (যেকোনো একটা থাকলেই riskLevel emergency, exception নেই — §9.3)
export const PEDIATRIC_DANGER_SIGNS = [
  { id: "cannotDrink", label: "শিশু পান করতে/বুকের দুধ খেতে অক্ষম" },
  { id: "vomitsEverything", label: "যা খাওয়ানো হচ্ছে সবকিছু বমি করে দিচ্ছে" },
  { id: "convulsions", label: "বর্তমান অসুস্থতায় খিঁচুনি হয়েছে" },
  { id: "lethargic", label: "অস্বাভাবিক নিস্তেজ/জাগানো কষ্ট/অজ্ঞান" },
  { id: "stiffNeck", label: "ঘাড় শক্ত হয়ে গেছে/নাড়াতে কষ্ট হচ্ছে" },
];

// Adult general emergency warning signs, FAST-items আলাদাভাবে চিহ্নিত (stroke protocol)
const FAST_IDS = ["oneSidedWeakness", "slurredSpeech", "facialDroop"];

export const ADULT_EMERGENCY_SIGNS = [
  { id: "chestPain", label: "বুকে ব্যথা/চাপ/অস্বস্তি" },
  { id: "breathingDifficulty", label: "হঠাৎ তীব্র শ্বাসকষ্ট" },
  { id: "oneSidedWeakness", label: "হঠাৎ শরীরের একপাশ দুর্বল/অবশ (FAST)" },
  { id: "slurredSpeech", label: "কথা জড়িয়ে যাচ্ছে/বুঝতে অসুবিধা হচ্ছে (FAST)" },
  { id: "facialDroop", label: "মুখ একপাশে বেঁকে গেছে (FAST)" },
  { id: "severeBleeding", label: "তীব্র/অনিয়ন্ত্রিত রক্তক্ষরণ" },
  { id: "unresponsive", label: "অজ্ঞান/ডাকে সাড়া দিচ্ছে না" },
  { id: "severeAllergicReaction", label: "মুখ/গলা ফুলে যাওয়া + শ্বাসকষ্ট (তীব্র এলার্জিক প্রতিক্রিয়া)" },
];

export function getChecklistForAgeGroup(ageGroup) {
  return isPediatricAgeGroup(ageGroup) ? PEDIATRIC_DANGER_SIGNS : ADULT_EMERGENCY_SIGNS;
}

const EMERGENCY_CONTACT = { name: "৯৯৯ (জাতীয় জরুরি সেবা)", number: "999", type: "emergency-police-fire" };

// checklist: { [itemId]: boolean } — Structured Trigger Layer থেকে আসা yes/no toggle
export function runTriage({ ageGroup, checklist }) {
  const pediatric = isPediatricAgeGroup(ageGroup);
  const items = getChecklistForAgeGroup(ageGroup);
  const triggeredItems = items.filter((it) => checklist && checklist[it.id]);

  const triageSource = [{
    rulesetName: pediatric ? "WHO IMCI General Danger Signs" : "Adult Emergency Warning Signs + FAST protocol",
    version: "MVP-v1",
    sourceReference: pediatric ? "WHO IMCI Chart Booklet" : "Standard adult emergency guideline / AHA-CDC FAST",
  }];

  if (triggeredItems.length > 0) {
    const isFast = !pediatric && triggeredItems.some((it) => FAST_IDS.includes(it.id));
    return {
      riskLevel: "emergency",
      triggeredRules: [{
        ruleId: pediatric ? "IMCI-GDS-001" : (isFast ? "FAST-STROKE-001" : "ADULT-EMERGENCY-001"),
        ruleSource: pediatric ? "WHO IMCI danger signs" : (isFast ? "FAST stroke protocol" : "Adult emergency warning signs"),
        description: triggeredItems.map((it) => it.label).join("; "),
        suggestedTimeframe: "তাৎক্ষণিক",
      }],
      uncertaintyLevel: "low",
      missingInformation: [],
      recommendedAction: {
        action: "call-emergency",
        timeframe: "তাৎক্ষণিক",
        timeframeSource: "rule-specific",
        emergencyContact: EMERGENCY_CONTACT,
      },
      ageGroupContext: ageGroup,
      triageSource,
    };
  }

  // কোনো emergency red-flag trigger হয়নি — এই MVP সংস্করণে শুধু emergency-checklist
  // চেক করা হয়েছে, তাই স্পষ্টভাবে uncertaintyLevel: high ও missingInformation-এ
  // জানানো হচ্ছে যে সম্পূর্ণ triage (Fever/Diarrhea ইত্যাদি disease-specific rule)
  // এখনো implement হয়নি — false-reassurance এড়াতে (roadmap §9 নীতির সাথে সংগতিপূর্ণ)।
  return {
    riskLevel: "routine",
    triggeredRules: [],
    uncertaintyLevel: "high",
    missingInformation: [
      "এই সংস্করণে শুধু জরুরি (emergency) red-flag checklist চেক হয়েছে — রোগ-নির্দিষ্ট (fever/diarrhea/cough ইত্যাদি) triage rule এখনো যুক্ত হয়নি।",
    ],
    recommendedAction: {
      action: "self-care-with-monitoring",
      timeframe: "লক্ষণ বাড়লে, না কমলে, বা নতুন উপসর্গ দেখা দিলে ডাক্তার দেখান",
      timeframeSource: "riskLevel-default",
      emergencyContact: null,
    },
    ageGroupContext: ageGroup,
    triageSource,
  };
}
