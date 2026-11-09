// src/health/prescriptions/prescriptionData.js
//
// ধাপ ৬ — অনুমোদিত ওষুধ সেভ (data-layer)। নতুন schema/rules নেই: বিদ্যমান createHealthRecord
// (medicationStatement) + setMedicationReminderTimes-ই ব্যবহার, tier ডিফল্ট "requires-consult"।
// Idempotent: সেভের ঠিক আগে নতুন করে তালিকা এনে একই নামের চলমান ওষুধ বাদ দেয় — double-submit/retry-তে
// ডুপ্লিকেট হয় না। একটা ব্যর্থ হলে বাকিগুলো চলে; ফলাফলে saved/skipped/failed আলাদা।

import { createHealthRecord, listHealthRecords, setMedicationReminderTimes } from "../records/healthRecordsData.js";
import { localISO } from "../../shared/dates.js";
import { findDuplicateMed, reminderTimesFor, frequencyText } from "./prescriptionParsing.js";

export async function loadPrescriptionContext(familyId, memberId) {
  const records = await listHealthRecords(familyId, memberId);
  return { records, allergies: records.filter((r) => r.resourceType === "allergy") };
}

function endDateFor(days) {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() + days - 1);
  return localISO(d);
}

/**
 * @param {Array<{name, days, meal, pattern, patternRaw, perDay, prn}>} items - ব্যবহারকারী-অনুমোদিত (সম্পাদিত) ওষুধ
 * @returns {Promise<{saved: string[], skipped: string[], failed: Array<{name: string, message: string}>}>}
 */
export async function saveApprovedMedications(familyId, targetMemberId, callerMemberId, items) {
  const known = (await listHealthRecords(familyId, targetMemberId)).slice();
  const today = localISO();
  const out = { saved: [], skipped: [], failed: [] };
  for (const it of items) {
    if (findDuplicateMed(it.name, known, today)) { out.skipped.push(it.name); continue; }
    try {
      const endDate = endDateFor(it.days);
      const id = await createHealthRecord(familyId, targetMemberId, callerMemberId, "medicationStatement", {
        name: it.name, tier: "requires-consult", status: "active", date: today,
        frequency: frequencyText(it) || "", durationDays: it.days || "",
      });
      await setMedicationReminderTimes(familyId, id, callerMemberId, reminderTimesFor(it), { endDate, mealTiming: it.meal || "any" });
      known.push({ resourceType: "medicationStatement", genericName: it.name, endDate });
      out.saved.push(it.name);
    } catch (e) {
      out.failed.push({ name: it.name, message: e.code === "permission-denied" ? "অনুমতি নেই" : (e.message || String(e)) });
    }
  }
  return out;
}
