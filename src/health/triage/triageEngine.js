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

const SEVERITY_RANK = { emergency: 4, urgent: 3, "needs-attention": 2, routine: 1, "self-care": 0 };
const ACTION_BY_RISK = {
  emergency: "call-emergency",
  urgent: "see-doctor-today",
  "needs-attention": "see-doctor-soon",
  routine: "self-care-with-monitoring",
  "self-care": "self-care-with-monitoring",
};

// রোগ-নির্দিষ্ট IMCI rule (Architecture Plan Part B §4.1, শুধু pediatric — IMCI মূলত
// ৫ বছরের নিচের শিশুর জন্য, বাংলাদেশ non-malaria-area default)। chiefComplaint ও
// complaintInputs Structured Trigger Layer থেকে আসে।
export const CHIEF_COMPLAINTS = [
  ["none", "নির্দিষ্ট কিছু না (শুধু emergency-checklist)"],
  ["fever", "জ্বর"],
  ["diarrhea", "ডায়রিয়া / পাতলা পায়খানা"],
];

function checkFever({ feverDays }) {
  const days = Number(feverDays);
  if (!isNaN(days) && days >= 7) {
    return { riskLevel: "urgent", ruleId: "IMCI-FEVER-002", ruleSource: "WHO IMCI Fever classification", description: "প্রতিদিন জ্বর ৭ দিনের বেশি", suggestedTimeframe: "সরাসরি ডাক্তার-assessment প্রয়োজন" };
  }
  return { riskLevel: "needs-attention", ruleId: "IMCI-FEVER-001", ruleSource: "WHO IMCI Fever classification", description: "জ্বর (danger sign ছাড়া)", suggestedTimeframe: "জ্বর থাকলে ২ দিন পর পুনরায় দেখান" };
}

function checkDiarrhea({ diarrheaDays, bloodyStool }) {
  if (bloodyStool) {
    return { riskLevel: "needs-attention", ruleId: "IMCI-DIAR-001", ruleSource: "WHO IMCI Diarrhea classification", description: "মলে রক্ত (Dysentery)", suggestedTimeframe: "২ দিন পর ফিরে আসুন" };
  }
  const days = Number(diarrheaDays);
  if (!isNaN(days) && days >= 14) {
    return { riskLevel: "routine", ruleId: "IMCI-DIAR-002", ruleSource: "WHO IMCI Diarrhea classification", description: "১৪+ দিন ধরে ডায়রিয়া (Persistent, non-severe)", suggestedTimeframe: "৫ দিন পর ফিরে আসুন যদি না কমে" };
  }
  return { riskLevel: "self-care", ruleId: "IMCI-DIAR-003", ruleSource: "WHO IMCI Diarrhea classification", description: "সাধারণ acute diarrhea (dehydration নেই ধরে নেওয়া হচ্ছে)", suggestedTimeframe: "ORS চালিয়ে যান; না কমলে বা নতুন উপসর্গ দেখা দিলে ডাক্তার দেখান" };
}

// checklist: { [itemId]: boolean }, chiefComplaint: "none"|"fever"|"diarrhea",
// complaintInputs: { feverDays, diarrheaDays, bloodyStool }
export function runTriage({ ageGroup, checklist, chiefComplaint = "none", complaintInputs = {} }) {
  const pediatric = isPediatricAgeGroup(ageGroup);
  const items = getChecklistForAgeGroup(ageGroup);
  const triggeredItems = items.filter((it) => checklist && checklist[it.id]);

  const triageSource = [{
    rulesetName: pediatric ? "WHO IMCI General Danger Signs" : "Adult Emergency Warning Signs + FAST protocol",
    version: "MVP-v1",
    sourceReference: pediatric ? "WHO IMCI Chart Booklet" : "Standard adult emergency guideline / AHA-CDC FAST",
  }];

  // Multi-Rule Priority — max-severity-wins (roadmap §9.1): সব candidate rule জমা করে
  // সবচেয়ে বেশি severity-টা জিতবে, কিন্তু triggeredRules-এ সবগুলোই থাকবে (traceable)।
  const candidates = [];

  if (triggeredItems.length > 0) {
    const isFast = !pediatric && triggeredItems.some((it) => FAST_IDS.includes(it.id));
    candidates.push({
      riskLevel: "emergency",
      ruleId: pediatric ? "IMCI-GDS-001" : (isFast ? "FAST-STROKE-001" : "ADULT-EMERGENCY-001"),
      ruleSource: pediatric ? "WHO IMCI danger signs" : (isFast ? "FAST stroke protocol" : "Adult emergency warning signs"),
      description: triggeredItems.map((it) => it.label).join("; "),
      suggestedTimeframe: "তাৎক্ষণিক",
    });
  }

  if (pediatric && chiefComplaint === "fever") {
    candidates.push(checkFever(complaintInputs));
    triageSource.push({ rulesetName: "WHO IMCI Fever classification", version: "MVP-v1", sourceReference: "WHO IMCI Chart Booklet" });
  }
  if (pediatric && chiefComplaint === "diarrhea") {
    candidates.push(checkDiarrhea(complaintInputs));
    triageSource.push({ rulesetName: "WHO IMCI Diarrhea classification", version: "MVP-v1", sourceReference: "WHO IMCI Chart Booklet" });
  }

  if (candidates.length === 0) {
    // কোনো rule-ই প্রযোজ্য না (adult/elderly + কোনো emergency red-flag নেই, chiefComplaint
    // fever/diarrhea না) — honest scope-limited fallback, false-reassurance এড়াতে।
    return {
      riskLevel: "routine",
      triggeredRules: [],
      uncertaintyLevel: "high",
      missingInformation: [
        "এই সংস্করণে শুধু জরুরি (emergency) red-flag checklist ও শিশুর Fever/Diarrhea rule চেক হয়েছে — বাকি রোগ-নির্দিষ্ট triage rule এখনো যুক্ত হয়নি।",
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

  candidates.sort((a, b) => SEVERITY_RANK[b.riskLevel] - SEVERITY_RANK[a.riskLevel]);
  const winner = candidates[0];

  return {
    riskLevel: winner.riskLevel,
    triggeredRules: candidates.map((c) => ({ ruleId: c.ruleId, ruleSource: c.ruleSource, description: c.description, suggestedTimeframe: c.suggestedTimeframe })),
    uncertaintyLevel: "low",
    missingInformation: [],
    recommendedAction: {
      action: ACTION_BY_RISK[winner.riskLevel],
      timeframe: winner.suggestedTimeframe,
      timeframeSource: "rule-specific",
      emergencyContact: winner.riskLevel === "emergency" ? EMERGENCY_CONTACT : null,
    },
    ageGroupContext: ageGroup,
    triageSource,
  };
}
