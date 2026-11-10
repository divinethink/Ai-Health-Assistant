// "+ দ্রুত যোগ"-এর টাইল ও গন্তব্য (pure, unit-testable)। নতুন ফর্ম নেই — প্রতিটা টাইল বিদ্যমান ফর্মের স্ক্রিনে নিয়ে যায়।
// tab = বটম-নেভ ট্যাব id (app.js); "aichat" মেনু-গ্রুপের ট্যাব।
export const QUICK_ITEMS = [
  { id: "weight", icon: "⚖️", label: "ওজন", tab: "tracker" },
  { id: "bp", icon: "❤️", label: "প্রেসার", tab: "home" },
  { id: "sugar", icon: "🩸", label: "সুগার", tab: "home" },
  { id: "medicine", icon: "💊", label: "ওষুধ", tab: "home" },
  { id: "symptom", icon: "🤒", label: "লক্ষণ", tab: "aichat" },
  { id: "food", icon: "🍽️", label: "খাবার", tab: "tracker" },
  { id: "water", icon: "💧", label: "পানি", tab: "tracker" },
  { id: "sleep", icon: "😴", label: "ঘুম", tab: "tracker" },
  { id: "report", icon: "📄", label: "রিপোর্ট", tab: "documents" },
];

export function quickTarget(kind) {
  const it = QUICK_ITEMS.find((x) => x.id === kind);
  return it ? it.tab : null;
}

// প্রেসার/সুগার → স্বাস্থ্য-রেকর্ড ফর্মে আগে-থেকে-ভরা ধরন+একক (বাকি ঘর ব্যবহারকারী ভরেন)
export const OBS_PRESETS = {
  bp: { type: "Blood Pressure", unit: "mmHg" },
  sugar: { type: "Blood Sugar", unit: "mg/dL" },
};
