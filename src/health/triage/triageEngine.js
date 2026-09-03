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
  ["cough", "কাশি / সর্দি"],
  ["ear", "কানে ব্যথা / স্রাব"],
  ["measles", "হাম (Measles)"],
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

// Pneumonia/Cough-Cold, Ear Problem, Measles family (Architecture Plan Part B §4.1.1)।
// Feeding/Nutrition family (VERY LOW WEIGHT FOR AGE) ইচ্ছাকৃতভাবে বাদ — growth-chart/
// weight-for-age percentile data এখনো system-এ নেই, ভুল-classification এড়াতে deferred।

function checkCough({ stridorCalm, chestIndrawing, fastBreathing, cough14Days }) {
  if (stridorCalm) {
    return { riskLevel: "emergency", ruleId: "IMCI-COUGH-001", ruleSource: "WHO IMCI Pneumonia classification", description: "স্থির অবস্থায় stridor (Severe Pneumonia/Very Severe Disease)", suggestedTimeframe: "তাৎক্ষণিক" };
  }
  if (chestIndrawing || fastBreathing) {
    return { riskLevel: "urgent", ruleId: "IMCI-COUGH-002", ruleSource: "WHO IMCI Pneumonia classification", description: "বুক দেবে যাওয়া/দ্রুত শ্বাস-প্রশ্বাস (Pneumonia)", suggestedTimeframe: "আজই ডাক্তার দেখান, ২ দিন পর ফলো-আপ" };
  }
  if (cough14Days) {
    return { riskLevel: "needs-attention", ruleId: "IMCI-COUGH-003", ruleSource: "WHO IMCI Pneumonia classification", description: "কাশি ১৪ দিনের বেশি (TB সন্দেহ)", suggestedTimeframe: "TB পরীক্ষার জন্য ডাক্তার দেখান" };
  }
  return { riskLevel: "self-care", ruleId: "IMCI-COUGH-004", ruleSource: "WHO IMCI Pneumonia classification", description: "সাধারণ কাশি/সর্দি (No Pneumonia)", suggestedTimeframe: "ঘরোয়া যত্ন; ৩ দিন পর ফলো-আপ, না কমলে" };
}

function checkEar({ earSwellingTender, earPainDischarge, earDurationDays }) {
  if (earSwellingTender) {
    return { riskLevel: "emergency", ruleId: "IMCI-EAR-001", ruleSource: "WHO IMCI Ear classification", description: "কানের পেছনে ফোলা/tenderness (Mastoiditis)", suggestedTimeframe: "তাৎক্ষণিক" };
  }
  if (earPainDischarge) {
    const days = Number(earDurationDays);
    const chronic = !isNaN(days) && days >= 14;
    return {
      riskLevel: "needs-attention",
      ruleId: chronic ? "IMCI-EAR-003" : "IMCI-EAR-002",
      ruleSource: "WHO IMCI Ear classification",
      description: chronic ? "কানে স্রাব ১৪+ দিন (Chronic Ear Infection)" : "কানে ব্যথা/স্রাব ১৪ দিনের কম (Acute Ear Infection)",
      suggestedTimeframe: "৫ দিন পর ফলো-আপ" + (chronic ? " (কান শুকনো রাখার guidance-সহ)" : ""),
    };
  }
  return null;
}

function checkMeasles({ measlesSevere, measlesEyeMouth, measlesCurrent }) {
  if (measlesSevere) {
    return { riskLevel: "emergency", ruleId: "IMCI-MEASLES-001", ruleSource: "WHO IMCI Measles classification", description: "গুরুতর জটিলতাসহ হাম (Severe Complicated Measles)", suggestedTimeframe: "তাৎক্ষণিক" };
  }
  if (measlesEyeMouth) {
    return { riskLevel: "urgent", ruleId: "IMCI-MEASLES-002", ruleSource: "WHO IMCI Measles classification", description: "চোখ/মুখে জটিলতাসহ হাম", suggestedTimeframe: "Vitamin A + ২ দিন পর ফলো-আপ" };
  }
  if (measlesCurrent) {
    return { riskLevel: "routine", ruleId: "IMCI-MEASLES-003", ruleSource: "WHO IMCI Measles classification", description: "হাম (বর্তমান/গত ৩ মাসে), জটিলতা ছাড়া", suggestedTimeframe: "২ দিন পর ফলো-আপ, না কমলে" };
  }
  return null;
}

// checklist: { [itemId]: boolean }, chiefComplaint: CHIEF_COMPLAINTS-এর কোনো একটা value,
// complaintInputs: { feverDays, diarrheaDays, bloodyStool, stridorCalm, chestIndrawing,
// fastBreathing, cough14Days, earSwellingTender, earPainDischarge, earDurationDays,
// measlesSevere, measlesEyeMouth, measlesCurrent }
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
  if (pediatric && chiefComplaint === "cough") {
    candidates.push(checkCough(complaintInputs));
    triageSource.push({ rulesetName: "WHO IMCI Pneumonia classification", version: "MVP-v1", sourceReference: "WHO IMCI Chart Booklet" });
  }
  if (pediatric && chiefComplaint === "ear") {
    const r = checkEar(complaintInputs);
    if (r) { candidates.push(r); triageSource.push({ rulesetName: "WHO IMCI Ear classification", version: "MVP-v1", sourceReference: "WHO IMCI Chart Booklet" }); }
  }
  if (pediatric && chiefComplaint === "measles") {
    const r = checkMeasles(complaintInputs);
    if (r) { candidates.push(r); triageSource.push({ rulesetName: "WHO IMCI Measles classification", version: "MVP-v1", sourceReference: "WHO IMCI Chart Booklet" }); }
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
