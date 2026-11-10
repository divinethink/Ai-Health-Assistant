// "+ দ্রুত যোগ" (ধাপ ৯) → গন্তব্য-স্ক্রিনকে "এই ফর্মটা খুলুন" জানানোর হালকা এক-বার-ব্যবহারের বার্তা।
// state/Firestore নেই; ৫ সেকেন্ডের পর মেয়াদ শেষ (পুরনো বার্তা পরে হঠাৎ ফর্ম খুলবে না)। গন্তব্য take করলে মুছে যায়।
let cur = null;
const TTL_MS = 5000;

export function setQuickIntent(kind) { cur = { kind, at: Date.now() }; }

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
