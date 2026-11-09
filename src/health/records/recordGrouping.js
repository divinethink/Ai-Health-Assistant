// Observation গ্রুপ/ট্রেন্ড — pure logic (টেস্টযোগ্য, firebase নির্ভর নয়)।

// height/weight-এর ইংরেজি-বাংলা দুই বানানই এক গ্রুপে
function obsGroupKey(r) {
  const s = (r.type || "").trim().toLowerCase();
  if (s === "উচ্চতা") return "height";
  if (s === "ওজন") return "weight";
  return s;
}
function obsLabel(key, sample) {
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
export function obsTrend(items) {
  if (items.length < 2) return null;
  const a = parseFloat(items[0].value), b = parseFloat(items[1].value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = Math.round((a - b) * 10) / 10;
  if (diff === 0) return null;
  return { dir: diff > 0 ? "up" : "down", diff: Math.abs(diff) };
}
