// scripts/populateMedicineDbBatch2.js
//
// P4 — Medicine Database populate script, ব্যাচ ২ (Architecture Plan Part B §5.4
// Group ৩-১৪, batch-১-এর বাকি সব entry — ORS/Paracetamol/Zinc/Ibuprofen/PPI/
// Antihistamine, ইত্যাদি batch-১-এ (populateMedicineDb.js) আগেই হয়ে গেছে,
// এখানে duplicate করা হয়নি)।
//
// batch-১-এর মতোই একই নীতি:
//   - সব entry `status: "draft"` — pharmacist/physician verify না হওয়া পর্যন্ত
//     firestore.rules (`status == 'verified'`)-এর কারণে app এগুলো read করতে
//     পারবে না। §12.1.3/§5.4.0 নীতি অনুযায়ী Group ১-২-এর batch-review deferred
//     থাকলেও Group ৩+ formal batch-review শুরু হওয়ার কথা — সেই review সম্পন্ন
//     না হওয়া পর্যন্ত এই সব entry নিরাপদে অকার্যকর (draft) অবস্থায় থাকবে।
//   - "educationalUseNote" — নতুন, শুধু Tier-2 (`requires-consult`) entry-তে,
//     §12.1 নীতির ("শুধু generic name/class/সাধারণ ব্যবহার — educational, কোনো
//     dose না") direct প্রতিফলন — schema-violation না, বরং architecture-এর
//     নিজস্ব সংজ্ঞা পূরণ করার জন্য একটা readable text-field।
//   - `emergencyBystanderOnly: true` — শুধু Aspirin (#48) entry-তে, যাতে
//     ভবিষ্যতে medicine-browse UI বানানোর সময় এই entry ভুল করেও normal
//     browse-flow-এ না দেখানো হয় (§5.4.1.1 scope-সীমাবদ্ধতা — শুধু
//     CARDIAC-BYSTANDER-001 triage-trigger থেকেই accessible)।
//
// ব্যবহার (batch-১-এর অভিন্ন পদ্ধতি):
//   node scripts/populateMedicineDbBatch2.js            (dry-run)
//   node scripts/populateMedicineDbBatch2.js --confirm  (আসল write)
//   scripts/serviceAccountKey.json আগে থেকেই থাকতে হবে (batch-১-এর নির্দেশনা দ্রষ্টব্য)।

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM = process.argv.includes("--confirm");
const FORCE = process.argv.includes("--force");

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
} catch (e) {
  console.error(`❌ Service account key পাওয়া যায়নি: ${keyPath}`);
  console.error("   batch-১ (populateMedicineDb.js)-এর নির্দেশনা অনুযায়ী প্রথমে key ফাইল রাখুন।");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function docIdFor(genericName) {
  return genericName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---- Architecture Plan Part B §5.4 Group ৩-১৪ (৩৫টা entry) ----
const MEDICINE_ENTRIES = [
  // === Group ৩ — শিশুর সিরাপ ===
  {
    genericName: "Salbutamol",
    class: "SABA bronchodilator",
    tier: "otc-self-care",
    forms: [{ form: "syrup", strength: "2mg/5ml" }],
    dosingRules: [
      { ageMin: 0.16, ageMax: 6, dosePerKg: "0.1mg/kg", frequency: "3-4 বার/দিন" },
      { ageMin: 6, ageMax: 12, fixedDose: "2mg", frequency: "3-4 বার/দিন" },
      { ageMin: 12, ageMax: null, fixedDose: "2-4mg", frequency: "3-4 বার/দিন" },
    ],
    contraindications: ["hyperthyroidism (caution)", "cardiac arrhythmia history"],
    interactsWith: ["beta-blocker", "অন্য sympathomimetic"],
    pregnancyCategory: "generally considered compatible",
    breastfeedingSafe: true,
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    usageScopeNote: "ঘন ঘন/নিয়মিত ব্যবহার-প্যাটার্ন সনাক্ত হলে physician-referral rule — এটা Medicine-DB field না, ভবিষ্যতে triage/AI-flow-level সতর্কতা হিসেবে বাস্তবায়ন প্রয়োজন (এখানে শুধু নোট)।",
  },
  {
    genericName: "Ketotifen",
    class: "mast-cell stabilizer/antihistamine",
    tier: "otc-self-care",
    forms: [{ form: "syrup", strength: "1mg/5ml" }],
    dosingRules: [
      { ageMin: 0.5, ageMax: 3, fixedDose: "0.5mg", frequency: "twice daily" },
      { ageMin: 3, ageMax: null, fixedDose: "1mg", frequency: "twice daily", maxDurationDays: 30 },
    ],
    contraindications: ["known hypersensitivity", "seizure disorder history"],
    interactsWith: ["CNS depressant", "oral antidiabetic (rare thrombocytopenia interaction reported)"],
    pregnancyCategory: "caution, limited data",
    breastfeedingSafe: "caution",
    source: ["BNFC"],
    sourceConflictNotes: "WHO EML core list-এ নেই",
  },
  {
    genericName: "Domperidone",
    class: "antiemetic/prokinetic",
    tier: "otc-self-care",
    forms: [{ form: "syrup", strength: "5mg/5ml" }],
    dosingRules: [
      { ageMin: 1, ageMax: 12, dosePerKg: "0.25mg/kg", frequency: "3 বার/দিন, খাবারের আগে", maxDurationDays: "5-7" },
      { ageMin: 12, ageMax: null, fixedDose: "10mg", frequency: "3 বার/দিন", maxDailyDose: "30mg/day", maxDurationDays: 7 },
    ],
    contraindications: ["cardiac conduction disorder/QT-prolongation history", "significant electrolyte imbalance", "hepatic impairment (moderate-severe)", "শিশু <1 বছর"],
    interactsWith: ["QT-prolonging drug (macrolide যেমন Azithromycin, antifungal)", "CYP3A4-inhibitor"],
    pregnancyCategory: "caution, limited data",
    breastfeedingSafe: "caution",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: "EMA/UK MHRA cardiac-safety warning (2014) অনুযায়ী dose/duration সীমিত",
  },
  {
    genericName: "Ambroxol",
    class: "mucolytic/expectorant",
    tier: "otc-self-care",
    forms: [{ form: "syrup", strength: "15mg/5ml or 30mg/5ml" }],
    dosingRules: [
      { ageMin: 0, ageMax: 2, fixedDose: "7.5mg", frequency: "twice daily", note: "২ বছরের নিচে cough-syrup ব্যবহারে সতর্কতা" },
      { ageMin: 2, ageMax: 6, fixedDose: "7.5mg", frequency: "twice daily" },
      { ageMin: 6, ageMax: 12, fixedDose: "15mg", frequency: "twice-three times daily" },
      { ageMin: 12, ageMax: null, fixedDose: "30mg", frequency: "three times daily" },
    ],
    contraindications: ["known hypersensitivity"],
    interactsWith: ["Dextromethorphan (বিপরীত উদ্দেশ্য — productive vs dry cough, একসাথে না দেওয়া উচিত)"],
    pregnancyCategory: "caution (avoid 1st trimester)",
    breastfeedingSafe: "caution",
    source: ["BNFC"],
    sourceConflictNotes: "WHO EML-এ নেই",
  },
  {
    genericName: "Montelukast",
    class: "leukotriene receptor antagonist",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: [],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "chronic asthma/allergic-rhinitis prophylaxis; প্রথম শুরু physician-নির্ণয়ের উপর নির্ভরশীল; FDA/EMA neuropsychiatric side-effect warning আছে। ডাক্তার-নির্দেশিত occasional ব্যবহার হলেও Tier 2 অপরিবর্তিত।",
  },
  {
    genericName: "Doxofylline",
    class: "methylxanthine bronchodilator",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: [],
    source: ["BNFC (সীমিত কভারেজ)"],
    sourceConflictNotes: "WHO EML/BNFC উভয়েই সীমিত কভারেজ — dosing sourcing pharmacist/physician local-knowledge-নির্ভর বেশি",
    educationalUseNote: "narrow-therapeutic-index bronchodilator class।",
  },
  {
    genericName: "Azithromycin",
    class: "macrolide antibiotic",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: ["Domperidone/Ondansetron (উভয়ই QT-prolongation ঝুঁকি — একসাথে সতর্কতা)"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "সাধারণ ব্যাকটেরিয়াল সংক্রমণে ব্যবহৃত ম্যাক্রোলাইড অ্যান্টিবায়োটিক।",
  },

  // === Group ৪ — এডাল্ট ===
  {
    genericName: "Loperamide",
    class: "antidiarrheal",
    tier: "otc-self-care",
    forms: [{ form: "capsule/tablet", strength: "2mg" }],
    dosingRules: [
      { ageMin: 18, ageMax: null, fixedDose: "প্রথমে 4mg, তারপর প্রতি loose motion-এ 2mg", frequency: "as needed", maxDailyDose: "16mg/day (OTC limit)", maxDurationDays: 2 },
    ],
    contraindications: ["জ্বর ও রক্ত-মিশ্রিত diarrhea (dysentery-সদৃশ — toxic megacolon ঝুঁকি)", "শিশু (<12 সাধারণত avoid)", "acute ulcerative colitis", "severe hepatic impairment"],
    interactsWith: ["QT-prolonging drug (উচ্চ ডোজে, rare)"],
    pregnancyCategory: "caution, avoid 1st trimester",
    breastfeedingSafe: "caution",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    usageScopeNote: "জ্বর+রক্ত-মিশ্রিত diarrhea-তে suggest করা উচিত না, escalate করা উচিত — triage red-flag-এর সাথে সরাসরি সংযুক্ত থাকা দরকার।",
  },
  {
    genericName: "Metronidazole",
    class: "nitroimidazole antibiotic/antiprotozoal",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: ["alcohol (disulfiram-like reaction)"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "dysentery/amoebiasis/giardiasis-এ ব্যবহৃত antibiotic-class ওষুধ। alcohol-এর সাথে severe interaction।",
  },
  {
    genericName: "Itopride",
    class: "prokinetic",
    tier: "otc-self-care",
    forms: [{ form: "tablet", strength: "50mg" }],
    dosingRules: [{ ageMin: 18, ageMax: null, fixedDose: "50mg", frequency: "3 বার/দিন, খাবারের আগে", maxDurationDays: 14 }],
    contraindications: ["GI hemorrhage/obstruction/perforation", "known hypersensitivity"],
    interactsWith: ["anticholinergic drug"],
    pregnancyCategory: "caution, limited data",
    breastfeedingSafe: "caution, limited data",
    source: ["BNFC"],
    sourceConflictNotes: "WHO EML-এ নেই",
  },
  {
    genericName: "Naproxen",
    class: "NSAID (longer-acting)",
    tier: "otc-self-care",
    forms: [{ form: "tablet", strength: "250mg/500mg" }],
    dosingRules: [{ ageMin: 18, ageMax: null, fixedDose: "250-500mg", frequency: "twice daily", maxDailyDose: "1000mg/day (OTC/short-term limit)", maxDurationDays: "3-5" }],
    contraindications: ["active peptic ulcer/GI bleeding history", "severe renal/hepatic impairment", "third trimester pregnancy", "asthma-with-NSAID-sensitivity", "dengue/সন্দেহভাজন dengue", "cardiovascular disease history (NSAID-class CV-risk warning)"],
    interactsWith: ["অন্য NSAID/aspirin", "anticoagulant", "ACE-inhibitor/ARB", "lithium"],
    pregnancyCategory: "avoid, especially 3rd trimester",
    breastfeedingSafe: "generally compatible (caution)",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Levothyroxine",
    class: "thyroid hormone replacement",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: ["Calcium (৪ ঘণ্টা timing-gap না মানলে absorption উল্লেখযোগ্যভাবে কমে)"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "থাইরয়েড হরমোন replacement, §12.4 Category B chronic-disease medicine। AI শুধু lab-trend (TSH) interpretation, follow-up classification, existing-dose-miss general safety guidance দেবে — dose কখনো suggest করবে না।",
  },
  {
    genericName: "Amlodipine",
    class: "calcium-channel blocker (antihypertensive)",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: [],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "উচ্চ রক্তচাপ চিকিৎসায় ব্যবহৃত calcium-channel blocker, §12.4 Category B chronic-disease medicine।",
  },
  {
    genericName: "Losartan",
    class: "ARB antihypertensive",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: [],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "উচ্চ রক্তচাপ চিকিৎসায় ব্যবহৃত ARB, §12.4 Category B chronic-disease medicine।",
  },
  {
    genericName: "Metformin",
    class: "biguanide antidiabetic",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: [],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "ডায়াবেটিস চিকিৎসায় ব্যবহৃত biguanide, §12.4 Category B chronic-disease medicine।",
  },
  {
    genericName: "Ondansetron",
    class: "5-HT3 antiemetic",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: ["Domperidone/Azithromycin (QT-prolongation cross-risk)"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "বমি-বমি ভাব/বমি-নিয়ন্ত্রণে ব্যবহৃত antiemetic, QT-prolongation ঝুঁকি Domperidone-এর মতোই।",
  },

  // === Group ৫ — বয়স্কদের নিয়মিত prescribed medicine (সব Tier 2) ===
  {
    genericName: "Clonazepam",
    class: "benzodiazepine (anticonvulsant/anxiolytic)",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: [],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "controlled/scheduled substance, dependency-risk, বয়স্কদের জন্য বিশেষভাবে ঝুঁকিপূর্ণ (fall-risk, cognitive impairment/confusion, respiratory-depression বিশেষত অন্য sedative/opioid-এর সাথে)।",
    highRiskFlag: true,
    riskNote: "Dependency/withdrawal-risk — dose-gap/adjustment আলোচনায় একেবারেই না; herbal/lifestyle-complementary guidance-ও suppress; শুধু generic info + urgent ডাক্তার-রেফার",
  },
  {
    genericName: "Flupentixol + Melitracen (combination)",
    class: "antipsychotic (low-dose) + tricyclic antidepressant combination",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: [],
    source: ["BNFC"],
    sourceConflictNotes: "regionally common combination product, sourcing pharmacist/physician-নির্ভর বেশি",
    educationalUseNote: "psychiatric medication, narrow therapeutic index। বয়স্কদের ক্ষেত্রে TCA-component-এর anticholinergic side-effect (confusion, urinary retention, cardiac conduction) ও fall-risk প্রাসঙ্গিক।",
    highRiskFlag: true,
    riskNote: "Narrow-therapeutic-index psychiatric combination — dose-gap/adjustment আলোচনায় একেবারেই না; শুধু generic info + urgent ডাক্তার-রেফার",
  },
  {
    genericName: "Pizotifen",
    class: "antihistamine-derivative (migraine prophylaxis)",
    tier: "requires-consult",
    forms: [],
    dosingRules: [],
    contraindications: [],
    interactsWith: [],
    source: ["BNFC"],
    sourceConflictNotes: null,
    educationalUseNote: "migraine prophylaxis, চিকিৎসক-titrated dose, dose-change advice AI কখনো দেবে না। তুলনামূলক কম high-risk (sedation/weight-gain মূল side-effect) কিন্তু chronic-prophylactic বলে Tier 2।",
    highRiskFlag: false,
  },

  // === Group ৬ — টপিক্যাল/চর্মরোগ ===
  {
    genericName: "Clotrimazole",
    class: "topical antifungal",
    tier: "otc-self-care",
    forms: [{ form: "cream", strength: "1%" }],
    dosingRules: [{ ageMin: 0, ageMax: null, frequency: "affected area-তে দিনে ২-৩ বার, পাতলা করে", maxDurationDays: 14, note: "২ সপ্তাহে improvement না হলে ডাক্তার-পরামর্শ" }],
    contraindications: ["known hypersensitivity", "খোলা ঘা/broken skin-এ সতর্কতা"],
    pregnancyCategory: "generally safe (topical)",
    breastfeedingSafe: true,
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Povidone-Iodine",
    class: "antiseptic",
    tier: "otc-self-care",
    forms: [
      { form: "solution", strength: "10%" },
      { form: "ointment", strength: "5-10%" },
    ],
    dosingRules: [{ ageMin: 0, ageMax: null, frequency: "কাটা-ছেঁড়া/ক্ষত পরিষ্কার, দিনে ১-২ বার" }],
    contraindications: ["thyroid disorder (বড় area/দীর্ঘমেয়াদি ব্যবহারে সতর্কতা)", "known iodine hypersensitivity", "নবজাতক-এ বড় area-তে সতর্কতা"],
    pregnancyCategory: "caution (বড় area/দীর্ঘমেয়াদি এড়ানো)",
    breastfeedingSafe: "caution (বড় area)",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    usageScopeNote: "tetanus-status-সচেতনতা সাথে যুক্ত (deep/rusty-wound হলে tetanus-history জিজ্ঞাসা triage-flow-এ থাকা উচিত)।",
  },
  {
    genericName: "Antibiotic Ointment (Mupirocin/Fusidic Acid)",
    class: "topical antibiotic",
    tier: "otc-self-care",
    forms: [{ form: "ointment/cream", strength: "2%" }],
    dosingRules: [{ ageMin: 0, ageMax: null, frequency: "পরিষ্কার ক্ষতে দিনে ২-৩ বার", maxDurationDays: "7-10", note: "গভীর/বড় ক্ষত, প্রচুর রক্তক্ষরণ, পশু-কামড়ে যথেষ্ট না — সরাসরি ডাক্তার (triage escalation)" }],
    contraindications: ["known hypersensitivity"],
    pregnancyCategory: "safe (topical)",
    breastfeedingSafe: true,
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },

  // === Group ৭ — মাসিক ব্যথা ===
  {
    genericName: "Mefenamic Acid",
    class: "NSAID",
    tier: "otc-self-care",
    forms: [
      { form: "tablet", strength: "250mg/500mg" },
      { form: "syrup", strength: "50mg/5ml (pediatric fever use)" },
    ],
    dosingRules: [{ ageMin: 18, ageMax: null, fixedDose: "500mg প্রথমে, তারপর 250mg", frequency: "every 6h", maxDurationDays: "3-5", note: "মাসিক শুরুর সাথে সাথেই শুরু করলে effectiveness বেশি" }],
    contraindications: ["active peptic ulcer/GI bleeding history", "severe renal/hepatic impairment", "third trimester pregnancy", "dengue/সন্দেহভাজন dengue", "asthma-with-NSAID-sensitivity"],
    interactsWith: ["অন্য NSAID/aspirin", "anticoagulant", "lithium"],
    pregnancyCategory: "avoid, especially 3rd trimester",
    breastfeedingSafe: "caution",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    usageScopeNote: "abnormal/irregular bleeding-সহ ব্যথা হলে gynecology-escalation পথে যাওয়া উচিত — শুধু routine dysmenorrhea-তেই এই entry suggest হবে।",
  },

  // === Group ৮ — Vitamin/Mineral Supplement ===
  {
    genericName: "Vitamin D3 (Cholecalciferol)",
    class: "vitamin supplement",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [
      { ageMin: 0, ageMax: 1, fixedDose: "400IU", frequency: "daily" },
      { ageMin: 1, ageMax: 18, fixedDose: "600IU", frequency: "daily" },
      { ageMin: 18, ageMax: 65, fixedDose: "600-800IU", frequency: "daily" },
      { ageMin: 65, ageMax: null, fixedDose: "800-1000IU", frequency: "daily" },
    ],
    contraindications: ["hypercalcemia", "known hypervitaminosis-D"],
    interactsWith: ["thiazide diuretic"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Calcium (Carbonate/Citrate)",
    class: "mineral supplement",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [
      { ageMin: 18, ageMax: 50, fixedDose: "1000mg elemental/day", frequency: "বিভক্ত ডোজে" },
      { ageMin: 50, ageMax: null, fixedDose: "1200mg elemental/day", frequency: "বিভক্ত ডোজে" },
    ],
    contraindications: ["hypercalcemia", "kidney stone history (caution)", "severe renal impairment"],
    interactsWith: ["Antacid/PPI-এর সাথে timing-সতর্কতা", "iron-এর absorption কমায় (২ ঘণ্টা gap)", "Levothyroxine absorption কমায় (৪ ঘণ্টা gap প্রয়োজন)"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Iron + Folic Acid (combination)",
    class: "hematinic (iron+folate combination)",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [{ ageMin: 12, ageMax: null, fixedDose: "1 tablet", frequency: "daily (deficiency-treatment-এ physician-guided উচ্চ-ডোজ)", note: "pregnancy-তে WHO ANC-supplement হিসেবে routine" }],
    contraindications: ["hemochromatosis/iron-overload disorder", "known hypersensitivity"],
    interactsWith: ["Calcium/Antacid-এর সাথে absorption কমে", "টেট্রাসাইক্লিন/সিপ্রোফ্লক্সাসিন absorption কমায়"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },

  // === Group ৯ — কাশি (dry-cough) ===
  {
    genericName: "Dextromethorphan",
    class: "dry-cough suppressant",
    tier: "otc-self-care",
    forms: [{ form: "syrup", strength: "10-15mg/5ml" }],
    dosingRules: [
      { ageMin: 0, ageMax: 6, note: "৬ বছরের নিচে সাধারণত নিরুৎসাহিত — suggest করা হবে না" },
      { ageMin: 6, ageMax: 12, fixedDose: "5-10mg", frequency: "every 4h", maxDailyDose: "60mg/day" },
      { ageMin: 12, ageMax: null, fixedDose: "10-20mg", frequency: "every 4h বা 30mg every 6-8h", maxDailyDose: "120mg/day" },
    ],
    contraindications: ["MAO-inhibitor (সাম্প্রতিক ১৪ দিন — serotonin syndrome ঝুঁকি)", "productive/mucus-heavy cough (suppression অনুচিত হতে পারে)", "asthma/COPD-এ সতর্কতা"],
    interactsWith: ["MAO-inhibitor (contraindicated)", "SSRIs (serotonin syndrome ঝুঁকি)", "CNS depressant", "Ambroxol (বিপরীত উদ্দেশ্য — একসাথে না দেওয়া উচিত)"],
    pregnancyCategory: "caution, limited data",
    breastfeedingSafe: "caution",
    source: ["BNFC"],
    sourceConflictNotes: "WHO EML-এ নেই",
  },

  // === Group ১০ — Topical Pain-Relief ===
  {
    genericName: "Diclofenac (topical gel)",
    class: "topical NSAID",
    tier: "otc-self-care",
    forms: [{ form: "gel", strength: "1%" }],
    dosingRules: [{ ageMin: 12, ageMax: null, frequency: "আক্রান্ত স্থানে দিনে ৩-৪ বার পাতলা প্রলেপ", maxDurationDays: 14 }],
    contraindications: ["খোলা ঘা/broken skin", "known NSAID hypersensitivity", "third trimester pregnancy"],
    pregnancyCategory: "caution 3rd trimester",
    breastfeedingSafe: "generally compatible",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
    usageScopeNote: "বয়স্কদের বাত/হাড়ক্ষয় ব্যথায় oral NSAID (Naproxen)-এর systemic risk এড়াতে safer first-choice, বিশেষত multi-medicine-নেওয়া patient-দের জন্য।",
  },

  // === Group ১১ — Constipation ===
  {
    genericName: "Lactulose",
    class: "osmotic laxative",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [
      { ageMin: 1, ageMax: 6, fixedDose: "5ml", frequency: "twice daily, প্রয়োজন অনুযায়ী adjust" },
      { ageMin: 6, ageMax: 12, fixedDose: "10ml", frequency: "twice daily" },
      { ageMin: 12, ageMax: null, fixedDose: "15ml", frequency: "twice daily", maxDurationDays: 14 },
    ],
    contraindications: ["galactosemia", "GI obstruction (suspected)", "known hypersensitivity"],
    interactsWith: [],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Psyllium Husk (Isabgol)",
    class: "bulk-forming laxative",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [{ ageMin: 12, ageMax: null, fixedDose: "1 চা চামচ (~5-10g)", frequency: "1-2 বার/দিন, প্রচুর পানির সাথে", maxDurationDays: 14, note: "পর্যাপ্ত পানি ছাড়া নিলে obstruction-risk বাড়াতে পারে" }],
    contraindications: ["GI obstruction (suspected)", "difficulty swallowing", "known hypersensitivity"],
    interactsWith: ["অন্য ওষুধের absorption দেরি করতে পারে (১-২ ঘণ্টা gap)"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Bisacodyl",
    class: "stimulant laxative",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [{ ageMin: 10, ageMax: null, fixedDose: "5-10mg (tablet)", frequency: "once daily, রাতে", maxDurationDays: "5-7", note: "দীর্ঘমেয়াদি stimulant-laxative নিরুৎসাহিত (bowel-dependency ঝুঁকি)" }],
    contraindications: ["GI obstruction (suspected)", "acute abdominal pain (undiagnosed)", "severe dehydration"],
    interactsWith: ["Antacid/dairy-এর সাথে একসাথে না নেওয়া"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },

  // === Group ১২ — Piles ===
  {
    genericName: "Hydrocortisone + Local Anesthetic (topical hemorrhoid cream)",
    class: "topical corticosteroid + anesthetic (hemorrhoid)",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [{ ageMin: 18, ageMax: null, frequency: "দিনে ২ বার + প্রয়োজনে মলত্যাগের পর, পাতলা প্রলেপ", maxDurationDays: 7, note: "৭ দিনের বেশি নিরুৎসাহিত (skin-thinning ঝুঁকি); রক্তক্ষরণ persistent/বাড়লে বা lump-পরিবর্তনে ডাক্তার-পরামর্শ" }],
    contraindications: ["local fungal/viral/bacterial skin infection", "known hypersensitivity"],
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },

  // === Group ১৩ — মুখের ঘা ===
  {
    genericName: "Benzydamine (oral rinse/gel)",
    class: "topical anti-inflammatory (oral rinse)",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [
      { ageMin: 6, ageMax: 12, note: "diluted rinse, প্রতি ১.৫-৩ ঘণ্টায়, গিলে ফেলা যাবে না" },
      { ageMin: 12, ageMax: null, fixedDose: "15ml rinse", frequency: "every 1.5-3h, gargle then spit out", maxDurationDays: 7 },
    ],
    contraindications: ["known hypersensitivity", "aspirin/NSAID-sensitivity history (caution)"],
    source: ["BNFC"],
    sourceConflictNotes: "WHO EML-এ নেই",
  },
  {
    genericName: "Triamcinolone Acetonide (dental paste)",
    class: "topical corticosteroid (dental)",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [{ ageMin: 6, ageMax: null, frequency: "ঘায়ে দিনে ২-৩ বার পাতলা প্রলেপ, খাবারের পর/ঘুমানোর আগে", maxDurationDays: 7, note: "৭ দিনে না সারলে বা recurrent হলে ডাক্তার-পরামর্শ" }],
    contraindications: ["oral fungal/viral infection (steroid infection-mask/worsen করতে পারে)", "known hypersensitivity"],
    source: ["BNFC"],
    sourceConflictNotes: "WHO EML-এ নেই",
  },

  // === Group ১৪ — Emergency Bystander First-Aid (narrow-scope, §5.4.1) ===
  {
    genericName: "Aspirin (Suspected Heart-Attack — Emergency Bystander First-Aid)",
    class: "antiplatelet, emergency-bystander-use only",
    tier: "otc-self-care",
    // roadmap/architecture §5.4.1.1 — এই entry কখনো normal medicine-browse/lookup
    // flow-এ accessible হবে না, শুধু CARDIAC-BYSTANDER-001 triage-trigger থেকেই।
    emergencyBystanderOnly: true,
    forms: [{ form: "chewable/soluble tablet", strength: "300mg (or 2×150mg / 4×75mg)" }],
    dosingRules: [
      { ageMin: 18, ageMax: null, fixedDose: "300mg, চিবিয়ে খাওয়ানো (গিলে ফেলা না)", frequency: "one-time only, ambulance আসার সময়", note: "এটা treatment না — bystander first-aid, ambulance/hospital-এর বিকল্প কখনো না" },
    ],
    contraindications: ["known Aspirin/NSAID hypersensitivity বা asthma-with-NSAID-sensitivity", "active bleeding বা সাম্প্রতিক significant bleeding history", "known bleeding-disorder", "১৮ বছরের নিচে (Reye's syndrome ঝুঁকি)"],
    interactsWith: ["anticoagulant (bleeding-risk বাড়ায়, তবু emergency-context-এ benefit উচ্চ বিবেচিত)"],
    pregnancyCategory: "avoid unless directed",
    breastfeedingSafe: "single emergency dose generally acceptable",
    source: ["WHO guideline-based bystander first-aid", "AHA/Red Cross bystander protocol"],
    sourceConflictNotes: "এটা normal WHO-EML/BNFC dosing-entry না — emergency bystander-action হিসেবে আলাদা source-category, batch-review-এ physician বিশেষভাবে confirm করবেন",
  },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
  console.log(`মোট entry: ${MEDICINE_ENTRIES.length}`);
  let willWrite = 0;
  let willSkip = 0;

  for (const entry of MEDICINE_ENTRIES) {
    const id = docIdFor(entry.genericName);
    const ref = db.collection("medicineDatabase").doc(id);
    const existingSnap = await ref.get();

    if (existingSnap.exists && existingSnap.data().status === "verified" && !FORCE) {
      console.log(`⏭️  skip (আগে থেকেই verified — overwrite এড়ানো হলো, --force দিলে overwrite হবে): ${id}`);
      willSkip++;
      continue;
    }

    const docData = {
      ...entry,
      highRiskFlag: entry.highRiskFlag ?? false,
      riskNote: entry.riskNote ?? null,
      status: "draft",
      lastVerifiedDate: null,
      verifiedByRole: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`${CONFIRM ? "✍️  write" : "🔍 preview"}: ${id} (${entry.genericName})`);
    if (CONFIRM) {
      await ref.set(docData, { merge: false });
    }
    willWrite++;
  }

  console.log(`\nসারাংশ: ${willWrite}টা entry ${CONFIRM ? "লেখা হলো" : "লেখা হতো"}, ${willSkip}টা skip হলো।`);
  console.log(`মনে রাখবেন: সব entry status: "draft"-এ থাকবে — pharmacist/physician verify করার আগে app এগুলো ব্যবহার করবে না (rules-level enforced)।`);
  if (!CONFIRM) {
    console.log("\nআসল write করতে চালান: node scripts/populateMedicineDbBatch2.js --confirm");
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ ত্রুটি:", e.message || e);
    process.exit(1);
  });
