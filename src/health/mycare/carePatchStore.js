// MyCare প্যাচ টেস্ট — এই ডিভাইসের localStorage (সদস্য-ভিত্তিক key)। ব্যর্থ হলে চুপচাপ খালি; অ্যাপ অক্ষত।
// "অন্যের জন্য" মোডে এটা কখনো ডাকা হয় না। সংবেদনশীল তথ্য নেই — শুধু আইটেম-id ও সময়।
import { sanitizePatchList, pruneExpired } from "./carePatch.js";

const { useState, useEffect, useCallback } = React;
const key = (memberId) => "hs-care-patch-" + memberId;

export function loadPatches(memberId, now) {
  try { return pruneExpired(JSON.parse(localStorage.getItem(key(memberId)) || "[]"), now); } catch (e) { return []; }
}
export function savePatches(memberId, list) {
  try { localStorage.setItem(key(memberId), JSON.stringify(sanitizePatchList(list))); return true; } catch (e) { return false; }
}

// ফল: { list, update(fn) } — update ফাংশন নতুন তালিকা ফেরত দেয়; স্টোরেজে লেখা ব্যর্থ হলেও স্ক্রিনে চলে (অধিবেশন পর্যন্ত)
export function usePatches(memberId) {
  const [list, setList] = useState(() => (memberId ? loadPatches(memberId, Date.now()) : []));
  useEffect(() => { setList(memberId ? loadPatches(memberId, Date.now()) : []); }, [memberId]);
  const update = useCallback((fn) => {
    if (!memberId) return;
    setList((cur) => { const next = sanitizePatchList(fn(cur)); savePatches(memberId, next); return next; });
  }, [memberId]);
  return { list, update };
}
