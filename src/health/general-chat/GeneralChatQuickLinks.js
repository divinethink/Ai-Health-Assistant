// General Chat — sidebar Quick-Links (নতুন)। Category-wise collapsible list,
// script-populated global `generalChatQuickLinks` collection থেকে read।
// "বিবিধ" ক্যাটাগরির কোনো fixed link নেই — শুধু ট্যাব হিসেবে থাকে, ক্লিক করলে
// শুধু active-category/tag "misc"-এ সেট হয় (open-web আলোচনা মোড)।

import { listGeneralChatQuickLinks, CATEGORY_LABELS, CATEGORY_ORDER } from "./generalChatData.js";

const { useState, useEffect } = React;

export function GeneralChatQuickLinks({ activeCategory, onSelectCategory }) {
  const [links, setLinks] = useState(null);
  const [err, setErr] = useState(null);
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    listGeneralChatQuickLinks()
      .then(setLinks)
      .catch((e) => setErr(e.message || String(e)));
  }, []);

  function toggleGroup(cat) {
    setOpenGroups((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  const grouped = {};
  (links || []).forEach((l) => {
    if (!grouped[l.category]) grouped[l.category] = [];
    grouped[l.category].push(l);
  });

  return React.createElement(
    "div", { style: { width: "220px", minWidth: "220px", borderRight: "1px solid #2A3542", background: "#1B2430", color: "#D6DEE6", overflowY: "auto", padding: "10px 0" } },
    React.createElement("div", { style: { padding: "0 12px 8px", fontSize: "11px", fontWeight: 700, color: "#8FA0B3", letterSpacing: "0.4px" } }, "QUICK LINKS"),

    err && React.createElement("div", { style: { padding: "8px 12px", fontSize: "11px", color: "#E88" } }, err),

    CATEGORY_ORDER.map((cat) => {
      const isActive = activeCategory === cat;
      if (cat === "misc") {
        return React.createElement(
          "div", { key: cat, onClick: () => onSelectCategory("misc"),
            style: { padding: "8px 12px", cursor: "pointer", fontSize: "13px", background: isActive ? "#2A3F52" : "transparent", borderLeft: isActive ? "3px solid #4FC3A1" : "3px solid transparent" } },
          "🌐 " + CATEGORY_LABELS[cat]
        );
      }
      const items = grouped[cat] || [];
      const isOpen = !!openGroups[cat];
      return React.createElement(
        "div", { key: cat },
        React.createElement(
          "div", {
            onClick: () => { toggleGroup(cat); onSelectCategory(cat); },
            style: { padding: "8px 12px", cursor: "pointer", fontSize: "13px", fontWeight: isActive ? 700 : 500, background: isActive ? "#2A3F52" : "transparent", borderLeft: isActive ? "3px solid #4FC3A1" : "3px solid transparent", display: "flex", justifyContent: "space-between" },
          },
          React.createElement("span", null, CATEGORY_LABELS[cat]),
          React.createElement("span", { style: { color: "#5A6B7D" } }, isOpen ? "▾" : "▸")
        ),
        isOpen && items.map((item) =>
          React.createElement(
            "a", {
              key: item.id, href: item.url, target: "_blank", rel: "noopener noreferrer",
              onClick: () => onSelectCategory(cat),
              style: { display: "block", padding: "6px 12px 6px 26px", fontSize: "12px", color: "#A9C4DE", textDecoration: "none", lineHeight: "1.4" },
              title: item.notes || "",
            },
            item.label
          )
        )
      );
    })
  );
}
