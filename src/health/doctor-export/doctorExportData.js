// Doctor-Facing Export — Health Profile (Factual Summary) data-layer
// (Architecture Plan Part C §10, roadmap §7.1)। কোনো AI মতামত/diagnosis নেই —
// শুধু user-verified structured data (`healthRecords`) থেকে সরাসরি populate,
// bright-line নীতি (§10.2)। AI Health Summary export এই ধাপে scope-এর বাইরে
// রাখা হয়েছে (আলাদা পরবর্তী ধাপ — owner-approved scope-narrowing, নিচে
// UI-তে নোট আছে)।

import { db } from "../../legacy/firebaseConfig.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { getAgeInYears, deriveAgeGroup } from "../triage/triageEngine.js";

function isHeightType(t) {
  const s = (t || "").trim().toLowerCase();
  return s === "height" || s === "উচ্চতা";
}
function isWeightType(t) {
  const s = (t || "").trim().toLowerCase();
  return s === "weight" || s === "ওজন";
}
function latestVerifiedObservation(records, matcher) {
  const matches = records.filter((r) => r.resourceType === "observation" && r.userVerified && matcher(r.type));
  // listHealthRecords() আগে থেকেই createdAt DESC sorted রাখে (healthRecordsData.js) —
  // তাই প্রথমটাই সর্বশেষ verified value।
  return matches[0] || null;
}

// শুধু active HealthEpisode থাকলেই currentComplaint populate হবে (§10.2)।
async function fetchActiveEpisode(familyId, memberId) {
  const snap = await db.collection("families").doc(familyId).collection("healthEpisodes")
    .where("memberId", "==", memberId).where("status", "==", "active").limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function buildHealthProfileExport(familyId, targetMemberId, generatedByMemberId) {
  const allMembers = await listMembers(familyId);
  const member = allMembers.find((m) => m.id === targetMemberId);
  if (!member) throw new Error("সদস্য পাওয়া যায়নি।");

  const records = await listHealthRecords(familyId, targetMemberId);
  const allergies = records.filter((r) => r.resourceType === "allergy");
  const activeConditions = records.filter((r) => r.resourceType === "condition" && (r.status === "active" || r.status === "chronic"));
  const pastHistory = records.filter((r) => r.resourceType === "condition" && r.status === "resolved");
  const currentMedications = records.filter((r) => r.resourceType === "medicationStatement" && r.status === "active");

  const heightObs = latestVerifiedObservation(records, isHeightType);
  const weightObs = latestVerifiedObservation(records, isWeightType);
  const heightCm = heightObs ? parseFloat(heightObs.value) : null;
  const weightKg = weightObs ? parseFloat(weightObs.value) : null;
  const bmi = heightCm && weightKg && heightCm > 0 ? weightKg / Math.pow(heightCm / 100, 2) : null;

  const activeEpisode = await fetchActiveEpisode(familyId, targetMemberId);

  return {
    member: {
      name: member.name,
      ageYears: getAgeInYears(member.dob),
      ageGroup: deriveAgeGroup(member.dob),
      sex: member.sex || null,
      bloodGroup: member.bloodGroup || null,
      heightCm, weightKg,
      bmi: bmi ? Math.round(bmi * 10) / 10 : null,
    },
    currentComplaint: activeEpisode
      ? { chiefComplaintTag: activeEpisode.chiefComplaintTag || null, createdAt: activeEpisode.createdAt || null }
      : null,
    allergies, activeConditions, currentMedications, pastHistory,
    generatedAt: Date.now(),
    generatedBy: generatedByMemberId,
  };
}
