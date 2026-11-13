// অসুখ গাইডের সংশোধন — Firestore `conditionGuides/{id}` (global, সবাই পড়ে; লেখা শুধু অ্যাপ-ক্রিয়েটর — firestore.rules)।
// ডক না থাকলে conditionGuideData.js-এর ডিফল্ট চলে। এক query-তে সব (≤২০ ডক)।

import { db } from "../../legacy/firebaseConfig.js";
import { sanitizeGuideFields } from "./conditionGuideData.js";

export async function listGuideOverrides() {
  const snap = await db.collection("conditionGuides").get();
  const out = {};
  snap.docs.forEach((d) => { out[d.id] = d.data(); });
  return out;
}

// verified=true হলে verifiedAt বসে; নইলে খসড়া (verifiedAt null)
export async function saveGuideOverride(id, fields, verified) {
  const f = sanitizeGuideFields(fields);
  const ts = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection("conditionGuides").doc(id).set({
    ...f, status: verified ? "verified" : "draft", verifiedAt: verified ? ts : null, updatedAt: ts,
  });
}

// মূল (ডিফল্ট) লেখায় ফেরা = সংশোধন-ডক মোছা
export async function resetGuideOverride(id) {
  await db.collection("conditionGuides").doc(id).delete();
}
