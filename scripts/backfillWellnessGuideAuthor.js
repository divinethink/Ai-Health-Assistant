// scripts/backfillWellnessGuideAuthor.js
//
// One-time migration — User-Owned Content amendment (item ৩,
// 1_1_1_1_Health_Assistant_Amendment_Plan_DRAFT.md)। নতুন firestore.rules-এ
// `wellnessGuides` update-rule এখন `authorId == callerMemberIdOf(familyId)`
// দিয়ে গার্ডেড — কিন্তু আগে ইন-অ্যাপ Admin CRUD দিয়ে তৈরি হওয়া পুরনো post-এ
// `authorId` field নেই। এই script সেগুলোতে family-র বর্তমান প্রথম Admin-এর
// memberId বসিয়ে দেয় (যেহেতু আগে শুধু Admin-ই লিখতে পারতেন, তাই এটাই সবচেয়ে
// accurate best-effort attribution — কেউ access হারায় না, শুধু edit-permission
// এখন সেই admin-memberId-বাহিত হবে)।
//
// যে ডকুমেন্টে familyId নেই (scripts/populateWellnessGuides.js দিয়ে সরাসরি
// লেখা curated seed-content) — সেগুলো ইচ্ছাকৃতভাবে স্কিপ হয়, কারণ ওগুলোর কোনো
// পারিবারিক owner নেই; আগের মতোই শুধু script re-run দিয়েই edit হবে।
//
// Zero Data Loss (Process Rule ৩): এই script কোনো doc delete করে না, শুধু
// অনুপস্থিত `authorId` field যোগ করে (merge: true)। Dry-run আগে, --confirm
// দিলে তবেই write হয়।
//
// ব্যবহার:
//   ড্রাই-রান:  node scripts/backfillWellnessGuideAuthor.js
//   আসল write: node scripts/backfillWellnessGuideAuthor.js --confirm

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM = process.argv.includes("--confirm");

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
} catch (e) {
  console.error(`❌ Service account key পাওয়া যায়নি: ${keyPath}`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function resolveFamilyAdminMemberId(familyId) {
  const famSnap = await db.collection("families").doc(familyId).get();
  if (!famSnap.exists) return null;
  const adminUids = famSnap.data().adminUids || [];
  if (adminUids.length === 0) return null;
  // প্রথম admin uid দিয়েই resolve — একাধিক admin থাকলেও যেকোনো একজন যথেষ্ট
  // (এই migration শুধু legacy attribution, নতুন behavior-এ কোনো প্রভাব নেই)।
  for (const uid of adminUids) {
    const idxSnap = await db.collection("families").doc(familyId).collection("uidMemberIndex").doc(uid).get();
    if (idxSnap.exists) return idxSnap.data().memberId;
  }
  return null;
}

async function main() {
  const snap = await db.collection("wellnessGuides").get();
  const toFix = snap.docs.filter((d) => !d.data().authorId);

  if (toFix.length === 0) {
    console.log("✅ সব wellnessGuides doc-এ ইতিমধ্যে authorId আছে — কিছু করার নেই।");
    return;
  }

  console.log(`মোট ${toFix.length}টা doc-এ authorId নেই:\n`);

  let planned = 0;
  let skipped = 0;

  for (const doc of toFix) {
    const data = doc.data();
    if (!data.familyId) {
      console.log(`  ⏭  স্কিপ (familyId নেই, curated seed-content): ${doc.id}`);
      skipped++;
      continue;
    }
    const memberId = await resolveFamilyAdminMemberId(data.familyId);
    if (!memberId) {
      console.log(`  ⚠️  স্কিপ (admin memberId resolve করা গেল না): ${doc.id} (familyId: ${data.familyId})`);
      skipped++;
      continue;
    }
    console.log(`  → ${doc.id}  (familyId: ${data.familyId})  authorId = ${memberId}`);
    planned++;
    if (CONFIRM) {
      await doc.ref.set({ authorId: memberId }, { merge: true });
    }
  }

  console.log(`\n${CONFIRM ? "✅ write সম্পন্ন" : "ℹ️  DRY-RUN — কোনো write হয়নি"}: ${planned}টা doc আপডেট ${CONFIRM ? "হলো" : "হবে"}, ${skipped}টা স্কিপ।`);
  if (!CONFIRM) console.log("আসল write করতে: node scripts/backfillWellnessGuideAuthor.js --confirm");
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
