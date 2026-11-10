// উচ্চতা/ওজনের একটাই লেখার পথ (ধাপ ৫)। প্রোফাইলের ✎ ফর্ম ও ট্র্যাকারের ওজন-ইনপুট — দুটোই এখান/saveDaily দিয়ে যায়,
// তাই একই দিনে একই মান বারবার বা দুই জায়গা থেকে দিলেও একটাই Observation থাকে (বদলায়, ডুপ্লিকেট হয় না)।
// ওজন → saveDaily (ট্র্যাকারের আজকের ডক + `weightObsId` Observation); উচ্চতা → ওই দিনের height Observation আপডেট/তৈরি।
// নতুন schema/rules নেই। ব্যর্থ হলে throw — retry নিরাপদ (idempotent)।

import { createHealthRecord, updateHealthRecord, listHealthRecords } from "./healthRecordsData.js";
import { getDaily, saveDaily } from "../tracker/trackerData.js";

export async function saveVitals(familyId, memberId, callerMemberId, { heightCm, weightKg }, date) {
  if (heightCm !== null && heightCm !== undefined) {
    const recs = await listHealthRecords(familyId, memberId, { fresh: true });
    const ex = recs.find((r) => r.resourceType === "observation" && /^(height|উচ্চতা)$/.test((r.type || "").trim().toLowerCase()) && r.date === date);
    const rec = { type: "height", value: String(heightCm), unit: "cm", date };
    if (ex) { if (parseFloat(ex.value) !== heightCm) await updateHealthRecord(familyId, ex.id, "observation", callerMemberId, rec); }
    else await createHealthRecord(familyId, memberId, callerMemberId, "observation", rec);
  }
  if (weightKg !== null && weightKg !== undefined) {
    const prev = await getDaily(familyId, memberId, date);
    await saveDaily(familyId, memberId, callerMemberId, date, { weightKg }, prev);
  }
}
