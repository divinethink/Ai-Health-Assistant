// src/health/doc-ai/aiResultValidate.js
//
// ধাপ ৪-খ(৩) — AI-র ফেরত JSON কঠোরভাবে যাচাই: (ক) schema, (খ) **grounding** —
// প্রতিটি ওষুধ/মান/ফোন সত্যিই OCR-টেক্সটে আছে কি না। না থাকলে সেই ঘর/ভুক্তি বাদ।
// Pure logic। নীতি: AI কখনো ডোজ/সময়/মান বানাতে পারবে না; কিছু ভুল হলে নীরবে বাদ, ঠিক করা নয়।
// ফল শুধু প্রস্তাব — চূড়ান্ত সিদ্ধান্ত বিদ্যমান যাচাই-ফর্মে ব্যবহারকারীর।

const BN = "০১২৩৪৫৬৭৮৯";
const toEn = (s) => String(s ?? "").replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
const MAX_ITEMS = 40;
const MAX_STR = 120;

/** শব্দ-তুলনার জন্য: ছোট হাত, অঙ্ক ইংরেজি, শুধু অক্ষর-অঙ্ক */
const norm = (s) => toEn(s).toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, "");
const str = (v) => (typeof v === "string" ? v.trim().slice(0, MAX_STR) : "");

/** AI-র উত্তর থেকে JSON বের করা (```json বেড়া/আগে-পরে লেখা সহ্য করে)। ব্যর্থ হলে null */
export function parseAiJson(raw) {
  if (raw && typeof raw === "object") return raw;
  let s = String(raw ?? "").trim();
  if (!s) return null;
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { const v = JSON.parse(s); return v && typeof v === "object" ? v : null; } catch { /* নিচে চেষ্টা */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { const v = JSON.parse(s.slice(a, b + 1)); return v && typeof v === "object" ? v : null; } catch { return null; } }
  return null;
}

/** নামের প্রতিটি অর্থপূর্ণ শব্দ (৩+ অক্ষর) টেক্সটে আছে? (ছোট শব্দ ছাড়া নাম হলে পুরো নাম) */
function nameGrounded(name, hay) {
  const full = norm(name);
  if (full.length < 3) return false;
  if (hay.includes(full)) return true;
  const words = toEn(name).toLowerCase().split(/[^a-z0-9ঀ-৿]+/).filter((w) => w.length >= 3 && !/^(tab|tablet|cap|capsule|syp|syrup|inj|dr)$/.test(w));
  return words.length > 0 && words.every((w) => hay.includes(w));
}

/** সংখ্যা-টোকেন টেক্সটে আছে (যেমন "500 mg" → 500 ও mg পাশাপাশি/কাছাকাছি) */
function strengthGrounded(strength, hay) {
  const m = toEn(strength).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|μg|gm|g|ml|iu|unit|units|%)/);
  if (!m) return false;
  const unit = m[2].replace("μ", "µ");
  return hay.includes(m[1] + unit);
}

const patternRe = (p) => { const m = toEn(p).match(/(\d+(?:[./]\d+)?)\s*\+\s*(\d+(?:[./]\d+)?)\s*\+\s*(\d+(?:[./]\d+)?)/); return m ? m.slice(1, 4).join("+") : null; };
const hayOf = (text) => norm(text);
const rawOf = (text) => toEn(text).toLowerCase().replace(/\s+/g, "");

/**
 * প্রেসক্রিপশন: { medicines: [{ name, strength?, pattern?, days?, meal? }] }
 * @returns {{ items: Array<{name, strength, patternRaw, days, meal, source:"ai", dropped: string[]}>, droppedItems: number }}
 * name টেক্সটে না থাকলে পুরো ভুক্তি বাদ; strength/pattern/days টেক্সটে না থাকলে শুধু সেই ঘর null।
 */
export function validatePrescriptionAi(ai, ocrText) {
  const list = Array.isArray(ai?.medicines) ? ai.medicines.slice(0, MAX_ITEMS) : [];
  const hay = hayOf(ocrText), compact = rawOf(ocrText), spaced = toEn(ocrText).toLowerCase();
  const items = []; let droppedItems = 0;
  for (const m of list) {
    const name = str(m?.name);
    if (!nameGrounded(name, hay)) { droppedItems++; continue; }
    const dropped = [];
    let strength = str(m?.strength) || null;
    if (strength && !strengthGrounded(strength, compact)) { dropped.push("strength"); strength = null; }
    let patternRaw = null;
    const p = patternRe(str(m?.pattern));
    if (p) { if (compact.includes(p.replace(/\+/g, "+"))) patternRaw = p; else dropped.push("pattern"); }
    let days = null;
    if (m?.days != null && m.days !== "") {
      const n = Number(m.days);
      const ok = Number.isInteger(n) && n >= 1 && n <= 365 && new RegExp("(?:^|[^0-9.])" + n + "\\s*(?:days?|din|দিন|weeks?|wks?|সপ্তাহ|months?|মাস)", "i").test(spaced);
      if (ok) days = n; else dropped.push("days");
    }
    const meal = m?.meal === "before" || m?.meal === "after" ? m.meal : null;
    items.push({ name, strength, patternRaw, days, meal, source: "ai", dropped });
  }
  return { items, droppedItems };
}

/**
 * ল্যাব: { results: [{ name, value, unit? }] }
 * মান গ্রহণযোগ্য শুধু যদি টেক্সটের কোনো লাইনে নাম ও সেই সংখ্যা দুটোই থাকে।
 * @returns {{ items: Array<{name, value, unit, source:"ai"}>, droppedItems: number }}
 */
export function validateLabAi(ai, ocrText) {
  const list = Array.isArray(ai?.results) ? ai.results.slice(0, MAX_ITEMS) : [];
  const lines = toEn(ocrText).split(/\r?\n/).map((l) => ({ n: norm(l), c: toEn(l).toLowerCase().replace(/,/g, ".") }));
  const items = []; let droppedItems = 0;
  for (const r of list) {
    const name = str(r?.name);
    const value = typeof r?.value === "number" ? r.value : parseFloat(toEn(r?.value).replace(",", "."));
    const nn = norm(name);
    if (nn.length < 2 || !Number.isFinite(value)) { droppedItems++; continue; }
    const vs = String(value);
    const numRe = new RegExp("(?:^|[^0-9.])" + vs.replace(".", "\\.") + "(?![0-9])");
    const line = lines.find((l) => l.n.includes(nn) && numRe.test(l.c));
    if (!line) { droppedItems++; continue; }
    let unit = str(r?.unit) || null;
    if (unit && !line.c.replace(/\s+/g, "").includes(unit.toLowerCase().replace(/\s+/g, ""))) unit = null;
    items.push({ name, value, unit, source: "ai" });
  }
  return { items, droppedItems };
}

const CARD_KEYS = ["name", "specialtyCategory", "phone", "area", "hospital", "chamberAddress"];

/**
 * ভিজিটিং কার্ড: { name, specialtyCategory, phone, area, hospital, chamberAddress }
 * phone-এর অঙ্কগুলো টেক্সটের অঙ্ক-ধারায় থাকতে হবে; বাকি ঘরের প্রতিটি শব্দ টেক্সটে থাকতে হবে।
 * @returns {{ fields: object, dropped: string[] }} — না-মেলা ঘর ""
 */
export function validateCardAi(ai, ocrText) {
  const hay = hayOf(ocrText), digits = toEn(ocrText).replace(/\D/g, "");
  const fields = {}, dropped = [];
  for (const k of CARD_KEYS) {
    const v = str(ai?.[k]);
    let ok = false;
    if (v) {
      if (k === "phone") { const d = toEn(v).replace(/\D/g, ""); ok = d.length >= 7 && d.length <= 13 && digits.includes(d.replace(/^88/, "")); }
      else if (k === "specialtyCategory") ok = true; // বিভাগ-ক্যাটাগরি টেক্সটের হুবহু অংশ নাও হতে পারে; পরে তালিকার সাথে মেলানো হবে
      else ok = nameGrounded(v, hay);
    }
    fields[k] = ok ? v : "";
    if (v && !ok) dropped.push(k);
  }
  return { fields, dropped };
}
