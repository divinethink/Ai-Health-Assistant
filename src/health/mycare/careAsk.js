// MyCare → AI Chat: নির্বাচিত বিভাগ/সমস্যা থেকে আগে-লেখা প্রশ্ন বানানো। pure।
// প্রশ্নে শুধু বিভাগ ও সমস্যার নাম থাকে; নাম, বয়স, অ্যালার্জি ইত্যাদি কিছু নয় (AI Chat নিজেই প্রোফাইল পড়ে)।
import { CAT_META, LABELS, CONCERN_KEY } from "./careLabels.js";

export function buildAskText(catId, concernId, lang) {
  const meta = CAT_META.find((c) => c[0] === catId);
  if (!meta) return "";
  const en = lang === "en";
  const cat = en ? meta[2] : meta[1];
  const key = CONCERN_KEY[catId];
  const c = concernId && key && LABELS[key] ? LABELS[key][concernId] : null;
  const concern = c ? (en ? c.en : c.bn) : "";
  if (en) {
    return concern
      ? "My " + cat + " concern: " + concern + ". Based on my health profile, please give general daily-care advice."
      : "Based on my health profile, please give general daily-care advice for " + cat + ".";
  }
  return concern
    ? "আমার " + cat + "-এর সমস্যা: " + concern + "। আমার স্বাস্থ্য-প্রোফাইল অনুযায়ী দৈনন্দিন যত্নের সাধারণ পরামর্শ দিন।"
    : "আমার স্বাস্থ্য-প্রোফাইল অনুযায়ী " + cat + "-এর দৈনন্দিন যত্নের সাধারণ পরামর্শ দিন।";
}
