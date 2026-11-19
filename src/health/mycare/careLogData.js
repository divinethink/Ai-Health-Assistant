// MyCare রুটিন চেকলিস্ট — Firestore (families/{fid}/careLog/{memberId})। শুধু এই ডেটা-লেয়ারই SDK ছোঁয়।
// ডক-ID = memberId; প্রতি সেভে শুধু ওই দিনের key merge হয় (অন্য দিন অক্ষত), তাই বারবার সেভে ডুপ্লিকেট নেই (idempotent)।
// ডক না থাকলে null। ব্যক্তিগত স্বাস্থ্য-তথ্য এখানে নেই — শুধু আইটেম-id ও তারিখ।
import { db } from "../../legacy/firebaseConfig.js";
import { sanitizeDays, sanitizeDay, overflowDates } from "./careLogCore.js";

const ref = (familyId, memberId) => db.collection("families").doc(familyId).collection("careLog").doc(memberId);
const ts = () => firebase.firestore.FieldValue.serverTimestamp();

export async function getCareLog(familyId, memberId) {
  const snap = await ref(familyId, memberId).get();
  return snap.exists ? { days: sanitizeDays(snap.data().days) } : null;
}

// date-এর টিক সেট করা; খালি হলে ওই দিনের key মোছা। সীমা ছাড়ানো পুরনো দিনও মোছা (মোট ≤ ৬০)।
export async function saveCareDay(familyId, memberId, callerMemberId, date, ticks, existed, allDays) {
  const del = () => firebase.firestore.FieldValue.delete();
  const t = sanitizeDay(ticks);
  const days = { [date]: t.length ? t : del() };
  overflowDates({ ...allDays, [date]: t }).forEach((d) => { if (d !== date) days[d] = del(); });
  await ref(familyId, memberId).set({
    v: 1, memberId, days,
    lastEditedByMemberId: callerMemberId, updatedAt: ts(),
    ...(existed ? {} : { createdAt: ts() }),
  }, { merge: true });
}
