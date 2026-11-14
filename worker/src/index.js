// Document/Report vault (Roadmap §7) — Cloudinary upload-signature + delete proxy।
// + AI Orchestration (Roadmap §10.2.5, Architecture Plan Part B §6.7/§6.7.1) — Groq LLM-proxy
// (primary) + Mistral (secondary/failover, §6.5 Phase 2, Thread-এ activated ২০২৬-০৯-০৭)।
// (এই থ্রেড, owner-approved) — শুধু non-image ক্ষেত্রে, Mistral vision/web-search
// সাপোর্ট করে না বলে।
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
//   POST /doctor-upload-auth { idToken, familyId, doctorId } -> same shape (Doctor Details visiting-card)
//   POST /doctor-delete       { idToken, familyId, doctorId } -> { ok: true }
//   POST /ai-chat        { idToken, familyId, payload, conversationHistory, ageYears? } -> { content, blocked, usage }
//   POST /doc-extract    { idToken, familyId, docType, text } -> { data, provider }  (OCR-টেক্সট → কঠোর JSON; ধাপ ৪-গ)

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

// allowed: app-এর verified DB থেকে inject-করা হুবহু dose/frequency লেখা — শুধু সেগুলো বাদ দিয়ে স্ক্যান;
// অন্য যেকোনো সংখ্যা-dose এখনো block (defense-in-depth অক্ষত)।
function scanForDoseLeak(text, allowed = []) {
  if (typeof text !== "string") return false;
  let t = text;
  for (const a of allowed) if (a && String(a).length >= 2) t = t.split(String(a)).join(" ");
  return DOSE_PATTERN.test(t);
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

// গুরুতর (high-severity) interaction — এগুলো সক্রিয় ওষুধ হলে dose কখনো দেখানো হয় না (block থাকে)।
// বাকি (মাঝারি/কম, qualitative) interaction-এ dose দেখানো হয় লাল সতর্কতা সহ (owner-approved, ২০২৬-১১-১১)।
const HIGH_SEVERITY_INTERACTION_TERMS = ["azithromycin", "clarithromycin", "erythromycin", "warfarin", "clopidogrel", "methotrexate", "lithium", "digoxin"];
function isHighSeverityInteraction(flag) {
  const hay = (String(flag.withGenericName || "") + " " + String(flag.note || "")).toLowerCase();
  return HIGH_SEVERITY_INTERACTION_TERMS.some((t) => hay.includes(t));
}

function resolveDoseCore({ medicineEntry, ageYears, allergySubstances, activeMedicationNames }) {
  if (!medicineEntry) return { blocked: true, reason: "no-verified-data" };
  if (medicineEntry.tier === "requires-consult") {
    return { blocked: true, reason: "requires-consult", genericName: medicineEntry.genericName, educationalUseNote: medicineEntry.educationalUseNote || null };
  }
  const interactionFlags = checkInteractionFlags(medicineEntry, activeMedicationNames);
  if (interactionFlags.some(isHighSeverityInteraction)) {
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
    interactionWarnings: interactionFlags.length > 0 ? interactionFlags : undefined,
  };
}

// এলার্জি এখন ব্লক নয় — শুধু allergyWarning ফ্ল্যাগ; বাকি নিয়ম অপরিবর্তিত।
function resolveDoseForMember(args) {
  const r = resolveDoseCore(args);
  const warn = !!(args.medicineEntry && checkAllergyBlock(args.medicineEntry.genericName, args.allergySubstances));
  return warn ? { ...r, allergyWarning: true } : r;
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
  const msg = buildDoseFactCore(resolution);
  const warns = [];
  if (resolution && resolution.allergyWarning) warns.push("এই সদস্যের প্রোফাইলে সংশ্লিষ্ট এলার্জি রেকর্ড আছে");
  if (resolution && !resolution.blocked && Array.isArray(resolution.interactionWarnings) && resolution.interactionWarnings.length) {
    warns.push("চলমান অন্য ওষুধের সাথে সম্ভাব্য interaction আছে (" + resolution.interactionWarnings.map((f) => f.withGenericName).join(", ") + ")");
  }
  if (msg && warns.length) {
    return msg + " লাল সতর্কতা (বাধ্যতামূলক): উত্তরের একদম শুরুতে আলাদা একটি লাইনে লিখুন \"⚠️ **সতর্কতা:** " + warns.join("; ") + " — ব্যবহারের আগে ডাক্তার/ফার্মাসিস্টকে জানান।\" (লাইনটা ⚠️ দিয়ে শুরু হতে হবে)। তারপর ডাটাবেসের dose যেমন আছে হুবহু (একই লেখা ও একক) দিন, নিজে বদলাবেন না।";
  }
  return msg;
}

function buildDoseFactCore(resolution) {
  if (!resolution) return null;
  const REASON_TEXT = {
    "no-verified-data": "এই ওষুধের কোনো verified তথ্য এখনো app database-এ নেই",
    "requires-consult": "এই ওষুধ শুধুমাত্র ডাক্তারের পরামর্শে ব্যবহারযোগ্য (Tier 2/requires-consult)",
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
      `কোনো dose/সংখ্যা উল্লেখ করবেন না। কারণ: ${reasonText}। উত্তরের একদম শুরুতে আলাদা লাইনে লিখুন "⚠️ **সতর্কতা:** ${reasonText}।" ` +
      `তারপর সাধারণ তথ্য দিন, ফার্মেসি/ডাক্তারকে কী কী জানাতে হবে (বয়স, এলার্জি, চলমান ওষুধ) বলুন এবং কোন লক্ষণে দ্রুত ডাক্তার/হাসপাতালে যেতে হবে সংক্ষেপে বলুন। নিজে থেকে কোনো dose-সংখ্যা কল্পনা করবেন না।`
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
- কখনো কোনো medicine-এর dose/frequency/duration/সংখ্যা কোনো নির্দিষ্ট পরিবার-সদস্যের জন্য ব্যক্তিগতভাবে/প্রেসক্রাইব-এর ঢঙে নিজে থেকে বলবেন না — dose সবসময় app-এর নিজস্ব verified database থেকে আসে, আপনার থেকে নয়। **ব্যতিক্রম (owner-approved, ২০২৬-০৯-১২):** তিনটা সাধারণ-আলোচনা চ্যাটে — Medical Science ("medical-science"), Herbal/Homeopathy ("herbal-homeopathy"), Nutrition/Fitness ("nutrition-fitness") — নিচে specialty-note-এ বর্ণিত মাত্রায় dose/practice-related তথ্য খোলামেলা আলোচনা অনুমোদিত। এটাও কখনো কোনো বাস্তব সদস্যের জন্য ব্যক্তিগত নির্দেশনা হিসেবে নয়, শুধু সাধারণ/শিক্ষামূলক আলোচনা হিসেবে।
- chronic disease (ডায়াবেটিস/উচ্চ রক্তচাপ/থাইরয়েড/কিডনি)-এর existing medicine-এর dose পরিবর্তন/বন্ধ করার পরামর্শ কখনো দেবেন না।
- কোনো ঔষধ prescribe/suggest করার সময় সংখ্যাসূচক dose উল্লেখ করবেন না।
- আনুষ্ঠানিক "Prescription" জারি করবেন না — এটা "AI Health Guidance", প্রতিস্থাপন নয়, ডাক্তারের বিকল্প নয়।
- Emergency/urgent risk মনে হলে সবসময় দ্রুত ডাক্তার/হাসপাতাল/৯৯৯-এর পরামর্শ দিন।
- বাংলায় স্পষ্ট, সহজ ভাষায় উত্তর দিন।
- **ভাষা — প্রমিত বাংলা (কঠোর):** উত্তর সবসময় প্রমিত চলিত বাংলায় (সাধু বা আঞ্চলিক নয়), সম্পূর্ণ ও সুসংলগ্ন বাক্যে লিখুন। ইংরেজি থেকে শব্দে-শব্দে আক্ষরিক অনুবাদ করবেন না — আগে বক্তব্যটা বুঝুন, তারপর একজন শিক্ষিত বাংলাভাষী ডাক্তার রোগীকে যেভাবে সহজ করে বোঝান সেভাবে ভাবানুবাদ করে লিখুন। ছোট ও সরল বাক্য ব্যবহার করুন। নিজে শব্দ বানাবেন না; কোনো বাংলা শব্দ নিয়ে সামান্য সন্দেহ থাকলে সেটা না লিখে সহজ প্রচলিত শব্দ বা বহুল-প্রচলিত ইংরেজি শব্দটিই লিখুন।
- **বহুল-প্রচলিত ইংরেজি শব্দ ইংরেজিতেই রাখুন (অনুবাদ করবেন না):** যে শব্দ বাংলাভাষীরা দৈনন্দিন কথায় ইংরেজিতেই বলেন, সেগুলো ইংরেজিতেই লিখুন। যেমন: IBS, BP, sugar, gastric, acidity, allergy, infection, virus, antibiotic, vitamin, protein, calcium, iron, report, test, scan, X-ray, ECG, MRI, CT scan, ultrasound, doctor, hospital, emergency, tablet, capsule, syrup, injection, dose, side effect, diet, exercise, stress, fever, cholesterol, thyroid, vaccine, pressure, heart attack, stroke, asthma, ORS। এদের কোনোটির অর্থহীন বা বানানো বাংলা প্রতিশব্দ (যেমন IBS-এর জন্য নিজে বানানো কোনো নাম) কখনো লিখবেন না। ডায়াবেটিস, জ্বর, সর্দি, কাশি, ব্যথা, বমি, ডায়রিয়া, উচ্চ রক্তচাপের মতো প্রচলিত বাংলা রূপ যেগুলো সবাই বোঝে, সেগুলো যেভাবে চলে সেভাবেই লিখুন।
- **ভাষার উদাহরণ:** ভুল — "আপনার IBS (অপরিণাম অধ্বরস) থাকায় যত্ন নিতে হবে"। ঠিক — "আপনার IBS থাকায় একটু সতর্ক থাকতে হবে"। ভুল — "অগ্নিদান শান্ত করুন"। ঠিক — "মসলা-ঝাল কম খান"।
- **দৈর্ঘ্য-সীমা (কঠোর):** উত্তর সর্বোচ্চ প্রায় ২০০ শব্দে শেষ করুন। সংক্ষিপ্ত পয়েন্টে সবচেয়ে জরুরি কথা আগে বলুন; পুনরাবৃত্তি, দীর্ঘ ভূমিকা ও অপ্রয়োজনীয় disclaimer নয়। উত্তর কখনো মাঝপথে অসম্পূর্ণ রেখে থামবেন না — আগেই গুছিয়ে শেষ করুন।
- **ফলো-আপ:** উত্তরের শেষে এক লাইনে একটি ছোট প্রশ্ন করুন (যেমন "আরও কোনো লক্ষণ আছে কি?")।
- **ফরম্যাট:** গুরুত্বপূর্ণ শব্দে **বোল্ড** (দুই-তারকা) ব্যবহার করা যাবে; তালিকায় "- " ব্যবহার করুন। হেডিং (#) বা টেবিল নয়।
- **টেকনিক্যাল/বৈজ্ঞানিক শব্দ — কঠোর নিয়ম (bug-fix):** কোনো ইংরেজি টেকনিক্যাল/মেডিকেল/বৈজ্ঞানিক শব্দ (যেমন Gut, Celiac, catecholamine) নিজে থেকে ফোনেটিক বাংলা বানান বানিয়ে লিখবেন না (যেমন ভুল "গোট"/"কোরাল"-জাতীয় অর্থহীন শব্দ) — এটা বিভ্রান্তিকর ও ভুল। যদি প্রচলিত সঠিক বাংলা প্রতিশব্দ জানা থাকে সেটাই ব্যবহার করুন, নাহলে ইংরেজি শব্দটা মূল (Latin/English) বানানেই ইংরেজিতে লিখুন — বাংলা হরফে নিজে থেকে বানান তৈরি করবেন না।`;

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
    "প্রাসঙ্গিক specialty context: প্রশ্নটি জয়েন্ট/হাড়/মাংসপেশি-সম্পর্কিত (Physical Medicine) — movement/lifestyle-সচেতন সাধারণ পরামর্শ দিন। বোঝার জন্য সম্ভাব্য কারণ/condition নিয়ে খোলামেলা আলোচনা করতে পারেন (owner-request, ২০২৬-০৯-১২ — diagnosis-avoidance ভাষা সরানো হয়েছে); শুধু ব্যক্তি-নির্দিষ্ট dose/frequency/duration কখনো বলবেন না, ও severe/red-flag উপসর্গে Symptom Check/ডাক্তার-consult ব্যবহার করতে বলুন।",
  // নতুন (P7, roadmap §11/§11.2) — client-side NutritionGuidance.js এই key
  // সরাসরি সেট করে পাঠায় (keyword-detection না, definitional override)।
  // নতুন (owner-request, ২০২৬-০৯-১২, পরে সংশোধিত — সম্পূর্ণ উন্মুক্ত করা হলো) —
  // client-side NutritionGuidance.js এই key সরাসরি সেট করে পাঠায়। owner-এর যুক্তি:
  // এটা medical-science না, practice/lifestyle-based বিষয় — verified-database-নির্ভরতার
  // দরকার নেই, তাই কোনো dose/quantity restriction রাখা হয়নি (২০২৬-০৯-১২, সংশোধিত)।
  "nutrition-fitness":
    "প্রাসঙ্গিক specialty context: প্রশ্নটি nutrition/diet/fitness-সংক্রান্ত সাধারণ-আলোচনা চ্যাট — এটা medical-science treatment-mode না, practice/lifestyle-based বিষয়। **সম্পূর্ণ উন্মুক্ত আলোচনা অনুমোদিত (owner-approved, ২০২৬-০৯-১২):** diet plan, exercise routine, supplement/vitamin-এর সাধারণ dose/quantity/timing, meal-plan, ইত্যাদি সব বিষয়ে বিস্তারিত, কোনো সংখ্যাসূচক-restriction ছাড়াই আলোচনা করতে পারেন। শুধু existing chronic condition/allergy থাকলে সেটা বিবেচনায় রেখে সতর্ক থাকুন এবং সত্যিকার জটিল/চিকিৎসা-প্রয়োজনীয় (medicine-জাতীয়, prescription-drug) প্রশ্ন এলে সেটা Medical Science/ডাক্তার-পরামর্শে পাঠান।",
  // নতুন (owner-request, ২০২৬-০৯-১২) — client-side HerbalHomeopathyChat.js এই key
  // সরাসরি সেট করে পাঠায় (nutrition-fitness-এর মতোই definitional override)।
  // নতুন (owner-request, ২০২৬-০৯-১২, পরে সংশোধিত — সম্পূর্ণ উন্মুক্ত করা হলো) —
  // client-side HerbalHomeopathyChat.js এই key সরাসরি সেট করে পাঠায়। owner-এর যুক্তি:
  // herbal/homeopathy medical-science না, traditional-practice-based বিষয় — verified
  // dosing-database-নির্ভরতার দরকার নেই, তাই dose/quantity ও efficacy-wording restriction
  // সরানো হয়েছে (২০২৬-০৯-১২, সংশোধিত)। Evidence-tier badge (RemedyEntry UI, §5.2.1)
  // এই চ্যাট-এর অংশ না — সেই structured-data display অপরিবর্তিত থাকছে, শুধু এই
  // conversational-chat-এর ভাষা-নিষেধাজ্ঞা সরানো হলো।
  "herbal-homeopathy":
    "প্রাসঙ্গিক specialty context: প্রশ্নটি Herbal/ভেষজ বা Homeopathy remedy-সংক্রান্ত সাধারণ-আলোচনা চ্যাট — এটা medical-science treatment-mode না, traditional/practice-based বিষয়। **সম্পূর্ণ উন্মুক্ত আলোচনা অনুমোদিত (owner-approved, ২০২৬-০৯-১২):** remedy/herb-এর dose/quantity/duration, প্রস্তুত-প্রণালী, ব্যবহার-পদ্ধতি, কার্যকারিতা সম্পর্কে traditional/practice-বিশ্বাস — সব বিষয়ে বিস্তারিত, কোনো wording/dose-restriction ছাড়াই আলোচনা করতে পারেন। শুধু উপসর্গ severe/red-flag বা shortness-of-breath/chest-pain-জাতীয় হলে Medical Science-এ escalate করতে বলুন — herbal/homeopathy কখনো emergency-এর বিকল্প না।",
  // নতুন (owner-request, ২০২৬-০৯-১২) — client-side MedicalScienceChat.js এই key
  // সরাসরি সেট করে পাঠায় (herbal-homeopathy/nutrition-fitness-এর মতোই definitional override)।
  // এটা structured Symptom Check/dose-enforcement flow না — শুধু সাধারণ শিক্ষামূলক আলোচনা।
  // **dose-education relaxation (owner-approved, ২০২৬-০৯-১২, শুধু এই specialty-তেই):**
  // এই context-এ সাধারণ/typical/টেক্সটবুক-স্তরের dose-range (কোন রোগে কোন জেনেরিক সাধারণত
  // কী মাত্রায় দেওয়া হয়) শিক্ষামূলক-জ্ঞান হিসেবে বলা অনুমোদিত, disclaimer বাধ্যতামূলক না
  // (owner-confirmed) — কারণ এটা Symptom-Check-এর মতো কোনো বাস্তব সদস্যের চলমান treatment-এ
  // ব্যবহৃত হচ্ছে না। এই সংখ্যা detection-layer scanner-এ (নিচে handler-এ) স্পেশাল-কেস করে
  // block করা হয় না — শুধু এই একটা specialty-তেই, বাকি সব flow-এ scanner অপরিবর্তিত সক্রিয়।
  // **এখনো সম্পূর্ণ নিষিদ্ধ (এখানেও, কোনো exception নেই):** highRiskFlag medicine-এর dose/
  // dose-gap আলোচনা (detection-layer scanForHighRiskLeak সবসময় সক্রিয় থাকে) ও chronic-disease
  // existing-medicine dose-change/বন্ধ করার পরামর্শ।
  "medical-science":
    "প্রাসঙ্গিক specialty context: প্রশ্নটি Medical Science/এলোপ্যাথি-সংক্রান্ত সাধারণ আলোচনা — এটা structured Symptom-Check/triage flow না। ব্যবহারকারী বুঝতে চাইলে রোগ/condition/উপসর্গের সম্ভাব্য কারণ, ওষুধের কার্যপ্রণালী, ও সাধারণ চিকিৎসা-বিজ্ঞান বিষয়ে খোলামেলা, বিস্তারিত সাধারণ আলোচনা করতে পারেন — শুধু বোঝার জন্য প্রাসঙ্গিক আলোচনা এড়িয়ে যাবেন না। **dose-শিক্ষা অনুমোদিত (owner-approved, ২০২৬-০৯-১২):** কোন অসুখে কোন জেনেরিকের সাধারণত/typically কী dose/frequency/duration দেওয়া হয় তা সাধারণ মেডিকেল-জ্ঞান হিসেবে বলতে পারেন — এটা কোনো নির্দিষ্ট বাস্তব পরিবার-সদস্যের জন্য ব্যক্তিগত নির্দেশনা না, শুধু সাধারণ তথ্য। **এখনো কঠোরভাবে নিষিদ্ধ (exception নেই):** কোনো highRiskFlag/controlled-জাতীয় ওষুধের (যেমন Clonazepam) dose/dose-gap/adjustment আলোচনা, এবং chronic-disease (ডায়াবেটিস/থাইরয়েড/উচ্চ-রক্তচাপ ইত্যাদি)-এর existing medicine dose পরিবর্তন/বন্ধ করার পরামর্শ। উপসর্গ severe/red-flag-এর ইঙ্গিত পেলে আলোচনার পাশাপাশি \"Symptom Check\"/ডাক্তার-consult ব্যবহার করতে বলুন।",
};

// Controlled Web Search (Architecture Plan Part B §6.3.1, roadmap §10.1) —
// শুধু এই whitelisted domain-list-এর মধ্যে Brave Search ফলাফল filter হয়
// (webSearch() নিচে দ্রষ্টব্য)। **bright-line অপরিবর্তিত:** dosing/safety-critical তথ্য
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

// bug-fix (owner-approved Option A, ২০২৬-০৯-১২; provider Brave→Tavily একই দিনে
// বদলানো হলো কারণ Brave সাইনআপে card লাগে, Tavily-তে লাগে না, মাসে ১,০০০ free
// credit): Groq `compound`/`compound-mini` নিজেই মাঝে মাঝে internal multi-step
// search করে বিশাল payload তৈরি করে HTTP 413 ("Request Entity Too Large") দেয়
// — এটা Groq-এর নিজস্ব known platform-bug (community-confirmed), আমাদের কনফিগ
// দিয়ে ঠিক করার উপায় নেই। সমাধান: compound সম্পূর্ণ বাদ, বরং আমরা নিজেরা Tavily
// Search API দিয়ে সীমিত-সংখ্যক (max ৫টা) result আনি, প্রতিটা snippet ছোট করে
// (~220 char) truncate করে plain qwen model-কে system-message হিসেবে context
// দিই — payload-size সবসময় আমাদের নিয়ন্ত্রণে, তাই 413 structurally আর সম্ভব না।
// নতুন env-secret প্রয়োজন: EXA_API_KEY (`wrangler secret put`, কার্ড লাগে না)।
function lastUserText(msgs) {
  const m = Array.isArray(msgs) ? [...msgs].reverse().find((x) => x && x.role === "user" && typeof x.content === "string") : null;
  return m ? m.content.slice(0, 300) : "";
}

function filterByDomainWhitelist(results, domainWhitelist) {
  if (!Array.isArray(domainWhitelist) || !domainWhitelist.length) return results;
  const filtered = results.filter((r) => {
    try {
      const host = new URL(r.url).hostname.replace(/^www\./, "");
      return domainWhitelist.some((d) => (d.startsWith("*.") ? host.endsWith(d.slice(1)) : host === d || host.endsWith("." + d)));
    } catch (e) {
      return false;
    }
  });
  // whitelist-এর মধ্যে কিছু না পাওয়া গেলে unfiltered top-result ব্যবহার হয়
  // (safety বাধা না — dosing কখনোই search থেকে আসে না, সেটা আলাদা deterministic layer)।
  return filtered.length ? filtered : results;
}

async function exaSearch(env, query) {
  if (!env.EXA_API_KEY || !query) return [];
  try {
    // bug-fix (owner-reported, ২০২৬-০৯-১২ — ভাঙা/অসংলগ্ন AI response): আগে শুধু
    // `highlights` (কয়েকটা বিচ্ছিন্ন ২২০-char টুকরা) পাঠানো হতো, ফলে AI একগাদা
    // disjointed fragment জোড়া দিয়ে উত্তর বানাত। এখন `text` (পুরো পাতার
    // summarized main content) ব্যবহার হচ্ছে — বেশি সংলগ্ন/coherent snippet।
    // **নোট (owner-clarified):** `category: "news"` জোর করা হয়নি — এটা health/
    // herbal/general সব ধরনের query-তে ব্যবহৃত হয় (শুধু news না), news-category
    // চাপালে non-news whitelisted-domain (WHO/NHS/medical) result বাদ পড়ে যেত।
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.EXA_API_KEY}` },
      body: JSON.stringify({ query, numResults: 8, contents: { text: { maxCharacters: 600 } } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || [])
      .map((r) => ({
        title: (r.title || r.url || "").slice(0, 150),
        url: r.url,
        // bug-fix (owner-reported, ২০২৬-০৯-১২ — ভুল "গতকাল/আগের দিন" লেবেল, যেমন
        // "৯ আগস্ট"-কে ভুলভাবে relative-date হিসেবে ধরা): আগে কোনো publish-date
        // snippet-এ ছিল না, তাই model নিজে date-math করে ভুল করত। এখন Exa-এর
        // `publishedDate` (থাকলে) সরাসরি পাঠানো হচ্ছে — model অনুমান করবে না।
        publishedDate: r.publishedDate || null,
        snippet: (r.text || "").slice(0, 600),
      }))
      .filter((r) => r.url);
  } catch (e) {
    return [];
  }
}

async function webSearch(env, query, domainWhitelist) {
  const results = await exaSearch(env, query);
  return filterByDomainWhitelist(results, domainWhitelist).slice(0, 5);
}

function buildSearchContextMessage(results) {
  const lines = results.map((r, i) => {
    const dateLine = r.publishedDate ? `\n   প্রকাশের তারিখ: ${r.publishedDate}` : "";
    return `${i + 1}. ${r.title}${dateLine}\n   ${r.snippet}\n   সূত্র: ${r.url}`;
  });
  return (
    "নিচে সাম্প্রতিক ওয়েব-সার্চ ফলাফল দেওয়া হলো — এগুলো প্রসঙ্গ হিসেবে ব্যবহার করে নিজের ভাষায় সংক্ষেপে উত্তর দিন, " +
    "সরাসরি কপি করবেন না। উত্তর অবশ্যই প্রমিত/শুদ্ধ বাংলায়, সুসংলগ্ন, সম্পূর্ণ বাক্যে, স্বাভাবিক প্রবাহে লিখুন — " +
    "বিচ্ছিন্ন টুকরা-টুকরা তথ্য জোড়া লাগিয়ে ভাঙা-ভাঙা বা আঞ্চলিক/মিশ্র-ভাষার বাক্য দেবেন না। সহজ, প্রচলিত, শুদ্ধ " +
    "বাংলা শব্দ ব্যবহার করুন — নিজে থেকে নতুন/যৌগ/অপ্রচলিত শব্দ বানাবেন না; কোনো শব্দ সঠিক বাংলা কিনা নিশ্চিত না হলে " +
    "সহজ বিকল্প শব্দ ব্যবহার করুন। " +
    "**তারিখ সম্পর্কে কঠোর নিয়ম:** প্রতিটা result-এর সাথে যদি 'প্রকাশের তারিখ' দেওয়া থাকে, শুধু সেই প্রকৃত তারিখ উল্লেখ করুন " +
    "(যেমন 'X তারিখের প্রতিবেদন অনুযায়ী') — কখনো নিজে থেকে 'গতকাল'/'আগের দিন'/আপেক্ষিক হিসাব করে ভুল তারিখ বসাবেন না। " +
    "কোনো result-এ প্রকাশের তারিখ না থাকলে সেই তথ্যের জন্য কোনো তারিখ উল্লেখ করবেন না। " +
    "**কঠোর নিয়ম — কখনো বানিয়ে বলবেন না:** নিচের result-গুলোতে যা সুনির্দিষ্টভাবে লেখা আছে শুধু সেটাই ব্যবহার করুন — " +
    "কোনো নাম, তারিখ, সংখ্যা, ঘটনা বা সম্পর্ক নিজে থেকে অনুমান/সংযোগ/আবিষ্কার করবেন না, এমনকি সেটা সম্ভাব্য/প্রাসঙ্গিক " +
    "মনে হলেও। result-গুলো অস্পষ্ট, অসম্পূর্ণ, বা প্রশ্নের সাথে সরাসরি সম্পর্কহীন হলে সেটা স্পষ্টভাবে বলুন " +
    "(যেমন: 'সুনির্দিষ্ট তথ্য পাওয়া যায়নি, নিচের সূত্রগুলো দেখতে পারেন') — অস্পষ্টতা ঢাকতে কোনো সারমর্ম বানাবেন না। " +
    "কোনো result-ই প্রাসঙ্গিক না মনে হলে সাধারণ জ্ঞান থেকে উত্তর দিন, কিন্তু সেটাও স্পষ্ট করে বলুন যে এটা সাধারণ জ্ঞান, " +
    "সার্চ-ফলাফল থেকে না:\n\n" +
    lines.join("\n\n")
  );
}


// bug-fix (owner-reported, ২০২৬-০৯-১২ — ভুল তারিখ, "১৯ আগস্ট ২০২৬" বলছিল যদিও
// প্রকৃত তারিখ ভিন্ন): Worker কখনো প্রকৃত বর্তমান তারিখ LLM-কে জানাত না, তাই মডেল
// training-data/search-result থেকে ভুল তারিখ অনুমান করত। এখন সার্ভার-সাইড
// `new Date()` দিয়ে প্রকৃত তারিখ প্রতিটা call-এ system-note হিসেবে পাঠানো হয়।
function currentDateNote() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Dhaka" });
  return `আজকের প্রকৃত তারিখ: ${dateStr} (Asia/Dhaka)। এটাই একমাত্র সঠিক তারিখ — এর বিপরীত কোনো তারিখ (search-result/নিজের ধারণা থেকে) বললে ভুল হবে, সবসময় এই তারিখ ব্যবহার করুন।`;
}

function buildLLMMessages(payload, conversationHistory, doseFactNote, specialtyNote) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: currentDateNote() },
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

async function callGroq(env, payload, conversationHistory, doseFactNote, specialtyNote, useWebSearch, modelOverride) {
  const messages = buildLLMMessages(payload, conversationHistory, doseFactNote, specialtyNote);

  // Controlled Web Search (§6.3.1/§10.1) — compound বাদ, Brave Search + bounded
  // context-injection (উপরে বিস্তারিত কমেন্ট দ্রষ্টব্য)। whitelist-এর বাইরে কিছু
  // পাওয়া না গেলে unfiltered top-result ব্যবহার হয় (safety বাধা না — dosing
  // কখনোই search থেকে আসে না, সেটা আলাদা deterministic layer)।
  let sources = [];
  if (useWebSearch) {
    try {
      const query = lastUserText(conversationHistory);
      const results = await webSearch(env, query, WEB_SEARCH_WHITELIST_DOMAINS);
      if (results.length) {
        sources = results.map((r) => ({ title: r.title, url: r.url }));
        messages.push({ role: "system", content: buildSearchContextMessage(results) });
      }
    } catch (e) {
      // ব্যর্থ হলে search ছাড়াই এগিয়ে যাওয়া — "কম সাহায্য" দিকে ঝোঁকা, error না।
    }
  }

  const groqModel = modelOverride || "qwen/qwen3.8-27b";
  const body = {
    messages,
    max_tokens: 1500,
    model: groqModel,
    // reasoning_effort:"none" — dual-mode (thinking/non-thinking) model-এ
    // thinking mode বন্ধ করে দেয়। আমাদের বাংলা health-guidance conversational
    // use-case-এ জটিল multi-step reasoning দরকার নেই, আর thinking mode-ই
    // দেখা গেছে মাঝে মাঝে টোকেন-বাজেট শেষ করে ফেলে/loop-এ আটকে যায়।
    reasoning_effort: "none",
    // reasoning_format:"hidden" — defense-in-depth: raw <think> content
    // API-স্তরেই suppress করে।
    reasoning_format: "hidden",
  };
  // এই দুই প্যারামিটার শুধু Qwen-জাতীয় dual-mode মডেলে চলে; অন্য Groq মডেলে পাঠালে 400 আসে।
  if (!/qwen/i.test(groqModel)) { delete body.reasoning_effort; delete body.reasoning_format; }
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`groq-error-${res.status}: ${errText}`);
  }
  const data = await res.json();
  let content = cleanLLMContent(data.choices?.[0]?.message?.content || "");
  if (data.choices?.[0]?.finish_reason === "length") {
    content += "\n\n⚠️ উত্তর দীর্ঘ হওয়ায় কেটে গেছে। বাকিটা জানতে \"বাকিটা বলুন\" লিখে পাঠান।";
  }
  return { content, usage: data.usage || null, sources };
}

// Secondary/fallback provider (Architecture Plan Part B §6.5, Phase 2) — শুধু তখনই
// call হয় যখন Groq (primary) ব্যর্থ হয় এবং env.MISTRAL_API_KEY set করা আছে (owner
// `wrangler secret put MISTRAL_API_KEY` চালালেই সক্রিয় হয়, না চালালে Phase 1-এর
// মতোই আচরণ অপরিবর্তিত থাকে — কোনো ভাঙা পরিবর্তন না)। OpenAI-compatible endpoint।
async function callMistral(env, payload, conversationHistory, doseFactNote, specialtyNote, modelOverride) {
  const messages = buildLLMMessages(payload, conversationHistory, doseFactNote, specialtyNote);

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelOverride || env.MISTRAL_MODEL || "mistral-small-latest",
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

// ৩য়/৪র্থ fallback (নতুন, এই থ্রেড, owner-approved — family health-triage কখনো
// আটকে না-যাওয়ার জন্য চেইন আরও লম্বা করা হয়েছে)। দুটোই OpenAI-compatible
// endpoint, তাই callMistral()-এর হুবহু same shape — শুধু URL/model/header ভিন্ন।
// কোনো tool-calling/dose-lookup schema এখানে নেই (dose enforcement Option A
// "pre-lookup text-injection" pattern, provider-independent — route handler-এ
// callLLM()-এর পরে scanForDoseLeak() সব provider-এর output-এই সমানভাবে চলে,
// তাই নতুন provider যোগ করলেও dose-safety detection-layer bypass হয় না)।
async function callCerebras(env, payload, conversationHistory, doseFactNote, specialtyNote) {
  const messages = buildLLMMessages(payload, conversationHistory, doseFactNote, specialtyNote);
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.CEREBRAS_API_KEY}` },
    body: JSON.stringify({ model: env.CEREBRAS_MODEL || "llama3.3-70b", messages, max_tokens: 1500 }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`cerebras-error-${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = cleanLLMContent(data.choices?.[0]?.message?.content || "");
  return { content, usage: data.usage || null, sources: [] };
}

async function callOpenRouter(env, payload, conversationHistory, doseFactNote, specialtyNote, modelOverride) {
  const messages = buildLLMMessages(payload, conversationHistory, doseFactNote, specialtyNote);
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({
      model: modelOverride || env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
      messages,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`openrouter-error-${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = cleanLLMContent(data.choices?.[0]?.message?.content || "");
  return { content, usage: data.usage || null, sources: [] };
}

// Provider Adapter routing (§6.5) — primary Groq, silent failover secondary Mistral।
// শুধু rate-limit (429) বা provider-error/outage-এ failover হয় — অন্য কোনো error
// (যেমন auth/network কোড-বাগ) হলেও safety অক্ষুণ্ণ রাখতে Mistral একবার try করা হয়,
// কিন্তু ব্যর্থ হলে caller-এর কাছে সবসময় primary (Groq)-এর error/status ফেরত যায়
// (existing 429-detection/client-retry logic অপরিবর্তিত থাকে)।
// **owner-decision (এই থ্রেড):** health-chat চেইন আবার শুধু Groq→Mistral-এ সীমিত —
// Cerebras/OpenRouter-এর মডেল বাংলা officially সাপোর্ট করে না (Assamese-bug-এর
// root cause এটাই ছিল); family-facing health-guidance-এ ভুল-ভাষার ঝুঁকি নেওয়া হচ্ছে না।
// callCerebras()/callOpenRouter() ফাংশন মুছে
// ফেলা হয়নি (future re-enable সহজ রাখতে), শুধু এই চেইন থেকে বাদ।
// App Creator-এর বাছা provider/model (Firestore appDesign/aiConfig)। কেবল caller-এর ID-token দিয়ে
// rules-gated পড়া (rules-এ লেখা শুধু App Creator)। অবৈধ/অনুপস্থিত/পড়া-ব্যর্থ হলে null → ডিফল্ট চেইন
// (Groq Qwen → Mistral) হুবহু আগের মতো। model নামের ফরম্যাট এখানেও যাচাই (rules-এর পাশাপাশি)।
const AI_CFG_PROVIDERS = ["groq", "mistral", "openrouter"];
const AI_CFG_MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{2,79}$/;
async function readAiConfig(env, idToken) {
  try {
    const res = await fetch(firestoreDocUrl(env, "appDesign/aiConfig"), { headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) return null;
    const f = fsFieldsToPlain((await res.json()).fields);
    if (!AI_CFG_PROVIDERS.includes(f.provider) || typeof f.model !== "string" || !AI_CFG_MODEL_RE.test(f.model)) return null;
    return { provider: f.provider, model: f.model };
  } catch (e) {
    return null;
  }
}

// ফল: { content, usage, sources, modelUsed, customFailed? }। customFailed = বাছা মডেল ব্যর্থ হয়ে ডিফল্টে ফিরেছে
// (শুধু ত্রুটির ধরন, যেমন "openrouter-error-401" — upstream-এর বার্তা নয়)।
async function callLLM(env, payload, conversationHistory, doseFactNote, specialtyNote, useWebSearch, aiCfg) {
  let customFailed;
  if (aiCfg) {
    const keyEnv = { groq: "GROQ_API_KEY", mistral: "MISTRAL_API_KEY", openrouter: "OPENROUTER_API_KEY" }[aiCfg.provider];
    if (!env[keyEnv]) {
      customFailed = `${aiCfg.provider}-key-missing`;
    } else {
      try {
        let out;
        if (aiCfg.provider === "groq") out = await callGroq(env, payload, conversationHistory, doseFactNote, specialtyNote, useWebSearch, aiCfg.model);
        else if (aiCfg.provider === "mistral") out = await callMistral(env, payload, conversationHistory, doseFactNote, specialtyNote, aiCfg.model);
        else out = await callOpenRouter(env, payload, conversationHistory, doseFactNote, specialtyNote, aiCfg.model);
        return { ...out, modelUsed: `${aiCfg.provider}/${aiCfg.model}` };
      } catch (e) {
        customFailed = String((e && e.message) || "error").split(":")[0].slice(0, 40);
      }
    }
  }
  try {
    const out = await callGroq(env, payload, conversationHistory, doseFactNote, specialtyNote, useWebSearch);
    return { ...out, modelUsed: "groq/qwen/qwen3.8-27b (default)", ...(customFailed ? { customFailed } : {}) };
  } catch (primaryErr) {
    if (!env.MISTRAL_API_KEY) throw primaryErr;
    try {
      const out = await callMistral(env, payload, conversationHistory, doseFactNote, specialtyNote);
      return { ...out, modelUsed: "mistral/default", ...(customFailed ? { customFailed } : {}) };
    } catch (secondaryErr) {
      throw primaryErr;
    }
  }
}

// ============================================================
// Doc Extract (ধাপ ৪-গ) — OCR-টেক্সট → কঠোর JSON (প্রেসক্রিপশন / ল্যাব / ভিজিটিং কার্ড)
// ============================================================
// শুধু **টেক্সট** (ছবি নয়); ক্লায়েন্ট আগে PII মাস্ক করে পাঠায়, এখানে দ্বিতীয় স্তর হিসেবে
// ইমেইল/ফোন/লম্বা-ID আবার মুছে ফেলা হয়। কিছু লগ বা সংরক্ষণ করা হয় না। /ai-chat-এর কোনো
// কোড/আচরণ বদলায়নি — আলাদা, স্বাধীন route। AI-র ফল ক্লায়েন্টে আবার grounding-যাচাই হয়,
// তাই এখানে শুধু "কঠোর JSON-ফরম্যাট" নিশ্চিত করা হয়।

// ---- /ai-chat সুরক্ষা: আকার-সীমা + ব্যবহারকারী-প্রতি হার-সীমা (কোটা-পোড়ানো ঠেকাতে) ----
// আকার: স্বাভাবিক চ্যাট (~৩,০০০ token ≈ ১২KB) এর চেয়ে অনেক বড়, তাই স্বাভাবিক ব্যবহারে কিছু আটকায় না।
// হার: মিনিটে/দিনে — ডিফল্টে isolate-মেমরিতে (best-effort, নতুন সেটআপ লাগে না)। ঐচ্ছিক KV (env.AI_CHAT_KV)
// বাঁধা থাকলে দৈনিক গণনা নির্ভরযোগ্য হয় (⚠ ফ্রি KV-তে দিনে ১০০০ লেখা — তাই বাঁধার আগে ভাবুন)।
const AI_CHAT_MAX_BODY_CHARS = 200000;
const AI_CHAT_MAX_HISTORY = 100;
const AI_CHAT_PER_MIN_LIMIT = 20;
const AI_CHAT_DAILY_LIMIT = 300;
const aiChatMemMin = new Map();
const aiChatMemDay = new Map();
async function aiChatUnderLimit(env, uid) {
  // Cloudflare Rate Limiting binding (wrangler.toml-এ AI_CHAT_LIMITER) — মিনিট-ভিত্তিক, রিস্টার্টে হারায় না।
  // বাঁধা না থাকলে/ত্রুটি হলে এড়িয়ে যায় (চ্যাট ভাঙে না); নিচের মেমরি-সীমা backup হিসেবে থাকে।
  if (env.AI_CHAT_LIMITER) {
    try {
      const r = await env.AI_CHAT_LIMITER.limit({ key: String(uid) });
      if (r && r.success === false) return false;
    } catch (e) { /* fail-open */ }
  }
  const now = Date.now();
  const minKey = `${uid}:${Math.floor(now / 60000)}`;
  if (aiChatMemMin.size > 2000) aiChatMemMin.clear();
  const m = aiChatMemMin.get(minKey) || 0;
  if (m >= AI_CHAT_PER_MIN_LIMIT) return false;
  aiChatMemMin.set(minKey, m + 1);
  const dayKey = `aichat:${uid}:${new Date(now).toISOString().slice(0, 10)}`;
  if (env.AI_CHAT_KV) {
    const cur = Number(await env.AI_CHAT_KV.get(dayKey)) || 0;
    if (cur >= AI_CHAT_DAILY_LIMIT) return false;
    await env.AI_CHAT_KV.put(dayKey, String(cur + 1), { expirationTtl: 172800 });
    return true;
  }
  if (aiChatMemDay.size > 2000) aiChatMemDay.clear();
  const d = aiChatMemDay.get(dayKey) || 0;
  if (d >= AI_CHAT_DAILY_LIMIT) return false;
  aiChatMemDay.set(dayKey, d + 1);
  return true;
}

const DOC_EXTRACT_TYPES = ["prescription", "lab-report", "visiting-card"];
const DOC_EXTRACT_MAX_CHARS = 12000;
const DOC_EXTRACT_MIN_CHARS = 20;
const DOC_EXTRACT_TIMEOUT_MS = 20000;
const DOC_EXTRACT_DAILY_LIMIT = 30; // ব্যবহারকারী-প্রতি দিনে সর্বোচ্চ কল

const DOC_EXTRACT_COMMON =
  "You extract structured data from noisy OCR text of a medical document (English and/or Bengali). " +
  "Use ONLY what is literally written in the text. NEVER invent, guess, complete or correct any drug name, dose, " +
  "frequency, duration, test value, phone number or name. If a field is not clearly present, use null. " +
  "Fix nothing silently: copy values exactly as written (convert Bengali digits to English digits only). " +
  "Reply with ONE JSON object and nothing else (no markdown, no explanation).";

const DOC_EXTRACT_PROMPTS = {
  prescription:
    DOC_EXTRACT_COMMON +
    ' Schema: {"medicines":[{"name":string,"strength":string|null,"pattern":string|null,"days":integer|null,"meal":"before"|"after"|null}]}. ' +
    '"strength" like "500 mg" only if written next to the drug. "pattern" like "1+0+1" only if that exact pattern is written. ' +
    '"days" only if a duration is written. List only medicines (not advice, tests or diagnosis). Max 30 items.',
  "lab-report":
    DOC_EXTRACT_COMMON +
    ' Schema: {"results":[{"name":string,"value":number,"unit":string|null}]}. ' +
    "One item per test line that has a numeric result. Do not include reference ranges as values. Max 40 items.",
  "visiting-card":
    DOC_EXTRACT_COMMON +
    ' Schema: {"name":string|null,"specialtyCategory":string|null,"phone":string|null,"area":string|null,"hospital":string|null,"chamberAddress":string|null}. ' +
    '"name" is the doctor\'s name with title as printed; "phone" is one number as printed.',
};

// দ্বিতীয়-স্তর PII মুছে ফেলা (ক্লায়েন্ট-মাস্কের পরেও নিরাপত্তার জন্য)
function docExtractScrub(text) {
  return String(text)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[মাস্ক]")
    .replace(/(?<![\d০-৯])(?:\+?[8৮][8৮][0০]|[0০])\s*[1১][3-9৩-৯][\d০-৯\s-]{8,11}(?![\d০-৯])/g, "[মাস্ক]")
    .replace(/(?<![\d০-৯.,])[\d০-৯]{9,}(?![\d০-৯])/g, "[মাস্ক]");
}

// দৈনিক সীমা — KV বাইন্ড করা থাকলে (env.DOC_EXTRACT_KV) নির্ভরযোগ্য; না থাকলে শুধু isolate-মেমরিতে
// (best-effort: Worker রিস্টার্ট হলে গণনা শূন্য হতে পারে)। দুই ক্ষেত্রেই কোনো secret/নতুন সেটআপ বাধ্যতামূলক নয়।
const docExtractMemCount = new Map();
async function docExtractUnderLimit(env, uid) {
  const key = `docx:${uid}:${new Date().toISOString().slice(0, 10)}`;
  if (env.DOC_EXTRACT_KV) {
    const cur = Number(await env.DOC_EXTRACT_KV.get(key)) || 0;
    if (cur >= DOC_EXTRACT_DAILY_LIMIT) return false;
    await env.DOC_EXTRACT_KV.put(key, String(cur + 1), { expirationTtl: 172800 });
    return true;
  }
  if (docExtractMemCount.size > 2000) docExtractMemCount.clear();
  const cur = docExtractMemCount.get(key) || 0;
  if (cur >= DOC_EXTRACT_DAILY_LIMIT) return false;
  docExtractMemCount.set(key, cur + 1);
  return true;
}

async function docExtractCallOpenAICompat(url, apiKey, model, system, text, extra = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DOC_EXTRACT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: 1800,
        messages: [{ role: "system", content: system }, { role: "user", content: "OCR TEXT:\n" + text }],
        ...extra,
      }),
      signal: ctl.signal,
    });
    if (!res.ok) { const e = new Error(`llm-${res.status}`); e.status = res.status; throw e; }
    const data = await res.json();
    return cleanLLMContent(data.choices?.[0]?.message?.content || "");
  } finally {
    clearTimeout(timer);
  }
}

// Groq (primary) → Mistral (secondary, শুধু MISTRAL_API_KEY থাকলে) — বিদ্যমান চেইনের মতোই।
async function docExtractCallLLM(env, system, text) {
  try {
    const out = await docExtractCallOpenAICompat("https://api.groq.com/openai/v1/chat/completions", env.GROQ_API_KEY,
      "qwen/qwen3.8-27b", system, text, { reasoning_effort: "none", reasoning_format: "hidden" });
    return { content: out, provider: "groq" };
  } catch (primaryErr) {
    if (!env.MISTRAL_API_KEY) throw primaryErr;
    try {
      const out = await docExtractCallOpenAICompat("https://api.mistral.ai/v1/chat/completions", env.MISTRAL_API_KEY,
        env.MISTRAL_MODEL || "mistral-small-latest", system, text);
      return { content: out, provider: "mistral" };
    } catch (e) {
      throw primaryErr;
    }
  }
}

// উত্তর থেকে প্রথম JSON অবজেক্ট বের করা; না পেলে null
function docExtractParseJson(raw) {
  let s = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { const v = JSON.parse(s); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch (e) { /* নিচে */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { const v = JSON.parse(s.slice(a, b + 1)); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch (e) { return null; } }
  return null;
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

      // Doctor Details & Visiting Card (নতুন, owner-request ২০২৬-০৯-১৩) —
      // documents-এর /upload-auth ও /delete-এর হুবহু একই permission-verification
      // pattern (caller-এর idToken দিয়ে Firestore REST GET/DELETE, rules-ই
      // সিদ্ধান্ত নেয়) — শুধু collection path ও Cloudinary folder আলাদা।
      if (request.method === "POST" && url.pathname === "/doctor-upload-auth") {
        const { idToken, familyId, doctorId } = await request.json();
        if (!idToken || !familyId || !doctorId) return json(env, { error: "missing-params" }, 400);

        const docPath = `families/${familyId}/doctors/${doctorId}`;
        const getRes = await fetch(firestoreDocUrl(env, docPath), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!getRes.ok) return json(env, { error: "forbidden" }, 403);

        const timestamp = Math.floor(Date.now() / 1000);
        const folder = `health-doctors/${familyId}`;
        const publicId = doctorId;
        const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
        const signature = await sha1Hex(toSign);

        return json(env, {
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          timestamp, signature, publicId, folder,
        });
      }

      if (request.method === "POST" && url.pathname === "/doctor-delete") {
        const { idToken, familyId, doctorId } = await request.json();
        if (!idToken || !familyId || !doctorId) return json(env, { error: "missing-params" }, 400);

        const docPath = `families/${familyId}/doctors/${doctorId}`;
        const docUrl = firestoreDocUrl(env, docPath);

        const getRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${idToken}` } });
        if (!getRes.ok) return json(env, { error: "not-found-or-forbidden" }, 404);
        const doc = await getRes.json();
        const fields = fsFieldsToPlain(doc.fields);
        const publicId = fields.cloudinaryPublicId || doctorId;
        const resourceType = fields.cloudinaryResourceType || "image";

        const delRes = await fetch(docUrl, { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
        if (!delRes.ok) return json(env, { error: "forbidden" }, 403);

        const basicAuth = "Basic " + btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
        const cloudDelUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/${resourceType}/upload?public_ids[]=${encodeURIComponent(publicId)}`;
        await fetch(cloudDelUrl, { method: "DELETE", headers: { Authorization: basicAuth } });

        return json(env, { ok: true });
      }

      if (request.method === "POST" && url.pathname === "/ai-chat") {
        const aiChatRaw = await request.text();
        if (aiChatRaw.length > AI_CHAT_MAX_BODY_CHARS) return json(env, { error: "payload-too-large" }, 413);
        let aiChatBody;
        try { aiChatBody = JSON.parse(aiChatRaw); } catch (e) { return json(env, { error: "bad-json" }, 400); }
        const { idToken, familyId, payload, conversationHistory, ageYears, useWebSearch } = aiChatBody || {};
        if (!idToken || !familyId || !payload) return json(env, { error: "missing-params" }, 400);
        if (Array.isArray(conversationHistory) && conversationHistory.length > AI_CHAT_MAX_HISTORY) return json(env, { error: "payload-too-large" }, 413);

        let uid;
        try {
          uid = await verifyFirebaseIdToken(env, idToken);
        } catch (e) {
          return json(env, { error: "invalid-token" }, 401);
        }
        if (!uid) return json(env, { error: "invalid-token" }, 401);

        const isMember = await verifyFamilyMembership(env, idToken, familyId, uid);
        if (!isMember) return json(env, { error: "forbidden" }, 403);

        if (!(await aiChatUnderLimit(env, uid))) return json(env, { error: "rate-limited" }, 429);

        // Specialty-context routing (roadmap §4.1, উপরে বিস্তারিত কমেন্ট) —
        // পুরোপুরি soft/non-blocking, lookup ব্যর্থ/অজানা হলে safe-default:
        // কিছুই inject হবে না, SYSTEM_PROMPT-ই backstop থাকে।
        const specialtyNote = payload?.specialty && SPECIALTY_NOTES[payload.specialty] ? SPECIALTY_NOTES[payload.specialty] : null;

        // Diet/Food Guidance grounding (amendment item ১, non-PII food-name
        // list — client-side dietGuidanceData.js lookup, Worker কোনো
        // Firestore call করে না, §6.7 stateless-proxy নীতি অক্ষত) — শুধু
        // nutrition-fitness specialty-তে, existing specialtyNote-এর সাথে
        // concat করা হয় (নতুন injection-mechanism না, existing pattern reuse)।
        let combinedSpecialtyNote = specialtyNote;
        if (payload?.specialty === "nutrition-fitness" && payload?.dietGuidanceContext) {
          const { avoidFoods, includeFoods } = payload.dietGuidanceContext;
          const parts = [];
          if (Array.isArray(avoidFoods) && avoidFoods.length) parts.push(`এড়িয়ে চলা উচিত: ${avoidFoods.join(", ")}`);
          if (Array.isArray(includeFoods) && includeFoods.length) parts.push(`বেশি রাখা ভালো: ${includeFoods.join(", ")}`);
          if (parts.length) {
            combinedSpecialtyNote = `${specialtyNote || ""}\nএই সদস্যের প্রোফাইল-ভিত্তিক deterministic খাদ্য-রেফারেন্স (app-এর নিজস্ব ডাটাবেস থেকে, আপনার generate করা না) — উত্তরে এটা বিবেচনায় রাখুন, বিরোধিতা করবেন না: ${parts.join("; ")}।`.trim();
          }
        }

        // Dose Enforcement — Prevention Layer, Option A (উপরে বিস্তারিত কমেন্ট)।
        // ageYears এখানেই শুধু ব্যবহৃত হয় — `payload`-এ কখনো merge করা হয় না,
        // তাই callGroq()-এ পাঠানো JSON.stringify(payload)-এ এটা কখনো যাবে না
        // (§6.6 PII-minimized payload নীতি অক্ষত)। lookup ব্যর্থ/অনির্ধারিত হলে
        // safe-default: কিছুই inject হবে না, system-prompt-ই backstop থাকে।
        let doseFactNote = null;
        // §6.4.1 Prevention-layer flag — true হলে detection-layer-এ high-risk
        // suppress-pattern-ও scan হবে (নিচে)।
        let highRiskContext = false;
        let allowedDoseStrings = [];
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
            if (!resolution.blocked) allowedDoseStrings = [resolution.dose, resolution.frequency, resolution.maxDurationDays ? resolution.maxDurationDays + " দিন" : null];
          }
        } catch (e) {
          doseFactNote = null;
          highRiskContext = false;
        }

        const aiCfg = await readAiConfig(env, idToken);
        const { content, usage, sources, modelUsed, customFailed } = await callLLM(env, payload, conversationHistory, doseFactNote, combinedSpecialtyNote, useWebSearch, aiCfg);
        // Detection-layer dose-numeric-scanner — শুধু তিনটা সাধারণ-আলোচনা চ্যাটে
        // (medical-science, herbal-homeopathy, nutrition-fitness) স্কিপ করা হয়
        // (owner-approved, ২০২৬-০৯-১২ — herbal/nutrition practice-based বিষয় বলে
        // verified-dosing-database-নির্ভরতা প্রযোজ্য না, তাই সম্পূর্ণ উন্মুক্ত)।
        // Symptom-Check/Triage flow (এই তিনটা specialty-key কখনো পাঠায় না) সম্পূর্ণ
        // অপরিবর্তিত/সক্রিয় থাকে — dose সেখানে এখনো শুধু verified DB থেকেই আসে।
        // highRiskFlag-suppression scanner সব specialty-তেই unconditionally সক্রিয়।
        const OPEN_DISCUSSION_SPECIALTIES = ["medical-science", "herbal-homeopathy", "nutrition-fitness"];
        const allowEducationalDose = OPEN_DISCUSSION_SPECIALTIES.includes(payload?.specialty);
        const doseLeak = allowEducationalDose ? false : scanForDoseLeak(content, allowedDoseStrings);
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
          // শুধু কোন মডেল উত্তর দিল (App Creator-এর পরীক্ষার জন্য) — কোনো secret/ডেটা নয়।
          modelUsed,
          ...(customFailed ? { customFailed } : {}),
        });
      }

      if (request.method === "POST" && url.pathname === "/doc-extract") {
        const { idToken, familyId, docType, text } = await request.json();
        if (!idToken || !familyId || typeof text !== "string" || !DOC_EXTRACT_TYPES.includes(docType)) {
          return json(env, { error: "missing-params" }, 400);
        }
        let uid;
        try { uid = await verifyFirebaseIdToken(env, idToken); } catch (e) { return json(env, { error: "invalid-token" }, 401); }
        if (!uid) return json(env, { error: "invalid-token" }, 401);
        if (!(await verifyFamilyMembership(env, idToken, familyId, uid))) return json(env, { error: "forbidden" }, 403);

        const clean = docExtractScrub(text.trim().slice(0, DOC_EXTRACT_MAX_CHARS));
        if (clean.length < DOC_EXTRACT_MIN_CHARS) return json(env, { error: "text-too-short" }, 400);
        if (!env.GROQ_API_KEY) return json(env, { error: "ai-not-configured" }, 503);
        if (!(await docExtractUnderLimit(env, uid))) return json(env, { error: "daily-limit" }, 429);

        let out;
        try {
          out = await docExtractCallLLM(env, DOC_EXTRACT_PROMPTS[docType], clean);
        } catch (e) {
          const rate = e && e.status === 429;
          return json(env, { error: rate ? "429" : e && e.name === "AbortError" ? "timeout" : "ai-unavailable" }, rate ? 429 : 502);
        }
        const data = docExtractParseJson(out.content);
        if (!data) return json(env, { error: "bad-json" }, 502);
        return json(env, { data, provider: out.provider });
      }


      return json(env, { error: "not-found" }, 404);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      // Rate-Limit Mitigation (§10.2.2) — Groq 429 হলে client নির্ভরযোগ্যভাবে
      // detect করে exponential-backoff retry করতে পারে সেজন্য generic 500-এর
      // বদলে proper 429 status ফেরত দেওয়া হচ্ছে (aiClient.js-এ retry-logic)।
      // bug-fix: আগে শুধু "groq-error-429" match হতো — Mistral/Cerebras/
      // OpenRouter fallback-ও ব্যর্থ হয়ে 429 দিলে সেটা ধরা পড়ত না, client
      // ভুলভাবে non-retryable 500 পেত। এখন যেকোনো provider-এর -429 ধরা হচ্ছে।
      const status = /-error-429\b/.test(msg) ? 429 : 500;
      return json(env, { error: msg }, status);
    }
  },
};
