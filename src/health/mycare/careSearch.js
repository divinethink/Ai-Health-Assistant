// MyCare — বিভাগ-পেজের খোঁজ (pure)। শুধু ইঞ্জিন যা দেখাতে দিয়েছে (নিরাপদ তালিকা) তার ভেতরেই খোঁজে; লুকানো আইটেম কখনো ফেরে না।
import { norm } from "./careSchema.js";
import { LABELS } from "./careLabels.js";

const CONCERN_GROUPS = [LABELS.skinConcerns, LABELS.hairConcerns, LABELS.oralConcerns];
const concernText = (id) => CONCERN_GROUPS.map((g) => g && g[id] ? g[id].bn + " " + g[id].en : "").join(" ");
const bl = (o) => (o ? (o.bn || "") + " " + (o.en || "") : "");

export function haystackOf(item) {
  return norm([bl(item.name), bl(item.how), bl(item.why), ...(item.ingredientAliases || []), ...(item.forConcerns || []).map(concernText)].join(" "));
}

// সব শব্দ মিলতে হবে (AND); ফাঁকা খোঁজ = সব
export function filterBySearch(entries, query) {
  const tokens = norm(query).split(" ").filter(Boolean);
  if (!tokens.length) return entries;
  return entries.filter((e) => { const h = haystackOf(e.item); return tokens.every((t) => h.includes(t)); });
}
