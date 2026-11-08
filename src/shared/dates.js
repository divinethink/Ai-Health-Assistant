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
