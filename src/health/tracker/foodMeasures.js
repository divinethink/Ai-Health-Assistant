// অতিরিক্ত ঘরোয়া মাপ (কাটোরি · কাপ · চামচ) — শুধু তরল/আধা-তরল খাবারের জন্য (pure data; UI/SDK-মুক্ত)।
// কেন শুধু এগুলো: আয়তন → গ্রাম রূপান্তর নির্ভর করে ঘনত্বের ওপর; তরল খাবারে ঘনত্ব ≈ ১ গ্রাম/মিলি, তাই হিসাব নির্ভরযোগ্য।
// কঠিন খাবারে (ভাত, তরকারি, ফল...) অনুমানে মাপ বানানো হয় না — সেখানে বিদ্যমান মাপ বা সরাসরি গ্রাম।
// গ্রাম = আয়তন (মিলি) × ঘনত্ব, ১ দশমিকে রাউন্ড। ডিফল্ট (প্রথম) মাপ অপরিবর্তিত — এখানের মাপ সবসময় তালিকার শেষে যোগ হয়।
// ⚠ আনুমানিক: কাটোরি/কাপের আকার ঘরে ঘরে আলাদা (UI-তে "≈ গ্রাম" দেখানো হয়)।

export const VOLUMES = [
  ["katori", "কাটোরি", 150],
  ["cup", "কাপ", 240],
  ["tbsp", "টেবিল-চামচ", 15],
];

// খাবারের key → ঘনত্ব (গ্রাম/মিলি)
export const LIQUID_DENSITY = {
  dal: 1, mugDal: 1, vegSoup: 1, daalSoup: 1, chickenJhol: 1, chickenSoup: 1,
  payesh: 1.05, tokDoi: 1.03, mishtiDoi: 1.1,
};

// baseMeasures: খাবারের নিজস্ব মাপ [{id,label,g}] — একই id/নামের মাপ আবার যোগ হয় না।
export function extraMeasuresFor(foodKey, baseMeasures) {
  const d = Object.prototype.hasOwnProperty.call(LIQUID_DENSITY, foodKey) ? LIQUID_DENSITY[foodKey] : null;
  if (!d) return [];
  const have = Array.isArray(baseMeasures) ? baseMeasures : [];
  return VOLUMES
    .filter(([id, label]) => !have.some((m) => m.id === id || m.label === label))
    .map(([id, label, ml]) => ({ id, label, g: Math.round(ml * d * 10) / 10 }));
}
