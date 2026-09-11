// scripts/populateWellnessGuides.js
//
// Wellness Guide — ব্লগ-স্টাইল স্বাস্থ্যকর জীবনযাপন নির্দেশিকা (owner-request,
// ২০২৬-০৯-১২)। careEscalationDirectory/remedyDatabase populate script-এর হুবহু
// একই pattern: owner নিজে local-এ চালাবেন, firestore.rules ইতিমধ্যে
// `wellnessGuides/{id}`-এ `allow write: if false` রেখেছে — শুধু এই trusted
// local script (Admin SDK) দিয়েই write সম্ভব।
//
// **কীভাবে নতুন পোস্ট যোগ করবেন:** নিচের ENTRIES array-তে একটা নতুন object
// যোগ করুন (নিচের উদাহরণ-এন্ট্রিগুলো দেখে ফরম্যাট বুঝে নিন), তারপর script
// রি-রান করুন (dry-run দিয়ে আগে দেখে নিন, তারপর --confirm)। existing
// পোস্ট (একই id) থাকলে overwrite হবে না — এডিট করতে চাইলে --force দিন।
//
// ক্যাটেগরি (owner-Confirmed, ২০২৬-০৯-১২):
//   "general"                    — সাধারণ স্বাস্থ্য-টিপস
//   "chronic-disease-prevention" — ডায়াবেটিস/উচ্চ রক্তচাপ/হৃদরোগ ইত্যাদি থেকে বাঁচার উপায়
//   "child-care"                 — শিশু লালন-পালন সংক্রান্ত, ageRangeYears: [min,max] (ঐচ্ছিক)
//   "women-health"                — নারী স্বাস্থ্য/গর্ভাবস্থা, pregnancyMonthRange: [min,max] (1-9, ঐচ্ছিক)
//   "elderly-care"                — বয়স্কদের যত্ন, ageRangeYears: [min,max] (ঐচ্ছিক)
//
// ব্যবহার:
//   ড্রাই-রান:  node scripts/populateWellnessGuides.js
//   আসল write: node scripts/populateWellnessGuides.js --confirm
//   এডিট/overwrite: node scripts/populateWellnessGuides.js --confirm --force

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function docIdFor(category, title) {
  return `${category}-${slugify(title)}`.slice(0, 120);
}

// ============================================================================
// নিচে ENTRIES array — owner এখানেই নতুন ব্লগ-পোস্ট যোগ করবেন। এখন শুধু
// ফরম্যাট বোঝানোর জন্য একটা করে উদাহরণ-এন্ট্রি প্রতিটা ক্যাটেগরিতে দেওয়া আছে —
// আসল কনটেন্ট (বিভিন্ন নির্ভরযোগ্য সোর্স থেকে) দিয়ে replace/সম্প্রসারণ করুন।
// ============================================================================
const ENTRIES = [
  {
    category: "general",
    title: "উদাহরণ: প্রতিদিনের সাধারণ স্বাস্থ্য-অভ্যাস",
    summary: "প্রতিদিনের ছোট অভ্যাস যা দীর্ঘমেয়াদি স্বাস্থ্যে বড় প্রভাব ফেলে।",
    body: "এখানে আপনার সংগ্রহ করা reliable তথ্য বসবে — এটা শুধু ফরম্যাট-উদাহরণ, replace করুন।",
    tags: ["lifestyle"],
    sourceNote: "উদাহরণ — replace করুন",
    ageRangeYears: null, pregnancyMonthRange: null,
  },
  {
    category: "chronic-disease-prevention",
    title: "উদাহরণ: ডায়াবেটিস প্রতিরোধে জীবনযাপন",
    summary: "ডায়াবেটিস ঝুঁকি কমাতে খাদ্যাভ্যাস ও জীবনযাপনের পরামর্শ।",
    body: "এখানে আপনার সংগ্রহ করা reliable তথ্য বসবে — এটা শুধু ফরম্যাট-উদাহরণ, replace করুন।",
    tags: ["diabetes", "prevention"],
    sourceNote: "উদাহরণ — replace করুন",
    ageRangeYears: null, pregnancyMonthRange: null,
  },
  {
    category: "child-care",
    title: "উদাহরণ: ১-৩ বছর বয়সী শিশুর পুষ্টি",
    summary: "১-৩ বছর বয়সে খাদ্য, পুষ্টি ও সাধারণ অসুখ-বিসুখ সংক্রান্ত পরামর্শ।",
    body: "এখানে আপনার সংগ্রহ করা reliable তথ্য বসবে — এটা শুধু ফরম্যাট-উদাহরণ, replace করুন।",
    tags: ["nutrition", "toddler"],
    sourceNote: "উদাহরণ — replace করুন",
    ageRangeYears: [1, 3], pregnancyMonthRange: null,
  },
  {
    category: "women-health",
    title: "উদাহরণ: গর্ভাবস্থার ১ম মাস",
    summary: "গর্ভাবস্থার প্রথম মাসে খাদ্য, পুষ্টি, সতর্কতা।",
    body: "এখানে আপনার সংগ্রহ করা reliable তথ্য বসবে — এটা শুধু ফরম্যাট-উদাহরণ, replace করুন।",
    tags: ["pregnancy", "first-trimester"],
    sourceNote: "উদাহরণ — replace করুন",
    ageRangeYears: null, pregnancyMonthRange: [1, 1],
  },
  {
    category: "elderly-care",
    title: "উদাহরণ: ৩০-৪০ বছর বয়সীদের স্বাস্থ্য-সতর্কতা",
    summary: "এই বয়স-রেঞ্জে খাদ্য, ব্যায়াম, ও prevention-focused স্ক্রিনিং পরামর্শ।",
    body: "এখানে আপনার সংগ্রহ করা reliable তথ্য বসবে — এটা শুধু ফরম্যাট-উদাহরণ, replace করুন।",
    tags: ["30-40", "screening"],
    sourceNote: "উদাহরণ — replace করুন",
    ageRangeYears: [30, 40], pregnancyMonthRange: null,
  },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
  let willWrite = 0, willSkip = 0;

  for (const entry of ENTRIES) {
    const id = docIdFor(entry.category, entry.title);
    const ref = db.collection("wellnessGuides").doc(id);
    const existingSnap = await ref.get();

    if (existingSnap.exists && !FORCE) {
      console.log(`⏭️  skip (আগে থেকেই আছে — overwrite এড়ানো হলো, --force দিলে overwrite হবে): ${id}`);
      willSkip++;
      continue;
    }

    const docData = {
      category: entry.category,
      title: entry.title,
      summary: entry.summary,
      body: entry.body,
      tags: entry.tags || [],
      ageRangeYears: entry.ageRangeYears || null,
      pregnancyMonthRange: entry.pregnancyMonthRange || null,
      sourceNote: entry.sourceNote || null,
      addedBy: "owner",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    console.log(`${CONFIRM ? "✍️  write" : "🔍 preview"}: ${id} (${entry.title})`);
    if (CONFIRM) {
      await ref.set(docData, { merge: false });
    }
    willWrite++;
  }

  console.log(`\nসারাংশ: ${willWrite}টা পোস্ট ${CONFIRM ? "লেখা হলো" : "লেখা হতো"}, ${willSkip}টা skip হলো।`);
  if (!CONFIRM) console.log("\n⚠️  এটা dry-run ছিল। আসল write করতে: node scripts/populateWellnessGuides.js --confirm");
}

run().then(() => process.exit(0)).catch((e) => { console.error("❌ ত্রুটি:", e); process.exit(1); });
