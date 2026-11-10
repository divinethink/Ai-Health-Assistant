// সদস্যের স্বাস্থ্য-রেকর্ডের শেয়ার্ড cache (pure — Firebase/React নেই, unit-testable)।
// উদ্দেশ্য: ট্র্যাকার, টাইমলাইন, এক্সপোর্ট, ট্রেন্ড ইত্যাদি প্রতিটা স্ক্রিন একই সদস্যের রেকর্ড
// আলাদা আলাদা করে না পড়ে একবার পড়ে ভাগ করে নেবে (Firestore read কমে, স্ক্রিনে একই তথ্য দেখায়)।
//
// নিরাপত্তা-নিয়ম:
//  - cache শুধু মেমরিতে (পেজ রিলোডে/লগআউটে মুছে যায়); কোথাও persist হয় না।
//  - সব লেখা (create/update/delete/restore) শেষে invalidate হয়; চলমান পুরনো fetch-এর ফল আর cache-এ ঢোকে না।
//  - TTL ছোট (১৫ সেকেন্ড) — অন্য ডিভাইসের বদল দ্রুত আসে। নিরাপত্তা-সংবেদনশীল পাঠে (AI/triage/ওষুধ-duplicate/
//    ডাক্তার-এক্সপোর্ট) `{ fresh: true }` দিয়ে cache এড়িয়ে সরাসরি সার্ভার থেকে পড়া হয়।
//  - প্রতিবার নতুন array ফেরত যায় (ভেতরের object শেয়ার্ড — কলারদের object বদলানো চলবে না)।

export const TTL_MS = 15000;

const cache = new Map(); // key → { at, records } | { promise }
const tokens = new Map(); // key → সর্বশেষ শুরু-হওয়া fetch-এর টোকেন
const listeners = new Set();
let seq = 0;

const keyOf = (familyId, memberId) => familyId + "|" + memberId;
const copy = (records) => records.slice();

// fetcher: () => Promise<records[]>; opts: { fresh, now }
export function getMemberRecords(familyId, memberId, fetcher, opts = {}) {
  const now = opts.now || Date.now;
  const key = keyOf(familyId, memberId);
  const e = cache.get(key);
  if (!opts.fresh && e) {
    if (e.promise) return e.promise.then(copy);
    if (now() - e.at < TTL_MS) return Promise.resolve(copy(e.records));
  }
  const token = ++seq;
  tokens.set(key, token);
  const promise = fetcher().then(
    (records) => {
      if (tokens.get(key) === token) cache.set(key, { at: now(), records });
      return records;
    },
    (err) => {
      if (tokens.get(key) === token) { cache.delete(key); tokens.delete(key); }
      throw err;
    }
  );
  cache.set(key, { promise });
  return promise.then(copy);
}

function notify(familyId, memberId) {
  listeners.forEach((fn) => { try { fn({ familyId, memberId }); } catch (_e) { /* উপেক্ষা */ } });
}

// memberId না দিলে ওই পরিবারের সব সদস্যের cache মোছে (যেমন update-এ recordId থেকে সদস্য জানা যায় না)।
export function invalidateMemberHealth(familyId, memberId) {
  const prefix = familyId + "|";
  [...cache.keys()].forEach((k) => {
    if (memberId ? k === keyOf(familyId, memberId) : k.startsWith(prefix)) { cache.delete(k); tokens.delete(k); }
  });
  [...tokens.keys()].forEach((k) => {
    if (memberId ? k === keyOf(familyId, memberId) : k.startsWith(prefix)) tokens.delete(k);
  });
  notify(familyId, memberId || null);
}

// লগআউট/সম্পূর্ণ রিস্টোরের পর সব মোছা।
export function clearMemberHealthCache() {
  cache.clear();
  tokens.clear();
  notify(null, null);
}

export function subscribeMemberHealth(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
