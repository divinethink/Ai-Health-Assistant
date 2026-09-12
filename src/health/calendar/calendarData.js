// Family Health Calendar + Vaccination-dose records — একটাই shared collection
// (owner-request, ২০২৬-০৯-১২, item ৪+৫), firestore.rules healthCalendarEvents
// match-block (family-wide open-read, creator/Admin-write) দ্রষ্টব্য।

import { db } from "../../legacy/firebaseConfig.js";

function eventsCol(familyId) {
  return db.collection("families").doc(familyId).collection("healthCalendarEvents");
}

export async function createCalendarEvent(familyId, callerMemberId, { memberId = null, title, eventType, date, time = null, notes = "", status = "upcoming", doseId = null }) {
  const ref = eventsCol(familyId).doc();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await ref.set({
    memberId, title, eventType, date, time, notes, status, doseId,
    lastEditedByMemberId: callerMemberId,
    createdAt: now, updatedAt: now,
  });
  return ref.id;
}

// শুধু equality-filter না (memberId==null-ও থাকতে পারে) — পুরো family-এর event
// সংখ্যা ছোট থাকবে ধরে নিয়ে client-side sort (§3.4.5-এর মতোই composite-index এড়ানো)।
export async function listCalendarEvents(familyId) {
  const snap = await eventsCol(familyId).get();
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return events;
}

export async function updateCalendarEventStatus(familyId, eventId, callerMemberId, status) {
  await eventsCol(familyId).doc(eventId).update({
    status, lastEditedByMemberId: callerMemberId,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteCalendarEvent(familyId, eventId) {
  await eventsCol(familyId).doc(eventId).delete();
}
