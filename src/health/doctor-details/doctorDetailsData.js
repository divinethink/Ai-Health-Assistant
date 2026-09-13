// Doctor Details & Visiting Card — নতুন feature (owner-request, ২০২৬-০৯-১৩)।
//
// OWNER-DECISION (এই থ্রেড): Condition.treatingPhysician সম্প্রসারণ না করে
// আলাদা independent, family-scoped `doctors` collection — কারণ এটা কোনো
// নির্দিষ্ট Condition/member-এর সাথে bound না, পুরো পরিবারের common reference
// directory (healthCalendarEvents-এর মতোই family-wide open-read, creator/
// Admin-write, firestore.rules দ্রষ্টব্য)। Category-তালিকা নতুন invent না করে
// existing Medical-Science specialty-list (specialtyRouter.js) পুনর্ব্যবহার।
//
// Visiting-card ছবি আপলোড documents.js-এর হুবহু Cloudinary+Worker pattern
// reuse করে (worker/src/index.js-এর /doctor-upload-auth ও /doctor-delete)।
// ছবি ঐচ্ছিক — না দিলে status: "no-image"।

import { db, auth } from "../../legacy/firebaseConfig.js";
import { SPECIALTY_LABELS } from "../treatment-modes/specialtyRouter.js";

export const DOCTOR_CATEGORIES = [
  ...Object.entries(SPECIALTY_LABELS),
  ["other", "অন্যান্য"],
];

const MAX_CARD_IMAGE_BYTES = 10 * 1024 * 1024;
const WORKER_URL = import.meta.env.VITE_MEDIA_WORKER_URL;

export function validateCardImage(file) {
  if (!file) return null; // ঐচ্ছিক — না দিলে ভ্যালিড
  if (!file.type.startsWith("image/")) return "ভিজিটিং কার্ডের জন্য শুধু ছবি (jpg/png) আপলোড করা যাবে।";
  if (file.size > MAX_CARD_IMAGE_BYTES) return "ছবির সাইজ 10MB-এর বেশি হতে পারবে না।";
  return null;
}

async function getIdToken() {
  if (!auth.currentUser) throw new Error("লগইন সেশন পাওয়া যায়নি — পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
  return auth.currentUser.getIdToken();
}

export async function listDoctors(familyId) {
  const snap = await db.collection("families").doc(familyId).collection("doctors").get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => {
    const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });
  return docs;
}

// ছবি upload — documentsData.js-এর uploadDocument()-এর হুবহু ৩-ধাপ pattern:
// Worker-কে signature চাওয়া (caller-এর idToken দিয়ে permission-verify) →
// সরাসরি Cloudinary-তে upload → client নিজে metadata doc update করে।
export async function uploadDoctorCardImage(familyId, doctorId, file) {
  const v = validateCardImage(file);
  if (v) throw new Error(v);
  if (!WORKER_URL) throw new Error("Media server configure করা নেই (VITE_MEDIA_WORKER_URL missing) — owner-কে জানান।");

  const idToken = await getIdToken();
  const authRes = await fetch(`${WORKER_URL}/doctor-upload-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, familyId, doctorId }),
  });
  if (!authRes.ok) throw new Error("আপলোড-অনুমতি নেওয়া যায়নি (permission বা network সমস্যা)।");
  const { cloudName, apiKey, timestamp, signature, publicId, folder } = await authRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("public_id", publicId);
  form.append("folder", folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("ছবি আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করুন।");
  const result = await uploadRes.json();

  await db.collection("families").doc(familyId).collection("doctors").doc(doctorId).update({
    status: "ready",
    visitingCardImageUrl: result.secure_url,
    cloudinaryPublicId: result.public_id,
    cloudinaryResourceType: result.resource_type,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function createDoctor(familyId, callerMemberId, fields, file) {
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const ref = db.collection("families").doc(familyId).collection("doctors").doc();
  await ref.set({
    name: fields.name.trim(),
    specialtyCategory: fields.specialtyCategory,
    hospital: fields.hospital ? fields.hospital.trim() : "",
    chamberAddress: fields.chamberAddress ? fields.chamberAddress.trim() : "",
    phone: fields.phone ? fields.phone.trim() : "",
    visitingCardImageUrl: null,
    status: file ? "pending" : "no-image",
    lastEditedByMemberId: callerMemberId,
    createdAt: now,
    updatedAt: now,
  });
  if (file) {
    try {
      await uploadDoctorCardImage(familyId, ref.id, file);
    } catch (e) {
      // ছবি আপলোড ব্যর্থ হলেও ডাক্তারের বাকি তথ্য (নাম/ফোন/ঠিকানা) রেখে দেওয়া
      // হচ্ছে — শুধু status "no-image"-এ ফিরিয়ে দেওয়া, user পরে edit করে ছবি
      // ছাড়াই রাখতে পারবেন বা পুরো entry ডিলিট করে আবার চেষ্টা করতে পারবেন।
      await ref.update({ status: "no-image", updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      throw e;
    }
  }
  return ref.id;
}

// Text-field-only edit — MVP-তে visiting-card ছবি বদলানোর সাপোর্ট নেই
// (minimum-code নীতি; ছবি বদলাতে চাইলে entry ডিলিট করে নতুন করে যোগ করা হবে)।
export async function updateDoctorFields(familyId, doctorId, callerMemberId, fields) {
  await db.collection("families").doc(familyId).collection("doctors").doc(doctorId).update({
    name: fields.name.trim(),
    specialtyCategory: fields.specialtyCategory,
    hospital: fields.hospital ? fields.hospital.trim() : "",
    chamberAddress: fields.chamberAddress ? fields.chamberAddress.trim() : "",
    phone: fields.phone ? fields.phone.trim() : "",
    lastEditedByMemberId: callerMemberId,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// roadmap §3.4-এর মতোই delete-safeguard দরকার নেই — এটা health-content না,
// পারিবারিক reference-directory entry; creator/Admin যে কেউ মুছতে পারবেন
// (firestore.rules-এ guard, delete করার আগে UI-তেই ২-ধাপ confirm আছে)।
export async function deleteDoctor(familyId, doctorId) {
  if (!WORKER_URL) throw new Error("Media server configure করা নেই।");
  const idToken = await getIdToken();
  const res = await fetch(`${WORKER_URL}/doctor-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, familyId, doctorId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error === "forbidden" || body.error === "not-found-or-forbidden"
      ? "এই ডাক্তারের তথ্য মুছার অনুমতি আপনার নেই।"
      : "মুছতে ব্যর্থ হয়েছে — আবার চেষ্টা করুন।");
  }
}
