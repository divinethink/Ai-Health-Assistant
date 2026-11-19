// MyCare → AI Chat: "এই প্রশ্নটি আগে থেকে লেখা থাকুক" — এক-বার-ব্যবহারের হালকা বার্তা (quickIntent-এর ধরনে)।
// শুধু বিভাগ/সমস্যার নাম-ভিত্তিক সাধারণ প্রশ্ন থাকে; ব্যক্তিগত তথ্য নয়। state/Firestore/localStorage নেই; ১৫ সেকেন্ডে মেয়াদ শেষ।
let cur = null;
const TTL_MS = 15000;
const MAX_LEN = 300;

export function setChatPrefill(text) {
  const t = String(text == null ? "" : text).trim().slice(0, MAX_LEN);
  cur = t ? { text: t, at: Date.now() } : null;
}

export function peekChatPrefill() {
  if (!cur) return "";
  if (Date.now() - cur.at > TTL_MS) { cur = null; return ""; }
  return cur.text;
}

export function clearChatPrefill() { cur = null; }
