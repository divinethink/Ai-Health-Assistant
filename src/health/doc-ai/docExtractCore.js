// src/health/doc-ai/docExtractCore.js
//
// ধাপ ৪-গ — AI-ম্যাপিংয়ের ক্লায়েন্ট-যুক্তি (নেটওয়ার্ক/auth ইনজেক্ট করা — তাই Node-এ টেস্টযোগ্য)।
// প্রবাহ: PII-মাস্ক → Worker /doc-extract → JSON পার্স → grounding-যাচাই (মূল OCR-টেক্সটের বিরুদ্ধে)।
// **কখনো throw করে না** — ব্যর্থ হলে { ok:false, reason } ফেরে, UI নীরবে হাতে-যাচাইয়ে ফিরবে।
// কিছুই সেভ করে না; ফল শুধু প্রস্তাব (৪-ঘ-তে খালি ঘরে হলুদ ট্যাগসহ বসবে)।

import { maskPii } from "./piiMask.js";
import { parseAiJson, validatePrescriptionAi, validateLabAi, validateCardAi } from "./aiResultValidate.js";

export const AI_DOC_TYPES = ["prescription", "lab-report", "visiting-card"];
const MIN_CHARS = 20;

const VALIDATORS = {
  prescription: (data, text) => validatePrescriptionAi(data, text),
  "lab-report": (data, text) => validateLabAi(data, text),
  "visiting-card": (data, text) => validateCardAi(data, text),
};

function hasUsable(docType, v) {
  if (docType === "visiting-card") return Object.values(v.fields || {}).some(Boolean);
  return (v.items || []).length > 0;
}

/**
 * @param {object} p
 * @param {"prescription"|"lab-report"|"visiting-card"} p.docType
 * @param {string} p.ocrText - মূল (মাস্ক-না-করা) OCR টেক্সট; grounding এর বিরুদ্ধে হয়
 * @param {string} p.familyId
 * @param {() => Promise<string>} p.getIdToken
 * @param {string} p.baseUrl - Worker URL
 * @param {typeof fetch} [p.fetchFn]
 * @param {(ms:number)=>Promise<void>} [p.sleep]
 * @param {{ maxRetries?: number, baseDelayMs?: number, timeoutMs?: number, onRetry?: (n:number,max:number)=>void }} [p.options]
 * @returns {Promise<{ok:true, docType, provider, masked:number, empty:boolean, items?:object[], fields?:object, droppedItems?:number, dropped?:string[]} | {ok:false, reason:string}>}
 */
export async function runDocExtract({ docType, ocrText, familyId, getIdToken, baseUrl, fetchFn = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), options = {} }) {
  const { maxRetries = 2, baseDelayMs = 1500, timeoutMs = 25000, onRetry } = options;
  try {
    if (!AI_DOC_TYPES.includes(docType)) return { ok: false, reason: "unsupported-type" };
    if (!baseUrl) return { ok: false, reason: "not-configured" };
    const text = String(ocrText || "").trim();
    if (text.replace(/\s/g, "").length < MIN_CHARS) return { ok: false, reason: "text-too-short" };
    if (!familyId) return { ok: false, reason: "no-family" };

    const idToken = await getIdToken();
    if (!idToken) return { ok: false, reason: "not-signed-in" };
    const { text: masked, masked: maskedCount } = maskPii(text, docType);

    let attempt = 0;
    for (;;) {
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
      let res, body;
      try {
        res = await fetchFn(`${baseUrl}/doc-extract`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, familyId, docType, text: masked }),
          signal: ctl ? ctl.signal : undefined,
        });
        body = await res.json();
      } catch (e) {
        return { ok: false, reason: e && e.name === "AbortError" ? "timeout" : "network" };
      } finally {
        if (timer) clearTimeout(timer);
      }

      if (res.ok) {
        const data = parseAiJson(body && body.data);
        if (!data) return { ok: false, reason: "bad-json" };
        const v = VALIDATORS[docType](data, text);
        return { ok: true, docType, provider: (body && body.provider) || null, masked: maskedCount, empty: !hasUsable(docType, v), ...v };
      }
      const code = body && body.error ? String(body.error) : `http-${res.status}`;
      if (code === "daily-limit") return { ok: false, reason: "daily-limit" };
      if ((res.status === 429 || code === "429") && attempt < maxRetries) {
        attempt += 1;
        if (typeof onRetry === "function") onRetry(attempt, maxRetries);
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
        continue;
      }
      return { ok: false, reason: code };
    }
  } catch (e) {
    return { ok: false, reason: "error" };
  }
}
