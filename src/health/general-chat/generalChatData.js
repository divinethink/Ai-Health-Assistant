// General Chat — data layer (নতুন, এই থ্রেড)।
//
// দুই আলাদা concern:
// ১) Ephemeral image upload — documentsData.js-এর Cloudinary-signing pattern
//    reuse (Worker `/general-chat-upload-auth`), কিন্তু কোনো Firestore metadata
//    doc তৈরি হয় না (history-না-সেভ নীতি) — সরাসরি Cloudinary URL client-state-এ
//    থাকে। ব্যবহারকারী সেই message "সেভ" না করলে `deleteGeneralChatImage()` দিয়ে
//    Cloudinary থেকেও মুছে ফেলা হয় (storage-এ eternal orphan asset এড়াতে)।
// ২) সেভ করা নোট — `families/{familyId}/generalChatNotes/{id}`, Admin-only
//    (firestore.rules-এ isAdminOfFamily()-gated)।

import { db, auth } from "../../legacy/firebaseConfig.js";

const WORKER_URL = import.meta.env.VITE_MEDIA_WORKER_URL;

async function getIdToken() {
  if (!auth.currentUser) throw new Error("লগইন সেশন পাওয়া যায়নি — পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
  return auth.currentUser.getIdToken();
}

export function validateGeneralChatImage(file) {
  if (!file) return "একটা ছবি বেছে নিন।";
  if (!file.type.startsWith("image/")) return "শুধু ছবি (jpg/png) দেওয়া যাবে।";
  if (file.size > 8 * 1024 * 1024) return "ছবির সাইজ 8MB-এর বেশি হতে পারবে না।";
  return null;
}

// আপলোড করে { secureUrl, publicId, resourceType } ফেরত দেয় — এগুলো শুধু
// client-side React state-এ রাখা হবে, কোনো Firestore write নেই এখানে।
export async function uploadGeneralChatImage(familyId, file) {
  const err = validateGeneralChatImage(file);
  if (err) throw new Error(err);
  if (!WORKER_URL) throw new Error("Media server configure করা নেই (VITE_MEDIA_WORKER_URL missing)।");

  const idToken = await getIdToken();
  const authRes = await fetch(`${WORKER_URL}/general-chat-upload-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, familyId }),
  });
  if (!authRes.ok) {
    const body = await authRes.json().catch(() => ({}));
    throw new Error(body.error === "forbidden-admin-only" ? "শুধু Admin General Chat ব্যবহার করতে পারবেন।" : "আপলোড-অনুমতি নেওয়া যায়নি।");
  }
  const { cloudName, apiKey, timestamp, signature, publicId, folder } = await authRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("public_id", publicId);
  form.append("folder", folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("ছবি আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করুন।");
  const result = await uploadRes.json();

  return { secureUrl: result.secure_url, publicId: result.public_id, resourceType: result.resource_type || "image" };
}

// "সেভ করুন" না চাপলে ছবি মুছে ফেলার জন্য — best-effort (ব্যর্থ হলেও চ্যাট আটকাবে না)।
export async function deleteGeneralChatImage(familyId, publicId, resourceType) {
  if (!WORKER_URL || !publicId) return;
  try {
    const idToken = await getIdToken();
    await fetch(`${WORKER_URL}/general-chat-delete-asset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, familyId, publicId, resourceType }),
    });
  } catch (e) {
    // best-effort cleanup — silent fail, ব্যবহারকারীকে বিরক্ত করার দরকার নেই
  }
}

// একটা নির্দিষ্ট exchange (user প্রশ্ন + AI উত্তর, অথবা শুধু AI উত্তর) সেভ করা —
// প্রতিটা message-এর পাশের "সেভ করুন" বাটন থেকে কল হয়।
export async function saveGeneralChatNote(familyId, { role, content, tag, sessionTitle, sourceLink, attachmentUrl }) {
  if (!auth.currentUser) throw new Error("লগইন সেশন পাওয়া যায়নি।");
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection("families").doc(familyId).collection("generalChatNotes").add({
    savedByUid: auth.currentUser.uid,
    role: role || "ai",
    content: content || "",
    tag: tag || "misc",
    sessionTitle: sessionTitle || null,
    sourceLink: sourceLink || null,
    attachmentUrl: attachmentUrl || null,
    pinned: false,
    visibility: "admin-only", // ভবিষ্যতে "family"-তে সম্প্রসারণযোগ্য রাখা হলো (এখনই ব্যবহার হচ্ছে না)
    savedAt: now,
  });
}

export async function listGeneralChatNotes(familyId) {
  const snap = await db.collection("families").doc(familyId).collection("generalChatNotes").get();
  const notes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  notes.sort((a, b) => {
    const at = a.savedAt && a.savedAt.toMillis ? a.savedAt.toMillis() : 0;
    const bt = b.savedAt && b.savedAt.toMillis ? b.savedAt.toMillis() : 0;
    return bt - at;
  });
  return notes;
}

export async function deleteGeneralChatNote(familyId, noteId) {
  await db.collection("families").doc(familyId).collection("generalChatNotes").doc(noteId).delete();
}

// Quick-Links directory (global, script-populated — scripts/populateGeneralChatQuickLinks.js)।
export async function listGeneralChatQuickLinks() {
  const snap = await db.collection("generalChatQuickLinks").where("active", "==", true).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const CATEGORY_LABELS = {
  nursery: "নার্সারি / কৃষি",
  religious: "ধর্মীয়",
  politics: "রাজনীতি",
  economics: "অর্থনীতি",
  history: "ইতিহাস-ঐতিহ্য",
  "geology-training": "ভূতত্ত্ব — Foreign Training",
  "geology-research": "ভূতত্ত্ব — Research",
  "geology-learning": "ভূতত্ত্ব — Learning",
  phd: "PhD / গবেষণা সুযোগ",
  health: "স্বাস্থ্য (সাধারণ জ্ঞান)",
  misc: "বিবিধ (উন্মুক্ত ওয়েব)",
};
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);
