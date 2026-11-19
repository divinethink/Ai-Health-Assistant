// MyCare — অ্যাপের বিদ্যমান তথ্য (সদস্য, স্বাস্থ্য-রেকর্ড, যত্ন-প্রোফাইল) → ইঞ্জিনের profile। pure (UI/DB-মুক্ত)।
// নীতি: জানা নয় = null (careGroups-এর "অজানা=সীমিত")। রেকর্ড পড়া ব্যর্থ হলে অ্যালার্জি অজানা ধরা হয়।
import { getAgeInYears } from "../triage/triageEngine.js";
import { pregnancyRecordsOf, detectFlagsFromConditions } from "../tracker/trackerCalc.js";
import { AGE_BANDS } from "./careLabels.js";

const LIVER_RE = /liver|cirrhosis|hepat|লিভার|সিরোসিস|হেপাটাইটিস|কলিজা/i;

function liverOf(records) {
  return (records || []).some((r) => r.resourceType === "condition" && r.status !== "resolved" && LIVER_RE.test(r.name || ""));
}

// নারীর গর্ভাবস্থা-রেকর্ড কখনো না থাকলে "অজানা" (null) — নিশ্চিত "না" ধরা হয় না; পুরুষ = false।
function pregnantOf(sex, records) {
  if (sex === "male") return false;
  if (sex !== "female") return null;
  const recs = pregnancyRecordsOf(records);
  return recs.length ? recs.some((r) => r.status !== "resolved") : null;
}

export function buildOwnProfile({ member, records, recordsOk, prefs }) {
  const m = member || {};
  const p = prefs || {};
  const sex = m.sex === "male" || m.sex === "female" ? m.sex : null;
  const age = getAgeInYears(m.dob);
  const ok = recordsOk === true && Array.isArray(records);
  const flags = ok ? detectFlagsFromConditions(records) : { kidney: false };
  return {
    ageYears: age, sex,
    allergies: ok ? records.filter((r) => r.resourceType === "allergy").map((r) => r.substance).filter(Boolean) : null,
    pregnant: ok ? pregnantOf(sex, records) : null,
    breastfeeding: sex === "female" ? (p.breastfeeding === true ? true : p.breastfeeding === false ? false : null) : false,
    kidney: !!flags.kidney, liver: ok ? liverOf(records) : false,
    skinType: p.skinType || null, hairType: p.hairType || null,
    avoidIngredients: p.avoidIngredients || [], preferences: p.preferences || [],
  };
}

export const splitIngredients = (s) => String(s || "").split(/[,\n;،]+/).map((x) => x.trim()).filter(Boolean).slice(0, 20);

// "অন্যের জন্য" — শুধু ফর্মের মান (মেমরি); মূল সদস্যের কিছু মেশে না।
// অ্যালার্জি ফাঁকা + "নেই" নিশ্চিত না হলে = অজানা (null) → শুধু মূল নিরাপদ সেট।
export function buildOtherProfile(f) {
  const band = AGE_BANDS.find((b) => b[0] === f.ageBand);
  const sex = f.sex === "male" || f.sex === "female" ? f.sex : null;
  const listed = splitIngredients(f.allergyText);
  const allergies = listed.length ? listed : f.noAllergy === true ? [] : null;
  const nursing = sex === "female" && f.pregnantOrNursing === true;
  return {
    ageYears: band ? band[3] : null, sex, allergies,
    pregnant: sex === "female" ? (f.pregnantOrNursing === true ? true : f.pregnantOrNursing === false ? false : null) : false,
    breastfeeding: sex === "female" ? nursing : false,
    kidney: false, liver: false,
    skinType: f.skinType || null, hairType: f.hairType || null,
    avoidIngredients: [], preferences: [],
  };
}

// প্রোফাইল-কার্ডের অগ্রগতি (০–১০০) ও "সম্পূর্ণ" কিনা
export function prefsProgress(prefs) {
  const p = prefs || {};
  const slots = [!!p.skinType, !!p.hairType, (p.skinConcerns || []).length > 0, (p.hairConcerns || []).length > 0, (p.oralConcerns || []).length > 0];
  const done = slots.filter(Boolean).length;
  return { percent: Math.round((done / slots.length) * 100), complete: !!p.skinType && !!p.hairType };
}
