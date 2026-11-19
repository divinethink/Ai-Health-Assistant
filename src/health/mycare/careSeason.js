// MyCare — বাংলাদেশের ৬ ঋতু (আনুমানিক বাংলা-ক্যালেন্ডার সীমা)। স্থানীয় তারিখ ব্যবহার, UTC নয়। pure।
export const SEASONS = ["grishmo", "borsha", "shorot", "hemonto", "shit", "boshonto"];
export function seasonOf(date) {
  const d = date instanceof Date ? date : new Date();
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  if (md >= 414 && md <= 614) return "grishmo";
  if (md >= 615 && md <= 814) return "borsha";
  if (md >= 815 && md <= 1014) return "shorot";
  if (md >= 1015 && md <= 1214) return "hemonto";
  if (md >= 1215 || md <= 213) return "shit";
  return "boshonto"; // ফেব্রুয়ারি ১৪ – এপ্রিল ১৩
}
