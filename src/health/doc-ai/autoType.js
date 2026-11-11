// src/health/doc-ai/autoType.js
//
// ধাপ ৪-ঙ — ধরন-চেনার ফল থেকে (docClassify.js) নথি-vault-এর ধরন ও পরের প্যানেল ঠিক করা।
// Pure logic (DOM/Firestore নেই)। অনিশ্চিত ("unknown") হলে কখনো জোর করে প্যানেল খোলে না —
// শুধু vault-এ "other" হিসেবে সংরক্ষণ; ব্যবহারকারী চাইলে ধরন হাতে বদলাতে পারেন।

export const AUTO = "auto";

/** kind: "prescription" | "lab-report" | "visiting-card" | "unknown" → documentsData-র docType */
export function kindToVaultType(kind) {
  if (kind === "prescription") return "prescription";
  if (kind === "lab-report") return "lab-report";
  return "other"; // ভিজিটিং কার্ড/অজানা — vault-এ "other"; কার্ড-ডেটা ডাক্তার-তালিকায় যায়
}

/** হাতে-বাছা docType/চিপ → kind (auto নয় এমন ক্ষেত্রে) */
export function kindFromChoice(choice) {
  if (choice === "prescription") return "prescription";
  if (choice === "lab-report") return "lab-report";
  if (choice === "visiting-card") return "visiting-card";
  return "other";
}

const META = {
  prescription: { emoji: "💊", label: "প্রেসক্রিপশন" },
  "lab-report": { emoji: "🔬", label: "ল্যাব রিপোর্ট" },
  "visiting-card": { emoji: "📇", label: "ডাক্তারের কার্ড" },
};

/**
 * @param {{type:string, confidence:"high"|"low"}|null} cls - classifyDocument() ফল
 * @returns {{ kind:string, sure:boolean, emoji:string, label:string, text:string }}
 */
export function describeDetection(cls) {
  const kind = cls && META[cls.type] ? cls.type : "unknown";
  if (kind === "unknown") return { kind, sure: false, emoji: "🤔", label: "চেনা যায়নি", text: "ধরন চেনা যায়নি — নিচ থেকে ধরন বেছে নিন।" };
  const m = META[kind];
  const sure = cls.confidence === "high";
  return { kind, sure, emoji: m.emoji, label: m.label, text: sure ? m.label + " মনে হচ্ছে" : m.label + " হতে পারে — ঠিক না হলে নিচ থেকে বদলান" };
}

/** ধরন নির্ধারণ: auto হলে শনাক্ত-করা kind, নইলে হাতে-বাছা */
export function resolveKind(choice, detection) {
  return choice === AUTO ? (detection ? detection.kind : "unknown") : kindFromChoice(choice);
}
