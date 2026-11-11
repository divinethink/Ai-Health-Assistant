// src/health/doc-ai/piiMask.js
//
// ধাপ ৪-খ(২) — বাইরের AI-তে পাঠানোর আগে রোগীর পরিচয় মুছে ফেলা (শুধু প্রেসক্রিপশন ও ল্যাব)।
// Pure logic। নীতি: সন্দেহ হলে মাস্ক করো (AI-র কাজের জন্য নাম/ফোন/ঠিকানা লাগে না)।
// ডাক্তারের নাম ("Dr./ডাঃ") ও ওষুধ/টেস্টের মান অক্ষত রাখা হয়। ভিজিটিং-কার্ডে মাস্ক নয়
// (কার্ডের তথ্যই আমাদের লক্ষ্য, রোগীর তথ্য নয়) — তাই সেখানে টেক্সট অপরিবর্তিত ফেরে।

const MASK = "[মাস্ক]";
const DOCTOR_LINE = /(?:^|\s)(?:ডাঃ|ডা\.|Dr\.?|Prof\.?|ডাক্তার)\s*\S/i;

// "লেবেল: মান" — লেবেলের পরের মান মুছবে (লেবেল থাকবে)
const LABEL_RE = new RegExp(
  "^(\\s*(?:patient(?:'s)?\\s*(?:name|id|no\\.?|code)?|pt\\.?\\s*name|name|রোগীর\\s*নাম|রোগীর\\s*আইডি|নাম|" +
  "age(?:\\s*/\\s*sex)?|sex|gender|dob|date\\s*of\\s*birth|বয়স|লিঙ্গ|জন্ম\\s*তারিখ|" +
  "address|ঠিকানা|guardian|father(?:'s)?\\s*name|husband|spouse|পিতার\\s*নাম|স্বামী|" +
  "nid|n\\.i\\.d|national\\s*id|passport|mrn|reg(?:istration)?\\.?\\s*(?:no|number|id)?|" +
  "hospital\\s*no|lab\\s*(?:id|no)|sample\\s*(?:id|no)|bill\\s*no|invoice\\s*no|ref(?:erred)?\\s*(?:by|no)?|mobile|phone|cell|contact|tel|email|e-mail|মোবাইল|ফোন|ইমেইল)" +
  "\\s*[:：\\-–]\\s*)(.+)$", "i"
);
const TITLE_NAME_RE = /^(\s*(?:mr|mrs|ms|miss|md|master|baby|মিসেস|মি\.|জনাব)\.?\s+)([A-Za-zঀ-৿][^\n,]{1,40})(.*)$/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?<![\d০-৯])(?:\+?[8৮][8৮][0০]|[0০])\s*[1১][3-9৩-৯][\d০-৯\s-]{8,11}(?![\d০-৯])/g;
const LONG_ID_RE = /(?<![\d০-৯.,])[\d০-৯]{9,}(?![\d০-৯])/g;
const AGE_SEX_RE = /\b\d{1,3}\s*(?:y|yrs?|years?|বছর)\b(?:\s*[/,]?\s*(?:m|f|male|female|পুরুষ|মহিলা))?/gi;

/**
 * @param {string} text
 * @param {string} docType - "prescription" | "lab-report" | "visiting-card" | অন্য
 * @returns {{ text: string, masked: number }} masked = কয়টি জায়গা বদলানো হয়েছে
 */
export function maskPii(text, docType) {
  const src = String(text || "");
  if (docType !== "prescription" && docType !== "lab-report") return { text: src, masked: 0 };
  let masked = 0;
  const hit = (s) => { masked++; return s; };
  const out = src.split(/\r?\n/).map((line) => {
    if (DOCTOR_LINE.test(line) && !LABEL_RE.test(line)) return line.replace(EMAIL_RE, () => hit(MASK)).replace(PHONE_RE, () => hit(MASK));
    let l = line;
    const lab = l.match(LABEL_RE);
    if (lab) {
      // "Name: ডাঃ ..." — ডাক্তারের লেবেল-লাইন (যেমন "Ref by: Dr. X") রাখা হয়: ডাক্তারের নাম রোগীর তথ্য নয়
      if (/^\s*ref(?:erred)?/i.test(lab[1]) && DOCTOR_LINE.test(lab[2])) return l;
      return hit(lab[1] + MASK);
    }
    const t = l.match(TITLE_NAME_RE);
    if (t) l = hit(t[1] + MASK + t[3]);
    return l.replace(EMAIL_RE, () => hit(MASK)).replace(PHONE_RE, () => hit(MASK))
      .replace(LONG_ID_RE, () => hit(MASK)).replace(AGE_SEX_RE, () => hit(MASK));
  }).join("\n");
  return { text: out, masked };
}
