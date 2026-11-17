// সাধারণ চিকিৎসা — সদস্যের নিজের তালিকা। বিদ্যমান healthRecords-এ resourceType "commonCare"।
// সব লেখা-পড়া বিদ্যমান createHealthRecord/updateHealthRecord/deleteHealthRecord দিয়ে (permission আগের নিয়মে)।
import { createHealthRecord, updateHealthRecord, deleteHealthRecord, buildHealthRecordFields } from "../records/healthRecordsData.js";
import { useMemberHealth } from "../records/useMemberHealth.js";
import { invalidateMemberHealth } from "../records/memberHealthStore.js";
import { db } from "../../legacy/firebaseConfig.js";
import { lookupMedicineEntry } from "../../legacy/medicineDb.js";
import { assembleHealthContext } from "../../legacy/healthContextEngine.js";
import { careDoseView, careDosePrefill } from "./careDose.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { getAgeInYears } from "../triage/triageEngine.js";

export const COMMON_CARE_TYPE = "commonCare";

export function emptyCareForm() { return { disease: "", brand: "", generic: "", dose: "", frequency: "", note: "" }; }

export function validateCareForm(f) {
  if (!f.disease.trim()) return "অসুখের নাম লিখুন।";
  if (!f.brand.trim() && !f.generic.trim()) return "ব্র্যান্ড বা জেনেরিক নামের অন্তত একটা লিখুন।";
  return null;
}

// নতুন রেকর্ডের আইডি আগে থেকে তৈরি — সেভ আবার চাপলে (নেটওয়ার্ক-ব্যর্থতা/ডবল-ট্যাপ) duplicate হয় না
export const newCareDocId = (fid) => db.collection("families").doc(fid).collection("healthRecords").doc().id;

// এক অসুখের একাধিক ওষুধ একসাথে (atomic: সব সেভ হয়, নয়তো কিছুই না)। items = [{ docId, fields }]
export async function addCareBatch(fid, memberId, callerId, items) {
  const col = db.collection("families").doc(fid).collection("healthRecords");
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  items.forEach(({ docId, fields }) => batch.set(col.doc(docId), {
    memberId, resourceType: COMMON_CARE_TYPE, ...buildHealthRecordFields(COMMON_CARE_TYPE, fields),
    lastEditedByMemberId: callerId, createdAt: now, updatedAt: now,
  }));
  try { await batch.commit(); } finally { invalidateMemberHealth(fid, memberId); }
}

export const addCare = (fid, memberId, callerId, f) => createHealthRecord(fid, memberId, callerId, COMMON_CARE_TYPE, f);
export const editCare = (fid, id, callerId, f) => updateHealthRecord(fid, id, COMMON_CARE_TYPE, callerId, f);
export const removeCare = (fid, id, memberId, callerId) => deleteHealthRecord(fid, id, memberId, callerId);

// অসুখ-অনুযায়ী গ্রুপ (pure)
export function groupByDisease(records, mode) {
  const want = mode || "allopathy";
  const map = new Map();
  records.filter((r) => r.resourceType === COMMON_CARE_TYPE && (r.mode || "allopathy") === want).forEach((r) => {
    const k = (r.disease || "").trim() || "অন্যান্য";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return [...map.entries()];
}

// নির্বাচিত সদস্যের জন্য ডোজ: verified DB entry + বয়স/এলার্জি/চলমান ওষুধ → careDoseView (শুধু পড়া; কিছু লেখে না)।
export async function loadCareDose(familyId, memberId, generic) {
  const [entry, { context, ageYears }] = await Promise.all([lookupMedicineEntry(generic), assembleHealthContext(familyId, memberId, null, {})]);
  const c = context.relevantClinicalContext;
  return careDoseView({ entry, ageYears, allergySubstances: c.relevantAllergies, activeMedicationNames: c.relevantMedications });
}

// "আমার তালিকায় নিন"-এর অটো-ফিল (শুধু পড়া; কিছু লেখে না) — লোডারের মতোই verified DB + বয়স/এলার্জি/চলমান ওষুধ
export async function loadCarePrefill(familyId, memberId, generic) {
  const [entry, { context, ageYears }] = await Promise.all([lookupMedicineEntry(generic), assembleHealthContext(familyId, memberId, null, {})]);
  const c = context.relevantClinicalContext;
  return careDosePrefill({ entry, ageYears, allergySubstances: c.relevantAllergies, activeMedicationNames: c.relevantMedications });
}
// সদস্যের বয়স (বছর) — ভেষজের বড়ো/শিশু মাত্রা বাছতে; জানা না গেলে null
export async function loadCareAge(familyId, memberId) {
  const m = (await listMembers(familyId)).find((x) => x.id === memberId);
  return m ? getAgeInYears(m.dob) : null;
}

export { useMemberHealth };
