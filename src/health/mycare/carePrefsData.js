// MyCare যত্ন-প্রোফাইল — Firestore (families/{fid}/carePrefs/{memberId})। শুধু এই ডেটা-লেয়ারই SDK ছোঁয়।
// ডক-ID = memberId → set(merge) তাই বারবার সেভে ডুপ্লিকেট নেই (idempotent); conflict = last-write-wins।
// ডক না থাকলে null (ডিফল্ট আচরণ)। স্বাস্থ্য-তথ্য (অ্যালার্জি/বয়স/গর্ভাবস্থা) এখানে সংরক্ষণ হয় না।
import { db } from "../../legacy/firebaseConfig.js";
import { sanitizeCarePrefs } from "./carePrefsSchema.js";

const ref = (familyId, memberId) => db.collection("families").doc(familyId).collection("carePrefs").doc(memberId);
const ts = () => firebase.firestore.FieldValue.serverTimestamp();

export async function getCarePrefs(familyId, memberId) {
  const snap = await ref(familyId, memberId).get();
  return snap.exists ? sanitizeCarePrefs(snap.data()) : null;
}

export async function saveCarePrefs(familyId, memberId, callerMemberId, prefs, existed) {
  await ref(familyId, memberId).set({
    ...sanitizeCarePrefs(prefs), memberId,
    lastEditedByMemberId: callerMemberId, updatedAt: ts(),
    ...(existed ? {} : { createdAt: ts() }),
  }, { merge: true });
}
