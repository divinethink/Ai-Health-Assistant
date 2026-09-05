// src/health/reports/testDictionaryData.js
//
// testNameDictionary query layer (Architecture Plan Part B §5.3) — medicineDb.js
// (src/legacy/)-এর একই pattern reuse (Process Rule ২: Existing pattern reuse)।
// medicineDb.js থেকে পার্থক্য: এই collection-এ কোনো "verified" status-gate নেই
// (§5.3 নোট — non-clinical-judgment grouping, pharmacist-review প্রয়োজন হয় না),
// তাই client সরাসরি সব entry পড়তে পারে।

import { db } from "../../legacy/firebaseConfig.js";

let cachedEntries = null;

// পুরো dictionary একবারে fetch+cache করা হয় (২৩টা entry, ছোট dataset —
// roadmap §10: semantic/vector search দরকার নেই, structured DB query যথেষ্ট)।
// প্রতিটা OCR/parse call-এ বারবার Firestore read না করে in-memory reuse।
export async function fetchTestNameDictionary({ forceRefresh = false } = {}) {
  if (cachedEntries && !forceRefresh) return cachedEntries;
  const snap = await db.collection("testNameDictionary").get();
  cachedEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return cachedEntries;
}
