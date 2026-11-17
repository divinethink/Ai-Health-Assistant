// সাধারণ চিকিৎসা: নির্বাচিত সদস্যের জন্য ডোজ — শুধু verified Medicine DB + বিদ্যমান doseEnforcement থেকে।
// pure (Firebase/UI-মুক্ত)। নিজে কোনো ডোজ বানায় না; DB-তে না থাকলে/Tier-২ হলে/অমিল হলে দেখায় না (safe-default)।
import { resolveDoseForMember } from "../../legacy/doseEnforcement.js";

const BLOCK_MSG = {
  "no-verified-data": "এই ওষুধের যাচাই-করা ডোজ ডাটাবেসে নেই — ডাক্তার/ফার্মাসিস্টের পরামর্শ নিন।",
  "requires-consult": "এই ওষুধের ডোজ অ্যাপ দেখায় না — ডাক্তারের পরামর্শ নিন।",
  "interaction-flag": "চলমান ওষুধের সাথে গুরুতর মিথস্ক্রিয়ার সম্ভাবনা — ডোজ দেখানো হচ্ছে না, ডাক্তার/ফার্মাসিস্টকে জিজ্ঞেস করুন।",
  "high-risk-flag": "ঝুঁকিপূর্ণ ওষুধ — ডোজ দেখানো হচ্ছে না, ডাক্তারের পরামর্শ নিন।",
  "no-matching-age-rule": "এই বয়সের জন্য যাচাই-করা ডোজ নেই (বা জন্মতারিখ যোগ করা নেই) — ডাক্তার/ফার্মাসিস্টের পরামর্শ নিন।",
  "note-only-no-dose": "এই বয়সে সাধারণত নিরুৎসাহিত/ডাক্তারের পরামর্শ লাগে — ডোজ দেখানো হচ্ছে না।",
};

// ফল: { blocked, message?, lines[], warnings[] } — UI শুধু রেন্ডার করে।
export function careDoseView({ entry, ageYears, allergySubstances = [], activeMedicationNames = [] }) {
  const r = resolveDoseForMember({ medicineEntry: entry || null, ageYears, allergySubstances, activeMedicationNames });
  if (r.blocked) {
    const warnings = r.reason === "note-only-no-dose" && r.note ? [r.note] : [];
    return { blocked: true, message: BLOCK_MSG[r.reason] || BLOCK_MSG["no-verified-data"], lines: [], warnings };
  }
  const perKg = /kg/i.test(String(r.dose));
  const lines = [
    "মাত্রা: " + r.dose + (perKg ? " (ওজন অনুযায়ী — সঠিক সংখ্যা ডাক্তার/ফার্মাসিস্টকে জিজ্ঞেস করুন)" : ""),
    r.frequency && "কতক্ষণ পরপর: " + r.frequency,
    r.maxDailyDose && "দিনে সর্বোচ্চ: " + r.maxDailyDose,
    r.maxDurationDays && "সর্বোচ্চ কতদিন: " + r.maxDurationDays + " দিন",
    r.note && "নোট: " + r.note,
  ].filter(Boolean);
  const warnings = [];
  if (r.allergyWarning) warnings.push("⚠ প্রোফাইলের এলার্জির সাথে নাম মিলতে পারে — ব্যবহারের আগে নিশ্চিত হন।");
  (r.interactionWarnings || []).forEach((f) => warnings.push("⚠ চলমান " + f.withGenericName + "-এর সাথে: " + f.note));
  if (r.contraindications && r.contraindications.length) warnings.push("নয়: " + r.contraindications.join("; "));
  return { blocked: false, lines, warnings, source: (r.source || []).join(" · ") };
}

// "আমার তালিকায় নিন"-এ ফর্মে আগে-থেকে বসানোর মান। ডোজ শুধু verified DB থেকে (careDoseView-র একই নিয়ম);
// ওজন-ভিত্তিক (mg/kg) হলে সংখ্যা নিজে বসানো হয় না — ভুল ডোজ সেভ হওয়ার ঝুঁকি। ফল: { fill: {dose,frequency,note}|null, message, warnings[] }
export function careDosePrefill({ entry, ageYears, allergySubstances = [], activeMedicationNames = [] }) {
  const r = resolveDoseForMember({ medicineEntry: entry || null, ageYears, allergySubstances, activeMedicationNames });
  if (r.blocked) return { fill: null, message: BLOCK_MSG[r.reason] || BLOCK_MSG["no-verified-data"], warnings: r.reason === "note-only-no-dose" && r.note ? [r.note] : [] };
  const warnings = [];
  if (r.allergyWarning) warnings.push("⚠ প্রোফাইলের এলার্জির সাথে নাম মিলতে পারে — ব্যবহারের আগে নিশ্চিত হন।");
  (r.interactionWarnings || []).forEach((f) => warnings.push("⚠ চলমান " + f.withGenericName + "-এর সাথে: " + f.note));
  if (/kg/i.test(String(r.dose))) return { fill: null, message: "এই বয়সে ডোজ ওজন অনুযায়ী (" + r.dose + ") — সঠিক সংখ্যা ডাক্তার/ফার্মাসিস্টকে জিজ্ঞেস করে নিজে লিখুন।", warnings };
  return { fill: { dose: String(r.dose), frequency: r.frequency ? String(r.frequency) : "", note: r.maxDailyDose ? "দিনে সর্বোচ্চ: " + r.maxDailyDose : "" }, message: null, warnings };
}
