// হোমের "＋" বাটন ও "কী যোগ করবেন?" শিট (ধাপ ৯, মকআপ অনুযায়ী)। শুধু presentational — ফর্ম/লেখা এখানে নেই।
// props: open, onOpen, onClose, onPick(kind), memberName
import { T } from "../tracker/trackerTheme.js";
import { QUICK_ITEMS, QUICK_GROUPS } from "./quickAddTargets.js";

const h = React.createElement;

export function QuickAddFab({ onOpen }) {
  return h("button", {
    type: "button", onClick: onOpen, "aria-label": "দ্রুত যোগ করুন",
    style: { position: "fixed", right: "12px", bottom: "68px", zIndex: 60, width: "50px", height: "50px", borderRadius: "50%", border: "none", background: T.green, color: "#fff", fontSize: "28px", lineHeight: 1, cursor: "pointer", boxShadow: "0 6px 16px rgba(14,75,67,0.35)", fontFamily: "inherit" },
  }, "+");
}

export function QuickAddSheet({ open, onClose, onPick, memberName }) {
  if (!open) return null;
  return h("div", { style: { position: "fixed", inset: 0, zIndex: 80 } },
    h("div", { onClick: onClose, "aria-hidden": "true", style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" } }),
    h("div", { role: "dialog", "aria-modal": "true", "aria-label": "কী যোগ করবেন?", style: { position: "absolute", left: 0, right: 0, bottom: 0, background: T.canvas, borderRadius: "28px 28px 0 0", padding: "10px 16px 16px", fontFamily: "'Hind Siliguri', sans-serif", maxHeight: "92%", overflowY: "auto" } },
      h("div", { style: { width: "44px", height: "5px", borderRadius: "3px", background: T.border, margin: "0 auto 8px" } }),
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("div", { style: { fontSize: "20px", fontWeight: 800, color: T.green } }, "কী যোগ করবেন?"),
        h("button", { type: "button", onClick: onClose, "aria-label": "বন্ধ করুন", style: { minWidth: "44px", minHeight: "44px", border: "none", background: "none", fontSize: "20px", color: T.muted, cursor: "pointer" } }, "✕")),
      h("div", { style: { fontSize: "14px", color: T.muted, margin: "0 0 4px" } }, "একবার দিলেই প্রোফাইল, ট্রেন্ড ও ডাক্তার-রিপোর্টে নিজে থেকে যুক্ত হবে।"),
      QUICK_GROUPS.map(([gid, glabel]) => h("div", { key: gid, style: { marginBottom: "4px" } },
        h("div", { style: { fontSize: "13px", fontWeight: 700, color: T.muted, margin: "4px 2px" } }, glabel),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" } },
          QUICK_ITEMS.filter((it) => it.group === gid).map((it) => h("button", {
            key: it.id, type: "button", onClick: () => onPick(it.id),
            style: { minHeight: "66px", padding: "4px", borderRadius: "16px", border: "1px solid " + T.border, background: T.surface, color: T.green, fontSize: "14px", lineHeight: 1.2, fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", fontFamily: "inherit" },
          }, h("span", { "aria-hidden": "true", style: { fontSize: "24px", lineHeight: 1 } }, it.icon), it.label))))),
      memberName && h("div", { style: { marginTop: "12px", padding: "10px 12px", borderRadius: "12px", background: T.track, fontSize: "13px", color: T.ink } }, "🔗 সদস্য: " + memberName + " · সব তথ্য একটাই স্বাস্থ্য-ভান্ডারে জমা হয়")));
}
