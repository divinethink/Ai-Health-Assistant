// Verified Care-Escalation Directory — global (family-independent) read layer,
// Architecture Plan Part B §5.1, populateCareEscalationDirectory.js-এর সাথে
// সহ-দলিল। remedyData.js-এর একই read-layer প্যাটার্ন (roadmap §12.5.1)।
//
// এই collection clinical dosing-data না (শুধু helpline/directory reference),
// এবং rules-এও কোনো status-gate নেই — তাই medicineDatabase/remedyDatabase-এর
// মতো client-side "verified"-filter এখানে প্রযোজ্য না, সব entry সরাসরি দেখানো
// নিরাপদ।

import { db } from "../../legacy/firebaseConfig.js";

export async function listCareEscalationDirectory() {
  const snap = await db.collection("careEscalationDirectory").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const CARE_ESCALATION_TYPE_LABELS = {
  "emergency-police-fire": "জরুরি (পুলিশ/ফায়ার/অ্যাম্বুলেন্স)",
  "national-health-telehealth": "স্বাস্থ্য টেলিহেলথ",
  "child-safety": "শিশু সুরক্ষা",
  "women-safety": "নারী সুরক্ষা",
  "civic-info": "নাগরিক সেবা",
  "telemedicine": "প্রাইভেট টেলিমেডিসিন",
  "pharmacist-consult": "Pharmacist-Consult",
};
