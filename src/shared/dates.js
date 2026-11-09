// বাংলা তারিখ-ফরম্যাট helper (টাইমলাইন/ক্যালেন্ডার/টিকা — সব জায়গায় একই ফরম্যাট)।
// শুধু display; stored data (ISO "YYYY-MM-DD") অপরিবর্তিত।

export function bnDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
}

export function bnDateFromMillis(ms) {
  return new Date(ms).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
}

export function bnMonthYear(ms) {
  return new Date(ms).toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
}

export function bnTime(ms) {
  return new Date(ms).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" });
}

export function bnNum(n) {
  return Number(n).toLocaleString("bn-BD");
}

// লোকাল তারিখ "YYYY-MM-DD" (UTC না)। toISOString() UTC দেয় — বাংলাদেশে ভোর ০০:০০–০৬:০০
// এর মধ্যে আগের দিনের তারিখ আসত। সেভ/ফর্মের "আজ" সবসময় এটা দিয়ে।
export function localISO(d) {
  const x = d || new Date();
  const p = (n) => String(n).padStart(2, "0");
  return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate());
}
