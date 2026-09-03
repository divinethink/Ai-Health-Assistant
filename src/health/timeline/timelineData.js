// Health Timeline — Checklist P2 শেষ আইটেম। roadmap §7: "Report শুধু file
// হিসেবে থাকবে না; ভবিষ্যতে ... health timeline-এ ব্যবহারযোগ্য হবে" — এই
// view সেটাই বাস্তবায়ন করে।
//
// সম্পূর্ণ read-only aggregation — কোনো নতুন Firestore collection/rules লাগেনি,
// existing listHealthRecords()/listDocuments()-ই reuse করা হয়েছে (দুটোই
// hasAccess()-গেটেড, তাই permission নতুন করে কিছু ভাবতে হয়নি — client শুধু
// দুটো legitimate read একসাথে merge+sort করছে)।

import { listHealthRecords, describeHealthRecord, RESOURCE_TYPE_LABELS } from "../records/healthRecordsData.js";
import { listDocuments, DOC_TYPE_LABELS } from "../documents/documentsData.js";

const RECORD_ICONS = {
  condition: "🩺",
  observation: "📈",
  medicationStatement: "💊",
  allergy: "⚠️",
};

function toMillis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

function dateStrToMillis(str) {
  if (!str) return null;
  const t = new Date(str + "T00:00:00").getTime();
  return Number.isNaN(t) ? null : t;
}

export async function buildTimeline(familyId, targetMemberId) {
  const [records, docs] = await Promise.all([
    listHealthRecords(familyId, targetMemberId),
    listDocuments(familyId, targetMemberId),
  ]);

  const recordEntries = records.map((r) => {
    // resourceType-ভেদে date-field আলাদা জায়গায় থাকে (Architecture Plan §2 schema) —
    // allergy-তে কোনো explicit date নেই বলে createdAt fallback ব্যবহার হয়।
    const explicitDate = r.onsetDate || r.date || r.startDate || null;
    const sortMillis = dateStrToMillis(explicitDate);
    return {
      id: "record-" + r.id,
      icon: RECORD_ICONS[r.resourceType] || "🩺",
      label: RESOURCE_TYPE_LABELS[r.resourceType] || r.resourceType,
      description: describeHealthRecord(r),
      displayDate: explicitDate,
      sortMillis: sortMillis !== null ? sortMillis : toMillis(r.createdAt),
      url: null,
    };
  });

  const docEntries = docs.map((d) => {
    const sortMillis = dateStrToMillis(d.date);
    return {
      id: "doc-" + d.id,
      icon: "📄",
      label: DOC_TYPE_LABELS[d.docType] || d.docType,
      description: d.fileName + (d.source ? " (" + d.source + ")" : ""),
      displayDate: d.date || null,
      sortMillis: sortMillis !== null ? sortMillis : toMillis(d.createdAt),
      url: d.status === "ready" ? d.cloudinaryUrl : null,
    };
  });

  const all = [...recordEntries, ...docEntries];
  all.sort((a, b) => (b.sortMillis || 0) - (a.sortMillis || 0));
  return all;
}
