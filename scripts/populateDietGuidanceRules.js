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
    linkedTag: { type: "condition", value: "diabetes", aliases: ["diabetic", "ডায়াবেটিস", "সুগার"] },
    avoidFoods: ["চিনি/মিষ্টি জাতীয় খাবার", "সাদা ভাত/সাদা আটার অতিরিক্ত", "মিষ্টি পানীয়/সফট ড্রিংক", "ফলের জুস (চিনি ছাড়া হলেও limited)"],
    includeFoods: ["লাল চাল/লাল আটা", "শাক-সবজি (বিশেষত পাতা-জাতীয়)", "ডাল/legume", "কম-glycemic ফল (আপেল, পেয়ারা)"],
    source: ["WHO Healthy Diet", "ICMR-NIN"],
  },
  {
    linkedTag: { type: "condition", value: "hypertension", aliases: ["high blood pressure", "high bp", "htn", "উচ্চ রক্তচাপ", "হাই প্রেশার", "হাই প্রেসার"] },
    avoidFoods: ["অতিরিক্ত লবণ/আচার", "প্রসেসড/ফাস্ট ফুড", "রেড মিট অতিরিক্ত"],
    includeFoods: ["পটাশিয়াম-সমৃদ্ধ ফল-সবজি (কলা, পালং শাক)", "কম-লবণযুক্ত রান্না", "মাছ"],
    source: ["WHO Healthy Diet", "NHS Eat Well"],
  },
  {
    linkedTag: { type: "condition", value: "thyroid", aliases: ["থাইরয়েড"] },
    avoidFoods: ["অতিরিক্ত কাঁচা ক্রুসিফেরাস সবজি (বাঁধাকপি/ফুলকপি কাঁচা, বেশি পরিমাণে)"],
    includeFoods: ["আয়োডিনযুক্ত লবণ (পরিমিত)", "প্রোটিন-সমৃদ্ধ খাবার", "সুষম সাধারণ খাদ্য"],
    source: ["NHS", "ICMR-NIN"],
  },
  {
    linkedTag: { type: "condition", value: "kidney disease", aliases: ["ckd", "chronic kidney", "kidney failure", "কিডনি রোগ", "কিডনির রোগ", "কিডনি ফেইলিউর"] },
    avoidFoods: ["অতিরিক্ত পটাশিয়াম-সমৃদ্ধ খাবার (কলা, কমলা বেশি পরিমাণে)", "অতিরিক্ত লবণ", "অতিরিক্ত প্রোটিন/রেড মিট"],
    includeFoods: ["চিকিৎসক-নির্দেশিত পরিমিত প্রোটিন", "কম-পটাশিয়াম সবজি", "পর্যাপ্ত কিন্তু নিয়ন্ত্রিত পানি (ডাক্তার-নির্দেশ অনুযায়ী)"],
    source: ["WHO", "ICMR-NIN"],
  },
  {
    linkedTag: { type: "condition", value: "high cholesterol", aliases: ["cholesterol", "dyslipidemia", "কোলেস্টেরল"] },
    avoidFoods: ["ট্রান্স-ফ্যাট/ভাজাপোড়া", "অতিরিক্ত ঘি/মাখন", "রেড মিট অতিরিক্ত"],
    includeFoods: ["ওটস/ফাইবার-সমৃদ্ধ খাবার", "বাদাম (পরিমিত)", "মাছ (ওমেগা-৩)"],
    source: ["NHS Eat Well", "WHO"],
  },
  {
    linkedTag: { type: "condition", value: "obesity", aliases: ["স্থূলতা"] },
    avoidFoods: ["উচ্চ-ক্যালরি প্রসেসড/ফাস্ট ফুড", "চিনি-যুক্ত পানীয়"],
    includeFoods: ["উচ্চ-ফাইবার শাক-সবজি", "পর্যাপ্ত প্রোটিন", "নিয়ন্ত্রিত অংশ (portion-control)"],
    source: ["WHO Healthy Diet"],
  },
  {
    linkedTag: { type: "condition", value: "anemia", aliases: ["anaemia", "রক্তশূন্যতা", "এনিমিয়া"] },
    avoidFoods: ["আয়রন-সমৃদ্ধ খাবারের সাথে সাথে চা/কফি (absorption কমায়)"],
    includeFoods: ["আয়রন-সমৃদ্ধ খাবার (পালং শাক, কলিজা, ডাল)", "ভিটামিন-সি সমৃদ্ধ ফল (আয়রন absorption বাড়ায়)"],
    source: ["ICMR-NIN", "NIH ODS"],
  },
  {
    linkedTag: { type: "condition", value: "pregnancy", aliases: ["pregnant", "গর্ভাবস্থা", "গর্ভবতী"] },
    avoidFoods: ["কাঁচা/আধা-সিদ্ধ মাছ-মাংস-ডিম", "অতিরিক্ত ক্যাফেইন", "পাস্তুরিত-না-হওয়া দুগ্ধজাত"],
    includeFoods: ["ফোলেট/আয়রন-সমৃদ্ধ খাবার", "ক্যালসিয়াম-সমৃদ্ধ খাবার", "পর্যাপ্ত প্রোটিন"],
    source: ["WHO ANC", "NHS"],
  },
  {
    linkedTag: { type: "condition", value: "piles", aliases: ["hemorrhoid", "haemorrhoid", "পাইলস", "অর্শ"] },
    avoidFoods: ["কম-ফাইবার/অতিরিক্ত মসলাযুক্ত খাবার"],
    includeFoods: ["উচ্চ-ফাইবার খাবার (ইসবগুল, শাক-সবজি)", "পর্যাপ্ত পানি"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "constipation", aliases: ["কোষ্ঠকাঠিন্য"] },
    avoidFoods: ["কম-ফাইবার প্রসেসড খাবার"],
    includeFoods: ["উচ্চ-ফাইবার শাক-সবজি/ফল", "পর্যাপ্ত পানি", "নিয়মিত হালকা ব্যায়াম (lifestyle সহায়ক)"],
    source: ["NHS"],
  },
  {
    // IBS (owner-request, ২০২৬-০৯-২০) — `aliases` optional (dietGuidanceData.js matcher),
    // যাতে "IBS"/"Irritable Bowel Syndrome"/বাংলা নাম — যেকোনোটা Condition-নামে লিখলেই মেলে।
    linkedTag: { type: "condition", value: "ibs", aliases: ["irritable bowel", "আইবিএস", "ইরিটেবল বাওয়েল"] },
    avoidFoods: [
      "অতিরিক্ত ভাজাপোড়া, তেল-চর্বিযুক্ত ও ঝাল-মসলাদার খাবার",
      "অতিরিক্ত চা/কফি ও গ্যাসযুক্ত (কার্বনেটেড) পানীয়",
      "সরবিটল/কৃত্রিম মিষ্টি (সুগার-ফ্রি গাম/ক্যান্ডি) ও অ্যালকোহল",
      "খাবার বাদ দেওয়া বা অনেকক্ষণ না-খেয়ে থাকা",
      "যে খাবারে উপসর্গ বাড়ে (যেমন বেশি পেঁয়াজ-রসুন, শিম/ডাল, দুধ, বেশি ফল) সেগুলো কমিয়ে দেখুন",
    ],
    includeFoods: [
      "নিয়মিত সময়ে ছোট-ছোট পরিমাণে ধীরে ধীরে খাওয়া",
      "পর্যাপ্ত পানি (দিনে প্রায় ৮ কাপ)",
      "দ্রবণীয় ফাইবার (ওটস, পাকা কলা, গাজর, আলু)",
      "সহজপাচ্য প্রোটিন (মাছ, মুরগি, ডিম)",
      "কোন খাবারে উপসর্গ বাড়ে তা খাদ্য-ডায়েরিতে লিখে রাখা (low-FODMAP ডায়েট শুরুর আগে ডাক্তার/পুষ্টিবিদের পরামর্শ নিন)",
    ],
    source: ["NHS", "NICE"],
  },
  // --- সাধারণ রোগ (owner-request, ২০২৬-০৯-২০) — সবই status:"draft", owner review ছাড়া app-এ কার্যকর হবে না ---
  {
    linkedTag: { type: "condition", value: "gastritis", aliases: ["acidity", "gerd", "reflux", "peptic ulcer", "gastric", "এসিডিটি", "গ্যাস্ট্রিক", "গ্যাস্ট্রাইটিস", "আলসার", "বুক জ্বালা"] },
    avoidFoods: ["ঝাল-মসলাদার ও ভাজাপোড়া খাবার", "অতিরিক্ত চা/কফি ও গ্যাসযুক্ত পানীয়", "টক/অ্যাসিডিক খাবার-পানীয় (উপসর্গ বাড়লে)", "অ্যালকোহল ও ধূমপান", "রাতে দেরিতে বা ভারী খাবার ও দীর্ঘক্ষণ না-খেয়ে থাকা"],
    includeFoods: ["নিয়মিত সময়ে অল্প অল্প করে ঘন ঘন খাওয়া", "সেদ্ধ/হালকা রান্নার খাবার (ভাত, সেদ্ধ আলু, সবজি)", "পাকা কলা, ওটস", "পর্যাপ্ত পানি", "খাওয়ার পর কিছুক্ষণ সোজা হয়ে বসা/হাঁটা (lifestyle সহায়ক)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "fever", aliases: ["জ্বর", "viral"] },
    avoidFoods: ["ভারী তেল-চর্বিযুক্ত, ভাজাপোড়া ও ঝাল-মসলাদার খাবার", "রাস্তার খোলা খাবার/পানীয়", "চিনি-যুক্ত সফট ড্রিংক"],
    includeFoods: ["প্রচুর তরল (পানি, ORS, ডাবের পানি, স্যুপ, ভাতের মাড়)", "সহজপাচ্য খাবার (নরম ভাত, খিচুড়ি, সেদ্ধ সবজি)", "মৌসুমি ফল (ভিটামিন-সি সমৃদ্ধ)", "ছোট পরিমাণে ঘন ঘন খাওয়া"],
    source: ["WHO", "NHS"],
  },
  {
    linkedTag: { type: "condition", value: "diarrhea", aliases: ["diarrhoea", "dysentery", "loose motion", "ডায়রিয়া", "পাতলা পায়খানা", "আমাশয়"] },
    avoidFoods: ["ভাজাপোড়া ও ঝাল-মসলাদার খাবার", "রাস্তার খোলা খাবার/কাটা ফল/শরবত", "চিনি-যুক্ত পানীয় ও প্যাকেটজাত ফলের জুস", "অ্যালকোহল ও অতিরিক্ত কফি"],
    includeFoods: ["ORS/স্যালাইন (প্রতি পাতলা পায়খানার পর) ও প্রচুর তরল", "ভাত, কলা, সেদ্ধ আলু, টোস্ট (সহজপাচ্য)", "টক দই (সহনীয় হলে)", "শিশুদের ক্ষেত্রে বুকের দুধ/স্বাভাবিক খাবার চালিয়ে যাওয়া"],
    source: ["WHO"],
  },
  {
    linkedTag: { type: "condition", value: "dengue", aliases: ["ডেঙ্গু"] },
    avoidFoods: ["ভাজাপোড়া, তেলযুক্ত ও ঝাল-মসলাদার খাবার", "রাস্তার খোলা খাবার"],
    includeFoods: ["প্রচুর তরল (ORS, ডাবের পানি, ফলের রস, স্যুপ, ভাতের মাড়)", "সহজপাচ্য নরম খাবার (খিচুড়ি, সেদ্ধ সবজি, ডিম)", "ছোট পরিমাণে ঘন ঘন খাওয়া"],
    source: ["WHO"],
  },
  {
    linkedTag: { type: "condition", value: "typhoid", aliases: ["টাইফয়েড", "enteric fever"] },
    avoidFoods: ["রাস্তার খোলা খাবার/কাটা ফল/অপরিষ্কার পানি", "ভাজাপোড়া, ঝাল-মসলাদার ও ভারী খাবার", "না-ধোয়া কাঁচা সালাদ"],
    includeFoods: ["ফোটানো/বিশুদ্ধ পানি ও প্রচুর তরল", "সহজপাচ্য নরম খাবার (খিচুড়ি, সেদ্ধ ভাত, সেদ্ধ সবজি)", "পর্যাপ্ত ক্যালরি — অল্প অল্প করে ঘন ঘন"],
    source: ["WHO"],
  },
  {
    linkedTag: { type: "condition", value: "common cold", aliases: ["cough", "flu", "influenza", "সর্দি", "কাশি", "ঠান্ডা লাগা"] },
    avoidFoods: ["ধূমপান ও ধোঁয়া", "অ্যালকোহল (পানিশূন্যতা বাড়ায়)", "অতিরিক্ত চিনি-যুক্ত পানীয়"],
    includeFoods: ["প্রচুর কুসুম গরম তরল (পানি, স্যুপ, চা-লেবু)", "মধু (কাশিতে, শুধু ১ বছরের বেশি বয়সীদের জন্য)", "ভিটামিন-সি সমৃদ্ধ ফল", "পর্যাপ্ত বিশ্রাম (lifestyle সহায়ক)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "gout", aliases: ["uric acid", "hyperuricemia", "ইউরিক এসিড", "গাউট"] },
    avoidFoods: ["লাল মাংস ও অর্গান মিট (কলিজা, ব্রেন)", "চিংড়ি/শেলফিশ ও কিছু সামুদ্রিক মাছ", "অ্যালকোহল (বিশেষত বিয়ার) ও চিনি-যুক্ত পানীয়"],
    includeFoods: ["প্রচুর পানি", "কম-ফ্যাটযুক্ত দুধ/দই", "শাক-সবজি ও ফল", "স্বাস্থ্যকর ওজন বজায় রাখা (lifestyle সহায়ক)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "fatty liver", aliases: ["nafld", "masld", "ফ্যাটি লিভার", "লিভারে চর্বি"] },
    avoidFoods: ["অ্যালকোহল", "চিনি-যুক্ত পানীয়/মিষ্টি ও ফলের জুস", "ভাজাপোড়া ও ট্রান্স-ফ্যাট", "সাদা ভাত/ময়দা/বেকারি আইটেম বেশি পরিমাণে"],
    includeFoods: ["শাক-সবজি ও ফল", "লাল চাল/লাল আটা/ওটস", "মাছ (ওমেগা-৩)", "স্বাস্থ্যকর তেল (পরিমিত)", "ওজন কমানো ও নিয়মিত ব্যায়াম (lifestyle সহায়ক)"],
    source: ["NHS", "WHO"],
  },
  {
    linkedTag: { type: "condition", value: "jaundice", aliases: ["hepatitis", "জন্ডিস", "হেপাটাইটিস"] },
    avoidFoods: ["অ্যালকোহল (সম্পূর্ণ বাদ)", "ভারী তেল-চর্বিযুক্ত ও ভাজাপোড়া খাবার", "রাস্তার খোলা খাবার ও কাঁচা/আধা-সিদ্ধ শেলফিশ"],
    includeFoods: ["সহজপাচ্য, হালকা রান্নার খাবার (ভাত, খিচুড়ি, সেদ্ধ সবজি)", "প্রচুর বিশুদ্ধ পানি ও চিনি-ছাড়া ফলের রস", "অল্প অল্প করে ঘন ঘন খাওয়া ও পর্যাপ্ত বিশ্রাম"],
    source: ["WHO", "NHS"],
  },
  {
    linkedTag: { type: "condition", value: "heart disease", aliases: ["coronary", "cardiac", "heart failure", "হৃদরোগ", "হার্টের রোগ", "হার্ট অ্যাটাক"] },
    avoidFoods: ["অতিরিক্ত লবণ, আচার, শুঁটকি ও প্রসেসড খাবার", "ট্রান্স-ফ্যাট/ভাজাপোড়া এবং অতিরিক্ত ঘি-মাখন", "রেড মিট ও প্রসেসড মাংস (সসেজ/নাগেট) বেশি", "চিনি-যুক্ত পানীয়"],
    includeFoods: ["শাক-সবজি ও ফল", "ওটস/লাল চাল/ডাল", "মাছ (সপ্তাহে ২ বার মতো)", "বাদাম (পরিমিত)", "কম-লবণযুক্ত রান্না"],
    source: ["NHS", "WHO"],
  },
  {
    linkedTag: { type: "condition", value: "urinary tract infection", aliases: ["uti", "urine infection", "প্রস্রাবের সংক্রমণ", "প্রস্রাবে ইনফেকশন"] },
    avoidFoods: ["অতিরিক্ত চা/কফি, অ্যালকোহল ও গ্যাসযুক্ত পানীয়", "অতিরিক্ত ঝাল-মসলাদার খাবার", "চিনি-যুক্ত পানীয়"],
    includeFoods: ["প্রচুর পানি ও তরল (দিনে বারবার)", "ভিটামিন-সি সমৃদ্ধ ফল", "প্রস্রাব চেপে না রাখা (lifestyle সহায়ক)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "kidney stone", aliases: ["renal stone", "urinary stone", "কিডনিতে পাথর", "কিডনি স্টোন"] },
    avoidFoods: ["অতিরিক্ত লবণ", "অতিরিক্ত রেড মিট/প্রাণিজ প্রোটিন", "কোলা/সফট ড্রিংক", "উচ্চ-অক্সালেট খাবার বেশি পরিমাণে (পালং শাক, বাদাম, চকলেট) — পাথরের ধরন অনুযায়ী ডাক্তারের পরামর্শ নিন"],
    includeFoods: ["প্রচুর পানি (প্রস্রাব হালকা রঙের থাকে এমন পরিমাণ)", "লেবু/লেবুর শরবত (চিনি কম)", "পরিমিত ক্যালসিয়াম-সমৃদ্ধ খাবার (দুধ/দই) — ক্যালসিয়াম একেবারে বাদ দেবেন না"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "pcos", aliases: ["polycystic ovary", "পিসিওএস"] },
    avoidFoods: ["চিনি-যুক্ত পানীয়/মিষ্টি ও প্রসেসড খাবার", "সাদা ভাত/ময়দা বেশি পরিমাণে", "ভাজাপোড়া/ট্রান্স-ফ্যাট"],
    includeFoods: ["উচ্চ-ফাইবার শাক-সবজি", "লাল চাল/ওটস/ডাল (কম-glycemic)", "প্রোটিন (মাছ, ডিম, মুরগি)", "নিয়মিত ব্যায়াম ও ওজন নিয়ন্ত্রণ (lifestyle সহায়ক)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "osteoporosis", aliases: ["হাড়ক্ষয়", "হাড় ক্ষয়"] },
    avoidFoods: ["অতিরিক্ত লবণ", "অতিরিক্ত চা/কফি/কোলা", "অ্যালকোহল ও ধূমপান"],
    includeFoods: ["ক্যালসিয়াম-সমৃদ্ধ খাবার (দুধ, দই, কাঁটাসহ ছোট মাছ, সবুজ শাক)", "ভিটামিন-ডি (সকালের রোদ, ডিম, মাছ)", "পর্যাপ্ত প্রোটিন", "ওজন-বহনকারী হালকা ব্যায়াম (lifestyle সহায়ক)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "condition", value: "migraine", aliases: ["মাইগ্রেন", "আধকপালি"] },
    avoidFoods: ["খাবার বাদ দেওয়া/দীর্ঘক্ষণ না-খেয়ে থাকা", "অতিরিক্ত ক্যাফেইন", "অ্যালকোহল", "নিজের ট্রিগার-খাবার (কারো কারো ক্ষেত্রে চকলেট, পুরনো চিজ, প্রসেসড মাংস)"],
    includeFoods: ["নিয়মিত সময়ে খাওয়া", "পর্যাপ্ত পানি", "কোন খাবারে মাথাব্যথা বাড়ে তা খাদ্য-ডায়েরিতে লিখে রাখা"],
    source: ["NHS"],
  },

  // --- সাধারণ food-allergy (roadmap §12.4 Category-নিরপেক্ষ, allergy-tag) ---
  {
    linkedTag: { type: "allergy", value: "egg", aliases: ["ডিম"] },
    avoidFoods: ["ডিম ও ডিম-ভিত্তিক খাবার (কেক/মেয়োনেজ ইত্যাদি)"],
    includeFoods: ["বিকল্প প্রোটিন উৎস (ডাল, মাছ, মাংস — allergy-নির্ভর)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "allergy", value: "milk", aliases: ["দুধ", "lactose"] },
    avoidFoods: ["দুধ ও দুগ্ধজাত (পনির/দই/মাখন)"],
    includeFoods: ["ক্যালসিয়ামের বিকল্প উৎস (তিল, সবুজ শাক, বাদাম)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "allergy", value: "peanut", aliases: ["groundnut", "চীনাবাদাম"] },
    avoidFoods: ["চিনাবাদাম ও চিনাবাদাম-ভিত্তিক খাবার"],
    includeFoods: ["অন্য বাদাম/বীজ (cross-reactivity না থাকলে, ডাক্তার-পরামর্শ সাপেক্ষে)"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "allergy", value: "shellfish", aliases: ["prawn", "shrimp", "চিংড়ি"] },
    avoidFoods: ["চিংড়ি/কাঁকড়া/শামুক-জাতীয় সামুদ্রিক খাবার"],
    includeFoods: ["সাধারণ মাছ (allergy না থাকলে)", "উদ্ভিজ্জ প্রোটিন"],
    source: ["NHS"],
  },
  {
    linkedTag: { type: "allergy", value: "gluten", aliases: ["wheat", "গম"] },
    avoidFoods: ["গম/আটা-ভিত্তিক খাবার (রুটি, পাস্তা, বিস্কুট)"],
    includeFoods: ["চাল-ভিত্তিক খাবার", "ভুট্টা", "gluten-free বিকল্প"],
    source: ["NHS"],
  },

  // --- BMI-category (owner-request, ২০২৬-০৯-১৬) — height/weight Observation
  // থেকে client-side derive করা BMI, dietGuidanceData.js-এ matchDietGuidanceForTags()
  // এর substring-match logic অপরিবর্তিত (নতুন logic লাগেনি, শুধু নতুন tag-value) ---
  {
    linkedTag: { type: "bmiCategory", value: "underweight" },
    avoidFoods: ["দীর্ঘ সময় না-খেয়ে থাকা", "কম-ক্যালরি/কম-পুষ্টির স্ন্যাক্স"],
    includeFoods: ["ঘন ঘন ছোট পরিমাণে উচ্চ-ক্যালরি সুষম খাবার", "প্রোটিন-সমৃদ্ধ খাবার (ডিম, দুধ, ডাল, মাছ-মাংস)", "স্বাস্থ্যকর ফ্যাট (বাদাম, ঘি পরিমিত)"],
    source: ["WHO Healthy Diet", "NHS Eat Well"],
  },
  {
    linkedTag: { type: "bmiCategory", value: "overweight" },
    avoidFoods: ["উচ্চ-ক্যালরি প্রসেসড/ভাজাপোড়া খাবার", "চিনি-যুক্ত পানীয়/মিষ্টি"],
    includeFoods: ["উচ্চ-ফাইবার শাক-সবজি", "নিয়ন্ত্রিত অংশ (portion-control)", "নিয়মিত হালকা-মাঝারি ব্যায়াম (lifestyle সহায়ক)"],
    source: ["WHO Healthy Diet"],
  },
  {
    linkedTag: { type: "bmiCategory", value: "obese" },
    avoidFoods: ["উচ্চ-ক্যালরি প্রসেসড/ফাস্ট ফুড", "চিনি-যুক্ত পানীয়", "অতিরিক্ত ভাজাপোড়া"],
    includeFoods: ["উচ্চ-ফাইবার শাক-সবজি", "পর্যাপ্ত প্রোটিন", "নিয়ন্ত্রিত অংশ (portion-control)", "নিয়মিত ব্যায়াম শুরুর আগে ডাক্তার-পরামর্শ (comorbidity থাকলে)"],
    source: ["WHO Healthy Diet"],
  },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
  let willWrite = 0, willSkip = 0, willAlias = 0;

  for (const entry of ENTRIES) {
    const id = docIdFor(entry.linkedTag.type, entry.linkedTag.value);
    const ref = db.collection("dietGuidanceRules").doc(id);
    const existingSnap = await ref.get();

    // বিদ্যমান doc-এ শুধু নতুন/বদলানো `aliases` থাকলে ঐ একটা field-ই আপডেট (status/খাদ্য-তালিকা
    // অক্ষত — verified entry "draft"-এ ফিরে যায় না; --force-এর মতো overwrite না)।
    if (existingSnap.exists && !FORCE && Array.isArray(entry.linkedTag.aliases)) {
      const cur = (existingSnap.data().linkedTag || {}).aliases || [];
      if (JSON.stringify(cur) !== JSON.stringify(entry.linkedTag.aliases)) {
        console.log(`${CONFIRM ? "🔗 aliases আপডেট" : "🔍 preview aliases আপডেট"}: ${id}`);
        if (CONFIRM) await ref.update({ "linkedTag.aliases": entry.linkedTag.aliases, updatedAt: FieldValue.serverTimestamp() });
        willAlias++;
        continue;
      }
    }

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

  console.log(`\nসারাংশ: ${willWrite}টা entry ${CONFIRM ? "লেখা হলো" : "লেখা হতো"}, ${willSkip}টা skip হলো, ${willAlias}টার শুধু aliases ${CONFIRM ? "আপডেট হলো" : "আপডেট হতো"}।`);
  console.log("⚠️  সব entry status: \"draft\" দিয়ে তৈরি হয় — app-এ কার্যকর হওয়ার আগে Firestore Console-এ প্রতিটা review করে status: \"verified\" করে দিন।");
  if (!CONFIRM) console.log("\nআসল write করতে: node scripts/populateDietGuidanceRules.js --confirm");
}

run().then(() => process.exit(0)).catch((e) => { console.error("❌ ত্রুটি:", e); process.exit(1); });
