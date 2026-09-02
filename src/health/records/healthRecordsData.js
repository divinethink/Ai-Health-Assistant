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
    return { name: fields.name.trim(), category: fields.category, status: fields.status, onsetDate: fields.date || null };
  }
  if (resourceType === "observation") {
    return { type: fields.type.trim(), value: fields.value.trim(), unit: fields.unit.trim(), date: fields.date || null };
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

export function describeHealthRecord(r) {
  if (r.resourceType === "condition") {
    return r.name + " — " + (r.status || "") + " (Category " + (r.category || "?") + ")" + (r.onsetDate ? ", onset: " + r.onsetDate : "");
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
