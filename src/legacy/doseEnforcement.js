// src/legacy/doseEnforcement.js
//
// Dose Enforcement — Prevention Layer, client-side core logic (roadmap §10.2.1,
// §12.1; Architecture Plan Part B §6.4)। triageEngine.js-এর প্যাটার্ন অনুসরণ —
// pure function, Firebase/network dependency নেই, স্বাধীনভাবে unit-testable।
//
// মূলনীতি (bright-line, exception নেই): dose কখনো LLM generate করবে না — এই
// ফাইলের deterministic lookup/rule-matching-ই একমাত্র উৎস। LLM/Worker tool-calling
// wiring এখনো বাকি (পরের ধাপ) — এই ফাইল আগে নিজে standalone verify হবে।

// dosingRules array থেকে member-এর বয়স (বছরে, fractional) অনুযায়ী matching rule।
// ageMax: null মানে ঊর্ধ্বসীমা নেই।
export function findDosingRuleForAge(dosingRules, ageYears) {
  if (!Array.isArray(dosingRules) || ageYears == null) return null;
  return (
    dosingRules.find((r) => {
      const min = r.ageMin ?? 0;
      const max = r.ageMax;
      return ageYears >= min && (max == null || ageYears < max);
    }) || null
  );
}

// Allergy cross-check — profile-এর AllergyIntolerance.substance-এর সাথে
// genericName মিল থাকলে block। Substring-ভিত্তিক (case-insensitive) —
// exact-match না মিললেও conservative side-এ থাকা ভালো (false-negative miss করার
// চেয়ে false-positive block করা নিরাপদ, §5.4.1.1 safe-default নীতির সাথে সংগতিপূর্ণ)।
export function checkAllergyBlock(genericName, allergySubstances = []) {
  if (!genericName) return false;
  const target = genericName.toLowerCase();
  return allergySubstances.some((s) => {
    const sub = String(s).toLowerCase();
    return sub && (target.includes(sub) || sub.includes(target));
  });
}

// Interaction cross-check — medicine entry-র `interactsWith` টেক্সট-লিস্টের সাথে
// member-এর active MedicationStatement.genericName মিলিয়ে flag (Architecture
// §6.4 checkInteractions() tool-schema-র deterministic client-side বাস্তবায়ন)।
// §5.7-এর ৩টা concrete case (Domperidone+Azithromycin, Calcium+Levothyroxine,
// Ambroxol vs Dextromethorphan) এই ফাংশনের মাধ্যমে ধরা পড়া উচিত।
export function checkInteractionFlags(medicineEntry, activeMedicationNames = []) {
  if (!medicineEntry || !Array.isArray(medicineEntry.interactsWith)) return [];
  const flags = [];
  for (const activeMed of activeMedicationNames) {
    if (!activeMed) continue;
    const activeLower = activeMed.toLowerCase();
    const matchedNote = medicineEntry.interactsWith.find((i) => String(i).toLowerCase().includes(activeLower));
    if (matchedNote) flags.push({ withGenericName: activeMed, note: matchedNote });
  }
  return flags;
}

// মূল enforcement — একটামাত্র entry-point, ফলাফল সবসময় { blocked, ... } আকারে।
// blocked: true হলে UI/Worker কখনো dose-সংখ্যা দেখাবে না, শুধু reason-অনুযায়ী
// fallback message (§6.4.1 highRiskFlag suppression, §12.1 Tier-2 flag, ইত্যাদি)।
//
// কোনো ধাপেই "অজানা/অনিশ্চিত হলে দেখিয়ে দাও" নেই — safe-default সবসময় block।
export function resolveDoseForMember({
  medicineEntry,
  ageYears,
  allergySubstances = [],
  activeMedicationNames = [],
}) {
  if (!medicineEntry) {
    return { blocked: true, reason: "no-verified-data" };
  }

  if (medicineEntry.tier === "requires-consult") {
    return {
      blocked: true,
      reason: "requires-consult",
      genericName: medicineEntry.genericName,
      class: medicineEntry.class || null,
      educationalUseNote: medicineEntry.educationalUseNote || null,
      highRiskFlag: !!medicineEntry.highRiskFlag,
      riskNote: medicineEntry.riskNote || null,
    };
  }

  if (checkAllergyBlock(medicineEntry.genericName, allergySubstances)) {
    return { blocked: true, reason: "allergy-contraindication", genericName: medicineEntry.genericName };
  }

  const interactionFlags = checkInteractionFlags(medicineEntry, activeMedicationNames);
  if (interactionFlags.length > 0) {
    // এই dataset-এ per-interaction severity-level নেই (§5.7 flag শুধু qualitative) —
    // তাই conservative default: যেকোনো matched interaction-এই dose suppress করা হবে,
    // pharmacist/physician-consult flag দেখানো হবে (§6.4 "high-severity suppress" নীতির
    // রক্ষণশীল প্রয়োগ, dose-safety-তে ambiguity থাকলে সবসময় block)।
    return { blocked: true, reason: "interaction-flag", genericName: medicineEntry.genericName, interactionFlags };
  }

  if (medicineEntry.highRiskFlag) {
    return {
      blocked: true,
      reason: "high-risk-flag",
      genericName: medicineEntry.genericName,
      riskNote: medicineEntry.riskNote || null,
    };
  }

  const rule = findDosingRuleForAge(medicineEntry.dosingRules, ageYears);
  if (!rule) {
    return { blocked: true, reason: "no-matching-age-rule", genericName: medicineEntry.genericName };
  }

  // কিছু rule শুধু সতর্কতা-নোট বহন করে, প্রকৃত dose-সংখ্যা নেই (যেমন "নিরুৎসাহিত")।
  const hasDoseValue = !!(rule.fixedDose || rule.dosePerKg);
  if (!hasDoseValue) {
    return { blocked: true, reason: "note-only-no-dose", genericName: medicineEntry.genericName, note: rule.note || null };
  }

  return {
    blocked: false,
    genericName: medicineEntry.genericName,
    class: medicineEntry.class || null,
    dose: rule.fixedDose || rule.dosePerKg,
    frequency: rule.frequency || null,
    maxDailyDose: rule.maxDailyDose || null,
    maxDurationDays: rule.maxDurationDays || null,
    note: rule.note || null,
    contraindications: medicineEntry.contraindications || [],
    source: medicineEntry.source || [],
    tier: medicineEntry.tier,
  };
}
