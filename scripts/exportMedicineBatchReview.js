// scripts/exportMedicineBatchReview.js
//
// P4 — Pharmacist/Physician Batch-Review Export (Architecture Plan Part B §5.4.0,
// roadmap §12.1.3)।
//
// উদ্দেশ্য: Medicine Database-এর draft entry-গুলো একটা CSV ফাইলে export করা,
// যেটা সরাসরি Google Sheets-এ import করে (File → Import → Upload) pharmacist/
// physician-কে link-shareable আকারে পাঠানো যাবে — column-by-column
// verify/edit/comment করার জন্য (PDF-এ annotate করা কঠিন বলে Sheets বাছাই হয়েছে,
// §5.4.0)।
//
// **Scope — শুধু Group ৩-১৪ (৩৫টা entry):** Thread 27 সিদ্ধান্ত অনুযায়ী Group ১-২
// (১২টা entry — ORS/Paracetamol/Zinc/Ibuprofen/PPI/Antihistamine)-এ owner-এর
// নিজের personal pharmacist/physician-level জ্ঞান থাকায় external batch-review
// থেকে আপাতত deferred। এই script Group ১-২ অন্তর্ভুক্ত করে না।
//
// **কোনো Firebase/network dependency লাগে না** — এই ফাইলে data সরাসরি
// Architecture Plan Part B §5.4-এর populated draft entry থেকে নেওয়া (একই সোর্স
// যা populateMedicineDbBatch2.js Firestore-এ লেখে) — শুধু review-এর জন্য একটা
// আলাদা, পড়া-সহজ CSV snapshot তৈরি করে। Firestore-এর আসল draft data touch/read
// করে না (Zero-Risk Discipline — শুধু নতুন standalone file, existing script
// অপরিবর্তিত)।
//
// ব্যবহার:
//   node scripts/exportMedicineBatchReview.js
//   → scripts/output/medicine_batch_review.csv তৈরি হবে
//   → Google Sheets খুলুন → File → Import → Upload → এই CSV → "Replace spreadsheet"
//     বা "Insert new sheet" বেছে নিন → Share (link-shareable) করে pharmacist/
//     physician-কে পাঠান।

import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "output");
const OUT_FILE = path.join(OUT_DIR, "medicine_batch_review.csv");

// ---- Architecture Plan Part B §5.4 Group ৩-১৪ (৩৫টা entry) — review-column-এর জন্য সংক্ষিপ্ত ফর্ম ----
const ENTRIES = [
  // === Group ৩ — শিশুর সিরাপ ===
  { genericName: "Salbutamol", class: "SABA bronchodilator", tier: "otc-self-care", forms: "syrup 2mg/5ml", dosingSummary: "2mo-6y: 0.1mg/kg 3-4x/day; 6-12y: 2mg 3-4x/day; 12+: 2-4mg 3-4x/day", contraindications: "hyperthyroidism (caution); cardiac arrhythmia history", interactsWith: "beta-blocker; other sympathomimetic", pregnancyCategory: "generally considered compatible", breastfeedingSafe: "true", source: "WHO-EML, BNFC", sourceConflictNotes: "ঘন ঘন/নিয়মিত ব্যবহার-প্যাটার্নে physician-referral flag প্রয়োজন (AI-orchestration-level, DB-field না)", highRiskFlag: "false" },
  { genericName: "Ketotifen", class: "mast-cell stabilizer/antihistamine", tier: "otc-self-care", forms: "syrup 1mg/5ml", dosingSummary: "6mo-3y: 0.5mg twice daily; 3y+: 1mg twice daily, max 30 days", contraindications: "known hypersensitivity; seizure disorder history", interactsWith: "CNS depressant; oral antidiabetic (rare thrombocytopenia interaction reported)", pregnancyCategory: "caution, limited data", breastfeedingSafe: "caution", source: "BNFC", sourceConflictNotes: "WHO EML core list-এ নেই", highRiskFlag: "false" },
  { genericName: "Domperidone", class: "antiemetic/prokinetic", tier: "otc-self-care", forms: "syrup 5mg/5ml", dosingSummary: "1-12y: 0.25mg/kg 3x/day before meals, max 5-7 days; 12+: 10mg 3x/day, max 30mg/day, max 7 days", contraindications: "cardiac conduction disorder/QT-prolongation history; significant electrolyte imbalance; hepatic impairment (moderate-severe); age <1y", interactsWith: "QT-prolonging drug (e.g. Azithromycin, antifungal); CYP3A4-inhibitor", pregnancyCategory: "caution, limited data", breastfeedingSafe: "caution", source: "WHO-EML, BNFC", sourceConflictNotes: "EMA/UK MHRA cardiac-safety warning (2014) অনুযায়ী dose/duration সীমিত। Cross-interaction: Azithromycin-এর সাথে QT-risk (§5.7)।", highRiskFlag: "false" },
  { genericName: "Ambroxol", class: "mucolytic/expectorant", tier: "otc-self-care", forms: "syrup 15mg/5ml or 30mg/5ml", dosingSummary: "0-2y: 7.5mg twice daily (caution <2y); 2-6y: 7.5mg twice daily; 6-12y: 15mg 2-3x/day; 12+: 30mg 3x/day", contraindications: "known hypersensitivity", interactsWith: "", pregnancyCategory: "caution (avoid 1st trimester)", breastfeedingSafe: "caution", source: "BNFC", sourceConflictNotes: "WHO EML-এ নেই। Cross-flag: Dextromethorphan (dry-cough)-এর বিপরীত উদ্দেশ্য, একসাথে না দেওয়া উচিত (§5.7)।", highRiskFlag: "false" },
  { genericName: "Montelukast", class: "leukotriene receptor antagonist", tier: "requires-consult", forms: "N/A (Tier 2, dose দেখানো হবে না)", dosingSummary: "N/A — physician-titrated, chronic asthma/allergic-rhinitis prophylaxis", contraindications: "FDA/EMA neuropsychiatric side-effect warning", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "owner-Confirmed: ডাক্তার-নির্দেশিত occasional ব্যবহার হলেও Tier 2 অপরিবর্তিত", highRiskFlag: "false" },
  { genericName: "Doxofylline", class: "methylxanthine bronchodilator", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A — narrow-therapeutic-index class", contraindications: "", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "BNFC (সীমিত কভারেজ)", sourceConflictNotes: "WHO EML/BNFC উভয়েই সীমিত কভারেজ — dosing sourcing pharmacist/physician local-knowledge-নির্ভর বেশি", highRiskFlag: "false" },
  { genericName: "Azithromycin", class: "macrolide antibiotic", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A", contraindications: "", interactsWith: "QT-interaction flag with Domperidone/Ondansetron (§5.7)", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "§12.1.2 default Tier 2 (antibiotic)", highRiskFlag: "false" },

  // === Group ৪ — এডাল্ট ===
  { genericName: "Loperamide", class: "antidiarrheal", tier: "otc-self-care", forms: "capsule/tablet 2mg", dosingSummary: "18+: প্রথমে 4mg, তারপর প্রতি loose motion-এ 2mg, max 16mg/day, max 2 days", contraindications: "জ্বর ও রক্ত-মিশ্রিত diarrhea (dysentery-সদৃশ — toxic megacolon ঝুঁকি); শিশু (<12 সাধারণত avoid); acute ulcerative colitis; severe hepatic impairment", interactsWith: "QT-prolonging drug (উচ্চ ডোজে, rare)", pregnancyCategory: "caution, avoid 1st trimester", breastfeedingSafe: "caution", source: "WHO-EML, BNFC", sourceConflictNotes: "Triage-relevance: জ্বর+রক্ত-মিশ্রিত diarrhea-তে suggest না করে escalate করা উচিত", highRiskFlag: "false" },
  { genericName: "Metronidazole", class: "nitroimidazole antibiotic/antiprotozoal", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A", contraindications: "alcohol-এর সাথে disulfiram-like reaction", interactsWith: "alcohol", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Itopride", class: "prokinetic", tier: "otc-self-care", forms: "tablet 50mg", dosingSummary: "18+: 50mg 3x/day before meals, max 14 days", contraindications: "GI hemorrhage/obstruction/perforation; known hypersensitivity", interactsWith: "anticholinergic drug", pregnancyCategory: "caution, limited data", breastfeedingSafe: "caution, limited data", source: "BNFC", sourceConflictNotes: "WHO EML-এ নেই", highRiskFlag: "false" },
  { genericName: "Naproxen", class: "NSAID (longer-acting)", tier: "otc-self-care", forms: "tablet 250mg/500mg", dosingSummary: "18+: 250-500mg twice daily, max 1000mg/day, max 3-5 days", contraindications: "active peptic ulcer/GI bleeding history; severe renal/hepatic impairment; third trimester pregnancy; asthma-NSAID-sensitivity; dengue/সন্দেহভাজন dengue; cardiovascular disease history", interactsWith: "other NSAID/aspirin; anticoagulant; ACE-inhibitor/ARB; lithium", pregnancyCategory: "avoid, especially 3rd trimester", breastfeedingSafe: "generally compatible (caution)", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Levothyroxine", class: "thyroid hormone replacement", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A — §12.4 Category B chronic, dose কখনো AI suggest করবে না", contraindications: "", interactsWith: "Calcium (timing-gap ৪ ঘণ্টা না মানলে absorption কমে, §5.7)", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Amlodipine", class: "calcium-channel blocker", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A — §12.4 Category B chronic (হাইপারটেনশন)", contraindications: "", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Losartan", class: "ARB antihypertensive", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A — §12.4 Category B chronic", contraindications: "", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Metformin", class: "biguanide antidiabetic", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A — §12.4 Category B chronic", contraindications: "", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Ondansetron", class: "5-HT3 antiemetic", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A", contraindications: "", interactsWith: "QT-prolongation risk (Domperidone/Azithromycin-এর মতোই cross-interaction, §5.7)", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },

  // === Group ৫ — বয়স্ক মা-বাবার নিয়মিত ওষুধ (সব Tier 2) ===
  { genericName: "Clonazepam", class: "benzodiazepine (anticonvulsant/anxiolytic)", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A — controlled/scheduled substance", contraindications: "dependency-risk; বয়স্কদের fall-risk, cognitive impairment/confusion, respiratory-depression (বিশেষত অন্য sedative/opioid-এর সাথে)", interactsWith: "sedative/opioid", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "highRiskFlag: TRUE। riskNote: Dependency/withdrawal-risk — dose-gap/adjustment আলোচনায় একেবারেই না; herbal/lifestyle-complementary guidance-ও suppress; শুধু generic info + urgent ডাক্তার-রেফার।", highRiskFlag: "true" },
  { genericName: "Flupentixol + Melitracen (combination)", class: "antipsychotic (low-dose) + tricyclic antidepressant", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A — narrow therapeutic index", contraindications: "বয়স্কদের ক্ষেত্রে TCA-component-এর anticholinergic side-effect (confusion, urinary retention, cardiac conduction) ও fall-risk", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "BNFC (WHO EML non-listed)", sourceConflictNotes: "regionally common combination product, sourcing pharmacist/physician-নির্ভর বেশি। highRiskFlag: TRUE। riskNote: Narrow-therapeutic-index psychiatric combination — dose-gap/adjustment আলোচনায় একেবারেই না; শুধু generic info + urgent ডাক্তার-রেফার।", highRiskFlag: "true" },
  { genericName: "Pizotifen", class: "antihistamine-derivative, migraine prophylaxis", tier: "requires-consult", forms: "N/A (Tier 2)", dosingSummary: "N/A — চিকিৎসক-titrated dose", contraindications: "", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "BNFC (WHO EML non-listed)", sourceConflictNotes: "তুলনামূলক কম high-risk (sedation/weight-gain মূল side-effect) — highRiskFlag false, normal Tier-2 behavior যথেষ্ট", highRiskFlag: "false" },

  // === Group ৬ — টপিক্যাল/চর্মরোগ ===
  { genericName: "Clotrimazole (topical antifungal)", class: "topical antifungal", tier: "otc-self-care", forms: "cream 1%", dosingSummary: "affected area-তে দিনে ২-৩ বার পাতলা করে, max 14 days", contraindications: "known hypersensitivity; খোলা ঘা/broken skin-এ সতর্কতা", interactsWith: "", pregnancyCategory: "generally safe (topical)", breastfeedingSafe: "true", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Povidone-Iodine (antiseptic)", class: "antiseptic", tier: "otc-self-care", forms: "solution 10%; ointment 5-10%", dosingSummary: "কাটা-ছেঁড়া/ক্ষত পরিষ্কার, দিনে ১-২ বার", contraindications: "thyroid disorder (বড় area/দীর্ঘমেয়াদি সতর্কতা); known iodine hypersensitivity; নবজাতক-এ বড় area সতর্কতা", interactsWith: "", pregnancyCategory: "caution (বড় area/দীর্ঘমেয়াদি এড়ানো)", breastfeedingSafe: "caution (বড় area)", source: "WHO-EML, BNFC", sourceConflictNotes: "tetanus-status-সচেতনতার সাথে যুক্ত", highRiskFlag: "false" },
  { genericName: "Antibiotic Ointment (Mupirocin/Fusidic Acid)", class: "topical antibiotic", tier: "otc-self-care", forms: "ointment/cream 2%", dosingSummary: "পরিষ্কার ক্ষতে দিনে ২-৩ বার, max 7-10 days", contraindications: "known hypersensitivity", interactsWith: "", pregnancyCategory: "safe (topical)", breastfeedingSafe: "true", source: "WHO-EML, BNFC", sourceConflictNotes: "গভীর/বড় ক্ষত, প্রচুর রক্তক্ষরণ, পশু-কামড়ে যথেষ্ট না — triage escalation দরকার", highRiskFlag: "false" },

  // === Group ৭ — মাসিক ব্যথা ===
  { genericName: "Mefenamic Acid", class: "NSAID", tier: "otc-self-care", forms: "tablet 250mg/500mg; syrup 50mg/5ml (pediatric fever use)", dosingSummary: "18+: প্রথমে 500mg, তারপর 250mg every 6h, max 3-5 days", contraindications: "active peptic ulcer/GI bleeding history; severe renal/hepatic impairment; third trimester pregnancy; dengue/সন্দেহভাজন dengue; asthma-NSAID-sensitivity", interactsWith: "other NSAID/aspirin; anticoagulant; lithium", pregnancyCategory: "avoid, especially 3rd trimester", breastfeedingSafe: "caution", source: "WHO-EML, BNFC", sourceConflictNotes: "abnormal/irregular bleeding-সহ ব্যথা হলে gynecology-escalation, শুধু routine dysmenorrhea-তেই suggest হবে", highRiskFlag: "false" },

  // === Group ৮ — Vitamin/Mineral ===
  { genericName: "Vitamin D3 (Cholecalciferol)", class: "vitamin supplement", tier: "otc-self-care", forms: "", dosingSummary: "0-1y: 400IU/day; 1-18y: 600IU/day; 18-65y: 600-800IU/day; 65+: 800-1000IU/day", contraindications: "hypercalcemia; known hypervitaminosis-D", interactsWith: "thiazide diuretic", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Calcium (Carbonate/Citrate)", class: "mineral supplement", tier: "otc-self-care", forms: "", dosingSummary: "18-50y: 1000mg elemental/day (divided); 50+: 1200mg elemental/day (divided)", contraindications: "hypercalcemia; kidney stone history (caution); severe renal impairment", interactsWith: "Antacid/PPI timing-সতর্কতা; iron absorption কমায় (2h gap); thyroxine absorption কমায় (4h gap, §5.7)", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "Cross-interaction: Levothyroxine-এর সাথে timing-gap critical (§5.7)", highRiskFlag: "false" },
  { genericName: "Iron + Folic Acid (combination)", class: "mineral/vitamin supplement", tier: "otc-self-care", forms: "", dosingSummary: "12+: 1 tablet daily (deficiency-treatment physician-guided উচ্চ-ডোজ); pregnancy-তে WHO ANC-supplement হিসেবে routine", contraindications: "hemochromatosis/iron-overload disorder; known hypersensitivity", interactsWith: "Calcium/Antacid absorption কমে; tetracycline/ciprofloxacin absorption কমায়", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },

  // === Group ৯ — কাশি ===
  { genericName: "Dextromethorphan", class: "dry-cough suppressant", tier: "otc-self-care", forms: "syrup 10-15mg/5ml", dosingSummary: "<6y: নিরুৎসাহিত; 6-12y: 5-10mg every 4h, max 60mg/day; 12+: 10-20mg every 4h or 30mg every 6-8h, max 120mg/day", contraindications: "MAO-inhibitor (সাম্প্রতিক ১৪ দিন — serotonin syndrome ঝুঁকি); productive/mucus-heavy cough; asthma/COPD-এ সতর্কতা", interactsWith: "MAO-inhibitor (contraindicated); SSRIs (serotonin syndrome ঝুঁকি); CNS depressant", pregnancyCategory: "caution, limited data", breastfeedingSafe: "caution", source: "N/A (WHO EML-এ নেই)", sourceConflictNotes: "§12.1.4 cold/cough সতর্কতা-প্রয়োজনীয় category। Cross-flag: Ambroxol-এর বিপরীত উদ্দেশ্য, একসাথে না দেওয়া উচিত (§5.7)।", highRiskFlag: "false" },

  // === Group ১০ — Topical Pain-Relief ===
  { genericName: "Diclofenac (topical gel)", class: "topical NSAID", tier: "otc-self-care", forms: "gel 1%", dosingSummary: "12+: আক্রান্ত স্থানে দিনে ৩-৪ বার পাতলা প্রলেপ, max 14 days", contraindications: "খোলা ঘা/broken skin; known NSAID hypersensitivity; third trimester pregnancy", interactsWith: "", pregnancyCategory: "caution 3rd trimester", breastfeedingSafe: "generally compatible", source: "WHO-EML, BNFC", sourceConflictNotes: "বয়স্কদের বাত/হাড়ক্ষয় ব্যথায় oral NSAID-এর systemic risk এড়াতে safer first-choice", highRiskFlag: "false" },

  // === Group ১১ — Constipation ===
  { genericName: "Lactulose", class: "osmotic laxative", tier: "otc-self-care", forms: "", dosingSummary: "1-6y: 5ml twice daily; 6-12y: 10ml twice daily; 12+: 15ml twice daily, max 14 days", contraindications: "galactosemia; GI obstruction (suspected); known hypersensitivity", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "", highRiskFlag: "false" },
  { genericName: "Psyllium Husk (Isabgol)", class: "bulk-forming laxative", tier: "otc-self-care", forms: "", dosingSummary: "12+: 1 চা চামচ (~5-10g), 1-2x/day প্রচুর পানির সাথে, max 14 days", contraindications: "GI obstruction (suspected); difficulty swallowing; known hypersensitivity", interactsWith: "অন্য ওষুধের absorption দেরি করতে পারে (1-2h gap)", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "পর্যাপ্ত পানি ছাড়া নিলে obstruction-risk বাড়াতে পারে", highRiskFlag: "false" },
  { genericName: "Bisacodyl", class: "stimulant laxative", tier: "otc-self-care", forms: "", dosingSummary: "10+: 5-10mg once daily at night, max 5-7 days", contraindications: "GI obstruction (suspected); acute abdominal pain (undiagnosed); severe dehydration", interactsWith: "Antacid/dairy-এর সাথে একসাথে না নেওয়া", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "দীর্ঘমেয়াদি stimulant-laxative নিরুৎসাহিত (bowel-dependency ঝুঁকি)", highRiskFlag: "false" },

  // === Group ১২ — Piles ===
  { genericName: "Hydrocortisone + Local Anesthetic (topical hemorrhoid cream)", class: "topical corticosteroid + anesthetic", tier: "otc-self-care", forms: "", dosingSummary: "18+: দিনে ২ বার + প্রয়োজনে মলত্যাগের পর, max 7 days", contraindications: "local fungal/viral/bacterial skin infection; known hypersensitivity", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "WHO-EML, BNFC", sourceConflictNotes: "৭ দিনের বেশি নিরুৎসাহিত (skin-thinning ঝুঁকি); রক্তক্ষরণ persistent/বাড়লে ডাক্তার-পরামর্শ", highRiskFlag: "false" },

  // === Group ১৩ — মুখের ঘা ===
  { genericName: "Benzydamine (oral rinse/gel)", class: "NSAID-topical (oral)", tier: "otc-self-care", forms: "", dosingSummary: "6-12y: diluted rinse every 1.5-3h; 12+: 15ml rinse every 1.5-3h, max 7 days", contraindications: "known hypersensitivity; aspirin/NSAID-sensitivity history (caution)", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "BNFC", sourceConflictNotes: "WHO EML-এ নেই", highRiskFlag: "false" },
  { genericName: "Triamcinolone Acetonide (dental paste)", class: "topical corticosteroid", tier: "otc-self-care", forms: "", dosingSummary: "6+: ঘায়ে দিনে ২-৩ বার পাতলা প্রলেপ, max 7 days", contraindications: "oral fungal/viral infection (steroid infection-mask/worsen করতে পারে); known hypersensitivity", interactsWith: "", pregnancyCategory: "", breastfeedingSafe: "", source: "BNFC", sourceConflictNotes: "WHO EML-এ নেই। ৭ দিনে না সারলে বা recurrent হলে ডাক্তার-পরামর্শ।", highRiskFlag: "false" },

  // === Group ১৪ — Emergency Bystander First-Aid ===
  { genericName: "Aspirin (Suspected Heart-Attack — Emergency Bystander First-Aid)", class: "antiplatelet, emergency-bystander-use only", tier: "otc-self-care (emergencyBystanderOnly)", forms: "chewable/soluble tablet 300mg (or 2×150mg / 4×75mg)", dosingSummary: "18+: 300mg চিবিয়ে খাওয়ানো (গিলে ফেলা না), one-time only, ambulance আসার সময়", contraindications: "known Aspirin/NSAID hypersensitivity বা asthma-NSAID-sensitivity; active/সাম্প্রতিক significant bleeding history; known bleeding-disorder; <18 বছর (Reye's syndrome ঝুঁকি)", interactsWith: "anticoagulant (bleeding-risk বাড়ায়, emergency-context-এ benefit উচ্চ বিবেচিত)", pregnancyCategory: "avoid unless directed", breastfeedingSafe: "single emergency dose generally acceptable", source: "WHO guideline-based bystander first-aid; AHA/Red Cross bystander protocol", sourceConflictNotes: "স্বাভাবিক WHO-EML/BNFC dosing-entry না — emergency bystander-action, শুধু CARDIAC-BYSTANDER-001 triage-trigger থেকেই accessible (§5.4.1.1), normal browse-flow-এ না। physician বিশেষভাবে confirm করবেন।", highRiskFlag: "false" },
];

// ---- CSV helper ----
function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADERS = [
  "genericName", "class", "tier", "forms", "dosingRules-summary",
  "contraindications", "interactsWith", "pregnancyCategory", "breastfeedingSafe",
  "source", "sourceConflictNotes", "highRiskFlag",
  "Reviewer Name/Role", "Verified? (Y/N)", "Reviewer Comment", "Review Date",
];

const rows = [HEADERS];
for (const e of ENTRIES) {
  rows.push([
    e.genericName, e.class, e.tier, e.forms, e.dosingSummary,
    e.contraindications, e.interactsWith, e.pregnancyCategory, e.breastfeedingSafe,
    e.source, e.sourceConflictNotes, e.highRiskFlag,
    "", "", "", "", // Reviewer columns — খালি, pharmacist/physician পূরণ করবেন
  ]);
}

const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, "\uFEFF" + csvContent, "utf8"); // BOM — Google Sheets/Excel-এ বাংলা ঠিকভাবে দেখাতে

console.log(`✅ ${ENTRIES.length}টা entry export হলো: ${OUT_FILE}`);
console.log("");
console.log("পরের ধাপ (Google Sheets-এ আনতে):");
console.log("  ১. sheets.google.com → Blank spreadsheet খুলুন");
console.log("  ২. File → Import → Upload → এই CSV ফাইল বেছে নিন");
console.log("  ৩. Import location: \"Replace current sheet\" (বা নতুন file হিসেবে)");
console.log("  ৪. Share বাটনে link-shareable করে pharmacist/physician-কে পাঠান");
console.log("  ৫. তাঁরা শেষ ৪টা Reviewer column পূরণ করবেন (Name/Role, Verified Y/N, Comment, Date)");
