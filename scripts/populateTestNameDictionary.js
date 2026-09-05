// scripts/populateTestNameDictionary.js
//
// P5 — Report Intelligence — testNameDictionary populate script
// (Architecture Plan Part B §5.3)। এই script owner নিজে local-এ চালাবেন —
// কোনো Cloud Function/cron না (roadmap §10.2.5 Spark-only নীতি)।
// firestore.rules ইতিমধ্যে `testNameDictionary/{testId}` collection-এ
// `allow write: if false` রেখেছে — শুধু এই trusted local script (Admin SDK,
// security-rules bypass করে) দিয়েই write সম্ভব।
//
// **medicineDatabase থেকে পার্থক্য:** এই collection-এ কোনো "draft"/"verified"
// status-gate নেই (Architecture §5.3 নোট অনুযায়ী canonicalName/synonyms
// mapping ও standard reference-range non-clinical-judgment গ্রুপিং —
// pharmacist/physician batch-review প্রয়োজন হয় না)। তাই এই script চালালেই
// entry সরাসরি app-এ ব্যবহারযোগ্য হবে।
//
// এই ব্যাচ (Architecture Part B §5.3 "প্রথম batch scope"):
//   Diabetes: FBS, RBS, HbA1c
//   Thyroid: TSH, Free T3, Free T4
//   Kidney: Creatinine, eGFR, Urea
//   সাধারণ/সংক্রমণ: CBC (Hb/WBC/Platelet), Dengue NS1/IgM/IgG, CRP/ESR,
//                    LFT (SGPT/SGOT), Lipid Profile (Total/LDL/HDL/Triglycerides)
//   মোট ২৩টা entry।
//
// ব্যবহার:
//   1) scripts/serviceAccountKey.json আগে থেকেই থাকলে reuse হবে (medicine
//      populate script-এর জন্য যেটা ব্যবহার করেছিলেন)।
//   2) ড্রাই-রান (কিছু লেখা হবে না, শুধু কী হবে দেখাবে):
//        node scripts/populateTestNameDictionary.js
//   3) আসল write:
//        node scripts/populateTestNameDictionary.js --confirm
//
// নিরাপত্তা: আগে থেকে থাকা entry এই script overwrite করবে না (--force দিলে
// করবে) — Process Rule ৩ (Zero Data Loss)।

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

// ---- Architecture Plan Part B §5.3 প্রথম batch (২৩টা entry) ----
const TEST_ENTRIES = [
  // --- Diabetes ---
  {
    testId: "fbs",
    canonicalName: "ফাস্টিং ব্লাড সুগার",
    canonicalNameEn: "Fasting Blood Sugar (FBS)",
    category: "diabetes",
    synonyms: ["FBS", "Fasting Glucose", "Fasting Blood Glucose", "FPG", "ফাস্টিং সুগার"],
    unit: "mg/dL",
    referenceRange: { low: 70, high: 99 },
    plausibleRange: { low: 20, high: 700 },
  },
  {
    testId: "rbs",
    canonicalName: "র‍্যান্ডম ব্লাড সুগার",
    canonicalNameEn: "Random Blood Sugar (RBS)",
    category: "diabetes",
    synonyms: ["RBS", "Random Glucose", "Random Blood Glucose", "র‍্যান্ডম সুগার"],
    unit: "mg/dL",
    referenceRange: { low: 70, high: 140 },
    plausibleRange: { low: 20, high: 700 },
  },
  {
    testId: "hba1c",
    canonicalName: "এইচবিএ১সি",
    canonicalNameEn: "HbA1c (Glycated Hemoglobin)",
    category: "diabetes",
    synonyms: ["HbA1c", "A1C", "Glycated Hb", "Glycosylated Hemoglobin"],
    unit: "%",
    referenceRange: { low: 4.0, high: 5.6 },
    plausibleRange: { low: 3, high: 20 },
  },

  // --- Thyroid ---
  {
    testId: "tsh",
    canonicalName: "টিএসএইচ",
    canonicalNameEn: "TSH (Thyroid Stimulating Hormone)",
    category: "thyroid",
    synonyms: ["TSH", "Thyrotropin"],
    unit: "mIU/L",
    referenceRange: { low: 0.4, high: 4.0 },
    plausibleRange: { low: 0.001, high: 150 },
  },
  {
    testId: "ft3",
    canonicalName: "ফ্রি টি৩",
    canonicalNameEn: "Free T3",
    category: "thyroid",
    synonyms: ["Free T3", "FT3", "Free Triiodothyronine"],
    unit: "pg/mL",
    referenceRange: { low: 2.3, high: 4.2 },
    plausibleRange: { low: 0.5, high: 30 },
  },
  {
    testId: "ft4",
    canonicalName: "ফ্রি টি৪",
    canonicalNameEn: "Free T4",
    category: "thyroid",
    synonyms: ["Free T4", "FT4", "Free Thyroxine"],
    unit: "ng/dL",
    referenceRange: { low: 0.8, high: 1.8 },
    plausibleRange: { low: 0.1, high: 10 },
  },

  // --- Kidney ---
  {
    testId: "creatinine",
    canonicalName: "ক্রিয়াটিনিন",
    canonicalNameEn: "Serum Creatinine",
    category: "kidney",
    synonyms: ["Creatinine", "S. Creatinine", "Cr"],
    unit: "mg/dL",
    referenceRange: { low: 0.6, high: 1.3 },
    plausibleRange: { low: 0.1, high: 20 },
  },
  {
    testId: "egfr",
    canonicalName: "ই-জিএফআর",
    canonicalNameEn: "eGFR",
    category: "kidney",
    synonyms: ["eGFR", "GFR", "Estimated GFR"],
    unit: "mL/min/1.73m²",
    referenceRange: { low: 90, high: 120 },
    plausibleRange: { low: 1, high: 150 },
  },
  {
    testId: "urea",
    canonicalName: "ইউরিয়া",
    canonicalNameEn: "Blood Urea",
    category: "kidney",
    synonyms: ["Urea", "Blood Urea Nitrogen", "BUN", "S. Urea"],
    unit: "mg/dL",
    referenceRange: { low: 15, high: 40 },
    plausibleRange: { low: 1, high: 300 },
  },

  // --- CBC ---
  {
    testId: "hb",
    canonicalName: "হিমোগ্লোবিন",
    canonicalNameEn: "Hemoglobin (Hb)",
    category: "cbc",
    synonyms: ["Hb", "Hgb", "Hemoglobin"],
    unit: "g/dL",
    referenceRange: { low: 12, high: 16 },
    plausibleRange: { low: 1, high: 25 },
  },
  {
    testId: "wbc",
    canonicalName: "শ্বেত রক্তকণিকা",
    canonicalNameEn: "Total WBC Count",
    category: "cbc",
    synonyms: ["WBC", "TC", "Total Count", "Total Leukocyte Count", "TLC"],
    unit: "×10³/µL",
    referenceRange: { low: 4.0, high: 11.0 },
    plausibleRange: { low: 0.1, high: 100 },
  },
  {
    testId: "platelet",
    canonicalName: "প্লাটিলেট",
    canonicalNameEn: "Platelet Count",
    category: "cbc",
    synonyms: ["Platelet", "PLT", "Platelet Count"],
    unit: "×10³/µL",
    referenceRange: { low: 150, high: 450 },
    plausibleRange: { low: 1, high: 2000 },
  },

  // --- Infection / সাধারণ ---
  {
    testId: "dengue-ns1",
    canonicalName: "ডেঙ্গু এনএস১",
    canonicalNameEn: "Dengue NS1 Antigen",
    category: "infection",
    synonyms: ["Dengue NS1", "NS1", "NS1 Antigen"],
    unit: "qualitative (Positive/Negative)",
    referenceRange: null,
    plausibleRange: null,
  },
  {
    testId: "dengue-igm",
    canonicalName: "ডেঙ্গু আইজিএম",
    canonicalNameEn: "Dengue IgM",
    category: "infection",
    synonyms: ["Dengue IgM", "IgM"],
    unit: "qualitative (Positive/Negative)",
    referenceRange: null,
    plausibleRange: null,
  },
  {
    testId: "dengue-igg",
    canonicalName: "ডেঙ্গু আইজিজি",
    canonicalNameEn: "Dengue IgG",
    category: "infection",
    synonyms: ["Dengue IgG", "IgG"],
    unit: "qualitative (Positive/Negative)",
    referenceRange: null,
    plausibleRange: null,
  },
  {
    testId: "crp",
    canonicalName: "সিআরপি",
    canonicalNameEn: "CRP (C-Reactive Protein)",
    category: "infection",
    synonyms: ["CRP", "C-Reactive Protein"],
    unit: "mg/L",
    referenceRange: { low: 0, high: 10 },
    plausibleRange: { low: 0, high: 500 },
  },
  {
    testId: "esr",
    canonicalName: "ইএসআর",
    canonicalNameEn: "ESR (Erythrocyte Sedimentation Rate)",
    category: "infection",
    synonyms: ["ESR", "Sed Rate"],
    unit: "mm/hr",
    referenceRange: { low: 0, high: 20 },
    plausibleRange: { low: 0, high: 150 },
  },

  // --- LFT ---
  {
    testId: "sgpt",
    canonicalName: "এসজিপিটি",
    canonicalNameEn: "SGPT (ALT)",
    category: "liver",
    synonyms: ["SGPT", "ALT", "Alanine Aminotransferase"],
    unit: "U/L",
    referenceRange: { low: 7, high: 56 },
    plausibleRange: { low: 0, high: 5000 },
  },
  {
    testId: "sgot",
    canonicalName: "এসজিওটি",
    canonicalNameEn: "SGOT (AST)",
    category: "liver",
    synonyms: ["SGOT", "AST", "Aspartate Aminotransferase"],
    unit: "U/L",
    referenceRange: { low: 8, high: 48 },
    plausibleRange: { low: 0, high: 5000 },
  },

  // --- Lipid Profile ---
  {
    testId: "cholesterol-total",
    canonicalName: "মোট কোলেস্টেরল",
    canonicalNameEn: "Total Cholesterol",
    category: "lipid",
    synonyms: ["Total Cholesterol", "Cholesterol"],
    unit: "mg/dL",
    referenceRange: { low: 0, high: 200 },
    plausibleRange: { low: 20, high: 1000 },
  },
  {
    testId: "ldl",
    canonicalName: "এলডিএল",
    canonicalNameEn: "LDL Cholesterol",
    category: "lipid",
    synonyms: ["LDL", "LDL Cholesterol", "Low-Density Lipoprotein"],
    unit: "mg/dL",
    referenceRange: { low: 0, high: 100 },
    plausibleRange: { low: 10, high: 600 },
  },
  {
    testId: "hdl",
    canonicalName: "এইচডিএল",
    canonicalNameEn: "HDL Cholesterol",
    category: "lipid",
    synonyms: ["HDL", "HDL Cholesterol", "High-Density Lipoprotein"],
    unit: "mg/dL",
    referenceRange: { low: 40, high: 60 },
    plausibleRange: { low: 5, high: 150 },
  },
  {
    testId: "triglycerides",
    canonicalName: "ট্রাইগ্লিসারাইড",
    canonicalNameEn: "Triglycerides",
    category: "lipid",
    synonyms: ["Triglycerides", "TG"],
    unit: "mg/dL",
    referenceRange: { low: 0, high: 150 },
    plausibleRange: { low: 10, high: 2000 },
  },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
  let willWrite = 0;
  let willSkip = 0;

  for (const entry of TEST_ENTRIES) {
    const { testId, ...rest } = entry;
    const ref = db.collection("testNameDictionary").doc(testId);
    const existingSnap = await ref.get();

    if (existingSnap.exists && !FORCE) {
      console.log(`⏭️  skip (আগে থেকেই আছে — overwrite এড়ানো হলো, --force দিলে overwrite হবে): ${testId}`);
      willSkip++;
      continue;
    }

    const docData = {
      ...rest,
      loincCode: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`${CONFIRM ? "✍️  write" : "🔍 preview"}: ${testId} (${entry.canonicalNameEn})`);
    if (CONFIRM) {
      await ref.set(docData, { merge: false });
    }
    willWrite++;
  }

  console.log(`\nসারাংশ: ${willWrite}টা entry ${CONFIRM ? "লেখা হলো" : "লেখা হতো"}, ${willSkip}টা skip হলো।`);
  if (!CONFIRM) {
    console.log("\nআসল write করতে চালান: node scripts/populateTestNameDictionary.js --confirm");
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ ত্রুটি:", e.message || e);
    process.exit(1);
  });
