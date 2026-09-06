// scripts/populateRemedyDb.js
//
// P6 — Herbal/Homeopathy RemedyEntry populate script (Architecture Plan Part B
// §5.2, roadmap §12.2)। এই script owner নিজে local-এ চালাবেন — কোনো Cloud
// Function/cron না (roadmap §10.2.5 Spark-only নীতি)। firestore.rules ইতিমধ্যে
// `remedyDatabase/{id}` collection-এ `allow write: if false` রেখেছে — শুধু এই
// trusted local script (Admin SDK, security-rules bypass করে) দিয়েই write সম্ভব।
//
// এই ব্যাচ: common herbal (৭টা) + common homeopathy (৪টা) remedy — পরিবারে
// প্রাসঙ্গিক ব্যবহার-ক্ষেত্র (হজম/গ্যাস, ঠান্ডা-কাশি, ঘুম/স্ট্রেস, ব্যথা,
// রোগ-প্রতিরোধ)। evidenceTier ও source §12.2/§5.2-এর source-hierarchy অনুযায়ী।
//
// **গুরুত্বপূর্ণ — status থাকবে "draft":** Medicine DB (§12.1.3)-এর মতোই batch-
// review নীতি এখানেও প্রযোজ্য বিবেচনা করে সামঞ্জস্যের জন্য `status: "draft"` +
// `verifiedByRole: null` + `lastVerifiedDate: null` যোগ করা হয়েছে (RemedyEntry
// schema-র মূল printed অংশে না থাকলেও, ভবিষ্যতে pharmacist/physician verify-
// workflow retrofit সহজ করতে)। **নোট (owner-এর জন্য, transparency):**
// `remedyDatabase` read-rule বর্তমানে `status`-এর উপর gate করে না (শুধু
// `request.auth != null`) — medicineDatabase-এর মতো `status == 'verified'`
// rules-level enforcement নেই। যেহেতু এখনো কোনো remedy-display UI নেই, এই মুহূর্তে
// ঝুঁকি নেই, কিন্তু ভবিষ্যতে remedy UI বানানোর সময় client-side status-filter
// (শুধু "verified" দেখানো) মনে রাখা আবশ্যক, অথবা rules-এ status-gate যোগ করা
// বিবেচনা করা যেতে পারে (এই script rules ছোঁয়নি, শুধু note)।
//
// ব্যবহার:
//   1) scripts/serviceAccountKey.json আগে থেকেই থাকলে reuse হবে (Medicine DB
//      script-এর জন্য আগেই বসানো হয়েছিল)।
//   2) ড্রাই-রান (কিছু লেখা হবে না, শুধু preview):
//        node scripts/populateRemedyDb.js
//   3) আসল write:
//        node scripts/populateRemedyDb.js --confirm
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

function docIdFor(mode, name) {
  return `${mode}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const HOMEOPATHY_DISCLAIMER =
  "নিয়ন্ত্রিত বৈজ্ঞানিক পর্যালোচনায় placebo-র তুলনায় অতিরিক্ত কার্যকারিতার নির্ভরযোগ্য প্রমাণ পাওয়া যায়নি।";
const TRADITIONAL_HERBAL_DISCLAIMER =
  "শুধুমাত্র ঐতিহ্যগত ব্যবহারের ভিত্তিতে অন্তর্ভুক্ত করা হয়েছে; নিয়ন্ত্রিত ক্লিনিক্যাল স্টাডি এর কার্যকারিতা সমর্থন করে না।";

// ---- Herbal (৭টা) — §12.2 source-hierarchy: NCCIH → EMA → BCSIR/National Herbarium → CCRAS → DGDA ----
const HERBAL_ENTRIES = [
  {
    name: "Ginger (আদা)",
    useCase: ["বমি-বমি ভাব", "মোশন-সিকনেস", "হালকা হজম-অস্বস্তি"],
    evidenceTier: 2,
    source: "NCCIH — Ginger",
    sourceCategory: "evidence-primary",
    wordingConstraint: "no-efficacy-claims",
    disclaimerRequired: false,
    disclaimerText: null,
  },
  {
    name: "Peppermint (পুদিনা)",
    useCase: ["IBS-সদৃশ পেট-ফাঁপা/গ্যাস", "হজম-অস্বস্তি"],
    evidenceTier: 2,
    source: "NCCIH — Peppermint Oil",
    sourceCategory: "evidence-primary",
    wordingConstraint: "no-efficacy-claims",
    disclaimerRequired: false,
    disclaimerText: null,
  },
  {
    name: "Turmeric / Curcumin (হলুদ)",
    useCase: ["সাধারণ প্রদাহ-সম্পর্কিত অস্বস্তি", "জয়েন্ট-ব্যথায় সহায়ক"],
    evidenceTier: 2,
    source: "NCCIH — Turmeric",
    sourceCategory: "evidence-primary",
    wordingConstraint: "no-efficacy-claims",
    disclaimerRequired: false,
    disclaimerText: null,
  },
  {
    name: "Fenugreek (মেথি)",
    useCase: ["রক্তে-শর্করা সহায়ক (সম্পূরক হিসেবে)", "স্তন্যদানে দুধ-বৃদ্ধি সহায়ক"],
    evidenceTier: 2,
    source: "NCCIH — Fenugreek",
    sourceCategory: "evidence-primary",
    wordingConstraint: "no-efficacy-claims",
    disclaimerRequired: false,
    disclaimerText: null,
  },
  {
    name: "Ashwagandha",
    useCase: ["স্ট্রেস/উদ্বেগ সহায়ক", "ঘুমের মান উন্নয়নে সহায়ক"],
    evidenceTier: 2,
    source: "NCCIH — Ashwagandha",
    sourceCategory: "evidence-primary",
    wordingConstraint: "no-efficacy-claims",
    disclaimerRequired: false,
    disclaimerText: null,
  },
  {
    name: "Tulsi / Holy Basil (তুলসী)",
    useCase: ["ঠান্ডা-কাশিতে ঐতিহ্যগত সহায়ক", "গলা-প্রশমক"],
    evidenceTier: 3,
    source: "BCSIR — Medicinal Plants of Bangladesh",
    sourceCategory: "evidence-primary",
    wordingConstraint: "no-efficacy-claims",
    disclaimerRequired: true,
    disclaimerText: TRADITIONAL_HERBAL_DISCLAIMER,
  },
  {
    name: "Black Seed / Kalojira (কালোজিরা)",
    useCase: ["সাধারণ রোগ-প্রতিরোধ সহায়ক (ঐতিহ্যগত)", "হজম-সহায়ক (ঐতিহ্যগত)"],
    evidenceTier: 3,
    source: "BCSIR — Medicinal Plants of Bangladesh",
    sourceCategory: "evidence-primary",
    wordingConstraint: "no-efficacy-claims",
    disclaimerRequired: true,
    disclaimerText: TRADITIONAL_HERBAL_DISCLAIMER,
  },
];

// ---- Homeopathy (৪টা) — সবসময় Fixed Tier 3 (§5.2/§12.2.1 নীতি) ----
const HOMEOPATHY_ENTRIES = [
  {
    name: "Arnica Montana",
    useCase: ["আঘাত/মচকানো-পরবর্তী ঐতিহ্যগত ব্যবহার", "শারীরিক ক্লান্তি (ঐতিহ্যগত)"],
    source: "Boericke's Materia Medica",
    sourceCategory: "evidence-primary",
  },
  {
    name: "Nux Vomica",
    useCase: ["হজম-অস্বস্তি/গ্যাস (ঐতিহ্যগত)", "অতিরিক্ত-খাওয়ার পরবর্তী অস্বস্তি (ঐতিহ্যগত)"],
    source: "Boericke's Materia Medica",
    sourceCategory: "evidence-primary",
  },
  {
    name: "Belladonna",
    useCase: ["হঠাৎ-শুরু জ্বর (ঐতিহ্যগত)", "মাথাব্যথা (ঐতিহ্যগত)"],
    source: "Boericke's Materia Medica",
    sourceCategory: "evidence-primary",
  },
  {
    name: "Rhus Toxicodendron",
    useCase: ["জয়েন্ট/মাংসপেশির শক্ত-ভাব (ঐতিহ্যগত)"],
    source: "Boericke's Materia Medica",
    sourceCategory: "evidence-primary",
  },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
  let willWrite = 0;
  let willSkip = 0;

  const allEntries = [
    ...HERBAL_ENTRIES.map((e) => ({ ...e, mode: "herbal" })),
    ...HOMEOPATHY_ENTRIES.map((e) => ({
      ...e,
      mode: "homeopathy",
      evidenceTier: 3, // §5.2 Fixed Rule — override-অযোগ্য
      wordingConstraint: "no-efficacy-claims",
      disclaimerRequired: true,
      disclaimerText: HOMEOPATHY_DISCLAIMER,
    })),
  ];

  for (const entry of allEntries) {
    const id = docIdFor(entry.mode, entry.name);
    const ref = db.collection("remedyDatabase").doc(id);
    const existingSnap = await ref.get();

    if (existingSnap.exists && existingSnap.data().status === "verified" && !FORCE) {
      console.log(`⏭️  skip (আগে থেকেই verified — overwrite এড়ানো হলো, --force দিলে overwrite হবে): ${id}`);
      willSkip++;
      continue;
    }

    const docData = {
      mode: entry.mode,
      name: entry.name,
      useCase: entry.useCase,
      evidenceTier: entry.evidenceTier,
      disclaimerRequired: entry.disclaimerRequired,
      disclaimerText: entry.disclaimerText,
      source: entry.source,
      sourceCategory: entry.sourceCategory,
      wordingConstraint: entry.wordingConstraint,
      lastVerifiedDate: null,
      verifiedByRole: null,
      status: "draft",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`${CONFIRM ? "✍️  write" : "🔍 preview"}: ${id} (${entry.name}, ${entry.mode}, Tier ${entry.evidenceTier})`);
    if (CONFIRM) {
      await ref.set(docData, { merge: false });
    }
    willWrite++;
  }

  console.log(`\nসারাংশ: ${willWrite}টা entry ${CONFIRM ? "লেখা হলো" : "লেখা হতো"}, ${willSkip}টা skip হলো।`);
  console.log(`মনে রাখবেন: সব entry status: "draft"-এ আছে — remedyDatabase read-rule বর্তমানে status-gate করে না, তাই ভবিষ্যতে UI বানানোর সময় client-side "verified"-filter করতে ভুলবেন না।`);
  if (!CONFIRM) {
    console.log("\nআসল write করতে চালান: node scripts/populateRemedyDb.js --confirm");
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ ত্রুটি:", e.message || e);
    process.exit(1);
  });
