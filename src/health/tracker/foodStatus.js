// ধাপ ৪ — খাবারের অবস্থা: সবুজ ✓ (ঠিক) / হলুদ ! (সীমিত) / লাল ✕ (এড়ান, কারণসহ)। pure ফাইল, UI-মুক্ত।
// লাল = প্রোফাইলের এলার্জি মেলা, অথবা `avoidMap` (খাবারের key → কারণ; ধাপ ৫-এর ডেটা এখানে ঢুকবে)।
// হলুদ = foodCatalog-এর সতর্কতা-ট্যাগ (TAGS)। শুধু সতর্কতা — কিছু ব্লক করে না; ডাক্তারের পরামর্শ প্রাধান্য পায়।
// আইকন+লেবেল সবসময় (রঙ-নির্ভর নয়)।

import { TAGS } from "./foodCatalog.js";
import { tagAvoidReason } from "./avoidRules.js";
import { medFoodNotes } from "./medFoodNotes.js";

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
  // হলুদ = শুধু সদস্যের প্রোফাইলে প্রযোজ্য সতর্কতা (owner-request ২০২৬-১১-১৪): বয়স/রোগ না মিললে gut/choke/caffeine কিছুই দেখানো হয় না;
  // ওষুধ-সময় নোট শুধু সক্রিয় ওষুধ (ctx.activeMeds) মিললে। চিনি-সতর্কতা সাধারণ (ডায়াবেটিস হলে ওপরে লাল)।
  const yellow = [];
  if (((f && f.tg) || []).includes("sugar")) yellow.push(TAGS.sugar[1]);
  medFoodNotes((opts.ctx || {}).activeMeds, key).forEach((n) => yellow.push(n.text));
  if (yellow.length) return { level: "yellow", ...STATUS_META.yellow, reasons: yellow };
  return { level: "green", ...STATUS_META.green, reasons: [] };
}

// খাবারের tg-র মধ্যে যেগুলো এই সদস্যের বয়স/রোগে প্রযোজ্য (চিপ/⚠ বার্তার জন্য); ওষুধ-সময় নোট আলাদা (medFoodNotes)।
export function relevantTagsOf(f, ctx = {}) {
  return ((f && f.tg) || []).filter((t) => TAGS[t] && t !== "medgap" && (t === "sugar" || tagAvoidReason(t, ctx)));
}

export const STATUS_COLORS = {
  green: { bg: "#F1F6F2", border: "#9CC5B4", text: "var(--hs-primary, #0E4B43)" },
  yellow: { bg: "#FFF8E6", border: "#EBD9B4", text: "#7A5200" },
  red: { bg: "#FDECEA", border: "#E3A59E", text: "#7A1F14" },
};
