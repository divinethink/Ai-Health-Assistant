// গর্ভাবস্থা/বুকের দুধ — প্রোফাইলে একবার (ধাপ ৬)। বিদ্যমান condition-রেকর্ডই (নতুন schema/rules নেই)।
// চালু: আগে থেকে (resolved সহ) রেকর্ড থাকলে সেটাই আবার active; নইলে একটা তৈরি → বারবার চাপলেও ডুপ্লিকেট নয়।
// বন্ধ: মোছা নয়, শুধু status="resolved" (ইতিহাস থাকে, "অতীত ইতিহাসে" দেখায়; নোট/ডাক্তার-তথ্য অক্ষত — শুধু ওই একটা ফিল্ড বদলায়)।
// স্থানান্তর: পুরনো ট্র্যাকার-টগল (goal.flags.pregnant) চালু অথচ কোনো রেকর্ড নেই → একবার রেকর্ড তৈরি; পুরনো goal-ডক অক্ষত।

import { db } from "../../legacy/firebaseConfig.js";
import { createHealthRecord, listHealthRecords } from "./healthRecordsData.js";
import { invalidateMemberHealth } from "./memberHealthStore.js";
import { pregnancyRecordsOf, PREGNANCY_CONDITION_NAME } from "../tracker/trackerCalc.js";
import { localISO } from "../../shared/dates.js";

async function setStatus(familyId, recordId, callerMemberId, status) {
  try {
    await db.collection("families").doc(familyId).collection("healthRecords").doc(recordId).update({
      status, lastEditedByMemberId: callerMemberId, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } finally { invalidateMemberHealth(familyId); }
}

export async function setPregnancyOn(familyId, memberId, callerMemberId) {
  const recs = pregnancyRecordsOf(await listHealthRecords(familyId, memberId, { fresh: true }));
  if (recs.some((r) => r.status !== "resolved")) return; // আগে থেকেই চালু
  if (recs.length) { await setStatus(familyId, recs[0].id, callerMemberId, "active"); return; }
  await createHealthRecord(familyId, memberId, callerMemberId, "condition", {
    name: PREGNANCY_CONDITION_NAME, category: "C", status: "active", chronicManagement: false, date: localISO(),
  });
}

export async function setPregnancyOff(familyId, memberId, callerMemberId) {
  const recs = pregnancyRecordsOf(await listHealthRecords(familyId, memberId, { fresh: true })).filter((r) => r.status !== "resolved");
  for (const r of recs) await setStatus(familyId, r.id, callerMemberId, "resolved");
}
