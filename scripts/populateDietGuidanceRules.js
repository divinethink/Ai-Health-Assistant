// scripts/populateDietGuidanceRules.js
//
// Diet/Food Guidance — Condition/Allergy-tag ভিত্তিক avoid/include food-list
// (amendment item ১, 1_1_1_1_Health_Assistant_Amendment_Plan_DRAFT.md)।
// medicineDatabase populate script-এর হুবহু একই pattern: owner নিজে local-এ
// চালাবেন, firestore.rules-এ `dietGuidanceRules/{id}`-এ `allow write: if false`
// রাখা আছে — শুধু এই trusted local script (Admin SDK) দিয়েই write সম্ভব।
//
// **status: "draft"** দিয়ে শুরু (medicineDatabase-এর মতোই verification-gate) —
// client শুধু `status == "verified"` entry read করতে পারে (firestore.rules)।
// owner নিজে/পরিচিত pharmacist-nutrition-জ্ঞানসম্পন্ন কেউ প্রতিটা entry
// review করে Firestore Console-এ সরাসরি `status: "verified"` করে দিলেই
// app-এ কার্যকর হবে — dose-database-এর মতো formal batch-review-script এখনো
// লাগবে না (এটা medicine-dose না, কম-ঝুঁকির reference-তথ্য)।
//
// linkedTag.type/value → Condition.name বা AllergyIntolerance.substance-এর
// সাথে case-insensitive substring-match হয় (dietGuidanceData.js দ্রষ্টব্য) —
// তাই value-এ common বাংলা/ইংরেজি নাম দুটোই না রেখে, সবচেয়ে প্রচলিত ইংরেজি
// generic-নাম ব্যবহার করা হয়েছে (Condition/Allergy entry-তেও এই নামেই সাধারণত
// সংরক্ষিত হয়)।
//
// **নতুন entry/tag যোগ করতে:** ENTRIES array-তে object যোগ করুন, script
// রি-রান করুন (dry-run আগে, তারপর --confirm)।
//
// ব্যবহার:
//   ড্রাই-রান:  node scripts/populateDietGuidanceRules.js
//   আসল write: node scripts/populateDietGuidanceRules.js --confirm
//   এডিট/overwrite: node scripts/populateDietGuidanceRules.js --confirm --force

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

function docIdFor(type, value) {
  return `${type}-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 120);
}

const ENTRIES = [
  // --- Category B chronic condition (roadmap §12.4 priority অনুযায়ী প্রথমে) ---
  {
    linkedTag: { type: "condition", value: "diabetes" },
    avoidFoods: ["চিনি/মিষ্টি জাতীয় খাবার", "সাদা ভাত/সাদা আটার অতিরিক্ত", "মিষ্টি পানীয়/সফট ড্রিংক", "ফলের জুস (চিনি ছাড়া হলেও limited)"],
    includeFoods: ["লাল চাল/লাল আটা", "শাক-সবজি (বিশেষত পাতা-জাতীয়)", "ডাল/legume", "কম-glycemic ফল (আপেল, পেয়ারা)"],
    source: ["WHO Healthy Diet", "ICMR-NIN"],
  },
  {
    linkedTag: { type: "condition", value: "hypertension" },
    avoidFoods: ["অতিরিক্ত লবণ/আচার", "প্রসেসড/ফাস্ট ফুড", "রেড মিট অতিরিক্ত"],
    includeFoods: ["পটাশিয়াম-সমৃদ্ধ ফল-সবজি (কলা, পালং শাক)", "কম-লবণযুক্ত রান্না", "মাছ"],
    source: ["WHO Healthy Diet", "NHS Eat Well"],
  },
  {
    linkedTag: { type: "condition", value: "thyroid" },
    avoidFoods: ["অতিরিক্ত কাঁচা ক্রুসিফেরাস সবজি (বাঁধাকপি/ফুলকপি কাঁচা, বেশি পরিমাণে)"],
    includeFoods: ["আয়োডিনযুক্ত লবণ (পরিমিত)", "প্রোটিন-সমৃদ্ধ খাবার", "সুষম সাধারণ খাদ্য"],
    source: ["NHS", "ICMR-NIN"],
  },
  {
    linkedTag: { type: "condition", value: "kidney disease" },
    avoidFoods: ["অতিরিক্ত পটাশিয়াম-সমৃদ্ধ খাবার (কলা, কমলা বেশি পরিমাণে)", "অতিরিক্ত লবণ", "অতিরিক্ত প্রোটিন/রেড মিট"],
    includeFoods: ["চিকিৎসক-নির্দেশিত পরিমিত প্রোটিন", "কম-পটাশিয়াম সবজি", "পর্যাপ্ত কিন্তু নিয়ন্ত্রিত পানি (ডাক্তার-নির্দেশ অনুযায়ী)"],
    source: ["WHO", "ICMR-NIN"],
  },
  {
    linkedTag: { type: "condition", value: "high cholesterol" },
    avoidFoods: ["ট্রান্স-ফ্যাট/ভাজাপোড়া", "অতিরিক্ত ঘি/মাখন", "রেড মিট অতিরিক্ত"],
    includeFoods: ["ওটস/ফাইবার-সমৃদ্ধ খাবার", "বাদাম (পরিমিত)", "মাছ (ওমেগা-৩)"],
    source: ["NHS Eat Well", "WHO"],
  },
  {
    linkedTag: { type: "condition", value: "obesity" },
    avoidFoods: ["উচ্চ-ক্যালরি প্রসেসড/ফাস্ট ফুড", "চিনি-যুক্ত পানীয়"],
    includeFoods: ["উচ্চ-ফাইবার শাক-সবজি", "পর্যাপ্ত প্রোটিন", "নিয়ন্ত্রিত অংশ (portion-control)"],
    source: ["WHO Healthy Diet"],
  },
  {
    linkedTag: { type: "condition", value: "anemia" },
    avoidFoods: ["আয়রন-সমৃদ্ধ খাবারের সাথে সাথে চা/কফি (absorption কমায়)"],
    includeFoods: ["আয়রন-সমৃদ্ধ খাবার (পালং শাক, কলিজা, ডাল)", "ভিটামিন-সি সমৃদ্ধ ফল (আয়রন absorption বাড়ায়)"],
    source: ["ICMR-NIN", "NIH ODS"],
  },
  {
    linkedTag: { type: "condition", value: "pregnancy" },
    avoidFoods: ["কাঁচা/আধা-সিদ্ধ মাছ-মাংস-ডিম", "অতিরিক্ত ক্যাফেইন", "পাস্তুরিত-না-হওয়া দুগ্ধজাত"],
    includeFoods: ["ফোলেট/আয়রন-সমৃদ্ধ খাবার", "ক্যালসিয়াম-সমৃদ্ধ খাবার", "পর্যাপ্ত প্রোটিন"],
    source: ["WHO ANC", "NHS"],
  },
  {
    linkedTag: { type: "condition", value: "piles" },
    avoidFoods: ["কম-ফাইবার/অতিরিক্ত মসলাযুক্ত খাবার"],
    includeFoods: ["উচ্চ-ফাইবার খাবার (ইসবগুল, শাক-সবজি)", "পর্যাপ্ত পানি"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "constipation" },
    avoidFoods: ["কম-ফাইবার প্রসেসড খাবার"],
    includeFoods: ["উচ্চ-ফাইবার শাক-সবজি/ফল", "পর্যাপ্ত পানি", "নিয়মিত হালকা ব্যায়াম (lifestyle সহায়ক)"],
    source: ["NHS"],
  },

  // --- সাধারণ food-allergy (roadmap §12.4 Category-নিরপেক্ষ, allergy-tag) ---
  {
    linkedTag: { type: "allergy", value: "egg" },
    avoidFoods: ["ডিম ও ডিম-ভিত্তিক খাবার (কেক/মেয়োনেজ ইত্যাদি)"],
    includeFoods: ["বিকল্প প্রোটিন উৎস (ডাল, মাছ, মাংস — allergy-নির্ভর)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "allergy", value: "milk" },
    avoidFoods: ["দুধ ও দুগ্ধজাত (পনির/দই/মাখন)"],
    includeFoods: ["ক্যালসিয়ামের বিকল্প উৎস (তিল, সবুজ শাক, বাদাম)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "allergy", value: "peanut" },
    avoidFoods: ["চিনাবাদাম ও চিনাবাদাম-ভিত্তিক খাবার"],
    includeFoods: ["অন্য বাদাম/বীজ (cross-reactivity না থাকলে, ডাক্তার-পরামর্শ সাপেক্ষে)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "allergy", value: "shellfish" },
    avoidFoods: ["চিংড়ি/কাঁকড়া/শামুক-জাতীয় সামুদ্রিক খাবার"],
    includeFoods: ["সাধারণ মাছ (allergy না থাকলে)", "উদ্ভিজ্জ প্রোটিন"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "allergy", value: "gluten" },
    avoidFoods: ["গম/আটা-ভিত্তিক খাবার (রুটি, পাস্তা, বিস্কুট)"],
    includeFoods: ["চাল-ভিত্তিক খাবার", "ভুট্টা", "gluten-free বিকল্প"],
    source: ["NHS"],
  },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
  let willWrite = 0, willSkip = 0;

  for (const entry of ENTRIES) {
    const id = docIdFor(entry.linkedTag.type, entry.linkedTag.value);
    const ref = db.collection("dietGuidanceRules").doc(id);
    const existingSnap = await ref.get();

    if (existingSnap.exists && !FORCE) {
      console.log(`⏭️  skip (আগে থেকেই আছে — overwrite এড়ানো হলো, --force দিলে overwrite হবে): ${id}`);
      willSkip++;
      continue;
    }

    const docData = {
      linkedTag: entry.linkedTag,
      avoidFoods: entry.avoidFoods,
      includeFoods: entry.includeFoods,
      source: entry.source,
      status: "draft",
      lastVerifiedDate: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    console.log(`${CONFIRM ? "✍️  write" : "🔍 preview"}: ${id}`);
    if (CONFIRM) {
      await ref.set(docData, { merge: false });
    }
    willWrite++;
  }

  console.log(`\nসারাংশ: ${willWrite}টা entry ${CONFIRM ? "লেখা হলো" : "লেখা হতো"}, ${willSkip}টা skip হলো।`);
  console.log("⚠️  সব entry status: \"draft\" দিয়ে তৈরি হয় — app-এ কার্যকর হওয়ার আগে Firestore Console-এ প্রতিটা review করে status: \"verified\" করে দিন।");
  if (!CONFIRM) console.log("\nআসল write করতে: node scripts/populateDietGuidanceRules.js --confirm");
}

run().then(() => process.exit(0)).catch((e) => { console.error("❌ ত্রুটি:", e); process.exit(1); });
