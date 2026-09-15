// Owner-Controlled Profile Permission (amendment item ২,
// 1_1_1_1_Health_Assistant_Amendment_Plan_DRAFT.md) — আগের request→approve
// Take-Access workflow (accessGrants.js, অক্ষত/অপরিবর্তিত আছে structural
// Parent-Child(<18) grant-এর জন্য) প্রতিস্থাপন করছে না, বরং তার **পাশে নতুন,
// simpler owner-controlled sharing layer** যোগ করছে non-structural
// সদস্যদের জন্য। প্রতিটা সদস্য নিজের প্রোফাইলে অন্য সদস্যদের read/write
// আলাদাভাবে সেট করতে পারবেন — কোনো request/approve/pending state নেই,
// owner-এর single direct write-ই যথেষ্ট (firestore.rules-এ enforce হয়)।
//
// Doc-ID deterministic: `{ownerId}_{granteeId}` (accessGrants-এর একই
// pattern) — ownerId = যার প্রোফাইল share হচ্ছে, granteeId = যাকে access
// দেওয়া হচ্ছে।

import { db } from "./firebaseConfig.js";

function shareRef(familyId, ownerId, granteeId) {
  return db.collection("families").doc(familyId).collection("profileShares").doc(ownerId + "_" + granteeId);
}

// owner নিজের প্রোফাইলে granteeId-কে read/write দিচ্ছেন — single direct write,
// কোনো approval-wait নেই। {read:false, write:false} পাঠালে কার্যকরভাবে
// access সরিয়ে নেওয়া হয় (delete না করেও, rules-এ flag-check-ই যথেষ্ট)।
export async function setProfileShare(familyId, ownerId, granteeId, { read, write }) {
  await shareRef(familyId, ownerId, granteeId).set(
    {
      ownerId,
      granteeId,
      read: !!read,
      write: !!write,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: false }
  );
}

// সম্পূর্ণ সরিয়ে ফেলা (doc delete) — {read:false,write:false} সেট করার
// বিকল্প, UI-এর সুবিধার্থে দুটোই সাপোর্ট করা হলো।
export async function removeProfileShare(familyId, ownerId, granteeId) {
  await shareRef(familyId, ownerId, granteeId).delete();
}

// আমি (ownerId) কাকে কী access দিয়েছি — নিজের Profile-এর "শেয়ারিং" সেকশনের
// জন্য। রিটার্ন: { [granteeId]: { read, write } }
export async function listMySharesGiven(familyId, ownerId) {
  const snap = await db.collection("families").doc(familyId).collection("profileShares").where("ownerId", "==", ownerId).get();
  const map = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    map[data.granteeId] = { read: !!data.read, write: !!data.write };
  });
  return map;
}
