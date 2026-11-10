// "ওষুধ খেয়েছি" চিহ্নের pure helper (React/Firestore নেই)। সংরক্ষণ: ট্র্যাকারের বিদ্যমান
// `daily_{সদস্য}_{তারিখ}` ডকের `medTaken` map-এ (firestore.rules healthTracker দ্রষ্টব্য) — নতুন collection নেই।
// key = `{ওষুধ-রেকর্ড-ID}_{HHMM}` (যেমন "Ab12…_0800"; ':' বাদ — Firestore field-path নিরাপদ), মান সবসময় true।
// আজকের না-হওয়া তারিখের ডক আলাদা, তাই প্রতিদিন নতুন করে শুরু; পুরনো দিনের ডেটা ডাক্তার-এক্সপোর্টে adherence-এর কাজে লাগবে।

export const MAX_MED_TAKEN = 60; // rules-এর সীমার সাথে মেলানো

export function doseKey(recordId, time) {
  return String(recordId) + "_" + String(time).replace(":", "");
}

export function isDoseKey(k) {
  return typeof k === "string" && /^[A-Za-z0-9]{1,40}_\d{4}$/.test(k);
}

// অজানা/ভুল ধরনের ডেটা বাদ দিয়ে শুধু বৈধ { key: true } রাখে।
export function sanitizeTaken(map) {
  const out = {};
  if (!map || typeof map !== "object") return out;
  Object.keys(map).forEach((k) => { if (isDoseKey(k) && map[k] === true && Object.keys(out).length < MAX_MED_TAKEN) out[k] = true; });
  return out;
}

// পুরনো (শুধু এই ডিভাইসের localStorage) key-গুলো `{id}_{HH:MM}` — নতুন ধরনে রূপান্তর; ভুল/অচেনা key বাদ।
export function legacyTakenToKeys(legacyMap) {
  const out = [];
  if (!legacyMap || typeof legacyMap !== "object") return out;
  Object.keys(legacyMap).forEach((k) => {
    if (!legacyMap[k]) return;
    const nk = String(k).replace(/:(\d{2})$/, "$1");
    if (isDoseKey(nk) && !out.includes(nk)) out.push(nk);
  });
  return out;
}

// নতুন key-র recordId অংশ।
export function recordIdOfDoseKey(k) {
  return k.slice(0, k.lastIndexOf("_"));
}
