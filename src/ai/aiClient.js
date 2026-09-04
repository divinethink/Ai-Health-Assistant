// src/ai/aiClient.js
// Provider Adapter caller (client-side) — Architecture Plan §6.5/§6.7.
// Calls the Cloudflare Worker /ai-chat proxy (Groq behind the scenes).
// No API key here — auth is via Firebase ID token, verified server-side.

import { auth } from "../legacy/firebaseConfig.js";

const WORKER_BASE_URL = import.meta.env.VITE_MEDIA_WORKER_URL || "";

/**
 * Ask the AI for guidance on an assembled health context.
 * @param {string} familyId
 * @param {object} payload - shape from healthContextEngine.buildHealthContext()
 * @returns {Promise<{ content: string }>}
 */
export async function askAI(familyId, payload) {
  if (!WORKER_BASE_URL) {
    throw new Error("VITE_MEDIA_WORKER_URL env-var missing — worker URL not configured.");
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not signed in — cannot call AI.");
  }

  const idToken = await user.getIdToken();

  const res = await fetch(`${WORKER_BASE_URL}/ai-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, familyId, payload }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`AI request failed (status ${res.status}, no JSON body).`);
  }

  if (!res.ok) {
    // Surface known worker error codes distinctly so UI can show a friendly message.
    const code = data && data.error ? data.error : `http-${res.status}`;
    throw new Error(`ai-error:${code}`);
  }

  return data; // { content: "..." }
}
