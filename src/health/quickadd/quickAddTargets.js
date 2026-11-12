// "+ দ্রুত যোগ"-এর টাইল ও গন্তব্য (pure, unit-testable)। নতুন ফর্ম নেই — প্রতিটা টাইল বিদ্যমান ফর্মের স্ক্রিনে নিয়ে যায়।
// tab = বটম-নেভ ট্যাব id (app.js); "aichat" মেনু-গ্রুপের ট্যাব।
export const QUICK_GROUPS = [["today", "আজকের"], ["measure", "মাপ"], ["record", "রেকর্ড"]];
export const QUICK_ITEMS = [
  { id: "water", icon: "💧", label: "পানি", tab: "home", group: "today" },
  { id: "food", icon: "🍽️", label: "খাবার", tab: "home", group: "today" },
  { id: "sleep", icon: "😴", label: "ঘুম", tab: "home", group: "today" },
  { id: "weight", icon: "⚖️", label: "ওজন", tab: "home", group: "today" },
  { id: "symptom", icon: "🤒", label: "লক্ষণ", tab: "aichat", group: "today" },
  { id: "bp", icon: "❤️", label: "প্রেসার", tab: "health", group: "measure" },
  { id: "sugar", icon: "🩸", label: "সুগার", tab: "health", group: "measure" },
  { id: "observation", icon: "📏", label: "পরিমাপ", tab: "health", group: "measure" },
  { id: "condition", icon: "🩺", label: "অসুখ", tab: "health", group: "record" },
  { id: "allergy", icon: "🤧", label: "অ্যালার্জি", tab: "health", group: "record" },
  { id: "medicine", icon: "💊", label: "ওষুধ/প্রেসক্রিপশন", tab: "health", group: "record" },
  { id: "report", icon: "📄", label: "রিপোর্ট", tab: "health", group: "record" },
];

export function quickTarget(kind) {
  const it = QUICK_ITEMS.find((x) => x.id === kind);
  return it ? it.tab : null;
}

// প্রেসার/সুগার → স্বাস্থ্য-রেকর্ড ফর্মে আগে-থেকে-ভরা ধরন+একক (বাকি ঘর ব্যবহারকারী ভরেন)
export const OBS_PRESETS = {
  bp: { type: "রক্তচাপ", unit: "mmHg" },
  sugar: { type: "রক্তের শর্করা", unit: "mg/dL" },
};
