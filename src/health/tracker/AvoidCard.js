// ধাপ ৫ — "সতর্কতা" কার্ড (শুধু দেখানো, কিছু ব্লক করে না)। হিসাব avoidRules.js-এ।
// props: domain "food"|"exercise", age, flags, condKeys
import { avoidFor } from "./avoidRules.js";
import { T, CARD_STYLE } from "./trackerTheme.js";

export function AvoidCard({ domain, age, flags, condKeys }) {
  const groups = avoidFor(domain, { age, flags, condKeys });
  if (!groups.length) return null;
  return React.createElement("div", { style: { ...CARD_STYLE, border: "1px solid #EBD9B4", background: "#FFF8E6", margin: "10px 0" } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: "#7A5200", marginBottom: "6px" } },
      "⚠ সতর্কতা — " + (domain === "food" ? "খাবারে এড়িয়ে চলুন/সীমিত রাখুন" : "ব্যায়ামে এড়িয়ে চলুন/সতর্ক থাকুন")),
    groups.map((g) => React.createElement("div", { key: g.id, style: { marginBottom: "8px" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink } }, g.title + " ", React.createElement("span", { style: { fontSize: "12px", fontWeight: 400, color: T.muted } }, "(সূত্র: " + g.src + ")")),
      g.items.map((it, i) => React.createElement("div", { key: i, style: { fontSize: "14px", color: T.ink, paddingLeft: "10px" } }, "• " + it)))),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted } }, "সাধারণ তথ্য; ডাক্তারের পরামর্শ প্রাধান্য পায়। এটি কিছু ব্লক করে না।"));
}
