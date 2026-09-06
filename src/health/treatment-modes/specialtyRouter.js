// Medical Science — Specialty-Context Routing (roadmap §4.1, P6 ধাপ ৩)।
// সম্পূর্ণ deterministic, age-group + symptom-keyword ভিত্তিক — কোনো AI-call
// লাগে না, ব্যবহারকারীর সামনে কোনো "specialty বেছে নিন" UI নেই (§4.1: "system
// নিজে প্রাসঙ্গিক specialty context লোড করবে")। এই routing শুধু worker-এ পাঠানো
// একটা soft context-hint (§6.6 payload-এর নতুন `specialty` field) — কোনো
// triage/safety-rule কখনো bypass/override করে না।

import { isPediatricAgeGroup } from "../triage/triageEngine.js";

export const SPECIALTY_LABELS = {
  pediatrics: "শিশু-বিশেষজ্ঞ (Pediatrics)",
  "gynecology-obstetrics": "গাইনি ও প্রসূতি-বিদ্যা",
  dermatology: "চর্ম/রূপচর্চা (Dermatology)",
  "endocrinology-medicine": "হরমোন/মেডিসিন (Endocrinology/Medicine)",
  "physical-medicine": "ফিজিক্যাল মেডিসিন (হাড়/জোড়া/মাংসপেশি)",
  "general-medicine": "সাধারণ মেডিসিন",
};

// priority-ক্রমে — একটার বেশি keyword মিললে তালিকার প্রথমটাই জেতে (deterministic)।
const KEYWORD_MAP = [
  ["dermatology", ["ত্বক", "চুল", "নখ", "চর্ম", "মেছতা", "vitiligo", "একজিমা", "rash", "চুলকানি", "ব্রণ", "skin", "hair"]],
  ["gynecology-obstetrics", ["মাসিক", "পিরিয়ড", "গর্ভ", "প্রেগনেন্সি", "pregnan", "যোনি", "স্তন", "menstru"]],
  ["endocrinology-medicine", ["থাইরয়েড", "thyroid", "ডায়াবেটিস", "diabetes", "সুগার", "রক্তচাপ", "hypertension", "hormone", "হরমোন"]],
  ["physical-medicine", ["জয়েন্ট", "হাড়", "কোমর", "ঘাড়", "মাংসপেশি", "বাত", "arthritis", "কাঁধ", "হাঁটু", "joint"]],
];

/**
 * @param {{ ageGroup?: string|null, symptoms?: string|null, relevantConditions?: string[] }} params
 * @returns {string} specialty key (SPECIALTY_LABELS-এর কোনো একটা)
 */
export function detectSpecialty({ ageGroup, symptoms, relevantConditions = [] } = {}) {
  // Age-based rule সবচেয়ে নির্ভরযোগ্য signal — keyword-scan-এর আগে চেক হয়।
  if (isPediatricAgeGroup(ageGroup)) return "pediatrics";

  const text = [symptoms, ...(relevantConditions || [])].filter(Boolean).join(" ").toLowerCase();
  if (text) {
    for (const [specialty, keywords] of KEYWORD_MAP) {
      if (keywords.some((kw) => text.includes(kw.toLowerCase()))) return specialty;
    }
  }
  return "general-medicine";
}
