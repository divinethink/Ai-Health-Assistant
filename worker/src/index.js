// Document/Report vault (Roadmap §7) — Cloudinary upload-signature + delete proxy।
// + AI Orchestration (Roadmap §10.2.5, Architecture Plan Part B §6.7/§6.7.1) — Groq LLM-proxy
// (primary) + Mistral (secondary/failover, §6.5 Phase 2, Thread-এ activated ২০২৬-০৯-০৭)।
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

// Detection-layer, §6.4.1 (highRiskFlag medicine — Clonazepam/Flupentixol+Melitracen-এর
// মতো dependency/narrow-therapeutic-index ওষুধ) — dose-gap/adjustment আলোচনা ও
// herbal/lifestyle-complementary suggestion phrase একসাথে ধরার pattern। শুধু তখনই
// active থাকে যখন conversation-এ কোনো highRiskFlag: true medicine reference পাওয়া
// গেছে (নিচে highRiskContext flag)।
const HIGH_RISK_SUPPRESS_PATTERN =
  /(ভেষজ|হার্বাল|প্রাকৃতিক\s*(উপায়|চিকিৎসা)?|ঘরোয়া\s*(উপায়|চিকিৎসা)?|আয়ুর্বেদ|হোমিওপ্যাথি|ডোজ\s*(কমিয়ে|বাড়িয়ে|পরিবর্তন|গ্যাপ)|মিস\s*হলে|বাদ\s*দিলে|বন্ধ\s*করলে|ধীরে\s*ধীরে\s*কমিয়ে|taper|withdrawal)/i;

function scanForHighRiskLeak(text) {
  return typeof text === "string" && HIGH_RISK_SUPPRESS_PATTERN.test(text);
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
    // §6.4.1 — highRiskFlag medicine-এ normal Tier-2 block-message-এর চেয়েও সংকীর্ণ
    // নির্দেশনা: dose-gap/adjustment আলোচনা ও herbal/lifestyle-complementary
    // guidance দুটোই suppress, শুধু generic-info + interaction-warning + urgent-referral।
    if (resolution.reason === "high-risk-flag") {
      return (
        `সিস্টেম-নোট (app-এর verified database থেকে, বাধ্যতামূলক পালনীয়): "${resolution.genericName || ""}" ` +
        `high-risk (dependency/narrow-therapeutic-index) ক্যাটাগরির ওষুধ। কোনো dose-সংখ্যা, dose-পরিবর্তন/গ্যাপ, ` +
        `বা "মিস হলে কী করবেন" জাতীয় আলোচনায় একেবারেই যাবেন না। কোনো ভেষজ/হোমিওপ্যাথি/ঘরোয়া/lifestyle-complementary ` +
        `পরামর্শও দেবেন না — শুধু সাধারণ generic-level শিক্ষামূলক তথ্য, সম্ভাব্য interaction-সতর্কতা, ও সরাসরি ` +
        `ডাক্তার/pharmacist-এর কাছে জরুরি যোগাযোগের পরামর্শ দিন।` +
        (resolution.riskNote ? ` অতিরিক্ত নোট: ${resolution.riskNote}` : "")
      );
    }
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

// --- Medical Science — Specialty-Context Routing (roadmap §4.1, P6 ধাপ ৩) ---
// client-side `specialtyRouter.js` (src/health/treatment-modes/) deterministic-
// ভাবে age/symptom-keyword দিয়ে specialty ঠিক করে, `payload.specialty`-তে পাঠায়।
// এখানে শুধু সেই key অনুযায়ী একটা ছোট অতিরিক্ত system-নোট বেছে নেওয়া হয় —
// existing doseFactNote injection-এর ঠিক একই প্যাটার্নে (নিচে messages-এ)।
// **এটা কোনো safety-rule bypass/override করে না** — উপরের SYSTEM_PROMPT-এর সব
// bright-line rule অপরিবর্তিতভাবে প্রযোজ্য থাকে; এই নোট শুধু response-এর
// context/vocabulary একটু বেশি relevant করে তোলে (soft hint)। "general-medicine"
// (ডিফল্ট)-এ কোনো নোট লাগে না — SYSTEM_PROMPT-ই যথেষ্ট, extra token খরচ এড়ানো
// হয়েছে (§10.2.2 token-efficient prompt design)।
//
// **নোট — কেন duplicate, import না:** client-side `SPECIALTY_LABELS`-এর মতোই
// ছোট static map, Worker আলাদা bundling-context বলে (উপরের dose-enforcement
// duplicate-এর একই যুক্তি) এখানে আলাদাভাবে রাখা হলো।
const SPECIALTY_NOTES = {
  pediatrics:
    "প্রাসঙ্গিক specialty context: এই সদস্য শিশু/নবজাতক — Pediatrics-এর দৃষ্টিভঙ্গি থেকে উত্তর দিন (বয়স-উপযোগী ভাষা, WHO IMCI-সংগতিপূর্ণ সতর্কতা), তবে সব বিদ্যমান নিয়ম অপরিবর্তিত থাকবে।",
  "gynecology-obstetrics":
    "প্রাসঙ্গিক specialty context: প্রশ্নটি গাইনি/প্রসূতি-সম্পর্কিত হতে পারে — প্রয়োজনে স্পর্শকাতর/stigma-conscious ভাষা ব্যবহার করুন, abnormal bleeding-জাতীয় বিষয়ে ডাক্তার-পরামর্শে উৎসাহ দিন।",
  dermatology:
    "প্রাসঙ্গিক specialty context: প্রশ্নটি ত্বক/চুল/নখ-সম্পর্কিত (Dermatology) — dermatologist-backed guidance-কে অগ্রাধিকার দিন, marketing/influencer-দাবি এড়িয়ে চলুন।",
  "endocrinology-medicine":
    "প্রাসঙ্গিক specialty context: প্রশ্নটি হরমোন/দীর্ঘমেয়াদি রোগ (থাইরয়েড/ডায়াবেটিস/উচ্চ-রক্তচাপ) সম্পর্কিত হতে পারে — chronic-disease bright-line rule (কোনো নতুন dose/পরিবর্তন-পরামর্শ না) বিশেষভাবে মনে রাখুন।",
  "physical-medicine":
    "প্রাসঙ্গিক specialty context: প্রশ্নটি জয়েন্ট/হাড়/মাংসপেশি-সম্পর্কিত (Physical Medicine) — movement/lifestyle-সচেতন সাধারণ পরামর্শ দিন, নির্দিষ্ট diagnosis দাবি করবেন না।",
  // নতুন (P7, roadmap §11/§11.2) — client-side NutritionGuidance.js এই key
  // সরাসরি সেট করে পাঠায় (keyword-detection না, definitional override)।
  "nutrition-fitness":
    "প্রাসঙ্গিক specialty context: প্রশ্নটি সাধারণ nutrition/diet/fitness-সংক্রান্ত (treatment mode/medical diagnosis না) — সরকারি/professional সোর্স-ভিত্তিক সাধারণ lifestyle guidance দিন, কোনো medicine/dose/supplement-ডোজ উল্লেখ করবেন না, existing chronic condition/allergy থাকলে সেটা বিবেচনায় রেখে সতর্ক থাকুন এবং জটিল/মেডিকেল প্রশ্নে ডাক্তার/nutritionist-consult এর পরামর্শ দিন।",
};

// Controlled Web Search (Architecture Plan Part B §6.3.1, roadmap §10.1) —
// শুধু এই whitelisted domain-list-এর মধ্যেই Groq compound-model search করবে
// (`search_settings.include_domains`, Groq API-level enforcement — LLM নিজে
// এড়িয়ে যেতে পারে না)। **bright-line অপরিবর্তিত:** dosing/safety-critical তথ্য
// কখনো web-search থেকে আসে না — সবসময় verified `medicineDatabase` lookup-tool
// থেকে (§12.1, উপরের dose-enforcement)। এই list শুধু general knowledge-refresh
// (guideline/recall/nutrition-fitness-beauty reference)-এর জন্য, roadmap §10.1।
const WEB_SEARCH_WHITELIST_DOMAINS = [
  "who.int", "cochranelibrary.com", "fda.gov", "nhs.uk", "patient.info", "cdc.gov",
  "*.gov.bd", "icddrb.org", "medex.com.bd", "dimsbd.com",
  "doctime.com.bd", "sebaghar.com", "medeasy.health",
  "medlineplus.gov", "msdmanuals.com", "nice.org.uk", "mohfw.gov.in", "drugs.com",
  "acsm.org", "odphp.health.gov", "nin.res.in", "ods.od.nih.gov", "bfsa.gov.bd", "eatright.org",
  "aad.org", "bad.org.uk", "iadvl.org", "dgdagov.info",
  "ema.europa.eu", "ccras.nic.in", "hamdard.com.bd", "nccih.nih.gov", "nch.org.in",
];

function buildLLMMessages(payload, conversationHistory, doseFactNote, specialtyNote) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "স্বাস্থ্য-প্রসঙ্গ (JSON): " + JSON.stringify(payload) },
    ...(specialtyNote ? [{ role: "system", content: specialtyNote }] : []),
    ...(doseFactNote ? [{ role: "system", content: doseFactNote }] : []),
    ...(Array.isArray(conversationHistory) ? conversationHistory : []),
  ];
}

// দুই provider-ই শেয়ার করে — raw/অসম্পূর্ণ <think> reasoning-leak কখনো
// user-কে দেখানো হবে না (§6.4.1/Thread 21 learning, provider-নিরপেক্ষ)।
function cleanLLMContent(rawContent) {
  let content = rawContent || "";
  if (content.includes("<think>")) {
    const closeIdx = content.indexOf("</think>");
    content = closeIdx !== -1 ? content.replace(/<think>[\s\S]*?<\/think>/gi, "") : content.slice(0, content.indexOf("<think>"));
  }
  content = content.trim();
  if (!content) {
    content = "দুঃখিত, উত্তরটা ঠিকভাবে তৈরি হয়নি। আরেকবার চেষ্টা করুন, বা প্রশ্নটা একটু ছোট করে জিজ্ঞাসা করুন।";
  }
  return content;
}

async function callGroq(env, payload, conversationHistory, doseFactNote, specialtyNote, useWebSearch) {
  const messages = buildLLMMessages(payload, conversationHistory, doseFactNote, specialtyNote);

  const body = { messages, max_tokens: 1500 };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` };

  if (useWebSearch) {
    // Controlled Web Search (§6.3.1/§10.1) — Groq-এর নিজস্ব `groq/compound`
    // built-in web-search tool, কিন্তু `search_settings.include_domains` দিয়ে
    // শুধু whitelisted domain-এই সীমাবদ্ধ (Groq API-level enforcement)। এই মোডে
    // reasoning_effort/format param প্রযোজ্য না (compound model-এর নিজস্ব
    // orchestration, qwen3.6-এর thinking-mode-config-এর সাথে সম্পর্কহীন)।
    body.model = "groq/compound";
    body.compound_custom = { tools: { enabled_tools: ["web_search"] } };
    body.search_settings = { include_domains: WEB_SEARCH_WHITELIST_DOMAINS };
    headers["Groq-Model-Version"] = "latest";
  } else {
    body.model = "qwen/qwen3.6-27b";
    // reasoning_effort:"none" — dual-mode (thinking/non-thinking) model-এ
    // thinking mode বন্ধ করে দেয়। আমাদের বাংলা health-guidance conversational
    // use-case-এ জটিল multi-step reasoning দরকার নেই, আর thinking mode-ই
    // দেখা গেছে মাঝে মাঝে টোকেন-বাজেট শেষ করে ফেলে/loop-এ আটকে যায় (owner
    // screenshot, ২০২৬-০৯-০৫)।
    body.reasoning_effort = "none";
    // reasoning_format:"hidden" — defense-in-depth: reasoning_effort ভবিষ্যতে
    // কোনো কারণে override/ignore হলেও, এটা raw <think> content API-স্তরেই
    // suppress করে (Groq docs: শুধু final answer content ফেরত আসে)।
    body.reasoning_format = "hidden";
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Controlled web-search ব্যর্থ হলে (model unavailable/tool-error ইত্যাদি)
    // একবার plain non-search মোডে fallback — general-chat-এর একই pattern
    // (§10.1 নীতি অক্ষুণ্ণ: search ব্যর্থ হলে "কম সাহায্য" দিকেই ঝোঁকা, error না)।
    if (useWebSearch) {
      return callGroq(env, payload, conversationHistory, doseFactNote, specialtyNote, false);
    }
    throw new Error(`groq-error-${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = cleanLLMContent(data.choices?.[0]?.message?.content || "");
  // executed_tools[].search_results — citation/source তালিকা, "silently মিশিয়ে
  // দেওয়া হবে না; reference হিসেবে দেখানো হবে" নীতির (§10.1) বাস্তবায়ন — client
  // এই sources আলাদাভাবে "সূত্র" হিসেবে দেখাবে, answer-টেক্সটের ভেতরে মেশানো হয় না।
  let sources = [];
  try {
    const executed = data.choices?.[0]?.message?.executed_tools;
    if (Array.isArray(executed)) {
      executed.forEach((t) => {
        (t.search_results?.results || []).forEach((r) => {
          if (r?.url) sources.push({ title: r.title || r.url, url: r.url });
        });
      });
    }
  } catch (e) {
    sources = [];
  }
  return { content, usage: data.usage || null, sources };
}

// Secondary/fallback provider (Architecture Plan Part B §6.5, Phase 2) — শুধু তখনই
// call হয় যখন Groq (primary) ব্যর্থ হয় এবং env.MISTRAL_API_KEY set করা আছে (owner
// `wrangler secret put MISTRAL_API_KEY` চালালেই সক্রিয় হয়, না চালালে Phase 1-এর
// মতোই আচরণ অপরিবর্তিত থাকে — কোনো ভাঙা পরিবর্তন না)। OpenAI-compatible endpoint।
async function callMistral(env, payload, conversationHistory, doseFactNote, specialtyNote) {
  const messages = buildLLMMessages(payload, conversationHistory, doseFactNote, specialtyNote);

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.MISTRAL_MODEL || "mistral-small-latest",
      messages,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`mistral-error-${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = cleanLLMContent(data.choices?.[0]?.message?.content || "");
  // Mistral compound/web-search সাপোর্ট করে না — sources সবসময় খালি array,
  // caller-side destructure-shape callGroq()-এর সাথে অভিন্ন রাখতে (§6.5 abstraction)।
  return { content, usage: data.usage || null, sources: [] };
}

// Provider Adapter routing (§6.5) — primary Groq, silent failover secondary Mistral।
// শুধু rate-limit (429) বা provider-error/outage-এ failover হয় — অন্য কোনো error
// (যেমন auth/network কোড-বাগ) হলেও safety অক্ষুণ্ণ রাখতে Mistral একবার try করা হয়,
// কিন্তু ব্যর্থ হলে caller-এর কাছে সবসময় primary (Groq)-এর error/status ফেরত যায়
// (existing 429-detection/client-retry logic অপরিবর্তিত থাকে)।
async function callLLM(env, payload, conversationHistory, doseFactNote, specialtyNote, useWebSearch) {
  try {
    return await callGroq(env, payload, conversationHistory, doseFactNote, specialtyNote, useWebSearch);
  } catch (primaryErr) {
    if (!env.MISTRAL_API_KEY) throw primaryErr;
    try {
      return await callMistral(env, payload, conversationHistory, doseFactNote, specialtyNote);
    } catch (secondaryErr) {
      throw primaryErr;
    }
  }
}

// ============================================================
// General Chat — Admin-only, health-restriction-free (নতুন এই থ্রেড)
// ============================================================
// roadmap-এ নতুন সংযোজন হিসেবে আলোচিত: family-health-triage-এর বাইরে, শুধু
// Admin-এর জন্য একটা সম্পূর্ণ আলাদা "General Chat" মোড — যেকোনো বিষয়ে
// (কৃষি/নার্সারি, ধর্মীয়, রাজনীতি, অর্থনীতি, ইতিহাস, ভূতত্ত্ব, গবেষণা/PhD,
// সাধারণ চিকিৎসা-জ্ঞান ইত্যাদি) খোলামেলা আলোচনা, ওয়েব-ব্রাউজ ও ছবি-বিশ্লেষণ সহ।
//
// **স্পষ্টীকরণ (গুরুত্বপূর্ণ, ভবিষ্যতের রক্ষণাবেক্ষণকারীর জন্য):** এখানে যা
// "বাদ" দেওয়া হয়েছে তা শুধু এই **app-এর নিজস্ব** health-specific restriction
// (dose-numeric-scanner, highRiskFlag-suppression, chronic-medicine bright-line,
// domain-whitelist) — এগুলো এই ফিচারের জন্য প্রাসঙ্গিক না (এটা member-specific
// clinical dose-suggestion tool না)। Groq/Mistral নিজেদের platform-level
// content-safety এখানে অপরিবর্তিতভাবে প্রযোজ্য থাকে — সেটা bypass করার কোনো
// instruction এখানে নেই।
//
// **Endpoint আলাদা রাখার কারণ (Process Rule ২, Zero-Risk Discipline):**
// existing `/ai-chat` (health-triage) route/logic একদম অপরিবর্তিত রাখতে এখানে
// সম্পূর্ণ নতুন, independent function/route তৈরি হয়েছে — কোনো শাখা-শর্ত পুরনো
// কোডে যোগ করা হয়নি।

const GENERAL_CHAT_SYSTEM_PROMPT = `আপনি একটি সাধারণ-উদ্দেশ্য AI সহকারী — এটি একটি পারিবারিক Health Assistant app-এর "General Chat" মোড, যা শুধুমাত্র family-এর Admin (প্রাপ্তবয়স্ক) ব্যবহার করছেন এই মূল health/triage ফিচারের সম্পূর্ণ বাইরে।
- এখানে app-এর নিজস্ব health-triage/dose-restriction (dose-সংখ্যা এড়িয়ে চলা, chronic-medicine-পরিবর্তন-না-বলা ইত্যাদি) প্রযোজ্য না — এটা কোনো symptom-triage/medicine-prescribing টুল না। তাই কৃষি/নার্সারি, ধর্মীয় জিজ্ঞাসা, রাজনীতি, অর্থনীতি, ইতিহাস, ভূতত্ত্ব, গবেষণা/PhD, সাধারণ চিকিৎসা/বৈজ্ঞানিক জ্ঞান ইত্যাদি যেকোনো বিষয়ে সরাসরি, বিস্তারিত ও স্বাধীনভাবে আলোচনা করুন।
- ব্যবহারকারী বাংলা বা ইংরেজি যেভাবে লেখেন, স্বাভাবিক সেই ভাষাতেই উত্তর দিন। অপ্রয়োজনীয় disclaimer/সতর্কতার পুনরাবৃত্তি এড়িয়ে চলুন।
- প্রশ্নটা যদি পরিবারের কোনো নির্দিষ্ট সদস্যের বর্তমান অসুস্থতা/উপসর্গ নিয়ে মনে হয় (personal medical triage দরকার এমন), শুধু একবার সংক্ষেপে জানিয়ে দিন যে app-এর "Symptom Check" ফিচার ব্যবহার করলে ভালো হবে — তারপরও প্রশ্নের সাধারণ-জ্ঞানভিত্তিক অংশের উত্তর দিতে বাধা নেই।
- ছবি দেওয়া হলে মনোযোগ দিয়ে বিশ্লেষণ করুন (যেমন গাছ/উদ্ভিদ প্রজাতি/রোগ-পোকা শনাক্তকরণ, নথি/লেখা পড়া, সাধারণ বস্তু-শনাক্তকরণ)।`;

// ID-token থেকেই uid বের হয় (verifyFirebaseIdToken, উপরে) — এখানে শুধু সেই uid
// পরিবারের `adminUids`-এ আছে কিনা যাচাই হয়। `families/{familyId}` doc যেকোনো
// authenticated ব্যবহারকারী GET করতে পারেন (firestore.rules-এ আগে থেকেই allow
// get: if request.auth != null আছে) — তাই এখানে কোনো নতুন rules-পরিবর্তন লাগেনি,
// admin-membership যাচাই সম্পূর্ণ এই Worker-এর application-logic-এ হচ্ছে।
async function verifyIsAdminOfFamily(env, idToken, familyId, uid) {
  try {
    const res = await fetch(firestoreDocUrl(env, `families/${familyId}`), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return false;
    const doc = await res.json();
    const values =
      (doc.fields &&
        doc.fields.adminUids &&
        doc.fields.adminUids.arrayValue &&
        doc.fields.adminUids.arrayValue.values) ||
      [];
    return values.some((v) => v.stringValue === uid);
  } catch (e) {
    return false;
  }
}

// hasImages হলে vision-capable model (এখনো Groq-এ multimodal support সহ,
// একই model যা health-chat-এও ব্যবহৃত হচ্ছে — নতুন model যাচাই লাগেনি)।
// নাহলে (ও useWebSearch !== false হলে) Groq-এর built-in `groq/compound`
// system — এটাই ওয়েব-ব্রাউজ দেয়, কোনো নতুন/paid third-party search-API-key
// লাগে না (Process Rule ৮, free-tier-first)। compound ব্যর্থ হলে (যেমন
// account-এ অনুপলব্ধ) plain text-model দিয়ে স্বয়ংক্রিয় fallback — conversation
// আটকে থাকবে না, শুধু সেই turn-এ web-search ছাড়াই উত্তর আসবে।
async function callGroqGeneralChat(env, messages, { useWebSearch, hasImages }) {
  const fullMessages = [{ role: "system", content: GENERAL_CHAT_SYSTEM_PROMPT }, ...(Array.isArray(messages) ? messages : [])];

  let model;
  const body = { max_tokens: 2000 };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` };

  if (hasImages) {
    model = env.GENERAL_CHAT_VISION_MODEL || "qwen/qwen3.6-27b";
  } else if (useWebSearch !== false) {
    model = env.GENERAL_CHAT_COMPOUND_MODEL || "groq/compound";
    body.compound_custom = { tools: { enabled_tools: ["web_search", "visit_website"] } };
    headers["Groq-Model-Version"] = "latest";
  } else {
    model = env.GENERAL_CHAT_TEXT_MODEL || "qwen/qwen3.6-27b";
  }
  body.model = model;
  body.messages = fullMessages;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    // compound (web-search) মোড ব্যর্থ হলে এক ধাপ fallback — text-only, plain
    // model দিয়ে retry (recursion একবারই ঘটে, কারণ পরের কলে useWebSearch:false)।
    if (!hasImages && useWebSearch !== false) {
      return callGroqGeneralChat(env, messages, { useWebSearch: false, hasImages: false });
    }
    throw new Error(`groq-error-${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = cleanLLMContent(data.choices?.[0]?.message?.content || "");
  return { content, usage: data.usage || null, modelUsed: model };
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
        const { idToken, familyId, payload, conversationHistory, ageYears, useWebSearch } = await request.json();
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

        // Specialty-context routing (roadmap §4.1, উপরে বিস্তারিত কমেন্ট) —
        // পুরোপুরি soft/non-blocking, lookup ব্যর্থ/অজানা হলে safe-default:
        // কিছুই inject হবে না, SYSTEM_PROMPT-ই backstop থাকে।
        const specialtyNote = payload?.specialty && SPECIALTY_NOTES[payload.specialty] ? SPECIALTY_NOTES[payload.specialty] : null;

        // Dose Enforcement — Prevention Layer, Option A (উপরে বিস্তারিত কমেন্ট)।
        // ageYears এখানেই শুধু ব্যবহৃত হয় — `payload`-এ কখনো merge করা হয় না,
        // তাই callGroq()-এ পাঠানো JSON.stringify(payload)-এ এটা কখনো যাবে না
        // (§6.6 PII-minimized payload নীতি অক্ষত)। lookup ব্যর্থ/অনির্ধারিত হলে
        // safe-default: কিছুই inject হবে না, system-prompt-ই backstop থাকে।
        let doseFactNote = null;
        // §6.4.1 Prevention-layer flag — true হলে detection-layer-এ high-risk
        // suppress-pattern-ও scan হবে (নিচে)।
        let highRiskContext = false;
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
            highRiskContext = resolution.reason === "high-risk-flag";
          }
        } catch (e) {
          doseFactNote = null;
          highRiskContext = false;
        }

        const { content, usage, sources } = await callLLM(env, payload, conversationHistory, doseFactNote, specialtyNote, useWebSearch);
        const doseLeak = scanForDoseLeak(content);
        const highRiskLeak = highRiskContext && scanForHighRiskLeak(content);
        const blocked = doseLeak || highRiskLeak;
        const fallbackMessage = highRiskLeak
          ? "এই ওষুধ সম্পর্কে dose/পরিবর্তন সংক্রান্ত যেকোনো প্রশ্নে সরাসরি ডাক্তার/pharmacist-এর সাথে যোগাযোগ করুন।"
          : "দুঃখিত, এই উত্তরে ওষুধের মাত্রা-সংক্রান্ত তথ্য সনাক্ত হয়েছে বলে এটি দেখানো যাচ্ছে না। ওষুধের dose/পরিবর্তন সংক্রান্ত যেকোনো প্রশ্নে সরাসরি ডাক্তার/pharmacist-এর সাথে যোগাযোগ করুন।";

        return json(env, {
          content: blocked ? fallbackMessage : content,
          blocked,
          usage,
          // blocked হলে sources-ও suppress করা হচ্ছে — defense-in-depth,
          // suppressed-response-এর সাথে কোনো আংশিক তথ্যও যেন না যায়।
          sources: blocked ? [] : sources || [],
        });
      }

      // --- General Chat routes (Admin-only, উপরে বিস্তারিত কমেন্ট) ---

      if (request.method === "POST" && url.pathname === "/general-chat-upload-auth") {
        const { idToken, familyId } = await request.json();
        if (!idToken || !familyId) return json(env, { error: "missing-params" }, 400);

        let uid;
        try {
          uid = await verifyFirebaseIdToken(env, idToken);
        } catch (e) {
          return json(env, { error: "invalid-token" }, 401);
        }
        if (!uid) return json(env, { error: "invalid-token" }, 401);

        const isAdmin = await verifyIsAdminOfFamily(env, idToken, familyId, uid);
        if (!isAdmin) return json(env, { error: "forbidden-admin-only" }, 403);

        // নতুন, আলাদা Cloudinary folder — health-document vault
        // (`health-docs/{familyId}`)-এর থেকে সম্পূর্ণ আলাদা রাখা হলো, কারণ এই
        // ছবিগুলো clinical/health-record না এবং কোনো Firestore metadata-doc
        // ছাড়াই ephemeral-ভাবে upload হয় (§ history না-সেভ নীতি)।
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = `general-chat/${familyId}`;
        const publicId = "gc-" + timestamp + "-" + Math.random().toString(36).slice(2, 10);
        const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
        const signature = await sha1Hex(toSign);

        return json(env, {
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          timestamp, signature, publicId, folder,
        });
      }

      // ব্যবহারকারী কোনো ছবি "সেভ" না করলে client নিজেই এই endpoint কল করে
      // Cloudinary থেকে asset মুছে দেয় (AI response পাওয়ার পরপরই বা সেশন শেষে) —
      // কোনো Firestore doc নেই বলে সরাসরি Cloudinary delete API।
      if (request.method === "POST" && url.pathname === "/general-chat-delete-asset") {
        const { idToken, familyId, publicId, resourceType } = await request.json();
        if (!idToken || !familyId || !publicId) return json(env, { error: "missing-params" }, 400);

        let uid;
        try {
          uid = await verifyFirebaseIdToken(env, idToken);
        } catch (e) {
          return json(env, { error: "invalid-token" }, 401);
        }
        if (!uid) return json(env, { error: "invalid-token" }, 401);

        const isAdmin = await verifyIsAdminOfFamily(env, idToken, familyId, uid);
        if (!isAdmin) return json(env, { error: "forbidden-admin-only" }, 403);

        const basicAuth = "Basic " + btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
        const cloudDelUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/${resourceType || "image"}/upload?public_ids[]=${encodeURIComponent(publicId)}`;
        await fetch(cloudDelUrl, { method: "DELETE", headers: { Authorization: basicAuth } });

        return json(env, { ok: true });
      }

      if (request.method === "POST" && url.pathname === "/general-chat") {
        const { idToken, familyId, messages, useWebSearch, hasImages } = await request.json();
        if (!idToken || !familyId || !Array.isArray(messages)) return json(env, { error: "missing-params" }, 400);

        let uid;
        try {
          uid = await verifyFirebaseIdToken(env, idToken);
        } catch (e) {
          return json(env, { error: "invalid-token" }, 401);
        }
        if (!uid) return json(env, { error: "invalid-token" }, 401);

        const isAdmin = await verifyIsAdminOfFamily(env, idToken, familyId, uid);
        if (!isAdmin) return json(env, { error: "forbidden-admin-only" }, 403);

        const { content, usage, modelUsed } = await callGroqGeneralChat(env, messages, { useWebSearch, hasImages });
        return json(env, { content, usage, modelUsed });
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
