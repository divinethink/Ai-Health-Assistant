// scripts/populateMedicineDb.js
//
// P4 — Medicine Database populate script (Architecture Plan Part A §3.4.4 item #4,
// Part B §5.4)। এই script owner নিজে local-এ চালাবেন — কোনো Cloud Function/cron না
// (roadmap §10.2.5 Spark-only নীতি)। firestore.rules ইতিমধ্যে
// `medicineDatabase/{id}` collection-এ `allow write: if false` রেখেছে — শুধু এই
// trusted local script (Admin SDK, security-rules bypass করে) দিয়েই write সম্ভব।
//
// এই ব্যাচ: Architecture Part B §5.4 Group ১ (ORS/Paracetamol/Zinc) + Group ২
// (Ibuprofen/Esomeprazole/Pantoprazole/Antacid/Antacid Plus/Bilastine/
// Fexofenadine/Cetirizine/Chlorpheniramine) — §12.1.4 সর্বোচ্চ-priority অনুযায়ী,
// মোট ১২টা entry। বাকি group (৩-১৪) পরবর্তী ব্যাচে আসবে (incremental, verify-first)।
//
// **গুরুত্বপূর্ণ — status থাকবে "draft":** §12.1.3 নীতি অনুযায়ী pharmacist/
// physician batch-review সম্পন্ন না হওয়া পর্যন্ত এই entry-গুলো "draft"-ই থাকবে।
// firestore.rules-এর read-rule (`status == 'verified'`) নিজেই নিশ্চিত করে যে draft
// অবস্থায় app কখনো এই data ব্যবহার করতে পারবে না — তাই এই script চালানো নিরাপদ,
// কোনো unverified dose সরাসরি family-কে দেখানো হবে না।
//
// ব্যবহার:
//   1) Firebase Console → Project Settings → Service Accounts → Generate new
//      private key → ডাউনলোড করা JSON ফাইলটা এই ফোল্ডারেই
//      `scripts/serviceAccountKey.json` নামে রাখুন (কখনো git-এ commit করবেন না,
//      .gitignore-এ যোগ করা আছে)।
//   2) npm install   (firebase-admin package.json-এ যোগ করা হয়েছে)
//   3) ড্রাই-রান (কিছু লেখা হবে না, শুধু কী হবে দেখাবে):
//        node scripts/populateMedicineDb.js
//   4) আসল write:
//        node scripts/populateMedicineDb.js --confirm
//
// নিরাপত্তা: আগে থেকে "verified" status-এর কোনো entry থাকলে এই script সেটা
// overwrite করবে না (--force দিলে করবে) — Process Rule ৩ (Zero Data Loss)।

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
  console.error("   Firebase Console → Project Settings → Service Accounts → Generate new private key");
  console.error("   ফাইলটা scripts/serviceAccountKey.json নামে রাখুন।");
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

// ---- Architecture Plan Part B §5.4 Group ১ + Group ২ (১২টা entry) ----
const MEDICINE_ENTRIES = [
  // --- Group ১ ---
  {
    genericName: "ORS (Oral Rehydration Salts)",
    class: "electrolyte/rehydration",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [
      { ageMin: 0, ageMax: 2, note: "প্রতি loose motion-এর পর ৫০-১০০ml" },
      { ageMin: 2, ageMax: 10, note: "প্রতি loose motion-এর পর ১০০-২০০ml" },
      { ageMin: 10, ageMax: null, note: "স্বাভাবিক পিপাসা অনুযায়ী, তরল-চাহিদা যতটা লাগে" },
    ],
    contraindications: ["severe dehydration/shock (IV fluid প্রয়োজন হতে পারে — triage-এ flag)"],
    interactsWith: [],
    pregnancyCategory: "safe",
    breastfeedingSafe: true,
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Paracetamol",
    class: "analgesic/antipyretic",
    tier: "otc-self-care",
    forms: [
      { form: "syrup", strength: "120mg/5ml" },
      { form: "tablet", strength: "500mg" },
    ],
    dosingRules: [
      { ageMin: 0, ageMax: 0.25, dosePerKg: "10mg/kg", frequency: "every 6-8h", maxDailyDose: "60mg/kg/day", note: "৩ মাসের নিচে সতর্কতা — ডাক্তার-পরামর্শ recommended" },
      { ageMin: 0.25, ageMax: 12, dosePerKg: "10-15mg/kg", frequency: "every 4-6h", maxDailyDose: "60-75mg/kg/day", maxDurationDays: 3 },
      { ageMin: 12, ageMax: null, fixedDose: "500-1000mg", frequency: "every 4-6h", maxDailyDose: "4000mg/day (adult)", maxDurationDays: 3 },
    ],
    contraindications: ["severe hepatic impairment", "known paracetamol hypersensitivity"],
    interactsWith: ["warfarin (dose-dependent, caution)"],
    pregnancyCategory: "generally safe (category B)",
    breastfeedingSafe: true,
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Zinc Sulfate",
    class: "trace-mineral/diarrhea-adjunct",
    tier: "otc-self-care",
    forms: [
      { form: "dispersible tablet", strength: "20mg" },
      { form: "syrup", strength: "20mg/5ml" },
    ],
    dosingRules: [
      { ageMin: 0, ageMax: 0.5, fixedDose: "10mg", frequency: "once daily", maxDurationDays: "10-14", note: "WHO: ৬ মাসের কম হলে অর্ধেক ডোজ" },
      { ageMin: 0.5, ageMax: 5, fixedDose: "20mg", frequency: "once daily", maxDurationDays: "10-14", note: "diarrhea বন্ধ হওয়ার পরও পূর্ণ ১০-১৪ দিন চালিয়ে যেতে হবে (relapse-prevention)" },
    ],
    contraindications: ["known zinc hypersensitivity"],
    interactsWith: ["কিছু antibiotic (tetracycline/quinolone)-এর absorption কমাতে পারে — ২ ঘণ্টা gap"],
    pregnancyCategory: "safe at recommended dose",
    breastfeedingSafe: true,
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },

  // --- Group ২ ---
  {
    genericName: "Ibuprofen",
    class: "NSAID",
    tier: "otc-self-care",
    forms: [
      { form: "syrup", strength: "100mg/5ml" },
      { form: "tablet", strength: "200mg/400mg" },
    ],
    dosingRules: [
      { ageMin: 0.5, ageMax: 12, dosePerKg: "5-10mg/kg", frequency: "every 6-8h", maxDailyDose: "30mg/kg/day", maxDurationDays: 3 },
      { ageMin: 12, ageMax: null, fixedDose: "200-400mg", frequency: "every 6-8h", maxDailyDose: "1200mg/day (OTC limit)", maxDurationDays: 3 },
    ],
    contraindications: [
      "6 মাসের নিচে শিশু",
      "active peptic ulcer/GI bleeding history",
      "severe renal impairment",
      "third trimester pregnancy",
      "asthma-with-NSAID-sensitivity history",
      "dengue/সন্দেহভাজন dengue (bleeding risk — Bangladesh-context-critical flag)",
    ],
    interactsWith: ["অন্য NSAID/aspirin", "anticoagulant (warfarin)", "ACE-inhibitor/ARB (renal risk বাড়ায়)"],
    pregnancyCategory: "avoid, especially 3rd trimester",
    breastfeedingSafe: "generally compatible (caution)",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Esomeprazole",
    class: "PPI",
    tier: "otc-self-care",
    forms: [
      { form: "capsule", strength: "20mg/40mg" },
      { form: "tablet (MUPS)", strength: "20mg/40mg" },
    ],
    dosingRules: [
      { ageMin: 12, ageMax: null, fixedDose: "20-40mg", frequency: "once daily, খাবারের আগে", maxDurationDays: 14, note: "৪-৮ সপ্তাহ physician-guided course এই app-এর self-care scope-এর বাইরে" },
      { ageMin: 1, ageMax: 12, note: "pediatric dosing physician-guided only, self-care-এ দেওয়া হবে না" },
    ],
    contraindications: ["known PPI hypersensitivity", "concurrent nelfinavir"],
    interactsWith: [
      "clopidogrel (antiplatelet কার্যকারিতা কমাতে পারে, CYP2C19-নির্ভর — Pantoprazole-এর চেয়ে বেশি সংবেদনশীল)",
      "methotrexate (উচ্চ-ডোজে)",
      "দীর্ঘমেয়াদে B12/Mg absorption কমাতে পারে",
    ],
    pregnancyCategory: "generally considered compatible",
    breastfeedingSafe: "caution, limited data",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Pantoprazole",
    class: "PPI",
    tier: "otc-self-care",
    forms: [{ form: "tablet (EC)", strength: "20mg/40mg" }],
    dosingRules: [
      { ageMin: 12, ageMax: null, fixedDose: "20-40mg", frequency: "once daily, খাবারের আগে", maxDurationDays: 14, note: "clopidogrel-সহ রোগীর জন্য Esomeprazole/Omeprazole-এর চেয়ে তুলনামূলক কম-interaction বিকল্প" },
    ],
    contraindications: ["known PPI hypersensitivity"],
    interactsWith: ["clopidogrel (তুলনামূলক কম, তবু caution-flag)", "methotrexate", "atazanavir"],
    pregnancyCategory: "generally considered compatible",
    breastfeedingSafe: "caution, limited data",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: "clopidogrel-interaction severity নিয়ে source-ভেদে মত ভিন্ন — flag রাখা হলো",
  },
  {
    genericName: "Antacid (Al(OH)3+Mg(OH)2)",
    class: "antacid",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [
      { ageMin: 12, ageMax: null, fixedDose: "10-15ml বা 1-2 tablet", frequency: "meal-এর ১-২ ঘণ্টা পর ও ঘুমানোর আগে", maxDailyDose: "4 বার/দিন", maxDurationDays: 14 },
      { ageMin: 0, ageMax: 12, note: "শিশুদের routine ব্যবহার নিরুৎসাহিত" },
    ],
    contraindications: ["severe renal impairment", "known hypersensitivity"],
    interactsWith: ["অনেক ওষুধের absorption কমায় (tetracycline, ciprofloxacin, iron) — ২ ঘণ্টা gap বাধ্যতামূলক"],
    pregnancyCategory: null,
    breastfeedingSafe: null,
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Antacid Plus (+Simethicone)",
    class: "antacid+antiflatulent",
    tier: "otc-self-care",
    forms: [],
    dosingRules: [
      { ageMin: 12, ageMax: null, fixedDose: "10-15ml বা 1-2 tablet", frequency: "meal-এর ১-২ ঘণ্টা পর ও ঘুমানোর আগে", maxDailyDose: "4 বার/দিন", maxDurationDays: 14 },
      { ageMin: 0, ageMax: 12, note: "শিশুদের routine ব্যবহার নিরুৎসাহিত" },
    ],
    contraindications: ["severe renal impairment", "known hypersensitivity"],
    interactsWith: ["অনেক ওষুধের absorption কমায় (tetracycline, ciprofloxacin, iron) — ২ ঘণ্টা gap বাধ্যতামূলক"],
    pregnancyCategory: null,
    breastfeedingSafe: null,
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Bilastine",
    class: "3rd-gen antihistamine",
    tier: "otc-self-care",
    forms: [{ form: "tablet", strength: "20mg" }],
    dosingRules: [
      { ageMin: 12, ageMax: null, fixedDose: "20mg", frequency: "once daily, খালি পেটে (খাবারের ১ ঘণ্টা আগে/২ ঘণ্টা পরে)", maxDurationDays: 30 },
      { ageMin: 6, ageMax: 12, fixedDose: "10mg", frequency: "once daily", note: "pediatric local-approval (DGDA) নিশ্চিত করা প্রয়োজন" },
    ],
    contraindications: ["known hypersensitivity", "severe renal impairment"],
    interactsWith: ["ketoconazole/erythromycin (absorption বাড়াতে পারে)", "grapefruit/ফলের জুস (bioavailability উল্লেখযোগ্য কমায়)"],
    pregnancyCategory: "limited data, caution",
    breastfeedingSafe: "limited data, caution",
    source: ["BNFC"],
    sourceConflictNotes: "WHO EML core list-এ নেই — BNFC primary source",
  },
  {
    genericName: "Fexofenadine",
    class: "3rd-gen antihistamine",
    tier: "otc-self-care",
    forms: [
      { form: "tablet", strength: "60mg/120mg/180mg" },
      { form: "suspension", strength: "30mg/5ml" },
    ],
    dosingRules: [
      { ageMin: 0.5, ageMax: 2, fixedDose: "15mg", frequency: "twice daily" },
      { ageMin: 2, ageMax: 11, fixedDose: "30mg", frequency: "twice daily" },
      { ageMin: 12, ageMax: null, fixedDose: "120-180mg", frequency: "once daily", maxDurationDays: 30 },
    ],
    contraindications: ["known hypersensitivity"],
    interactsWith: ["Al/Mg-antacid (absorption কমায় — ২ ঘণ্টা gap)", "ফলের জুস (bioavailability কমাতে পারে)"],
    pregnancyCategory: "generally considered compatible",
    breastfeedingSafe: "caution, limited data",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Cetirizine",
    class: "2nd-gen antihistamine",
    tier: "otc-self-care",
    forms: [
      { form: "syrup", strength: "5mg/5ml" },
      { form: "tablet", strength: "10mg" },
    ],
    dosingRules: [
      { ageMin: 0.5, ageMax: 2, fixedDose: "2.5mg", frequency: "once daily", maxDurationDays: 7 },
      { ageMin: 2, ageMax: 6, fixedDose: "2.5mg", frequency: "once/twice daily", maxDailyDose: "5mg/day", maxDurationDays: 7 },
      { ageMin: 6, ageMax: 12, fixedDose: "5-10mg", frequency: "once daily", maxDurationDays: 7 },
      { ageMin: 12, ageMax: null, fixedDose: "10mg", frequency: "once daily", maxDurationDays: 7, note: "৭ দিনের বেশি হলে ডাক্তার-পরামর্শ flag" },
    ],
    contraindications: ["severe renal impairment", "known hypersensitivity"],
    interactsWith: ["CNS depressant/alcohol"],
    pregnancyCategory: "generally considered safe",
    breastfeedingSafe: "caution, limited data",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
  {
    genericName: "Chlorpheniramine",
    class: "1st-gen antihistamine (sedating)",
    tier: "otc-self-care",
    forms: [
      { form: "syrup", strength: "2mg/5ml" },
      { form: "tablet", strength: "4mg" },
    ],
    dosingRules: [
      { ageMin: 0.5, ageMax: 2, note: "রুটিন ব্যবহার নিরুৎসাহিত — sedation/paradoxical-excitation ঝুঁকি" },
      { ageMin: 2, ageMax: 6, fixedDose: "1mg", frequency: "every 4-6h", maxDailyDose: "6mg/day" },
      { ageMin: 6, ageMax: 12, fixedDose: "2mg", frequency: "every 4-6h", maxDailyDose: "12mg/day" },
      { ageMin: 12, ageMax: null, fixedDose: "4mg", frequency: "every 4-6h", maxDailyDose: "24mg/day" },
    ],
    contraindications: ["narrow-angle glaucoma", "severe asthma/COPD", "urinary retention history", "নবজাতক/premature শিশু"],
    interactsWith: ["CNS depressant", "alcohol", "MAO inhibitor"],
    pregnancyCategory: "caution, lower-risk option if needed",
    breastfeedingSafe: "caution (sedation risk in infant)",
    source: ["WHO-EML", "BNFC"],
    sourceConflictNotes: null,
  },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
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
      highRiskFlag: false,
      riskNote: null,
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
    console.log("\nআসল write করতে চালান: node scripts/populateMedicineDb.js --confirm");
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ ত্রুটি:", e.message || e);
    process.exit(1);
  });
