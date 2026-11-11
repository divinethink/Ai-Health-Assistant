// লক্ষণ-যাচাই: চেকলিস্ট-আইটেমকে ২–৩ গ্রুপে সাজানো (ধাপ ৩)। শুধু প্রদর্শন — triageEngine-এর আইটেম/id/নিয়ম অপরিবর্তিত।
// নিরাপত্তা: প্রতিটি আইটেম ঠিক একবার আসে (কোনো গ্রুপে না পড়লে "অন্যান্য"-তে), তাই কোনো লক্ষণ লুকিয়ে যায় না। টেস্ট: tests/shared/triageGroups.test.mjs

const ADULT_GROUPS = [
  { key: "chest", icon: "❤️", title: "বুক ও শ্বাস", ids: ["chestPain", "breathingDifficulty"] },
  { key: "stroke", icon: "⚡", title: "স্ট্রোকের লক্ষণ (FAST)", ids: ["oneSidedWeakness", "slurredSpeech", "facialDroop"] },
  { key: "other", icon: "🩸", title: "রক্তক্ষরণ, অজ্ঞান ও অ্যালার্জি", ids: ["severeBleeding", "unresponsive", "severeAllergicReaction"] },
];

// items: engine-এর getChecklistForAgeGroup() ফল; pediatric হলে এক গ্রুপ (আইটেম মাত্র ৫টা)
export function groupChecklistItems(items, pediatric) {
  const list = Array.isArray(items) ? items : [];
  if (pediatric) return list.length ? [{ key: "child", icon: "🧒", title: "শিশুর বিপদ-চিহ্ন", items: list }] : [];
  const used = new Set();
  const groups = ADULT_GROUPS.map((g) => ({ key: g.key, icon: g.icon, title: g.title, items: g.ids.map((id) => list.find((it) => it.id === id)).filter(Boolean) }));
  groups.forEach((g) => g.items.forEach((it) => used.add(it.id)));
  const rest = list.filter((it) => !used.has(it.id)); // engine-এ নতুন আইটেম এলে হারাবে না
  if (rest.length) groups[groups.length - 1].items.push(...rest);
  return groups.filter((g) => g.items.length);
}
