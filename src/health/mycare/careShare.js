// MyCare — আইটেম শেয়ারের লেখা (pure)। শুধু আইটেমের নাম, নিয়ম ও সতর্কতা; প্রোফাইল/নাম/স্বাস্থ্য-তথ্য কখনো নয়
// (ফাংশন আইটেম ছাড়া আর কিছু নেয় না, তাই ব্যক্তিগত তথ্য ঢোকার পথই নেই)।
const pick = (o, lang) => (o ? (lang === "en" ? o.en : o.bn) || "" : "");
const warnText = (w, lang) => (typeof w === "string" ? w : pick(w, lang));

export function buildShareText(item, lang) {
  if (!item) return "";
  const lines = [pick(item.name, lang), pick(item.how, lang)];
  const warns = (item.warnings || []).map((w) => warnText(w, lang)).filter(Boolean);
  if (warns.length) lines.push((lang === "en" ? "Caution: " : "সতর্কতা: ") + warns.join(" "));
  lines.push(lang === "en" ? "General guide, not medical advice." : "এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।");
  return lines.filter(Boolean).join("\n\n");
}

// ফল: "shared" | "copied" | "cancelled" | "unsupported" | "error" — navigator ইনজেক্ট করা যায় (টেস্টের জন্য)
export async function shareText(title, text, nav) {
  const n = nav || (typeof navigator !== "undefined" ? navigator : null);
  if (!n) return "unsupported";
  if (typeof n.share === "function") {
    try { await n.share({ title, text }); return "shared"; }
    catch (e) { return e && e.name === "AbortError" ? "cancelled" : "error"; }
  }
  if (n.clipboard && typeof n.clipboard.writeText === "function") {
    try { await n.clipboard.writeText(title + "\n\n" + text); return "copied"; } catch (e) { return "error"; }
  }
  return "unsupported";
}
