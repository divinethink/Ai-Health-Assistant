// General Chat — data layer। আপডেট (এই থ্রেড): আগের ephemeral/per-message-save
// মডেল বাতিল — এখন পুরো session Firestore-এ auto-save হয় (HealthEpisode/
// EpisodeMessage-এর হুবহু structural pattern reuse, Architecture Plan Part C §9)।
// Delete শুধু পুরো session-scope-এ (owner-approved)। এছাড়া lightweight Project
// (Knowledge+Instructions) CRUD।

import { db, auth } from "../../legacy/firebaseConfig.js";

const WORKER_URL = import.meta.env.VITE_MEDIA_WORKER_URL;

// owner-approved ("সর্বোচ্চ সীমা দিন") — Process Rule ৮ (unbounded reads এড়ানো)
// মেনে একটা generous কিন্তু bounded cap। দরকার হলে শুধু এই সংখ্যা বদলালেই চলবে।
export const SESSION_LIST_LIMIT = 300;
export const KNOWLEDGE_MAX_CHARS = 8000;

async function getIdToken() {
  if (!auth.currentUser) throw new Error("লগইন সেশন পাওয়া যায়নি — পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
  return auth.currentUser.getIdToken();
}

function famRef(familyId) {
  return db.collection("families").doc(familyId);
}

// ---------------- ছবি (ephemeral upload, session-এর সাথে persist হয়) ----------------

export function validateGeneralChatImage(file) {
  if (!file) return "একটা ছবি বেছে নিন।";
  if (!file.type.startsWith("image/")) return "শুধু ছবি (jpg/png) দেওয়া যাবে।";
  if (file.size > 8 * 1024 * 1024) return "ছবির সাইজ 8MB-এর বেশি হতে পারবে না।";
  return null;
}

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

// composer-এ pending অবস্থায় user ছবি বাতিল করলে (এখনো কোনো message-এ persist হয়নি) —
// best-effort cleanup, ব্যর্থ হলেও চ্যাট আটকাবে না।
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
    // best-effort — silent fail
  }
}

// ---------------- Session / Message (auto-save) ----------------

export async function createGeneralChatSession(familyId, { title, projectId }) {
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const ref = await famRef(familyId).collection("generalChatSessions").add({
    title: title || "নতুন চ্যাট",
    projectId: projectId || null,
    createdByUid: auth.currentUser.uid,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function listGeneralChatSessions(familyId) {
  const snap = await famRef(familyId).collection("generalChatSessions")
    .orderBy("updatedAt", "desc").limit(SESSION_LIST_LIMIT).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function loadGeneralChatMessages(familyId, sessionId) {
  const snap = await famRef(familyId).collection("generalChatSessions").doc(sessionId)
    .collection("messages").orderBy("createdAt", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addGeneralChatMessage(familyId, sessionId, msg) {
  const sessionRef = famRef(familyId).collection("generalChatSessions").doc(sessionId);
  const ref = await sessionRef.collection("messages").add({
    role: msg.role,
    text: msg.text || "",
    imageUrl: msg.imageUrl || null,
    imagePublicId: msg.imagePublicId || null,
    imageResourceType: msg.imageResourceType || null,
    tag: msg.tag || "misc",
    sources: msg.sources || [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await sessionRef.update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  return ref.id;
}

// Edit+Resend (নতুন, owner-request) — user নিজের আগের প্রশ্ন edit করে আবার
// পাঠালে, সেই message ও তারপরের সব message (Firestore-এ persist হওয়া অংশ)
// মুছে ফেলা হয়, যাতে edit করা message-ই সেই position-এর নতুন latest turn হয়ে
// যায় (standard AI-chatbox আচরণ)। সংযুক্ত ছবি (যদি থাকে) ইচ্ছাকৃতভাবে
// Cloudinary থেকে মোছা হয় না — edit করা message নিজেই সেই ছবি পুনরায় ব্যবহার
// করতে পারে বলে delete করলে data-loss হতে পারত (Process Rule ৩)।
export async function deleteGeneralChatMessagesByIds(familyId, sessionId, ids) {
  if (!ids || ids.length === 0) return;
  const sessionRef = famRef(familyId).collection("generalChatSessions").doc(sessionId);
  const batch = db.batch();
  ids.forEach((id) => batch.delete(sessionRef.collection("messages").doc(id)));
  await batch.commit();
}

// পুরো session delete — owner-approved scope (individual-message-delete নেই)।
// সংযুক্ত ছবি থাকলে Cloudinary থেকেও best-effort মুছে ফেলা হয়। ৫০০-message batch-
// limit-এর বেশি বড় কোনো single session এই family-scale app-এ প্রত্যাশিত না।
export async function deleteGeneralChatSession(familyId, sessionId) {
  const sessionRef = famRef(familyId).collection("generalChatSessions").doc(sessionId);
  const msgsSnap = await sessionRef.collection("messages").get();

  const batch = db.batch();
  const imagesToClean = [];
  msgsSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.imagePublicId) imagesToClean.push({ publicId: data.imagePublicId, resourceType: data.imageResourceType });
    batch.delete(d.ref);
  });
  batch.delete(sessionRef);
  await batch.commit();

  imagesToClean.forEach((img) => deleteGeneralChatImage(familyId, img.publicId, img.resourceType));
}

// ---------------- Project (Knowledge + Instructions, lightweight) ----------------

export async function createGeneralChatProject(familyId, { name, instructions, knowledge }) {
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const ref = await famRef(familyId).collection("generalChatProjects").add({
    name: name || "নতুন Project",
    instructions: (instructions || "").slice(0, KNOWLEDGE_MAX_CHARS),
    knowledge: (knowledge || "").slice(0, KNOWLEDGE_MAX_CHARS),
    createdByUid: auth.currentUser.uid,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateGeneralChatProject(familyId, projectId, { name, instructions, knowledge }) {
  await famRef(familyId).collection("generalChatProjects").doc(projectId).update({
    name: name || "নতুন Project",
    instructions: (instructions || "").slice(0, KNOWLEDGE_MAX_CHARS),
    knowledge: (knowledge || "").slice(0, KNOWLEDGE_MAX_CHARS),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function listGeneralChatProjects(familyId) {
  const snap = await famRef(familyId).collection("generalChatProjects").orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteGeneralChatProject(familyId, projectId) {
  await famRef(familyId).collection("generalChatProjects").doc(projectId).delete();
}

// ---------------- Quick-Links directory (global, script-populated) ----------------

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
