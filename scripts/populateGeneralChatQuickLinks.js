// scripts/populateGeneralChatQuickLinks.js
//
// General Chat — Quick-Links directory populate script (নতুন, এই থ্রেড)।
// owner নিজে local-এ চালাবেন — কোনো Cloud Function/cron না (roadmap §10.2.5
// Spark-only নীতি)। firestore.rules-এ `generalChatQuickLinks/{id}` collection-এ
// `allow write: if false` — শুধু এই trusted local script (Admin SDK) দিয়েই
// write সম্ভব (populateCareEscalationDirectory.js-এর হুবহু একই pattern)।
//
// ভবিষ্যতে নতুন লিংক যোগ/সম্পাদনা করতে হলে: নিচের ENTRIES array-এ যোগ/এডিট
// করে আবার `--confirm` দিয়ে চালান (existing entry থাকলে --force ছাড়া
// overwrite হবে না, Process Rule ৩ — Zero Data Loss)।
//
// ক্যাটাগরি-স্কিম (owner-approved): category field-ই General Chat UI-তে
// sidebar-এর group-লেবেল হিসেবে সরাসরি ব্যবহার হয় এবং সেভ-করা-নোটের
// tag-dropdown-ও এই একই category-তালিকা থেকে populate হয় (তাই নতুন category
// যোগ করলে দুই জায়গাতেই স্বয়ংক্রিয়ভাবে প্রতিফলিত হবে, আলাদা কোনো hardcoded
// তালিকা রক্ষণাবেক্ষণ করতে হবে না)।
//
// "স্বাস্থ্য" ক্যাটাগরি — Architecture Plan Part B §6.3.1-এ আগে থেকেই Confirmed
// whitelisted domain থেকে সরাসরি reuse করা হলো (নতুন কোনো লিংক researched হয়নি,
// শুধু General Chat-এও সহজে অ্যাক্সেসযোগ্য করা হলো)।
// "বিবিধ" ক্যাটাগরির কোনো fixed entry নেই — UI-তে আলাদাভাবে হার্ডকোড থাকবে,
// এখানে populate করার কিছু নেই (roadmap আলোচনা দ্রষ্টব্য)।
//
// ব্যবহার:
//   ড্রাই-রান:  node scripts/populateGeneralChatQuickLinks.js
//   আসল write: node scripts/populateGeneralChatQuickLinks.js --confirm
//   overwrite:  node scripts/populateGeneralChatQuickLinks.js --confirm --force

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
  console.error("   scripts/serviceAccountKey.json নামে রাখুন (অন্যান্য populate script-এর মতোই)।");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function docIdFor(category, url) {
  return `${category}-${url}`
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// category → sidebar-এ দেখানো বাংলা লেবেল ও প্রদর্শন-ক্রম
export const CATEGORY_LABELS = {
  nursery: "নার্সারি / কৃষি",
  religious: "ধর্মীয়",
  politics: "রাজনীতি",
  economics: "অর্থনীতি",
  history: "ইতিহাস-ঐতিহ্য",
  "geology-training": "ভূতত্ত্ব — Foreign Training",
  "geology-research": "ভূতত্ত্ব — Research",
  "geology-learning": "ভূতত্ত্ব — Learning",
  phd: "PhD / গবেষণা সুযোগ",
  health: "স্বাস্থ্য (সাধারণ জ্ঞান)",
};
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

const ENTRIES = [
  // ---- নার্সারি / কৃষি ----
  { category: "nursery", label: "কৃষি সম্প্রসারণ অধিদপ্তর (DAE), বাংলাদেশ", url: "https://dae.gov.bd/", notes: "বাংলাদেশের সরকারি কৃষি তথ্য, প্রযুক্তি, রোগ-পোকা ও উৎপাদনসংক্রান্ত তথ্য" },
  { category: "nursery", label: "Bangladesh Agricultural Research Institute (BARI)", url: "https://bari.gov.bd/", notes: null },
  { category: "nursery", label: "Royal Horticultural Society (RHS), UK", url: "https://www.rhs.org.uk/", notes: "Container gardening, propagation, potting media, plant care ও ornamental horticulture" },
  { category: "nursery", label: "University of Kentucky – Cooperative Extension", url: "https://extension.ca.uky.edu/", notes: "Commercial container nursery production বিষয়ে গবেষণাভিত্তিক তথ্য" },
  { category: "nursery", label: "University of Georgia Extension", url: "https://extension.uga.edu/", notes: "Nursery & ornamental horticulture, container production" },

  // ---- ধর্মীয় ----
  { category: "religious", label: "IslamQA.org – Hanafi Fiqh", url: "https://islamqa.org/hanafi/", notes: null },
  { category: "religious", label: "Darul Ifta Deoband", url: "https://darulifta-deoband.com/", notes: null },
  { category: "religious", label: "iFatwa", url: "https://ifatwa.info/", notes: null },
  { category: "religious", label: "Traversing Tradition", url: "https://traversingtradition.com/", notes: null },
  { category: "religious", label: "Ittiqan Institute", url: "https://ittiqan.com/", notes: null },

  // ---- রাজনীতি ----
  { category: "politics", label: "The Conversation", url: "https://theconversation.com/", notes: null },
  { category: "politics", label: "RealClearWorld", url: "https://www.realclearworld.com/", notes: null },

  // ---- অর্থনীতি ----
  { category: "economics", label: "Investopedia", url: "https://www.investopedia.com/", notes: null },
  { category: "economics", label: "NerdWallet", url: "https://www.nerdwallet.com/", notes: null },
  { category: "economics", label: "The Balance – Make Money", url: "https://www.thebalancemoney.com/make-money-4689740", notes: null },

  // ---- ইতিহাস-ঐতিহ্য ----
  { category: "history", label: "Encyclopaedia Britannica – History", url: "https://www.britannica.com/topic/history", notes: null },
  { category: "history", label: "World History Encyclopedia", url: "https://www.worldhistory.org/", notes: null },
  { category: "history", label: "UNESCO – World Heritage", url: "https://whc.unesco.org/", notes: null },
  { category: "history", label: "Smithsonian Institution", url: "https://www.si.edu/", notes: null },
  { category: "history", label: "Oxford Islamic Studies Online", url: "https://www.oxfordislamicstudies.com/", notes: null },
  { category: "history", label: "World History Encyclopedia – Islamic World", url: "https://www.worldhistory.org/Islamic_World/", notes: null },

  // ---- ভূতত্ত্ব — Foreign Training ----
  { category: "geology-training", label: "ITEC – Indian Technical and Economic Cooperation", url: "https://www.itecgoi.in/", notes: null },
  { category: "geology-training", label: "PanAfGeo+ – EuroGeoSurveys", url: "https://panafgeo.eurogeosurveys.org/events/", notes: null },
  { category: "geology-training", label: "Geological Survey of India (GSI) – GSITI", url: "https://gsi.gov.in/about-gsiti/", notes: null },
  { category: "geology-training", label: "IIRS – Indian Institute of Remote Sensing (ISRO)", url: "https://admissions.iirs.gov.in/coursecalender", notes: null },
  { category: "geology-training", label: "Geological Society of America (GSA) – Short Courses", url: "https://store.geosociety.org/collections/short-courses", notes: null },

  // ---- ভূতত্ত্ব — Research ----
  { category: "geology-research", label: "UNESCO–IGCP", url: "https://www.unesco.org/en/iggp/igcp-projects", notes: null },
  { category: "geology-research", label: "IUGS – International Union of Geological Sciences", url: "https://www.iugs.org/", notes: null },
  { category: "geology-research", label: "IUGG – International Union of Geodesy and Geophysics", url: "https://iugg.org/", notes: null },
  { category: "geology-research", label: "INQUA – International Union for Quaternary Research", url: "https://www.inqua.org/", notes: null },
  { category: "geology-research", label: "IODP – International Ocean Discovery Program", url: "https://www.iodp.org/", notes: null },

  // ---- ভূতত্ত্ব — Learning ----
  { category: "geology-learning", label: "MIT OpenCourseWare – Introduction to Geology", url: "https://ocw.mit.edu/courses/12-001-introduction-to-geology-fall-2013/", notes: null },
  { category: "geology-learning", label: "OpenLearn – Open University", url: "https://www.open.edu/openlearn/science-maths-technology/free-courses", notes: "Geology, mineralogy, rocks under microscope-সহ কিছু ফ্রি কোর্স" },
  { category: "geology-learning", label: "Coursera – Geology Courses", url: "https://www.coursera.org/courses?query=geology", notes: null },
  { category: "geology-learning", label: "NPTEL – Geology / Earth Sciences", url: "https://nptel.ac.in/", notes: "IIT-এর university-level lecture ও courses" },
  { category: "geology-learning", label: "Class Central – Geology Courses", url: "https://www.classcentral.com/subject/geology", notes: null },

  // ---- PhD / গবেষণা সুযোগ ----
  { category: "phd", label: "FindAPhD", url: "https://www.findaphd.com/", notes: null },
  { category: "phd", label: "EURAXESS – European Research Jobs & PhD Opportunities", url: "https://euraxess.ec.europa.eu/jobs", notes: null },
  { category: "phd", label: "Academic Positions", url: "https://academicpositions.com/", notes: null },
  { category: "phd", label: "Nature Careers", url: "https://www.nature.com/naturecareers/", notes: null },
  { category: "phd", label: "PhDportal", url: "https://www.phdportal.com/", notes: null },

  // ---- স্বাস্থ্য (সাধারণ জ্ঞান) — Architecture Plan Part B §6.3.1 থেকে reuse ----
  { category: "health", label: "WHO", url: "https://www.who.int/", notes: "IMCI/ANC danger signs, EML, vaccination schedule, general guideline" },
  { category: "health", label: "NHS (UK)", url: "https://www.nhs.uk/", notes: "Plain-language clinical guidance" },
  { category: "health", label: "Patient.info", url: "https://patient.info/", notes: null },
  { category: "health", label: "CDC", url: "https://www.cdc.gov/", notes: "Health advisory, recall, immunization info" },
  { category: "health", label: "MedlinePlus (NIH)", url: "https://medlineplus.gov/", notes: "Medicine/condition patient-facing reference" },
  { category: "health", label: "MSD Manuals (Consumer Version)", url: "https://www.msdmanuals.com/", notes: "রোগের কারণ/লক্ষণ/diagnosis/treatment, plain-language" },
  { category: "health", label: "NICE (UK)", url: "https://www.nice.org.uk/", notes: "Evidence-based clinical guideline" },
  { category: "health", label: "Cochrane Library", url: "https://www.cochranelibrary.com/", notes: "Systematic review" },
];

async function run() {
  console.log(`মোড: ${CONFIRM ? "CONFIRM (আসল write হবে)" : "DRY-RUN (কিছু লেখা হবে না, শুধু preview)"}${FORCE ? " + FORCE" : ""}`);
  let willWrite = 0;
  let willSkip = 0;

  for (const entry of ENTRIES) {
    const id = docIdFor(entry.category, entry.url);
    const ref = db.collection("generalChatQuickLinks").doc(id);
    const existingSnap = await ref.get();

    if (existingSnap.exists && !FORCE) {
      console.log(`⏭️  skip (আগে থেকেই আছে): ${id}`);
      willSkip++;
      continue;
    }

    const docData = {
      category: entry.category,
      label: entry.label,
      url: entry.url,
      notes: entry.notes,
      active: true,
      addedBy: "owner-script",
      addedAt: FieldValue.serverTimestamp(),
    };

    console.log(`${CONFIRM ? "✍️  write" : "🔍 preview"}: ${id} (${entry.label})`);
    if (CONFIRM) {
      await ref.set(docData, { merge: false });
    }
    willWrite++;
  }

  console.log(`\nসারাংশ: ${willWrite}টা entry ${CONFIRM ? "লেখা হলো" : "লেখা হতো"}, ${willSkip}টা skip হলো।`);
  if (!CONFIRM) {
    console.log("\nআসল write করতে চালান: node scripts/populateGeneralChatQuickLinks.js --confirm");
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ ত্রুটি:", e.message || e);
    process.exit(1);
  });
