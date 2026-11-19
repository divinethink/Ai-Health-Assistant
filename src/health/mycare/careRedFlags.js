// MyCare — ডাক্তার-দেখানোর লক্ষণ (red flag)। থাকলে পরামর্শ-তালিকা নয়, সরাসরি রেফার। pure।
export const RED_FLAGS = [
  { id: "face-swelling-breathing", level: "emergency", cats: "*", bn: "মুখ/ঠোঁট/চোখ ফোলা বা শ্বাসকষ্ট — এখনই জরুরি সেবা নিন।", en: "Swelling of face, lips or eyes, or trouble breathing — get emergency help now." },
  { id: "rash-with-fever", level: "doctor", cats: "*", bn: "জ্বরসহ র‍্যাশ — আজই ডাক্তার দেখান।", en: "Rash with fever — see a doctor today." },
  { id: "spreading-rash", level: "doctor", cats: "*", bn: "র‍্যাশ দ্রুত ছড়াচ্ছে — চর্মরোগ বিশেষজ্ঞ/ডাক্তার দেখান।", en: "Rash is spreading fast — see a dermatologist or doctor." },
  { id: "mole-change", level: "doctor", cats: ["skin", "body"], bn: "তিল বা দাগের আকার/রং বদলেছে — চর্মরোগ বিশেষজ্ঞ দেখান।", en: "A mole or spot changed size or colour — see a dermatologist." },
  { id: "blood-or-pus", level: "doctor", cats: "*", bn: "রক্ত বা পুঁজ আছে — ডাক্তার দেখান।", en: "Blood or pus is present — see a doctor." },
  { id: "blistering", level: "doctor", cats: "*", bn: "ফোস্কা পড়েছে — ব্যবহার বন্ধ করে ডাক্তার দেখান।", en: "Blisters appeared — stop use and see a doctor." },
  { id: "sudden-hair-loss", level: "doctor", cats: ["hair"], bn: "হঠাৎ অনেক চুল পড়া বা টাক-ছোপ — ডাক্তার দেখান।", en: "Sudden heavy hair loss or bald patches — see a doctor." },
  { id: "heat-illness", level: "doctor", cats: ["seasonal"], bn: "গরমে অসুস্থ লাগছে ও জ্বর উঠেছে — heat exhaustion বা heatstroke হতে পারে; দ্রুত ডাক্তার দেখান।", en: "Feeling unwell with a high temperature in the heat — may be heat exhaustion or heatstroke; see a doctor promptly." },
  { id: "mouth-ulcer-2w", level: "doctor", cats: ["oral"], bn: "মুখের ঘা ২ সপ্তাহের বেশি — ডাক্তার/দন্তচিকিৎসক দেখান।", en: "Mouth ulcer for over 2 weeks — see a doctor or dentist." },
  { id: "gum-bleeding-recurrent", level: "doctor", cats: ["oral"], bn: "মাড়ি থেকে বারবার রক্ত — দন্তচিকিৎসক দেখান।", en: "Gums bleed repeatedly — see a dentist." },
  { id: "severe-tooth-pain-swelling", level: "doctor", cats: ["oral"], bn: "দাঁতে তীব্র ব্যথা বা ফোলা — আজই দন্তচিকিৎসক দেখান।", en: "Severe tooth pain or swelling — see a dentist today." },
];

// symptomIds: ব্যবহারকারীর বাছা লক্ষণের id। ফল: emergency আগে।
export function detectRedFlags(symptomIds, category) {
  const set = new Set(symptomIds || []);
  return RED_FLAGS
    .filter((f) => set.has(f.id) && (f.cats === "*" || !category || f.cats.includes(category)))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "emergency" ? -1 : 1));
}
