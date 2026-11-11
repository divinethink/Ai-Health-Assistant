// ধাপ ৪ — খাবারের অবস্থা: সবুজ ✓ (ঠিক) / হলুদ ! (সীমিত) / লাল ✕ (এড়ান, কারণসহ)। pure ফাইল, UI-মুক্ত।
// লাল = প্রোফাইলের এলার্জি মেলা, অথবা `avoidMap` (খাবারের key → কারণ; ধাপ ৫-এর ডেটা এখানে ঢুকবে)।
// হলুদ = foodCatalog-এর সতর্কতা-ট্যাগ (TAGS)। শুধু সতর্কতা — কিছু ব্লক করে না; ডাক্তারের পরামর্শ প্রাধান্য পায়।
// আইকন+লেবেল সবসময় (রঙ-নির্ভর নয়)।

import { TAGS } from "./foodCatalog.js";
import { tagAvoidReason } from "./avoidRules.js";

export const STATUS_META = {
  green: { icon: "✓", label: "ঠিক আছে" },
  yellow: { icon: "!", label: "সীমিত রাখুন" },
  red: { icon: "✕", label: "এড়িয়ে চলুন" },
};

// f: ক্যাটালগ খাবার {al, tg}; opts: { allergyTags: [], avoidMap: { key: "কারণ" }, ctx: { age, flags, condKeys } }
export function foodStatus(key, f, opts = {}) {
  const tags = new Set(opts.allergyTags || []);
  const avoid = (opts.avoidMap && opts.avoidMap[key]) || null;
  const red = [];
  if (f && f.al && tags.has(f.al)) red.push("প্রোফাইলের অ্যালার্জির সাথে মিলতে পারে");
  if (avoid) red.push(String(avoid));
  ((f && f.tg) || []).filter((t) => TAGS[t]).forEach((t) => { const r = tagAvoidReason(t, opts.ctx || {}); if (r && !red.includes(r)) red.push(r); });
  if (red.length) return { level: "red", ...STATUS_META.red, reasons: red };
  const yellow = ((f && f.tg) || []).filter((t) => TAGS[t]).map((t) => TAGS[t][1]);
  if (yellow.length) return { level: "yellow", ...STATUS_META.yellow, reasons: yellow };
  return { level: "green", ...STATUS_META.green, reasons: [] };
}

export const STATUS_COLORS = {
  green: { bg: "#F1F6F2", border: "#9CC5B4", text: "var(--hs-primary, #0E4B43)" },
  yellow: { bg: "#FFF8E6", border: "#EBD9B4", text: "#7A5200" },
  red: { bg: "#FDECEA", border: "#E3A59E", text: "#7A1F14" },
};
