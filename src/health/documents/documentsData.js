// Document/Report upload — Roadmap §7 (Medical Record / Document Vault), Checklist P2।
//
// OWNER-DECISION HISTORY (এই থ্রেড):
//  ১. Firebase Cloud Storage — বাতিল (Oct 2024+ Blaze/card বাধ্যতামূলক নীতি)।
//  ২. Cloudflare R2 — বাতিল (account-এ payment-method সংযুক্তি বাধ্যতামূলক, ২০২৬)।
//  ৩. Google Sign-in বাধ্যতামূলক করে Drive-storage — বাতিল (no-phone সদস্যদের
//     core no-account-needed design ভাঙে + permission-sync জটিলতা)।
//  ৪. Firestore-এ compressed-base64 (আগের সংস্করণ) — কাজ করত কিন্তু raw ফাইল
//     রাখা যেত না, PDF পাতা-প্রতি ছবিতে রূপান্তরিত/সীমিত হতো — owner-এর
//     "raw file দরকার" চাহিদা পূরণ করত না।
//  ৫. **এখন — Cloudinary** (genuinely free-forever, card লাগে না, image+raw/PDF
//     উভয়ই আসল ফাইল হিসেবে রাখে)। API secret আড়াল করতে নতুন Cloudflare Worker
//     (`worker/`) — কোনো নতুন permission-logic Worker-এ ডুপ্লিকেট হয়নি, সব
//     authorization existing firestore.rules-এর মাধ্যমেই হয় (worker/src/index.js
//     দ্রষ্টব্য)।
//
// ফ্লো:
//  Upload: client Firestore metadata doc তৈরি করে (status:"pending") → Worker-কে
//    docId পাঠিয়ে upload-signature চায় (Worker Firestore GET দিয়ে hasAccess()
//    verify করে) → client সরাসরি Cloudinary-তে upload করে → client নিজেই
//    metadata doc-এ cloudinaryUrl update করে (status:"ready")।
//  Delete: client শুধু Worker-কে docId পাঠায় → Worker নিজেই Firestore doc read+
//    delete করে (hasDeleteAccess() verify) → তারপর Cloudinary asset মোছে।

import { db, auth } from "../../legacy/firebaseConfig.js";
import { notifyMember } from "../../legacy/accessGrants.js";

export const DOC_TYPE_LABELS = {
  prescription: "Prescription",
  "lab-report": "Lab Report",
  imaging: "Imaging Report",
  "discharge-summary": "Discharge Summary",
  other: "Other",
};

const MAX_ORIGINAL_FILE_BYTES = 20 * 1024 * 1024;
const WORKER_URL = import.meta.env.VITE_MEDIA_WORKER_URL; // যেমন: https://health-assistant-media-proxy.<subdomain>.workers.dev

export function validateFile(file) {
  if (!file) return "একটা ফাইল বেছে নিন।";
  const okType = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okType) return "শুধু ছবি (jpg/png) বা PDF আপলোড করা যাবে।";
  if (file.size > MAX_ORIGINAL_FILE_BYTES) return "ফাইলের সাইজ 20MB-এর বেশি হতে পারবে না।";
  return null;
}

async function getIdToken() {
  if (!auth.currentUser) throw new Error("লগইন সেশন পাওয়া যায়নি — পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
  return auth.currentUser.getIdToken();
}

export async function uploadDocument(familyId, targetMemberId, callerMemberId, file, { docType, date, source }) {
  const err = validateFile(file);
  if (err) throw new Error(err);
  if (!WORKER_URL) throw new Error("Media server configure করা নেই (VITE_MEDIA_WORKER_URL missing) — owner-কে জানান।");

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const metaRef = db.collection("families").doc(familyId).collection("documents").doc();
  const docId = metaRef.id;

  // ১) placeholder metadata — এই write-ই Firestore rules-এ hasAccess() যাচাই করে,
  //    Worker পরে এই একই doc read করে সেই যাচাই-ই পুনর্ব্যবহার করবে।
  await metaRef.set({
    memberId: targetMemberId,
    docType,
    date: date || null,
    source: source ? source.trim() : null,
    fileName: file.name,
    originalContentType: file.type,
    status: "pending",
    lastEditedByMemberId: callerMemberId,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const idToken = await getIdToken();
    const authRes = await fetch(`${WORKER_URL}/upload-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, familyId, docId }),
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

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      body: form,
    });
    if (!uploadRes.ok) throw new Error("ফাইল আপলোড ব্যর্থ হয়েছে — আবার চেষ্টা করুন।");
    const result = await uploadRes.json();

    await metaRef.update({
      status: "ready",
      cloudinaryUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      cloudinaryResourceType: result.resource_type,
      sizeBytes: result.bytes || file.size,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { id: docId };
  } catch (e) {
    // আপলোড ব্যর্থ হলে খালি "pending" metadata থেকে যাওয়া ঠিক না — cleanup চেষ্টা
    // (নিজের/admin-এর ক্ষেত্রে সাধারণত hasDeleteAccess() থাকে; approved-grantee-এর
    // ক্ষেত্রে নাও থাকতে পারে — সেক্ষেত্রে stray "pending" record থেকে যাবে,
    // ক্ষতিকর না, শুধু cosmetic — non-blocking known limitation)।
    await metaRef.delete().catch(() => {});
    throw e;
  }
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

// Cloudinary "fl_attachment" flag — inline-view-এর বদলে Save-As force করে,
// কোনো নতুন signature লাগে না (delivery type: upload)।
export function getDownloadUrl(cloudinaryUrl) {
  return cloudinaryUrl.replace("/upload/", "/upload/fl_attachment/");
}

// roadmap §3.4 Admin delete-override safeguard অপরিবর্তিত — Worker নিজেই
// Firestore doc delete করে (hasDeleteAccess() verify-সহ), client শুধু
// notification পাঠায় (Admin-override হলে)।
export async function deleteDocument(familyId, docId, targetMemberId, callerMemberId) {
  if (!WORKER_URL) throw new Error("Media server configure করা নেই।");
  const idToken = await getIdToken();
  const res = await fetch(`${WORKER_URL}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, familyId, docId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error === "forbidden" || body.error === "not-found-or-forbidden"
      ? "এই Document মুছার অনুমতি আপনার নেই।"
      : "মুছতে ব্যর্থ হয়েছে — আবার চেষ্টা করুন।");
  }
  if (targetMemberId !== callerMemberId) {
    await notifyMember(familyId, targetMemberId, "document-deleted",
      "আপনার একটি Document Admin কর্তৃক মুছে ফেলা হয়েছে।");
  }
}
