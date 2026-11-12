// "+ দ্রুত যোগ" (ধাপ ৯) → গন্তব্য-স্ক্রিনকে "এই ফর্মটা খুলুন" জানানোর হালকা এক-বার-ব্যবহারের বার্তা।
// state/Firestore নেই; ৫ সেকেন্ডের পর মেয়াদ শেষ (পুরনো বার্তা পরে হঠাৎ ফর্ম খুলবে না)। গন্তব্য take করলে মুছে যায়।
let cur = null;
const TTL_MS = 5000;

export function setQuickIntent(kind) { cur = { kind, at: Date.now() }; }

// "কোন ট্যাব থেকে + চাপা হয়েছিল" — ফুল-পেজ ফর্ম ✕ দিয়ে বন্ধ করলে সেখানেই ফেরার জন্য (স্ট্যান্ডার্ড: যেখান থেকে খুলেছেন, সেখানেই ফেরা)।
// এক-বার-ব্যবহার + একই ৫ সেকেন্ড মেয়াদ; গন্তব্য কম্পোনেন্ট মাউন্টে take করে নিজের কাছে রাখে। ফেরা = ফোনের Back-এর সমান (history.back)।
let origin = null;
export function setQuickOrigin(tab) { origin = tab ? { tab, at: Date.now() } : null; }
export function takeQuickOrigin() {
  const o = origin; origin = null;
  return o && Date.now() - o.at <= TTL_MS ? o.tab : null;
}
export function quickReturn() { try { window.history.back(); } catch (_e) { /* উপেক্ষা */ } }

export function peekQuickIntent(kinds) {
  if (!cur) return null;
  if (Date.now() - cur.at > TTL_MS) { cur = null; return null; }
  return !kinds || kinds.includes(cur.kind) ? cur.kind : null;
}

export function takeQuickIntent(kinds) {
  const k = peekQuickIntent(kinds);
  if (k) cur = null;
  return k;
}
