// Herbal/Homeopathy RemedyEntry — global (family-independent) read layer,
// Architecture Plan Part B §5.2, populateRemedyDb.js-এর সাথে সহ-দলিল।
//
// **নিরাপত্তা-নোট:** `remedyDatabase` rules বর্তমানে `status` অনুযায়ী gate করে
// না (medicineDatabase-এর মতো `status == 'verified'` rules-level enforcement
// নেই) — তাই এই client-side filter-ই একমাত্র safeguard যাতে unverified draft
// entry কখনো ব্যবহারকারীকে দেখানো না হয়। medicineDb.js/dose-enforcement-এর
// মতোই "safe-default: block/hide" নীতি অনুসরণ করা হলো।

import { db } from "../../legacy/firebaseConfig.js";

export async function listVerifiedRemedies(mode) {
  const snap = await db.collection("remedyDatabase").where("mode", "==", mode).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.status === "verified");
}
