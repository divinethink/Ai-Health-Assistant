// Observation গ্রুপ/ট্রেন্ড — pure logic (টেস্টযোগ্য, firebase নির্ভর নয়)।

// height/weight-এর ইংরেজি-বাংলা দুই বানানই এক গ্রুপে
function obsGroupKey(r) {
  const s = (r.type || "").trim().toLowerCase();
  if (s === "উচ্চতা") return "height";
  if (s === "ওজন") return "weight";
  if (s === "blood pressure") return "রক্তচাপ"; // পুরনো ইংরেজি রেকর্ড ও নতুন বাংলা একই গ্রুপে
  if (s === "blood sugar") return "রক্তের শর্করা";
  return s;
}
// ইউনিট দেখানোর বাংলা (শুধু দেখানো; সংরক্ষিত মান বদলায় না)
export function unitLabelBn(u) {
  const k = String(u || "").trim().toLowerCase();
  return k === "kg" ? "কেজি" : k === "cm" ? "সেমি" : (u || "");
}
// অ্যাপ-তৈরি type-এর বাংলা নাম (কাঁচা slug দেখানো হয় না)
const OBS_LABELS_BN = { "stool-bristol": "পেটের লক্ষণ (Bristol)", "রক্তচাপ": "রক্তচাপ", "রক্তের শর্করা": "রক্তের শর্করা" };
function obsLabel(key, sample) {
  if (OBS_LABELS_BN[key]) return OBS_LABELS_BN[key];
  if (key === "height") return "উচ্চতা";
  if (key === "weight") return "ওজন";
  return (sample.type || "").trim();
}

// পরিমাপ গ্রুপ করা — প্রতি ধরনে নতুন→পুরনো (তারিখ, সমান হলে createdAt-ক্রম; list আগে থেকেই createdAt DESC)
export function groupObservations(records) {
  const map = new Map();
  records.filter((r) => r.resourceType === "observation").forEach((r) => {
    const k = obsGroupKey(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return Array.from(map.entries()).map(([key, items]) => {
    const sorted = items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return { key, label: obsLabel(key, sorted[0]), items: sorted };
  });
}

// সর্বশেষ বনাম আগের মান — দুটোই সংখ্যা ও আলাদা হলে { dir: "up"|"down", diff }, নইলে null
// উচ্চতা বড়দের ক্ষেত্রে বদলায় না — ভুল-এন্ট্রি সংশোধনে ↑↓ বিভ্রান্তিকর, তাই কোনো তীর নয়
export function obsTrend(items) {
  if (items.length < 2) return null;
  if (obsGroupKey(items[0]) === "height") return null;
  const a = parseFloat(items[0].value), b = parseFloat(items[1].value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = Math.round((a - b) * 10) / 10;
  if (diff === 0) return null;
  return { dir: diff > 0 ? "up" : "down", diff: Math.abs(diff) };
}
