// scripts/verifyMedicineDb.js
//
// medicineDatabase-এর entry "draft" → "verified" করে (owner-run, Admin SDK; Cloud Function নেই)।
// শুধু তিনটা ফিল্ড বদলায়: status, verifiedByRole, lastVerifiedDate — আর কিছু ছোঁয় না।
// শুধু আগে-draft entry বদলায়; verified/অন্য status-এ হাত দেয় না। Reviewer সত্যিই verify করার পরেই চালান।
//
// ব্যবহার (প্রথমে ড্রাই-রান — কিছু লেখা হয় না):
//   node scripts/verifyMedicineDb.js --role pharmacist --date 2026-11-16 --names "Paracetamol,Ibuprofen"
//   node scripts/verifyMedicineDb.js --role physician  --date 2026-11-16 --all
// ঠিক দেখালে আবার একই কমান্ডে শেষে --confirm যোগ করুন।
// নোট: Aspirin (bystander) শুধু --role physician দিয়ে verify হয়।
// সেটআপ: scripts/serviceAccountKey.json (বা GOOGLE_APPLICATION_CREDENTIALS) — populate script-এর মতোই।

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { validateOpts, planVerification } from "./lib/medicineVerifyPlan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const CONFIRM = argv.includes("--confirm");
const opts = {
  role: arg("--role"), date: arg("--date"), all: argv.includes("--all"),
  names: (arg("--names") || "").split(",").map((s) => s.trim()).filter(Boolean),
  today: new Date().toISOString().slice(0, 10),
};
const bad = validateOpts(opts);
if (bad) { console.error("❌ " + bad); process.exit(1); }

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "serviceAccountKey.json");
let serviceAccount;
try { serviceAccount = JSON.parse(readFileSync(keyPath, "utf8")); }
catch (e) { console.error("❌ Service account key পাওয়া যায়নি: " + keyPath); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collection("medicineDatabase").get();
const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
const { toVerify, skipped, unmatched } = planVerification(docs, opts);

console.log("Role: " + opts.role + " · তারিখ: " + opts.date + " · " + (CONFIRM ? "আসল write" : "ড্রাই-রান"));
toVerify.forEach((m) => console.log("✅ verify হবে: " + m.genericName + " [" + m.tier + "]"));
skipped.forEach((s) => console.log("⏭️  skip: " + s.id + " — " + s.reason));
unmatched.forEach((n) => console.log("⚠️  নাম মেলেনি: " + n));
console.log("মোট verify: " + toVerify.length);

if (!CONFIRM) { console.log("\nকিছু লেখা হয়নি। ঠিক থাকলে শেষে --confirm যোগ করে আবার চালান।"); process.exit(0); }
for (let i = 0; i < toVerify.length; i += 400) {
  const batch = db.batch();
  toVerify.slice(i, i + 400).forEach((m) => batch.update(db.collection("medicineDatabase").doc(m.id), { status: "verified", verifiedByRole: opts.role, lastVerifiedDate: opts.date }));
  await batch.commit();
}
console.log("✅ সম্পন্ন: " + toVerify.length + "টি entry verified।");
