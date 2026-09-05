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
//   POST /ai-chat        { idToken, familyId, payload, conversationHistory, ageYears? } -> { content, blocked, usage }

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

// --- Dose Enforcement — Prevention Layer, Option A: Pre-Lookup Injection ---
// (roadmap §6.4/§10.2.1, owner-approved Option A over native tool-calling — কম
// ঝুঁকি, model-নির্ভরতা কম)। LLM কখনো dose-সংখ্যা নিজে generate করে না — user
// কোনো নির্দিষ্ট medicine-এর নাম উল্লেখ করলে, Groq-কে কল করার **আগেই** এখানে
// deterministic lookup করে ফলাফল (dose-fact বা block-reason) একটা অতিরিক্ত
// system-নোট হিসেবে messages-এ inject করা হয় — LLM শুধু সেটা বাংলায় ব্যাখ্যা
// করে, সংখ্যা নিজে বসায় না। Detection-layer (scanForDoseLeak, উপরে) backstop
// হিসেবে অপরিবর্তিত থাকছে (defense-in-depth)।
//
// **নোট — কেন duplicate, import না:** src/legacy/doseEnforcement.js-এ একই pure
// function আছে (client-side ব্যবহারের জন্য, ইতিমধ্যে ৭টা case দিয়ে verify করা)।
// এখানে duplicate রাখা হলো কারণ Worker আলাদা bundling-context (Wrangler/esbuild)
// এবং cross-directory import আসলে deploy করে পরীক্ষা না করে নিশ্চিত হওয়া যাচ্ছে
// না — production Worker না ভাঙার জন্য এই ছোট, ইতিমধ্যে-verified logic-ই এখানে
// আলাদাভাবে রাখা নিরাপদ (Zero-Risk Discipline)। দুই ফাইল ভবিষ্যতে একসাথে বদলাতে
// হবে যদি dose-logic নিজেই বদলায় (এই কমেন্টই সেই reminder)।

function medicineDocId(genericName) {
  return String(genericName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function findDosingRuleForAge(dosingRules, ageYears) {
  if (!Array.isArray(dosingRules) || ageYears == null) return null;
  return (
    dosingRules.find((r) => {
      const min = r.ageMin ?? 0;
      const max = r.ageMax;
      return ageYears >= min && (max == null || ageYears < max);
    }) || null
  );
}

function checkAllergyBlock(genericName, allergySubstances) {
  if (!genericName) return false;
  const target = genericName.toLowerCase();
  return (allergySubstances || []).some((s) => {
    const sub = String(s).toLowerCase();
    return sub && (target.includes(sub) || sub.includes(target));
  });
}

function checkInteractionFlags(medicineEntry, activeMedicationNames) {
  if (!medicineEntry || !Array.isArray(medicineEntry.interactsWith)) return [];
  const flags = [];
  for (const activeMed of activeMedicationNames || []) {
    if (!activeMed) continue;
    const activeLower = activeMed.toLowerCase();
    const matchedNote = medicineEntry.interactsWith.find((i) => String(i).toLowerCase().includes(activeLower));
    if (matchedNote) flags.push({ withGenericName: activeMed, note: matchedNote });
  }
  return flags;
}

function resolveDoseForMember({ medicineEntry, ageYears, allergySubstances, activeMedicationNames }) {
  if (!medicineEntry) return { blocked: true, reason: "no-verified-data" };
  if (medicineEntry.tier === "requires-consult") {
    return { blocked: true, reason: "requires-consult", genericName: medicineEntry.genericName, educationalUseNote: medicineEntry.educationalUseNote || null };
  }
  if (checkAllergyBlock(medicineEntry.genericName, allergySubstances)) {
    return { blocked: true, reason: "allergy-contraindication", genericName: medicineEntry.genericName };
  }
  const interactionFlags = checkInteractionFlags(medicineEntry, activeMedicationNames);
  if (interactionFlags.length > 0) {
    return { blocked: true, reason: "interaction-flag", genericName: medicineEntry.genericName, interactionFlags };
  }
  if (medicineEntry.highRiskFlag) {
    return { blocked: true, reason: "high-risk-flag", genericName: medicineEntry.genericName, riskNote: medicineEntry.riskNote || null };
  }
  const rule = findDosingRuleForAge(medicineEntry.dosingRules, ageYears);
  if (!rule) return { blocked: true, reason: "no-matching-age-rule", genericName: medicineEntry.genericName };
  const hasDoseValue = !!(rule.fixedDose || rule.dosePerKg);
  if (!hasDoseValue) return { blocked: true, reason: "note-only-no-dose", genericName: medicineEntry.genericName, note: rule.note || null };
  return {
    blocked: false,
    genericName: medicineEntry.genericName,
    dose: rule.fixedDose || rule.dosePerKg,
    frequency: rule.frequency || null,
    maxDurationDays: rule.maxDurationDays || null,
    contraindications: medicineEntry.contraindications || [],
    source: medicineEntry.source || [],
  };
}

// Firestore REST value-conversion — medicineDatabase entry-তে nested array/map/
// double/null থাকে, existing fsFieldsToPlain() (উপরে) শুধু flat string/int/bool-এর
// জন্য (অন্য endpoint-এ ব্যবহৃত, ওটা অপরিবর্তিত রাখা হলো — Process Rule ২)।
function fsValueToPlain(v) {
  if (!v || v.nullValue !== undefined) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(fsValueToPlain);
  if (v.mapValue !== undefined) return fsDocFieldsToPlain(v.mapValue.fields);
  return null;
}
function fsDocFieldsToPlain(fields) {
  const out = {};
  for (const k in fields || {}) out[k] = fsValueToPlain(fields[k]);
  return out;
}

// শুধু verified, non-emergency-only entry ফেরত দেয় — draft/unverified হলে rules
// নিজেই deny করবে (non-ok response), সেটা catch করে null (safe-default block)।
async function fetchMedicineEntry(env, idToken, genericName) {
  try {
    const res = await fetch(firestoreDocUrl(env, `medicineDatabase/${medicineDocId(genericName)}`), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const doc = await res.json();
    const data = fsDocFieldsToPlain(doc.fields);
    if (data.status !== "verified" || data.emergencyBystanderOnly) return null;
    return { genericName, ...data };
  } catch (e) {
    return null;
  }
}

const KNOWN_MEDICINES = [
  { term: "ors", genericName: "ORS (Oral Rehydration Salts)" },
  { term: "paracetamol", genericName: "Paracetamol" },
  { term: "zinc sulfate", genericName: "Zinc Sulfate" },
  { term: "ibuprofen", genericName: "Ibuprofen" },
  { term: "esomeprazole", genericName: "Esomeprazole" },
  { term: "pantoprazole", genericName: "Pantoprazole" },
  { term: "antacid plus", genericName: "Antacid Plus (+Simethicone)" },
  { term: "antacid", genericName: "Antacid (Al(OH)3+Mg(OH)2)" },
  { term: "bilastine", genericName: "Bilastine" },
  { term: "fexofenadine", genericName: "Fexofenadine" },
  { term: "cetirizine", genericName: "Cetirizine" },
  { term: "chlorpheniramine", genericName: "Chlorpheniramine" },
  { term: "salbutamol", genericName: "Salbutamol" },
  { term: "ketotifen", genericName: "Ketotifen" },
  { term: "domperidone", genericName: "Domperidone" },
  { term: "ambroxol", genericName: "Ambroxol" },
  { term: "montelukast", genericName: "Montelukast" },
  { term: "doxofylline", genericName: "Doxofylline" },
  { term: "azithromycin", genericName: "Azithromycin" },
  { term: "loperamide", genericName: "Loperamide" },
  { term: "metronidazole", genericName: "Metronidazole" },
  { term: "itopride", genericName: "Itopride" },
  { term: "naproxen", genericName: "Naproxen" },
  { term: "levothyroxine", genericName: "Levothyroxine" },
  { term: "amlodipine", genericName: "Amlodipine" },
  { term: "losartan", genericName: "Losartan" },
  { term: "metformin", genericName: "Metformin" },
  { term: "ondansetron", genericName: "Ondansetron" },
  { term: "clonazepam", genericName: "Clonazepam" },
  { term: "flupentixol", genericName: "Flupentixol + Melitracen (combination)" },
  { term: "pizotifen", genericName: "Pizotifen" },
  { term: "clotrimazole", genericName: "Clotrimazole" },
  { term: "povidone-iodine", genericName: "Povidone-Iodine" },
  { term: "antibiotic ointment", genericName: "Antibiotic Ointment (Mupirocin/Fusidic Acid)" },
  { term: "mefenamic acid", genericName: "Mefenamic Acid" },
  { term: "vitamin d3", genericName: "Vitamin D3 (Cholecalciferol)" },
  { term: "calcium", genericName: "Calcium (Carbonate/Citrate)" },
  { term: "iron", genericName: "Iron + Folic Acid (combination)" },
  { term: "dextromethorphan", genericName: "Dextromethorphan" },
  { term: "diclofenac", genericName: "Diclofenac (topical gel)" },
  { term: "lactulose", genericName: "Lactulose" },
  { term: "psyllium husk", genericName: "Psyllium Husk (Isabgol)" },
  { term: "bisacodyl", genericName: "Bisacodyl" },
  { term: "hydrocortisone", genericName: "Hydrocortisone + Local Anesthetic (topical hemorrhoid cream)" },
  { term: "benzydamine", genericName: "Benzydamine (oral rinse/gel)" },
  { term: "triamcinolone acetonide", genericName: "Triamcinolone Acetonide (dental paste)" },
  // "Aspirin" ইচ্ছাকৃতভাবে বাদ — emergencyBystanderOnly entry, fetchMedicineEntry()
  // এমনিতেই এটা filter করে (§5.4.1.1 normal-flow-এ কখনো accessible না), কিন্তু
  // এখানে না রাখাই স্পষ্টতর।
];

function detectMentionedMedicine(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const { term, genericName } of KNOWN_MEDICINES) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp("\\b" + escaped + "\\b", "i").test(lower)) return genericName;
  }
  return null;
}

function buildDoseFactMessage(resolution) {
  if (!resolution) return null;
  const REASON_TEXT = {
    "no-verified-data": "এই ওষুধের কোনো verified তথ্য এখনো app database-এ নেই",
    "requires-consult": "এই ওষুধ শুধুমাত্র ডাক্তারের পরামর্শে ব্যবহারযোগ্য (Tier 2/requires-consult)",
    "allergy-contraindication": "এই সদস্যের প্রোফাইলে সংশ্লিষ্ট এলার্জি রেকর্ড আছে",
    "interaction-flag": "এই সদস্যের চলমান অন্য ওষুধের সাথে সম্ভাব্য interaction আছে",
    "high-risk-flag": "এই ওষুধ high-risk (dependency/narrow-therapeutic-index) ক্যাটাগরির",
    "no-matching-age-rule": "এই বয়সের জন্য কোনো নির্দিষ্ট dosing-নিয়ম verified database-এ নেই",
    "note-only-no-dose": "এই বয়সের জন্য শুধু সতর্কতা আছে, নির্দিষ্ট dose নেই",
  };
  if (resolution.blocked) {
    const reasonText = REASON_TEXT[resolution.reason] || "dose তথ্য দেখানো যাবে না";
    return (
      `সিস্টেম-নোট (app-এর verified database থেকে, বাধ্যতামূলক পালনীয়): "${resolution.genericName || ""}"-এর ` +
      `কোনো dose/সংখ্যা উল্লেখ করবেন না। কারণ: ${reasonText}। শুধু generic/সাধারণ তথ্য দিন এবং সরাসরি ডাক্তার/` +
      `pharmacist-এর সাথে যোগাযোগের পরামর্শ দিন — নিজে থেকে কোনো dose-সংখ্যা কল্পনা করবেন না।`
    );
  }
  return (
    `সিস্টেম-নোট (app-এর verified database থেকে, বাধ্যতামূলক পালনীয় — শুধু এই সংখ্যাগুলোই ব্যবহার করুন, ` +
    `নিজে থেকে ভিন্ন কোনো সংখ্যা বলবেন না): "${resolution.genericName}" — dose: ${resolution.dose}, frequency: ` +
    `${resolution.frequency || "N/A"}${resolution.maxDurationDays ? ", সর্বোচ্চ মেয়াদ: " + resolution.maxDurationDays + " দিন" : ""}। ` +
    `উৎস: ${(resolution.source || []).join(", ")}। contraindication: ${(resolution.contraindications || []).join(", ") || "উল্লেখযোগ্য কিছু নেই"}।`
  );
}

const SYSTEM_PROMPT = `আপনি একটি পারিবারিক AI Health Assistant। কঠোরভাবে মেনে চলুন:
- কখনো কোনো medicine-এর dose/frequency/duration/সংখ্যা নিজে থেকে বলবেন না — শুধু generic-level পরামর্শ দেবেন, dose সবসময় app-এর নিজস্ব verified database থেকে আসে, আপনার থেকে নয়।
- chronic disease (ডায়াবেটিস/উচ্চ রক্তচাপ/থাইরয়েড/কিডনি)-এর existing medicine-এর dose পরিবর্তন/বন্ধ করার পরামর্শ কখনো দেবেন না।
- কোনো ঔষধ prescribe/suggest করার সময় সংখ্যাসূচক dose উল্লেখ করবেন না।
- আনুষ্ঠানিক "Prescription" জারি করবেন না — এটা "AI Health Guidance", প্রতিস্থাপন নয়, ডাক্তারের বিকল্প নয়।
- Emergency/urgent risk মনে হলে সবসময় দ্রুত ডাক্তার/হাসপাতাল/৯৯৯-এর পরামর্শ দিন।
- বাংলায় স্পষ্ট, সহজ ভাষায় উত্তর দিন।`;

async function callGroq(env, payload, conversationHistory, doseFactNote) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "স্বাস্থ্য-প্রসঙ্গ (JSON): " + JSON.stringify(payload) },
    ...(doseFactNote ? [{ role: "system", content: doseFactNote }] : []),
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
        const { idToken, familyId, payload, conversationHistory, ageYears } = await request.json();
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

        // Dose Enforcement — Prevention Layer, Option A (উপরে বিস্তারিত কমেন্ট)।
        // ageYears এখানেই শুধু ব্যবহৃত হয় — `payload`-এ কখনো merge করা হয় না,
        // তাই callGroq()-এ পাঠানো JSON.stringify(payload)-এ এটা কখনো যাবে না
        // (§6.6 PII-minimized payload নীতি অক্ষত)। lookup ব্যর্থ/অনির্ধারিত হলে
        // safe-default: কিছুই inject হবে না, system-prompt-ই backstop থাকে।
        let doseFactNote = null;
        try {
          const lastUserMsg = Array.isArray(conversationHistory)
            ? [...conversationHistory].reverse().find((m) => m && m.role === "user")
            : null;
          const scanText = [payload?.relevantClinicalContext?.symptoms, lastUserMsg?.content].filter(Boolean).join(" ");
          const mentioned = detectMentionedMedicine(scanText);
          if (mentioned) {
            const entry = await fetchMedicineEntry(env, idToken, mentioned);
            const resolution = resolveDoseForMember({
              medicineEntry: entry,
              ageYears: typeof ageYears === "number" ? ageYears : null,
              allergySubstances: payload?.relevantClinicalContext?.relevantAllergies || [],
              activeMedicationNames: payload?.relevantClinicalContext?.relevantMedications || [],
            });
            doseFactNote = buildDoseFactMessage(resolution);
          }
        } catch (e) {
          doseFactNote = null;
        }

        const { content, usage } = await callGroq(env, payload, conversationHistory, doseFactNote);
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
