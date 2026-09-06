// Health Context Engine (Architecture Plan Part B §6.6 CloudRequestPayload)।
// দুই-স্তর split (triageEngine.js প্যাটার্ন অনুসরণ) — pure builder vs data-fetch wrapper।

import { listMembers } from "./familyIdentity.js";
import { listHealthRecords } from "../health/records/healthRecordsData.js";
import { deriveAgeGroup, getAgeInYears } from "../health/triage/triageEngine.js";
import { detectSpecialty } from "../health/treatment-modes/specialtyRouter.js";

// Pure function — Firebase dependency নেই, unit-testable। §6.6 exclude-list অনুযায়ী
// নাম/DOB/phone/address/treatingPhysician-contact/অন্য-সদস্যের-তথ্য/bulk-history কখনো
// এখানে ঢোকানো হয় না — শুধু নিচের allow-listed field।
export function buildHealthContext({ member, records = [], triageResult = null, symptomInputs = {} }) {
  const relevantConditions = records
    .filter((r) => r.resourceType === "condition" && (r.status === "active" || r.status === "chronic"))
    .map((r) => r.name);

  const relevantAllergies = records
    .filter((r) => r.resourceType === "allergy")
    .map((r) => r.substance);

  const relevantMedications = records
    .filter((r) => r.resourceType === "medicationStatement" && r.status === "active")
    .map((r) => r.genericName);

  const ageGroup = deriveAgeGroup(member.dob);

  return {
    memberPseudonymId: member.id,
    ageGroup,
    sex: member.sex || null,
    // Medical Science Specialty-Context Routing (roadmap §4.1, P6 ধাপ ৩) — নতুন,
    // deterministic (কোনো AI-call/PII না), শুধু worker-কে একটা soft context-hint
    // দেয় (§6.6 payload-এ নতুন field, non-PII, exclude-list-এর কোনোটা লঙ্ঘন করে না)।
    specialty: detectSpecialty({ ageGroup, symptoms: symptomInputs.symptoms, relevantConditions }),
    relevantClinicalContext: {
      symptoms: symptomInputs.symptoms || null,
      duration: symptomInputs.duration || null,
      severity: symptomInputs.severity || null,
      relevantConditions,
      relevantAllergies,
      relevantMedications,
    },
    triageContext: triageResult,
  };
}

// Thin async wrapper — existing familyIdentity.js/healthRecordsData.js read-function
// reuse করে, কোনো নতুন Firestore query/collection লাগে না।
//
// **গুরুত্বপূর্ণ (roadmap §6.4/Dose Enforcement, Option A):** `ageYears` এখানে
// আলাদাভাবে (context object-এর বাইরে) ফেরত দেওয়া হয় — যাতে ভুলেও এটা
// `context`-এর ভেতরে ঢুকে Groq-বাউন্ড payload-এ (§6.6 PII-minimized payload)
// চলে না যায়। `context`/buildHealthContext() shape সম্পূর্ণ অপরিবর্তিত।
export async function assembleHealthContext(familyId, targetMemberId, triageResult, symptomInputs = {}) {
  const members = await listMembers(familyId);
  const member = members.find((m) => m.id === targetMemberId);
  if (!member) throw new Error("সদস্য পাওয়া যায়নি: " + targetMemberId);
  const records = await listHealthRecords(familyId, targetMemberId);
  const context = buildHealthContext({ member, records, triageResult, symptomInputs });
  return { context, ageYears: getAgeInYears(member.dob) };
}
