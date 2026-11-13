// appDesign.js — গ্লোবাল অ্যাপ ডিজাইন (App Creator-এর সাজানো; সব সদস্য একই দেখেন)।
// ডক: appDesign/layout { pages:{home:{main:[…]}, trend:{top:[…],week:[…]}}, updatedAt, updatedBy }
// পড়া: যেকোনো সাইন-ইন সদস্য (ব্যর্থ হলে ডিফল্ট লেআউট — আগের আচরণ হুবহু)। লেখা: শুধু App Creator (Rules-এ enforced)।
// শুধু যে পেজ বদলেছে সেটাই merge-লেখা হয়; অন্য পেজ অক্ষুণ্ণ। একবার fetch, মেমরিতে cache; সেভের পর সবাইকে জানানো হয়।
import { db, auth } from "./firebaseConfig.js";
import { BLOG_ADMIN_UID } from "../health/wellness-guide/wellnessGuideData.js";
import { PAGE_IDS, zonesOf, sanitizePage } from "../shared/pageLayout.js";

const { useState, useEffect } = React;

// শুধু UI দেখানোর জন্য — আসল নিয়ন্ত্রণ firestore.rules-এর isBlogAdmin()/App Creator (একই UID)।
export const isAppCreatorUid = (uid) => !!uid && uid === BLOG_ADMIN_UID;

let cache = { pages: null }; // pages = সেভ-করা raw ম্যাপ (বা null = ডিফল্ট)
let started = false;
const subs = new Set();
const notify = () => subs.forEach((f) => { try { f(); } catch (_e) { /* উপেক্ষা */ } });

async function fetchDesign() {
  try {
    const snap = await db.collection("appDesign").doc("layout").get();
    const data = snap.exists ? snap.data() : null;
    cache = { pages: data && data.pages && typeof data.pages === "object" ? data.pages : null };
  } catch (_e) {
    cache = { pages: null }; // read ব্যর্থ → ডিফল্ট
  }
  notify();
}

/** পেজের বৈধ লেআউট { zone: cards[] }; ডক না থাকলে/অবৈধ হলে ডিফল্ট। */
export function useAppDesign(page) {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    if (!started) { started = true; fetchDesign(); }
    return () => { subs.delete(f); };
  }, []);
  return sanitizePage(page, cache.pages);
}

/** শুধু এই পেজের লেআউট লেখা (merge)। layout = { zone: cards[] } */
export async function saveDesignPage(page, layout) {
  if (!PAGE_IDS.includes(page)) throw new Error("অচেনা পেজ");
  const user = auth.currentUser;
  if (!user) throw new Error("সাইন-ইন প্রয়োজন");
  const clean = {};
  zonesOf(page).forEach((z) => { clean[z] = (layout[z] || []).map((c) => ({ id: c.id, visible: !!c.visible, fold: c.fold })); });
  await db.collection("appDesign").doc("layout").set(
    { pages: { [page]: clean }, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: user.uid },
    { merge: true }
  );
  cache = { pages: { ...(cache.pages || {}), [page]: clean } };
  notify();
}
