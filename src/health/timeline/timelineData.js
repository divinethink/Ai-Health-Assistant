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
import { listCalendarEvents } from "../calendar/calendarData.js";
import { getWeekDaily } from "../tracker/trackerData.js";
import { last7DatesISO } from "../tracker/weeklyTrend.js";
import { localISO } from "../../shared/dates.js";
import { calendarEntries, trackerWeekEntry } from "./timelineExtras.js";

// টাইমলাইনের জন্য পুরো-বাংলা লেবেল ও ফিল্টার-category (শুধু display)
const RECORD_LABELS_BN = {
  condition: "রোগ/সমস্যা",
  observation: "পরিমাপ/টেস্ট",
  medicationStatement: "ওষুধ",
  allergy: "অ্যালার্জি",
};
const RECORD_CATEGORIES = {
  condition: "illness",
  observation: "measurement",
  medicationStatement: "medication",
};
const TAG_LABELS_BN = { "emergency-checklist": "জরুরি চেকলিস্ট" };

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

// opts.records: useMemberHealth-এর shared রেকর্ড (দিলে আলাদা read হয় না)। ক্যালেন্ডার/ট্র্যাকার বাড়তি অংশ —
// না পড়া গেলে (ব্যর্থ/অনুমতি নেই) শুধু ওই এন্ট্রিগুলো বাদ, বাকি টাইমলাইন চলে।
export async function buildTimeline(familyId, targetMemberId, opts) {
  const [records, docs, episodes, events, weekDocs] = await Promise.all([
    opts && opts.records ? Promise.resolve(opts.records) : listHealthRecords(familyId, targetMemberId),
    listDocuments(familyId, targetMemberId),
    listEpisodesForMember(familyId, targetMemberId),
    listCalendarEvents(familyId).catch(() => []),
    getWeekDaily(familyId, targetMemberId, last7DatesISO()).catch(() => []),
  ]);

  const recordEntries = records.map((r) => {
    // resourceType-ভেদে date-field আলাদা জায়গায় থাকে (Architecture Plan §2 schema) —
    // allergy-তে কোনো explicit date নেই বলে createdAt fallback ব্যবহার হয়।
    const explicitDate = r.onsetDate || r.date || r.startDate || null;
    const sortMillis = dateStrToMillis(explicitDate);
    return {
      id: "record-" + r.id,
      icon: RECORD_ICONS[r.resourceType] || "🩺",
      label: RECORD_LABELS_BN[r.resourceType] || RESOURCE_TYPE_LABELS[r.resourceType] || r.resourceType,
      description: describeHealthRecord(r),
      displayDate: explicitDate,
      // তারিখ না থাকলে createdAt fallback — শুধু display, stored data বদলায় না
      sortMillis: sortMillis !== null ? sortMillis : toMillis(r.createdAt),
      category: RECORD_CATEGORIES[r.resourceType] || null,
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
      category: null,
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
      label: "লক্ষণ যাচাই" + (ep.chiefComplaintTag && ep.chiefComplaintTag !== "general" ? " — " + (TAG_LABELS_BN[ep.chiefComplaintTag] || ep.chiefComplaintTag) : ""),
      description: (riskLevel ? RISK_LABELS_BN[riskLevel] || riskLevel : "ফলাফল পাওয়া যায়নি") + (ep.status === "archived" ? " (আর্কাইভড)" : ""),
      displayDate: createdDate ? createdDate.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" }) : null,
      sortMillis: toMillis(ep.createdAt),
      category: "symptom",
      riskLevel: riskLevel || null,
      hasTime: true,
      url: null,
    };
  });

  const weekEntry = trackerWeekEntry(weekDocs);
  const all = [
    ...recordEntries, ...docEntries, ...episodeEntries,
    ...calendarEntries(events, targetMemberId, localISO()),
    ...(weekEntry ? [weekEntry] : []),
  ];
  all.sort((a, b) => (b.sortMillis || 0) - (a.sortMillis || 0));
  return all;
}
