// General Chat AI caller — src/ai/aiClient.js-এর retry/backoff pattern reuse,
// কিন্তু আলাদা Worker endpoint (`/general-chat`) call করে (health `/ai-chat`
// endpoint অপরিবর্তিত/অস্পৃষ্ট রাখতে, Process Rule ২)।

import { auth } from "../../legacy/firebaseConfig.js";

const WORKER_BASE_URL = import.meta.env.VITE_MEDIA_WORKER_URL || "";

/**
 * @param {string} familyId
 * @param {Array<{role:string, content:(string|Array)}>} messages - OpenAI-style; ছবি থাকলে
 *   content একটা array হবে: [{type:"text",text},{type:"image_url",image_url:{url}}]
 * @param {{ useWebSearch?: boolean, hasImages?: boolean, onRetry?: Function, maxRetries?: number, baseDelayMs?: number }} options
 * @returns {Promise<{ content: string, usage?: object, modelUsed?: string }>}
 */
export async function askGeneralChat(familyId, messages, options = {}) {
  const { useWebSearch = true, hasImages = false, onRetry, maxRetries = 2, baseDelayMs = 1500 } = options;

  if (!WORKER_BASE_URL) throw new Error("VITE_MEDIA_WORKER_URL env-var missing — worker URL not configured.");
  const user = auth.currentUser;
  if (!user) throw new Error("User not signed in — cannot call AI.");
  const idToken = await user.getIdToken();

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(`${WORKER_BASE_URL}/general-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, familyId, messages, useWebSearch, hasImages }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`AI request failed (status ${res.status}, no JSON body).`);
    }

    if (res.ok) return data; // { content, usage, modelUsed }

    const code = data && data.error ? data.error : `http-${res.status}`;
    const isRateLimited = res.status === 429 || /429/.test(code);

    if (isRateLimited && attempt < maxRetries) {
      attempt += 1;
      if (typeof onRetry === "function") onRetry(attempt, maxRetries);
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    if (code === "forbidden-admin-only") throw new Error("general-chat-error:admin-only");
    throw new Error(`general-chat-error:${code}`);
  }
}
