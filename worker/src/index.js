// Document/Report vault (Roadmap §7) — Cloudinary upload-signature + delete proxy।
// + AI Orchestration (Roadmap §10.2.5, Architecture Plan Part B §6.7/§6.7.1) — Groq LLM-proxy।
//
// কেন এই Worker দরকার: Cloudinary API secret ও Groq API key কখনো client bundle-এ
// যেতে পারবে না (Process Rule ৪)। কিন্তু permission-decision (কে কোন memberId-এর
// জন্য upload/delete/AI-chat করতে পারবে) আমরা এখানে ডুপ্লিকেট করি না — সেটা
// সম্পূর্ণভাবে ইতিমধ্যে deployed `firestore.rules`-কেই একমাত্র source-of-truth
// রাখা হয়েছে। পদ্ধতি: caller-এর Firebase ID token verify করে, তারপর সেই idToken
// দিয়ে Firestore REST API-কে request পাঠানো হয় — Firestore নিজেই rules অনুযায়ী
// allow/deny করে; Worker শুধু ফলাফল দেখে পরবর্তী action চালায় কিনা ঠিক করে।
//
// Endpoints:
//   POST /upload-auth  { idToken, familyId, docId } -> { cloudName, apiKey, timestamp, signature, publicId, folder }
//   POST /delete        { idToken, familyId, docId } -> { ok: true }
//   POST /ai-chat        { idToken, familyId, memberId, payload, conversationHistory } -> { content, blocked, usage }

import { jwtVerify, createRemoteJWKSet } from "jose";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function firestoreDocUrl(env, path) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
}

function fsFieldsToPlain(fields) {
  const out = {};
  for (const k in fields || {}) {
    const v = fields[k];
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
  }
  return out;
}

async function sha1Hex(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- AI-চ্যাট (§6.7) সংযুক্ত হেল্পার ---

// ধাপ ১: idToken-এর signature Firebase-এর public JWK দিয়ে verify করা (Admin SDK ছাড়াই, §6.7.1)।
async function verifyFirebaseIdToken(env, idToken) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    audience: env.FIREBASE_PROJECT_ID,
  });
  return payload.user_id || payload.sub;
}

// ধাপ ২: family-membership নিশ্চিতকরণ — existing pattern reuse (uidMemberIndex, rules-gated GET)।
async function verifyFamilyMembership(env, idToken, familyId, uid) {
  const docPath = `families/${familyId}/uidMemberIndex/${uid}`;
  const res = await fetch(firestoreDocUrl(env, docPath), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return res.ok;
}

// Detection-layer (§6.4) — বাংলা (০-৯) + Latin (0-9) digit ও mg/ml/tablet/বার-জাতীয়
// unit-শব্দ একসাথে থাকা pattern LLM output-এ পাওয়া গেলে dose-leak সন্দেহ করা হবে।
const DOSE_PATTERN = new RegExp(
  "[0-9০-৯]+(\\.[0-9০-৯]+)?\\s*(mg|ml|mcg|iu|মিগ্রা|মিলি|গ্রাম|ইউনিট|tablet|ট্যাবলেট|ক্যাপসুল|" +
    "বার/দিন|বার\\s*/\\s*দিন|times a day|per day|/day)",
  "i"
);

function scanForDoseLeak(text) {
  return typeof text === "string" && DOSE_PATTERN.test(text);
}

const SYSTEM_PROMPT = `আপনি একটি পারিবারিক AI Health Assistant। কঠোরভাবে মেনে চলুন:
- কখনো কোনো medicine-এর dose/frequency/duration/সংখ্যা নিজে থেকে বলবেন না — শুধু generic-level পরামর্শ দেবেন, dose সবসময় app-এর নিজস্ব verified database থেকে আসে, আপনার থেকে নয়।
- chronic disease (ডায়াবেটিস/উচ্চ রক্তচাপ/থাইরয়েড/কিডনি)-এর existing medicine-এর dose পরিবর্তন/বন্ধ করার পরামর্শ কখনো দেবেন না।
- কোনো ঔষধ prescribe/suggest করার সময় সংখ্যাসূচক dose উল্লেখ করবেন না।
- আনুষ্ঠানিক "Prescription" জারি করবেন না — এটা "AI Health Guidance", প্রতিস্থাপন নয়, ডাক্তারের বিকল্প নয়।
- Emergency/urgent risk মনে হলে সবসময় দ্রুত ডাক্তার/হাসপাতাল/৯৯৯-এর পরামর্শ দিন।
- বাংলায় স্পষ্ট, সহজ ভাষায় উত্তর দিন।`;

async function callGroq(env, payload, conversationHistory) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "স্বাস্থ্য-প্রসঙ্গ (JSON): " + JSON.stringify(payload) },
    ...(Array.isArray(conversationHistory) ? conversationHistory : []),
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen3.6-27b",
      messages,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`groq-error-${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = (data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return { content, usage: data.usage || null };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(env) });
    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/upload-auth") {
        const { idToken, familyId, docId } = await request.json();
        if (!idToken || !familyId || !docId) return json(env, { error: "missing-params" }, 400);

        const docPath = `families/${familyId}/documents/${docId}`;
        const getRes = await fetch(firestoreDocUrl(env, docPath), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!getRes.ok) return json(env, { error: "forbidden" }, 403);

        const timestamp = Math.floor(Date.now() / 1000);
        const folder = `health-docs/${familyId}`;
        const publicId = docId;
        const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
        const signature = await sha1Hex(toSign);

        return json(env, {
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          timestamp, signature, publicId, folder,
        });
      }

      if (request.method === "POST" && url.pathname === "/delete") {
        const { idToken, familyId, docId } = await request.json();
        if (!idToken || !familyId || !docId) return json(env, { error: "missing-params" }, 400);

        const docPath = `families/${familyId}/documents/${docId}`;
        const docUrl = firestoreDocUrl(env, docPath);

        const getRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${idToken}` } });
        if (!getRes.ok) return json(env, { error: "not-found-or-forbidden" }, 404);
        const doc = await getRes.json();
        const fields = fsFieldsToPlain(doc.fields);
        const publicId = fields.cloudinaryPublicId || docId;
        const resourceType = fields.cloudinaryResourceType || "image";

        const delRes = await fetch(docUrl, { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
        if (!delRes.ok) return json(env, { error: "forbidden" }, 403);

        const basicAuth = "Basic " + btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
        const cloudDelUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/${resourceType}/upload?public_ids[]=${encodeURIComponent(publicId)}`;
        await fetch(cloudDelUrl, { method: "DELETE", headers: { Authorization: basicAuth } });

        return json(env, { ok: true });
      }

      if (request.method === "POST" && url.pathname === "/ai-chat") {
        const { idToken, familyId, payload, conversationHistory } = await request.json();
        if (!idToken || !familyId || !payload) return json(env, { error: "missing-params" }, 400);

        let uid;
        try {
          uid = await verifyFirebaseIdToken(env, idToken);
        } catch (e) {
          return json(env, { error: "invalid-token" }, 401);
        }
        if (!uid) return json(env, { error: "invalid-token" }, 401);

        const isMember = await verifyFamilyMembership(env, idToken, familyId, uid);
        if (!isMember) return json(env, { error: "forbidden" }, 403);

        const { content, usage } = await callGroq(env, payload, conversationHistory);
        const blocked = scanForDoseLeak(content);

        return json(env, {
          content: blocked
            ? "দুঃখিত, এই উত্তরে ওষুধের মাত্রা-সংক্রান্ত তথ্য সনাক্ত হয়েছে বলে এটি দেখানো যাচ্ছে না। ওষুধের dose/পরিবর্তন সংক্রান্ত যেকোনো প্রশ্নে সরাসরি ডাক্তার/pharmacist-এর সাথে যোগাযোগ করুন।"
            : content,
          blocked,
          usage,
        });
      }

      return json(env, { error: "not-found" }, 404);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      // Rate-Limit Mitigation (§10.2.2) — Groq 429 হলে client নির্ভরযোগ্যভাবে
      // detect করে exponential-backoff retry করতে পারে সেজন্য generic 500-এর
      // বদলে proper 429 status ফেরত দেওয়া হচ্ছে (aiClient.js-এ retry-logic)।
      const status = /groq-error-429/.test(msg) ? 429 : 500;
      return json(env, { error: msg }, status);
    }
  },
};
