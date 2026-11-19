// MyCare (ব্যক্তিগত যত্ন) — ধাপ ১: শুধু নেভিগেশন-কাঠামো। কোনো ডেটা/schema/AI নেই।
// বিষয়বস্তু ও ইঞ্জিন পরের ধাপে (MyCare_Plan.md)। ব্লগ এখন মেনু থেকে খোলে।
import { L, useLang } from "../../shared/i18n.js";

const CATS = [
  ["skin", "ত্বক", "Skin Care", "#1F7A5C"],
  ["hair", "চুল", "Hair Care", "#3B82B6"],
  ["oral", "দাঁত ও মুখ", "Oral Care", "#D08A2E"],
  ["body", "শরীর", "Body Care", "#7A5BB0"],
  ["seasonal", "ঋতুভিত্তিক", "Seasonal Care", "#C25B3A"],
  ["natural", "প্রাকৃতিক", "Natural Care", "#3F7F6A"],
];

export function MyCareSection({ chip }) {
  useLang();
  return React.createElement(
    "div", { style: { padding: "8px 12px 76px", color: "var(--hs-text)" } },
    React.createElement("div", { style: { display: "flex", marginBottom: "4px" } }, chip),
    React.createElement("h2", { style: { fontSize: "22px", margin: "8px 0 2px", color: "var(--hs-primary)" } }, "MyCare"),
    React.createElement("p", { style: { fontSize: "14px", color: "var(--hs-muted)", margin: "0 0 12px" } },
      L("প্রমাণভিত্তিক ব্যক্তিগত যত্নের গাইড", "Evidence-based personal care guide")),
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginBottom: "14px" } },
      CATS.map(([id, bn, en, color]) => React.createElement("div", {
        key: id,
        style: { minHeight: "96px", padding: "14px", borderRadius: "18px", border: "1px solid var(--hs-border)", background: "var(--hs-surface)", boxShadow: "0 4px 14px rgba(14,75,67,0.08)", display: "flex", flexDirection: "column", justifyContent: "space-between" },
      },
        React.createElement("span", { style: { width: "28px", height: "28px", borderRadius: "50%", border: "3px solid " + color } }),
        React.createElement("span", null,
          React.createElement("span", { style: { display: "block", fontSize: "15px", fontWeight: 700, color: "var(--hs-text)" } }, L(bn, en)),
          React.createElement("span", { style: { display: "block", fontSize: "12px", color: "var(--hs-muted)", marginTop: "2px" } }, L("শীঘ্রই আসছে", "Coming soon")))))),
    React.createElement("p", { style: { fontSize: "12.5px", color: "var(--hs-muted)", lineHeight: 1.5, margin: 0 } },
      L("এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।", "This is a general guide, not medical advice."))
  );
}
