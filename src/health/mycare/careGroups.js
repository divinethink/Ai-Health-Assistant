// MyCare — প্রোফাইল স্বাভাবিকীকরণ, বিশেষ গ্রুপ ও "অজানা" নীতি। pure।
// null = অজানা (নিরাপদ ধরা হয় না)। adapter (ধাপ ৪) স্পষ্টভাবে জানা মান দেবে:
// pregnant:false শুধু যখন অ্যাপে "গর্ভবতী নন" নিশ্চিত; allergies:[] শুধু যখন অ্যালার্জি-তালিকা যাচাই হয়েছে।
import { norm } from "./careSchema.js";

const bool = (v) => (v === true ? true : v === false ? false : null);
const list = (v) => (Array.isArray(v) ? v.map(norm).filter(Boolean) : []);

export function normalizeProfile(raw) {
  const r = raw || {};
  const age = typeof r.ageYears === "number" && isFinite(r.ageYears) && r.ageYears >= 0 ? r.ageYears : null;
  return {
    ageYears: age,
    sex: r.sex === "male" || r.sex === "female" ? r.sex : null,
    pregnant: bool(r.pregnant),
    breastfeeding: bool(r.breastfeeding),
    kidney: r.kidney === true,
    liver: r.liver === true,
    allergies: Array.isArray(r.allergies) ? list(r.allergies) : null,
    avoidIngredients: list(r.avoidIngredients),
    skinType: r.skinType || null,
    hairType: r.hairType || null,
    preferences: Array.isArray(r.preferences) ? r.preferences : [],
  };
}

export function groupsOf(p) {
  const g = new Set();
  if (p.ageYears != null && p.ageYears < 2) g.add("under2");
  if (p.ageYears != null && p.ageYears < 18) g.add("under18");
  if (p.pregnant === true) g.add("pregnancy");
  if (p.breastfeeding === true) g.add("breastfeeding");
  if (p.kidney) g.add("kidney");
  if (p.liver) g.add("liver");
  return g;
}

// কোন তথ্য অজানা — অজানা থাকলে শুধু মূল নিরাপদ সেট।
export function unknownsOf(p) {
  const u = [];
  if (p.ageYears == null) u.push("age");
  if (p.allergies == null) u.push("allergy");
  if (p.sex === "female" && p.ageYears != null && p.ageYears >= 12 && p.ageYears <= 50 && p.pregnant == null) u.push("pregnancy");
  if (p.sex == null && p.ageYears != null && p.ageYears >= 12) u.push("sex");
  return u;
}
