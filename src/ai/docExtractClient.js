// src/ai/docExtractClient.js
// ধাপ ৪-গ — OCR-টেক্সট থেকে AI-ম্যাপিং (Worker /doc-extract)। aiClient.js-এর মতোই Firebase ID token
// ও Worker URL ব্যবহার করে; কোনো API key ক্লায়েন্টে নেই। মূল যুক্তি doc-ai/docExtractCore.js-এ (টেস্টযোগ্য)।
// ব্যর্থ হলে throw নয় — { ok:false, reason } ফেরে, তাই কলার নীরবে হাতে-যাচাইয়ে ফিরতে পারে।

import { auth } from "../legacy/firebaseConfig.js";
import { runDocExtract } from "../health/doc-ai/docExtractCore.js";

const WORKER_BASE_URL = import.meta.env.VITE_MEDIA_WORKER_URL || "";

/**
 * @param {string} familyId
 * @param {"prescription"|"lab-report"|"visiting-card"} docType
 * @param {string} ocrText
 * @param {{ onRetry?: Function, maxRetries?: number }} [options]
 */
export function extractDocWithAi(familyId, docType, ocrText, options = {}) {
  return runDocExtract({
    docType, ocrText, familyId, baseUrl: WORKER_BASE_URL, options,
    getIdToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  });
}
