// Health Record CRUD (Condition/Observation/MedicationStatement/AllergyIntolerance)।
// app.js থেকে split (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।
//
// Architecture Plan §2 অনুযায়ী একত্রিত `healthRecords/{id}` collection, resourceType
// discriminator দিয়ে চারটা logical type আলাদা করা হয়। `firestore_rules_FINAL.md`-এর
// healthRecords match-block অনুযায়ী rules নিজেই এই ৪টা resourceType allow করে ও
// hasAccess(familyId, targetMemberId, callerMemberId) দিয়ে verify করে — তাই client-এর
// দায়িত্ব শুধু সঠিক memberId (কার record) ও lastEditedByMemberId (caller নিজে কে,
// permission-verification-only field, Architecture Plan §2 নোট অনুযায়ী — content-edit
// audit-trail না) পাঠানো।

import { db } from "../../legacy/firebaseConfig.js";
import { notifyMember } from "../../legacy/accessGrants.js";

export const RESOURCE_TYPE_LABELS = {
  condition: "Condition (রোগ/সমস্যা)",
  observation: "Observation (পরিমাপ/টেস্ট)",
  medicationStatement: "Medication (ওষুধ)",
  allergy: "Allergy (এলার্জি)",
};

// resourceType-নির্দিষ্ট field-সেট আলাদা করা হলো (Architecture Plan §2 schema অনুযায়ী) —
// অপ্রাসঙ্গিক ফর্ম-ফিল্ড payload-এ যাতে না যায় (rules-এ allowlist নেই এই collection-এ,
// কিন্তু data-hygiene-এর জন্য এখানেই সীমিত রাখা হলো)।
export function buildHealthRecordFields(resourceType, fields) {
  if (resourceType === "condition") {
    // Treating Physician Contact (roadmap §12.5, Architecture Plan Part A §2 —
    // schema আগে থেকেই সংজ্ঞায়িত ছিল, এখন প্রথমবার UI থেকে populate হচ্ছে)।
    // তিনটাই optional; সব খালি হলে treatingPhysician: null (existing record ভাঙবে না)।
    const physName = (fields.physicianName || "").trim();
    const physContact = (fields.physicianContact || "").trim();
    const physHospital = (fields.physicianHospital || "").trim();
    const treatingPhysician = (physName || physContact || physHospital)
      ? { name: physName || null, chamberContact: physContact || null, hospital: physHospital || null }
      : null;
    return { name: fields.name.trim(), category: fields.category, status: fields.status, chronicManagement: fields.chronicManagement === true, onsetDate: fields.date || null, treatingPhysician };
  }
  if (resourceType === "observation") {
    // source/extractionMethod/extractionConfidence/originalOcrValue/userVerified —
    // Architecture Plan Part A §2 schema-তে আগে থেকেই সংজ্ঞায়িত ছিল, P5 Report
    // Intelligence verification-form (ReportVerificationForm.js) এখন এগুলো পাঠাবে।
    // ম্যানুয়াল entry (HealthRecordForm.js) এই field গুলো পাঠায় না বলে default
    // "manual"/userVerified:true হয় — এটাই সঠিক আচরণ (ব্যবহারকারী নিজে টাইপ
    // করেছেন মানেই verified, roadmap §8-এর userVerified-gate নীতির সাথে সংগতিপূর্ণ)।
    return {
      type: fields.type.trim(), value: fields.value.trim(), unit: fields.unit.trim(), date: fields.date || null,
      source: fields.source || "manual",
      extractionMethod: fields.extractionMethod || null,
      extractionConfidence: fields.extractionConfidence || null,
      originalOcrValue: fields.originalOcrValue || null,
      userVerified: fields.userVerified !== undefined ? fields.userVerified : true,
    };
  }
  if (resourceType === "medicationStatement") {
    return { genericName: fields.name.trim(), tier: fields.tier, status: fields.status, startDate: fields.date || null };
  }
  if (resourceType === "allergy") {
    return { substance: fields.name.trim(), reaction: fields.reaction.trim(), severity: fields.severity };
  }
  throw new Error("অজানা resourceType: " + resourceType);
}

export async function createHealthRecord(familyId, targetMemberId, callerMemberId, resourceType, fields) {
  const ref = db.collection("families").doc(familyId).collection("healthRecords").doc();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await ref.set({
    memberId: targetMemberId,
    resourceType,
    ...buildHealthRecordFields(resourceType, fields),
    lastEditedByMemberId: callerMemberId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

// resourceType বদলানো যায় না (rules-এও locked, L413) — শুধু field-value edit।
export async function updateHealthRecord(familyId, recordId, resourceType, callerMemberId, fields) {
  const ref = db.collection("families").doc(familyId).collection("healthRecords").doc(recordId);
  await ref.update({
    ...buildHealthRecordFields(resourceType, fields),
    lastEditedByMemberId: callerMemberId,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// roadmap §3.4 Admin delete-override safeguard (ক): নিজের record না হলে (অর্থাৎ
// Admin অন্য সদস্যের record মুছছেন — rules-এ hasDeleteAccess শুধু Admin/self-কেই
// অনুমতি দেয়, তাই targetMemberId != callerMemberId মানেই Admin-override) —
// owner-কে notification। ２-ধাপ confirm UI-স্তরে (HealthRecordList)।
export async function deleteHealthRecord(familyId, recordId, targetMemberId, callerMemberId) {
  await db.collection("families").doc(familyId).collection("healthRecords").doc(recordId).delete();
  if (targetMemberId !== callerMemberId) {
    await notifyMember(familyId, targetMemberId, "record-deleted",
      "আপনার একটি Health Record Admin কর্তৃক মুছে ফেলা হয়েছে।");
  }
}

// শুধু equality filter (memberId ==) — orderBy যোগ করলে composite index লাগত, তাই
// client-side sort করা হচ্ছে (§3.4.5-এর memberId+resourceType composite index শুধু
// resourceType-ফিল্টার-সহ query-র জন্য প্রয়োজন হবে, এই মুহূর্তে সেই query নেই)।
export async function listHealthRecords(familyId, targetMemberId) {
  const snap = await db.collection("families").doc(familyId).collection("healthRecords")
    .where("memberId", "==", targetMemberId).get();
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  records.sort((a, b) => {
    const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });
  return records;
}

// নতুন (owner-request, ২০২৬-০৯-১২ — Medication reminder/adherence tracker, item ২):
// MedicationStatement schema-তে (Architecture Plan Part A §2) reminder-time কোনো
// field ছিল না — নতুন `reminderTimes: [string ("HH:MM")]` optional field যোগ করা
// হলো, schema-breaking না (নতুন optional field, না থাকলে undefined/[] ধরা হবে) এবং
// rules-change লাগেনি (এই collection-এ field-allowlist নেই)। buildHealthRecordFields()
// bypass করে সরাসরি এই একটা field আপডেট করা হচ্ছে, অন্য medication-edit ফর্ম অপ্রভাবিত থাকে।
export async function setMedicationReminderTimes(familyId, recordId, callerMemberId, reminderTimes) {
  const ref = db.collection("families").doc(familyId).collection("healthRecords").doc(recordId);
  await ref.update({
    reminderTimes,
    lastEditedByMemberId: callerMemberId,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export function describeHealthRecord(r) {
  if (r.resourceType === "condition") {
    const tp = r.treatingPhysician;
    const tpText = tp && (tp.name || tp.hospital || tp.chamberContact)
      ? " | ডাক্তার: " + (tp.name || "?") + (tp.hospital ? " (" + tp.hospital + ")" : "") + (tp.chamberContact ? ", যোগাযোগ: " + tp.chamberContact : "")
      : "";
    return r.name + " — " + (r.status || "") + " (Category " + (r.category || "?") + ")" + (r.chronicManagement ? " [Chronic]" : "") + (r.onsetDate ? ", onset: " + r.onsetDate : "") + tpText;
  }
  if (r.resourceType === "observation") {
    return r.type + ": " + r.value + (r.unit ? " " + r.unit : "") + (r.date ? " (" + r.date + ")" : "");
  }
  if (r.resourceType === "medicationStatement") {
    return r.genericName + " — " + (r.tier || "") + ", " + (r.status || "") + (r.startDate ? ", শুরু: " + r.startDate : "");
  }
  if (r.resourceType === "allergy") {
    return r.substance + " — " + (r.reaction || "") + " (" + (r.severity || "") + ")";
  }
  return "";
}
