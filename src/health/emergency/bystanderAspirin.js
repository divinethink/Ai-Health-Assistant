// Suspected Heart-Attack Bystander Aspirin — Contraindication Auto-Verify
// (Architecture Plan Part B §5.4.1.1, roadmap §9.4/§19 amendment)।
//
// সম্পূর্ণ deterministic, rule-based — কোনো LLM/AI judgment না (Process ফাইল
// Rule ৫, Medical Safety)। Safe-default নীতি: কোনো field missing/unknown/
// unverified থাকলে সবসময় block — "অজানা = নিরাপদ" কখনো ধরে নেওয়া হয় না।
//
// Pure function — কোনো Firebase/network dependency নেই, স্বাধীনভাবে
// unit-testable (triageEngine.js-এর একই প্যাটার্ন)।

const ASPIRIN_ALLERGY_PATTERN = /aspirin|nsaid|ibuprofen|naproxen|এসপিরিন|আইবুপ্রোফেন|নেপ্রোক্সেন/i;
const BLEEDING_CONDITION_PATTERN = /bleeding|blood.?disorder|হিমোফিলিয়া|রক্তক্ষরণ.?জনিত/i;

// allergyRecords/conditionRecords: healthRecords collection থেকে resourceType
// অনুযায়ী filter করা array (listHealthRecords() রেজাল্ট থেকে caller filter করে)।
export function checkAspirinContraindication({ ageYears, allergyRecords, conditionRecords }) {
  if (ageYears == null || isNaN(ageYears) || ageYears < 18) {
    return { blocked: true, reason: "বয়স ১৮ বছরের নিচে বা অজানা (Reye's syndrome ঝুঁকি, safe-default: block)" };
  }
  if (!Array.isArray(allergyRecords) || !Array.isArray(conditionRecords)) {
    return { blocked: true, reason: "Allergy/Condition প্রোফাইল যাচাই করা যায়নি (safe-default: block)" };
  }
  const allergyHit = allergyRecords.some((r) => ASPIRIN_ALLERGY_PATTERN.test(r.substance || ""));
  if (allergyHit) {
    return { blocked: true, reason: "Aspirin/NSAID অ্যালার্জি প্রোফাইলে আছে" };
  }
  const bleedingHit = conditionRecords.some(
    (r) => BLEEDING_CONDITION_PATTERN.test(r.name || "") && r.status !== "resolved"
  );
  if (bleedingHit) {
    return { blocked: true, reason: "Bleeding-disorder/active-bleeding condition প্রোফাইলে আছে" };
  }
  return { blocked: false, reason: null };
}
