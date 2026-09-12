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
import { listEpisodesForMember, getTriageResult } from "../episodes/episodesData.js";

const RECORD_ICONS = {
  condition: "🩺",
  observation: "📈",
  medicationStatement: "💊",
  allergy: "⚠️",
};

// নতুন (owner-request, ২০২৬-০৯-১২ — Symptom timeline/pattern view): riskLevel অনুযায়ী
// icon, যাতে timeline-এ কোন Symptom Check কতটা severe ছিল এক নজরে বোঝা যায়।
const RISK_ICONS = {
  emergency: "🚨",
  urgent: "⚠️",
  "needs-attention": "🟡",
  routine: "🟢",
  "self-care": "🌿",
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
  const [records, docs, episodes] = await Promise.all([
    listHealthRecords(familyId, targetMemberId),
    listDocuments(familyId, targetMemberId),
    listEpisodesForMember(familyId, targetMemberId),
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

  // নতুন (owner-request, ২০২৬-০৯-১২ — Symptom timeline/pattern view): প্রতিটা Episode-এর
  // linked TriageResult থেকে riskLevel টেনে timeline-এ দেখানো হচ্ছে — কোনো নতুন read-pattern
  // না, existing hasAccess()-গেটেড subcollection-ই read হচ্ছে (episode-প্রতি ১টা extra get)।
  const triageResults = await Promise.all(
    episodes.map((ep) => (ep.triageResultId ? getTriageResult(familyId, ep.id, ep.triageResultId) : Promise.resolve(null)))
  );
  const RISK_LABELS_BN = {
    emergency: "জরুরি (Emergency)",
    urgent: "জরুরি-প্রায় (Urgent)",
    "needs-attention": "মনোযোগ প্রয়োজন",
    routine: "রুটিন",
    "self-care": "স্ব-যত্ন",
  };
  const episodeEntries = episodes.map((ep, i) => {
    const triage = triageResults[i];
    const riskLevel = triage && triage.riskLevel;
    const createdDate = ep.createdAt && ep.createdAt.toDate ? ep.createdAt.toDate() : null;
    return {
      id: "episode-" + ep.id,
      icon: RISK_ICONS[riskLevel] || "🩹",
      label: "Symptom Check" + (ep.chiefComplaintTag && ep.chiefComplaintTag !== "general" ? " — " + ep.chiefComplaintTag : ""),
      description: (riskLevel ? RISK_LABELS_BN[riskLevel] || riskLevel : "ফলাফল পাওয়া যায়নি") + (ep.status === "archived" ? " (আর্কাইভড)" : ""),
      displayDate: createdDate ? createdDate.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" }) : null,
      sortMillis: toMillis(ep.createdAt),
      url: null,
    };
  });

  const all = [...recordEntries, ...docEntries, ...episodeEntries];
  all.sort((a, b) => (b.sortMillis || 0) - (a.sortMillis || 0));
  return all;
}
