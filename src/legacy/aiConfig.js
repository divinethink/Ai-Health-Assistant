// aiConfig.js — AI provider + model সেটিং (শুধু App Creator বদলান)। ডক: appDesign/aiConfig { provider, model, updatedAt, updatedBy }
// API key এখানে কখনো নয় — key থাকে শুধু Worker-এর secret-এ (GitHub Secrets → deploy-worker)।
// আসল নিয়ন্ত্রণ firestore.rules (লেখা শুধু App Creator UID + provider/model ফরম্যাট); এখানের যাচাই শুধু সুবিধার জন্য।
// Worker প্রতি AI-চ্যাটে এটি পড়ে; অবৈধ/ব্যর্থ হলে ডিফল্ট (Groq Qwen → Mistral)।
import { db, auth } from "./firebaseConfig.js";

export const AI_PROVIDERS = [
  { id: "groq", label: "Groq", examples: ["qwen/qwen3.8-27b", "llama-3.3-70b-versatile"] },
  { id: "mistral", label: "Mistral", examples: ["mistral-small-latest", "mistral-large-latest"] },
  { id: "openrouter", label: "OpenRouter", examples: ["meta-llama/llama-4-maverick"] },
];
export const DEFAULT_AI_CONFIG = { provider: "groq", model: "qwen/qwen3.8-27b" };

// rules/Worker-এর regex-এর সাথে মেলানো: ৩–৮০ অক্ষর, অক্ষর/সংখ্যা দিয়ে শুরু, শুধু A-Za-z0-9 . _ : / -
export const isValidModelName = (m) => typeof m === "string" && m.length >= 3 && m.length <= 80 && /^[A-Za-z0-9][A-Za-z0-9._:/-]+$/.test(m);

/** সেভ-করা সেটিং; ডক না থাকলে/ব্যর্থ হলে null (= ডিফল্ট চলছে)। */
export async function loadAiConfig() {
  try {
    const snap = await db.collection("appDesign").doc("aiConfig").get();
    const d = snap.exists ? snap.data() : null;
    if (d && AI_PROVIDERS.some((p) => p.id === d.provider) && isValidModelName(d.model)) return { provider: d.provider, model: d.model };
  } catch (_e) { /* ডিফল্ট */ }
  return null;
}

export async function saveAiConfig(provider, model) {
  const user = auth.currentUser;
  if (!user) throw new Error("সাইন-ইন প্রয়োজন");
  const m = String(model || "").trim();
  if (!AI_PROVIDERS.some((p) => p.id === provider) || !isValidModelName(m)) throw new Error("invalid");
  await db.collection("appDesign").doc("aiConfig").set({
    provider, model: m, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: user.uid,
  });
}
