// পেজ-কার্ড রেন্ডার (App Creator-এর ডিজাইন অনুযায়ী): দৃশ্যমানতা + ভাঁজ। শুধু presentational।
// fold = fixed → কিছুই মোড়ায় না (আগের আচরণ হুবহু); open/closed → শিরোনামসহ ভাঁজযোগ্য।
import { cardTitle } from "./pageLayout.js";

const { useState } = React;

export function FoldWrap({ fold, title, children }) {
  const [open, setOpen] = useState(fold === "open");
  if (fold !== "open" && fold !== "closed") return children;
  return React.createElement("div", { style: { marginBottom: "8px" } },
    React.createElement("button", {
      type: "button", onClick: () => setOpen((o) => !o), "aria-expanded": open,
      style: { width: "100%", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "0 14px", marginBottom: open ? "6px" : 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: "14px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-chip-bg, #E4F0E9)", color: "var(--hs-text, #1F2D2A)" },
    },
      React.createElement("span", { style: { fontSize: "15px", fontWeight: 700 } }, title),
      React.createElement("span", { "aria-hidden": "true", style: { fontSize: "14px", color: "var(--hs-muted, #5F716C)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" } }, "▾")),
    open && children);
}

/**
 * cards = এই zone-এর বৈধ তালিকা (useAppDesign থেকে); nodes[id]() → অ্যারে/element (না দেখানোর মতো হলে null/[])।
 * কীতে fold যুক্ত, তাই ডিজাইন বদলালে কার্ড নতুন করে mount হয় (নতুন ডিফল্ট ভাঁজ প্রযোজ্য)।
 */
export function renderLayoutCards(page, zone, cards, nodes) {
  const out = [];
  cards.forEach((c) => {
    if (!c.visible || !nodes[c.id]) return;
    const content = nodes[c.id]();
    const arr = Array.isArray(content) ? content : [content];
    if (!arr.some((x) => x)) return; // কার্ডে কিছু নেই → ফাঁকা ভাঁজ-হেডার নয়
    out.push(React.createElement(React.Fragment, { key: c.id + ":" + c.fold },
      React.createElement(FoldWrap, { fold: c.fold, title: cardTitle(page, zone, c.id) }, React.createElement(React.Fragment, null, ...arr))));
  });
  return out;
}
