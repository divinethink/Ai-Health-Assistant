// src/legacy/medicineDb.js
//
// Medicine/Condition DB query layer (roadmap §10, Architecture Plan Part B §6.2) —
// Firestore structured query, semantic/vector search না (৩০-৫০ entry ছোট dataset)।
//
// firestore.rules-এ `medicineDatabase/{id}` collection-এর read-rule
// (`resource.data.status == 'verified'`) নিজেই "draft entry app-এ ব্যবহারযোগ্য না"
// নীতি (roadmap §12.1.3) enforce করে — তাই draft entry read করলে rules
// permission-denied ছুঁড়বে। এখানে সেই error catch করে null ফেরত দেওয়া হয়েছে
// (safe-default: unverified/অজানা = কিছুই দেখানো হবে না, §5.4.1.1-এর
// "safe-default block" নীতির সাথে সংগতিপূর্ণ)।

import { db } from "./firebaseConfig.js";

export function medicineDocId(genericName) {
  return String(genericName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// একটামাত্র generic medicine lookup — verified না হলে বা না-পাওয়া গেলে null।
// §5.4.1.1: emergencyBystanderOnly entry (Aspirin) এই সাধারণ lookup দিয়ে কখনো
// ফেরত আসবে না — শুধু আলাদা, dedicated bystander-flow থেকেই ব্যবহারযোগ্য হবে।
export async function lookupMedicineEntry(genericName) {
  if (!genericName) return null;
  try {
    const snap = await db.collection("medicineDatabase").doc(medicineDocId(genericName)).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (data.status !== "verified") return null; // rules-এর duplicate client-side guard
    if (data.emergencyBystanderOnly) return null;
    return { id: snap.id, ...data };
  } catch (e) {
    // permission-denied (draft/unverified entry) সহ যেকোনো read-error-এ safe-default।
    return null;
  }
}

// একাধিক genericName একসাথে lookup (interaction cross-check-এ member-এর active
// medication list resolve করতে প্রয়োজন) — প্রতিটা independently safe-default।
export async function lookupMedicineEntries(genericNames = []) {
  const results = await Promise.all(genericNames.map((n) => lookupMedicineEntry(n)));
  return results.filter(Boolean);
}
