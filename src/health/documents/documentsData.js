// Document/Report upload — Roadmap §7 (Medical Record / Document Vault),
// Checklist P2. File bytes Cloud Storage-এ (storage.rules), metadata
// Firestore-এ families/{familyId}/documents/{id}। healthRecordsData.js-এর
// একই pattern reuse (hasAccess() permission model, notifyMember delete-
// safeguard) — নতুন কিছু invent করা হয়নি।
//
// পরিধি (এই থ্রেড): শুধু upload + metadata + list + delete। OCR/text-
// extraction/AI-interpretation Architecture Plan Part C §7 (P5, ভবিষ্যতে)।

import { db, storage } from "../../legacy/firebaseConfig.js";
import { notifyMember } from "../../legacy/accessGrants.js";

export const DOC_TYPE_LABELS = {
  prescription: "Prescription",
  "lab-report": "Lab Report",
  imaging: "Imaging Report",
  "discharge-summary": "Discharge Summary",
  other: "Other",
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // storage.rules-এর সাথে মিলিয়ে (10MB)
const ALLOWED_TYPE_RE = /^image\/|^application\/pdf$/;

export function validateFile(file) {
  if (!file) return "একটা ফাইল বেছে নিন।";
  if (!ALLOWED_TYPE_RE.test(file.type)) return "শুধু ছবি (jpg/png) বা PDF আপলোড করা যাবে।";
  if (file.size > MAX_FILE_BYTES) return "ফাইলের সাইজ 10MB-এর বেশি হতে পারবে না।";
  return null;
}

export async function uploadDocument(familyId, targetMemberId, callerMemberId, file, { docType, date, source }) {
  const err = validateFile(file);
  if (err) throw new Error(err);

  const docRef = db.collection("families").doc(familyId).collection("documents").doc();
  const docId = docRef.id;
  const storagePath = `families/${familyId}/documents/${targetMemberId}/${docId}/${file.name}`;

  await storage.ref(storagePath).put(file, { contentType: file.type });

  const now = firebase.firestore.FieldValue.serverTimestamp();
  await docRef.set({
    memberId: targetMemberId,
    docType,
    date: date || null,
    source: source ? source.trim() : null,
    storagePath,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    lastEditedByMemberId: callerMemberId,
    createdAt: now,
    updatedAt: now,
  });
  return docId;
}

export async function listDocuments(familyId, targetMemberId) {
  const snap = await db.collection("families").doc(familyId).collection("documents")
    .where("memberId", "==", targetMemberId).get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => {
    const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });
  return docs;
}

export async function getDocumentDownloadUrl(storagePath) {
  return storage.ref(storagePath).getDownloadURL();
}

// roadmap §3.4 Admin delete-override safeguard — healthRecordsData.js-এর
// deleteHealthRecord()-এর হুবহু pattern: targetMemberId != callerMemberId
// মানেই Admin-override, owner-কে notification। Storage থেকে ফাইল আগে মুছে
// তারপর metadata মোছা হচ্ছে — ব্যর্থ storage-delete হলে metadata থেকে
// যাবে (orphan-file নয়, orphan-metadata; পরে retry/cleanup সহজ, উল্টোটা
// হলে metadata হারিয়ে storage-এ untracked ফাইল থেকে যেত)।
export async function deleteDocument(familyId, docId, targetMemberId, callerMemberId, storagePath) {
  try {
    await storage.ref(storagePath).delete();
  } catch (e) {
    if (e.code !== "storage/object-not-found") throw e;
  }
  await db.collection("families").doc(familyId).collection("documents").doc(docId).delete();
  if (targetMemberId !== callerMemberId) {
    await notifyMember(familyId, targetMemberId, "document-deleted",
      "আপনার একটি Document Admin কর্তৃক মুছে ফেলা হয়েছে।");
  }
}
