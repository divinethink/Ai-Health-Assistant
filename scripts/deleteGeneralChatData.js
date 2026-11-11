// scripts/deleteGeneralChatData.js
//
// ধাপ ৪-ছ — General Chat-এর সব Firestore ডাটা মোছা (owner-অনুমোদিত, ২০২৬-১১-১১: "ডাটা সহ ডিলিট")।
// owner নিজে local-এ চালাবেন (Admin SDK; Cloud Function/cron নেই — Spark-only)।
// মোছা হয়: generalChatQuickLinks (global) + প্রতি family-র generalChatSessions (messages সহ) ও generalChatProjects।
// নিরাপত্তা (Zero Data Loss): মোছার আগে সব ডাটা JSON-ব্যাকআপে লেখা হয়; ব্যাকআপ ব্যর্থ হলে কিছুই মোছা হয় না।
// স্বাস্থ্য-রেকর্ড/healthEpisodes/AI চ্যাট (`/ai-chat`) এই স্ক্রিপ্ট ছোঁয় না।
// ⚠ Cloudinary-র `general-chat/<familyId>` ফোল্ডারের ছবি এই স্ক্রিপ্ট মোছে না — Cloudinary Media Library থেকে ফোল্ডারটা নিজে মুছুন।
//
// ব্যবহার:
//   ড্রাই-রান (শুধু গোনে): node scripts/deleteGeneralChatData.js
//   আসল মোছা:           node scripts/deleteGeneralChatData.js --confirm
// ক্রম: আগে এই স্ক্রিপ্ট → তারপর firestore.rules থেকে generalChat* ব্লক সরানো (deploy-rules)।

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIRM = process.argv.includes("--confirm");
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "serviceAccountKey.json");
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const db = getFirestore();

const plain = (doc) => ({ id: doc.id, ...doc.data() });

async function main() {
  const backup = { exportedAt: new Date().toISOString(), quickLinks: [], families: {} };
  const targets = []; // মোছার ref-তালিকা
  let counts = { quickLinks: 0, sessions: 0, messages: 0, projects: 0 };

  const links = await db.collection("generalChatQuickLinks").get();
  links.forEach((d) => { backup.quickLinks.push(plain(d)); targets.push(d.ref); counts.quickLinks++; });

  const families = await db.collection("families").get();
  for (const fam of families.docs) {
    const entry = { sessions: [], projects: [] };
    const sessions = await fam.ref.collection("generalChatSessions").get();
    for (const s of sessions.docs) {
      const msgs = await s.ref.collection("messages").get();
      entry.sessions.push({ ...plain(s), messages: msgs.docs.map(plain) });
      counts.messages += msgs.size; counts.sessions++; targets.push(s.ref);
    }
    const projects = await fam.ref.collection("generalChatProjects").get();
    projects.forEach((p) => { entry.projects.push(plain(p)); counts.projects++; targets.push(p.ref); });
    if (entry.sessions.length || entry.projects.length) backup.families[fam.id] = entry;
  }

  console.log("পাওয়া গেছে:", counts);
  if (!CONFIRM) { console.log("ড্রাই-রান — কিছু মোছা হয়নি। আসল মোছা: --confirm"); return; }
  if (targets.length === 0) { console.log("মোছার মতো কিছু নেই।"); return; }

  const file = path.join(__dirname, "general-chat-backup-" + Date.now() + ".json");
  writeFileSync(file, JSON.stringify(backup, null, 2), "utf8"); // ব্যর্থ হলে এখানেই থামে — কিছু মোছা হয় না
  console.log("ব্যাকআপ লেখা হয়েছে:", file);

  for (const ref of targets) await db.recursiveDelete(ref);
  console.log("✅ মোছা সম্পন্ন।");
}

main().catch((e) => { console.error("ব্যর্থ:", e.message || e); process.exit(1); });
