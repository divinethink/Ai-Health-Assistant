// src/ai/aiClient.js
// Provider Adapter caller (client-side) — Architecture Plan §6.5/§6.7.
// Calls the Cloudflare Worker /ai-chat proxy (Groq behind the scenes).
// No API key here — auth is via Firebase ID token, verified server-side.
//
// Rate-Limit (429) Mitigation (roadmap §10.2.2) — এই থ্রেডে যোগ হলো:
// request-queue না রেখে (single-user-at-a-time UI বলে সরল থাকা যায়) সরাসরি
// exponential-backoff auto-retry। Worker 429 detect করলে (§10.2.5-এর সংযুক্ত
// fix) proper HTTP 429 status ফেরত দেয়, ক্লায়েন্ট সেটা দেখে non-alarming
// retry করে — ব্যবহারকারী raw error না দেখে শুধু soft loading-message দেখবে
// (onRetry callback দিয়ে, TriageForm.js-এ ব্যবহৃত)। Provider-level fallback
// (Mistral) এখনো Phase 1 stub-only (§6.5) — তাই এখানে শুধু retry, secondary-
// provider swap নেই।

import { auth } from "../legacy/firebaseConfig.js";

const WORKER_BASE_URL = import.meta.env.VITE_MEDIA_WORKER_URL || "";

/**
 * Ask the AI for guidance on an assembled health context.
 * @param {string} familyId
 * @param {object} payload - shape from healthContextEngine.buildHealthContext()
 * @param {Array<{role:string, content:string}>} conversationHistory - পূর্ববর্তী turn (assistant/user), স্তর-২/৩ follow-up-এর জন্য
 * @param {{ onRetry?: (attempt:number, maxRetries:number)=>void, maxRetries?: number, baseDelayMs?: number }} options
 * @returns {Promise<{ content: string, blocked?: boolean, usage?: object }>}
 */
export async function askAI(familyId, payload, conversationHistory = [], options = {}) {
  const { onRetry, maxRetries = 2, baseDelayMs = 1500, ageYears = null } = options;

  if (!WORKER_BASE_URL) {
    throw new Error("VITE_MEDIA_WORKER_URL env-var missing — worker URL not configured.");
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not signed in — cannot call AI.");
  }
  const idToken = await user.getIdToken();

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(`${WORKER_BASE_URL}/ai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, familyId, payload, conversationHistory, ageYears }),
      // ageYears `payload`-এর বাইরে, আলাদা top-level field — Worker শুধু নিজস্ব
      // dose pre-lookup-এ ব্যবহার করবে, Groq-কে পাঠানো কনটেক্সটে কখনো যাবে না
      // (roadmap §6.6 PII-minimized payload নীতি)।
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`AI request failed (status ${res.status}, no JSON body).`);
    }

    if (res.ok) return data; // { content, blocked, usage }

    const code = data && data.error ? data.error : `http-${res.status}`;
    const isRateLimited = res.status === 429 || /429/.test(code);

    if (isRateLimited && attempt < maxRetries) {
      attempt += 1;
      if (typeof onRetry === "function") onRetry(attempt, maxRetries);
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // ~1.5s, ~3s
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    // Surface known worker error codes distinctly so UI can show a friendly message.
    throw new Error(`ai-error:${code}`);
  }
}
