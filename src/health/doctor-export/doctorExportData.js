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
import { getGoal, getWeekDaily } from "../tracker/trackerData.js";
import { last7DatesISO, targetCtxFor, weeklySummary } from "../tracker/weeklyTrend.js";
import { detectFlagsFromConditions, effectivePregnant } from "../tracker/trackerCalc.js";

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

// গত ৭ দিনের ট্র্যাকার সারাংশ (পার্ট ৮) — ঐচ্ছিক সেকশন। ডেটা না থাকলে বা পড়া ব্যর্থ হলে null:
// এক্সপোর্টের বাকি অংশ কখনো এর কারণে ভাঙে না। শুধু ব্যবহারকারীর দেওয়া সংখ্যা; কোনো AI মতামত নেই।
async function fetchTrackerWeek(familyId, memberId, member, records) {
  try {
    const dates = last7DatesISO();
    const [docs, goal] = await Promise.all([getWeekDaily(familyId, memberId, dates), getGoal(familyId, memberId)]);
    const detected = detectFlagsFromConditions(records);
    const gf = (goal && goal.flags) || {};
    const flags = { pregnant: effectivePregnant(goal, records), diabetes: !!gf.diabetes || detected.diabetes, kidney: !!gf.kidney || detected.kidney };
    const ay = getAgeInYears(member.dob);
    return weeklySummary(docs, dates, targetCtxFor({ age: ay === null ? null : Math.floor(ay), flags, goal })); // ট্র্যাকারের ageYears-এর মতো পূর্ণ বছর
  } catch (_e) {
    return null;
  }
}

export async function buildHealthProfileExport(familyId, targetMemberId, generatedByMemberId, { includeTracker = true } = {}) {
  const allMembers = await listMembers(familyId);
  const member = allMembers.find((m) => m.id === targetMemberId);
  if (!member) throw new Error("সদস্য পাওয়া যায়নি।");

  const records = await listHealthRecords(familyId, targetMemberId, { fresh: true });
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
  const trackerWeek = includeTracker ? await fetchTrackerWeek(familyId, targetMemberId, member, records) : null;

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
    trackerWeek,
    generatedAt: Date.now(),
    generatedBy: generatedByMemberId,
  };
}
