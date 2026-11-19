// MyCare — প্যাচ টেস্ট স্মরণ (pure; React/Storage-মুক্ত)। নতুন পণ্যের প্যাচ টেস্ট শুরুর ২৪ ঘণ্টা পরে অ্যাপে "ত্বক কেমন আছে?" জিজ্ঞেস করা হয়।
// সংরক্ষণ শুধু এই ডিভাইসে (carePatchStore.js): আইটেম-id ও শুরুর সময়। Firestore/rules বদল নেই, কোনো ব্যক্তিগত তথ্য নেই।
export const PATCH_AFTER_MS = 24 * 3600 * 1000; // স্মরণ আসার সময়
export const SNOOZE_MS = 6 * 3600 * 1000;       // "পরে মনে করান"
export const EXPIRE_MS = 7 * 24 * 3600 * 1000;  // উত্তর না দিলে ৭ দিন পরে নিজে মুছে যায়
export const PATCH_MAX = 5;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

// আইটেমে প্যাচ টেস্টের নির্দেশ আছে কি (সতর্কতা বা "কীভাবে"-র লেখা থেকে)
export function needsPatchTest(item) {
  if (!item) return false;
  const parts = [...(item.warnings || []), item.how].filter(Boolean);
  return parts.some((w) => {
    const o = typeof w === "string" ? { en: w, bn: w } : w;
    return /patch[- ]test/i.test(o.en || "") || /লাগিয়ে দেখুন/.test(o.bn || "");
  });
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

// ভুল/নষ্ট ডেটা বাদ; সর্বোচ্চ PATCH_MAX; id অনন্য
export function sanitizePatchList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set(), out = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || !ID_RE.test(String(x.id)) || seen.has(x.id) || num(x.at) == null) continue;
    seen.add(x.id);
    out.push({ id: x.id, at: x.at, ...(num(x.until) != null ? { until: x.until } : {}) });
    if (out.length >= PATCH_MAX) break;
  }
  return out;
}

// শুরু করা (আগে থাকলে নতুন করে শুরু); সীমা ছাড়ালে সবচেয়ে পুরনোটি বাদ
export function startPatch(list, id, now) {
  if (!ID_RE.test(String(id))) return sanitizePatchList(list);
  const rest = sanitizePatchList(list).filter((x) => x.id !== id);
  return [{ id, at: now }, ...rest].slice(0, PATCH_MAX);
}
export const finishPatch = (list, id) => sanitizePatchList(list).filter((x) => x.id !== id);
export const snoozePatch = (list, id, now) => sanitizePatchList(list).map((x) => (x.id === id ? { ...x, until: now + SNOOZE_MS } : x));

// অবস্থা: "waiting" (২৪ ঘণ্টা হয়নি) | "due" (জিজ্ঞেস করার সময়) | "expired" | null (তালিকায় নেই)
export function patchState(list, id, now) {
  const x = sanitizePatchList(list).find((p) => p.id === id);
  if (!x) return null;
  if (now - x.at > EXPIRE_MS) return "expired";
  return now >= Math.max(x.at + PATCH_AFTER_MS, x.until || 0) ? "due" : "waiting";
}
export const duePatches = (list, now) => sanitizePatchList(list).filter((x) => patchState([x], x.id, now) === "due");
// মেয়াদ-শেষ বাদ দিয়ে পরিষ্কার তালিকা (লোডের সময়)
export const pruneExpired = (list, now) => sanitizePatchList(list).filter((x) => now - x.at <= EXPIRE_MS);
