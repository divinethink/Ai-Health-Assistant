// scripts/populateCareEscalationDirectory.js
//
// P8 — Verified Care-Escalation Directory populate script (Architecture Plan
// Part B §5.1, roadmap §12.5.1)। owner নিজে local-এ চালাবেন — কোনো Cloud
// Function/cron না (roadmap §10.2.5 Spark-only নীতি)। firestore.rules
// ইতিমধ্যে `careEscalationDirectory/{id}` collection-এ `allow write: if false`
// রেখেছে — শুধু এই trusted local script (Admin SDK) দিয়েই write সম্ভব।
//
// Scope: Global (family-independent) — সব family একই directory শেয়ার করে
// (Confirmed, Part B §5.1)। Entry-তালিকা roadmap §12.5.1-এ Confirmed।
//
// নোট: ১৬২৬৩ (স্বাস্থ্য বাতায়ন)-এর charge-status এখনো owner-verification
// pending (roadmap §12.5.1) — সেই note এই entry-র `notes` field-এ রাখা হলো।
//
// ব্যবহার:
//   ড্রাই-রান:  node scripts/populateCareEscalationDirectory.js
//   আসল write: node scripts/populateCareEscalationDirectory.js --confirm
//
// নিরাপত্তা: existing entry থাকলে overwrite করবে না (--force দিলে করবে) —
// Process Rule ৩ (Zero Data Loss)।

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

// নোট: modular API (firebase-admin/app, firebase-admin/firestore) ব্যবহার করা
// হয়েছে — namespaced `admin.credential.cert(...)` স্টাইলের চেয়ে বেশি
// version-robust (ESM/CJS interop-এ কিছু firebase-admin ভার্সনে namespace
// অসম্পূর্ণ resolve হওয়ার পরিচিত সমস্যা এড়াতে)।
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function docIdFor(type, name) {
  return `${type}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// roadmap §12.5.1 / Architecture Plan Part B §5.1 — Confirmed initial entries
const ENTRIES = [
  { name: "৯৯৯ — জাতীয় জরুরি সেবা (পুলিশ/ফায়ার/অ্যাম্বুলেন্স)", type: "emergency-police-fire", contact: "999", notes: "টোল-ফ্রি, ২৪/৭" },
  { name: "১০০ — ঢাকা মেট্রোপলিটন পুলিশ", type: "emergency-police-fire", contact: "100", notes: null },
  { name: "১৬২৬৩ — স্বাস্থ্য বাতায়ন (DGHS জাতীয় টেলিহেলথ)", type: "national-health-telehealth", contact: "16263", notes: "২৪/৭ রেজিস্টার্ড ডাক্তার পরামর্শ — charge-status owner-verification pending" },
  { name: "১০৯ — নারী নির্যাতন/বাল্যবিবাহ প্রতিরোধ", type: "women-safety", contact: "109", notes: null },
  { name: "১০৯৮ — শিশু সহায়তা কল সেন্টার", type: "child-safety", contact: "1098", notes: null },
  { name: "৩৩৩ — জাতীয় তথ্য বাতায়ন", type: "civic-info", contact: "333", notes: null },
  { name: "১০৬ — দুর্নীতি দমন কমিশন", type: "civic-info", contact: "106", notes: null },
  { name: "১০৫ — জাতীয় পরিচয়পত্র", type: "civic-info", contact: "105", notes: null },
  { name: "DocTime", type: "telemedicine", contact: "doctime.com.bd", notes: "fee-based ভিডিও কনসাল্ট + e-prescription" },
  { name: "Sebaghar.com", type: "telemedicine", contact: "sebaghar.com", notes: "fee-based ভিডিও কনসাল্ট + e-prescription" },
  { name: "MedEasy", type: "pharmacist-consult", contact: "medeasy.health", notes: "online pharmacy, prescription verify + delivery" },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
  let willWrite = 0;
  let willSkip = 0;

  for (const entry of ENTRIES) {
    const id = docIdFor(entry.type, entry.name);
    const ref = db.collection("careEscalationDirectory").doc(id);
    const existingSnap = await ref.get();

    if (existingSnap.exists && !FORCE) {
      console.log(`⏭️  skip (আগে থেকেই আছে — overwrite এড়ানো হলো, --force দিলে overwrite হবে): ${id}`);
      willSkip++;
      continue;
    }

    const docData = {
      name: entry.name,
      type: entry.type,
      contact: entry.contact,
      notes: entry.notes,
      verifiedBy: "owner",
      lastVerifiedDate: null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    console.log(`${CONFIRM ? "✍️  write" : "🔍 preview"}: ${id} (${entry.name})`);
    if (CONFIRM) {
      await ref.set(docData, { merge: false });
    }
    willWrite++;
  }

  console.log(`\nসারাংশ: ${willWrite}টা entry ${CONFIRM ? "লেখা হলো" : "লেখা হতো"}, ${willSkip}টা skip হলো।`);
  if (!CONFIRM) {
    console.log("\nআসল write করতে চালান: node scripts/populateCareEscalationDirectory.js --confirm");
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ ত্রুটি:", e.message || e);
    process.exit(1);
  });
