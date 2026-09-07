// AI Health Summary — data-layer (Architecture Plan Part C §10.3, roadmap §12.0)।
// Existing TriageResult (§4) + episode-এর guidance-message থেকেই populate হয় —
// কোনো নতুন schema লাগে না (§10.3 নীতি অনুযায়ী)। সবচেয়ে সাম্প্রতিক HealthEpisode
// (active থাকলে সেটাই, না হলে সবচেয়ে সাম্প্রতিক archived) বেছে নেওয়া হয়।

import { db } from "../../legacy/firebaseConfig.js";

function toMillis(v) {
  return v && typeof v.toMillis === "function" ? v.toMillis() : v || 0;
}

async function fetchMostRecentEpisode(familyId, memberId) {
  const snap = await db.collection("families").doc(familyId).collection("healthEpisodes")
    .where("memberId", "==", memberId).get();
  const episodes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (episodes.length === 0) return null;
  episodes.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
  return episodes[0];
}

async function fetchLatestTriageResult(familyId, episodeId) {
  const snap = await db.collection("families").doc(familyId).collection("healthEpisodes")
    .doc(episodeId).collection("triageResults").get();
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (results.length === 0) return null;
  results.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return results[0];
}

async function fetchAiGuidanceText(familyId, episodeId) {
  const snap = await db.collection("families").doc(familyId).collection("healthEpisodes")
    .doc(episodeId).collection("messages").get();
  const msgs = snap.docs.map((d) => d.data());
  msgs.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  return msgs.filter((m) => m.role === "ai").map((m) => m.content).join("\n\n---\n\n");
}

// memberName আলাদা parameter হিসেবে নেওয়া হচ্ছে (caller-এর কাছে listMembers()
// থেকে ইতিমধ্যে আছে) — duplicate Firestore read এড়াতে (Process Rule ৮)।
export async function buildAiHealthSummary(familyId, targetMemberId, memberName) {
  const episode = await fetchMostRecentEpisode(familyId, targetMemberId);
  if (!episode) {
    throw new Error("এই সদস্যের জন্য এখনো কোনো Symptom Check / AI Guidance session নেই।");
  }
  const [triage, guidanceText] = await Promise.all([
    fetchLatestTriageResult(familyId, episode.id),
    fetchAiGuidanceText(familyId, episode.id),
  ]);
  if (!guidanceText) {
    throw new Error("এই সদস্যের সাম্প্রতিক session-এ কোনো AI guidance পাওয়া যায়নি।");
  }
  return {
    memberName,
    chiefComplaintTag: episode.chiefComplaintTag || null,
    episodeCreatedAt: episode.createdAt || null,
    riskLevel: triage ? triage.riskLevel : null,
    recommendedAction: triage ? triage.recommendedAction : null,
    guidanceText,
    generatedAt: Date.now(),
  };
}
