// src/health/doc-ai/docClassify.js
//
// ধাপ ৪-খ(১) — OCR/PDF টেক্সট দেখে নথির ধরন নিজে চেনা (AI ছাড়া, নিয়মভিত্তিক)।
// Pure logic — DOM/Firestore নেই। অনিশ্চিত হলে "unknown" (কখনো জোর করে অনুমান নয়);
// তখন UI ব্যবহারকারীকে হাতে বাছতে দেবে।
//
// ফেরত ধরন: "prescription" | "lab-report" | "visiting-card" | "unknown"
// (prescription/lab-report = documentsData.js-এর docType; visiting-card = ডাক্তার-তালিকার কার্ড)

const BN = "০১২৩৪৫৬৭৮৯";
const toEn = (s) => String(s || "").replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

const RX_SIGNS = [
  [/(?:^|\s)(?:Rx|℞)(?=[\s:.]|$)/m, 3],
  [/^\s*(?:[0-9]{1,2}\s*[.)]\s*)?(?:tab|tablet|cap|capsule|syp|syrup|susp|inj|injection|oint|drops?)\b\.?/gim, 2],
  [/\b\d+(?:[./]\d+)?\s*\+\s*\d+(?:[./]\d+)?\s*\+\s*\d+(?:[./]\d+)?\b/, 3],
  [/\b(?:bd|tds|qid|od|sos|prn)\b/i, 1],
  [/\b\d+\s*(?:days?|weeks?|months?)\b|\d+\s*(?:দিন|সপ্তাহ|মাস)/i, 1],
  [/খাবারের\s*(?:আগে|পরে)|after\s*meal|before\s*meal|\bAC\b|\bPC\b/i, 1],
  [/\b(?:advice|follow[\s-]*up|diagnosis|chief complaints?)\b|পরামর্শ|ফলো\s*আপ/i, 1],
];

const LAB_SIGNS = [
  [/\b(?:reference|ref\.?)\s*(?:range|value|interval)s?\b|normal\s*range|রেফারেন্স/i, 3],
  [/\b(?:specimen|sample|collected|reported|lab\s*no|test\s*name|investigation|result)\b/i, 1],
  [/\b(?:mg\/dl|g\/dl|mmol\/l|iu\/l|u\/l|ng\/ml|pg\/ml|µiu\/ml|miu\/l|\/cumm|\/µl|fl|%)\b/gi, 1],
  [/\b(?:cbc|hemoglobin|haemoglobin|hb|wbc|rbc|platelet|esr|creatinine|glucose|hba1c|cholesterol|triglyceride|sgpt|alt|sgot|ast|tsh|urea|uric acid|bilirubin|ferritin)\b/gi, 1],
  [/\b(?:pathology|laborator(?:y|ies)|diagnostic|biochemistry|haematology|hematology)\b/i, 2],
];

const CARD_SIGNS = [
  [/(?:^|\s)(?:ডাঃ|ডা\.|Dr\.?|Prof\.?|ডাক্তার)\s*[A-Za-zঀ-৿]/m, 2],
  [/\b(?:MBBS|FCPS|MRCP|MD|MS|BCS|FRCS|DCH|DGO|MCPS|MPH|PhD)\b/, 2],
  [/\b(?:chamber|appointment|visiting\s*hours?|consultant|specialist)\b|চেম্বার|সিরিয়াল|সাক্ষাতের\s*সময়/i, 2],
  [/\b(?:hospital|clinic|medical\s*college|diagnostic\s*center)\b|হাসপাতাল|ক্লিনিক/i, 1],
  [/(?:\+?880|0)\s*1[3-9][\d\s-]{8,11}/, 1],
];

function score(text, signs) {
  let s = 0;
  for (const [re, w] of signs) {
    const m = text.match(re);
    if (m) s += w * Math.min(m.length > 1 && re.global ? m.length : 1, 3);
  }
  return s;
}

/**
 * @param {string} rawText
 * @returns {{ type: "prescription"|"lab-report"|"visiting-card"|"unknown", confidence: "high"|"low", scores: {prescription:number, lab:number, card:number} }}
 */
export function classifyDocument(rawText) {
  const text = toEn(rawText).replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const scores = { prescription: score(text, RX_SIGNS), lab: score(text, LAB_SIGNS), card: score(text, CARD_SIGNS) };
  // ভিজিটিং কার্ড ছোট (কম লাইন); লম্বা লেখায় কার্ডের নম্বর কমানো হয়
  if (lines.length > 14) scores.card = Math.floor(scores.card / 3);
  else if (lines.length <= 12) scores.card += 1;
  if (lines.length < 2 || text.replace(/\s/g, "").length < 15) return { type: "unknown", confidence: "low", scores };

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = ranked[0];
  const second = ranked[1][1];
  if (topVal < 4) return { type: "unknown", confidence: "low", scores };
  const type = topKey === "lab" ? "lab-report" : topKey === "card" ? "visiting-card" : "prescription";
  // প্রথম-দ্বিতীয়ের ব্যবধান কম হলে অনিশ্চিত — হাতে বাছাই
  if (topVal - second < 2) return { type: "unknown", confidence: "low", scores };
  return { type, confidence: topVal - second >= 4 ? "high" : "low", scores };
}
