// Health Context Engine (Architecture Plan Part B §6.6 CloudRequestPayload)।
// দুই-স্তর split (triageEngine.js প্যাটার্ন অনুসরণ) — pure builder vs data-fetch wrapper।

import { listMembers } from "./familyIdentity.js";
import { listHealthRecords } from "../health/records/healthRecordsData.js";
import { deriveAgeGroup } from "../health/triage/triageEngine.js";

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

  return {
    memberPseudonymId: member.id,
    ageGroup: deriveAgeGroup(member.dob),
    sex: member.sex || null,
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
export async function assembleHealthContext(familyId, targetMemberId, triageResult, symptomInputs = {}) {
  const members = await listMembers(familyId);
  const member = members.find((m) => m.id === targetMemberId);
  if (!member) throw new Error("সদস্য পাওয়া যায়নি: " + targetMemberId);
  const records = await listHealthRecords(familyId, targetMemberId);
  return buildHealthContext({ member, records, triageResult, symptomInputs });
}
