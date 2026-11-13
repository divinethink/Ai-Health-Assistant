// সাধারণ চিকিৎসা — সদস্যের নিজের তালিকা। বিদ্যমান healthRecords-এ resourceType "commonCare"।
// সব লেখা-পড়া বিদ্যমান createHealthRecord/updateHealthRecord/deleteHealthRecord দিয়ে (permission আগের নিয়মে)।
import { createHealthRecord, updateHealthRecord, deleteHealthRecord } from "../records/healthRecordsData.js";
import { useMemberHealth } from "../records/useMemberHealth.js";

export const COMMON_CARE_TYPE = "commonCare";

export function emptyCareForm() { return { disease: "", brand: "", generic: "", dose: "", frequency: "", note: "" }; }

export function validateCareForm(f) {
  if (!f.disease.trim()) return "অসুখের নাম লিখুন।";
  if (!f.brand.trim() && !f.generic.trim()) return "ব্র্যান্ড বা জেনেরিক নামের অন্তত একটা লিখুন।";
  return null;
}

export const addCare = (fid, memberId, callerId, f) => createHealthRecord(fid, memberId, callerId, COMMON_CARE_TYPE, f);
export const editCare = (fid, id, callerId, f) => updateHealthRecord(fid, id, COMMON_CARE_TYPE, callerId, f);
export const removeCare = (fid, id, memberId, callerId) => deleteHealthRecord(fid, id, memberId, callerId);

// অসুখ-অনুযায়ী গ্রুপ (pure)
export function groupByDisease(records) {
  const map = new Map();
  records.filter((r) => r.resourceType === COMMON_CARE_TYPE).forEach((r) => {
    const k = (r.disease || "").trim() || "অন্যান্য";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return [...map.entries()];
}

export { useMemberHealth };
