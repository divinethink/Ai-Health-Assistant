// দ্বিতীয় স্তরের পিল-সারি (ট্র্যাকারের "আমার লক্ষ্য | ডায়েট প্ল্যান | ব্যায়াম প্ল্যান"-এর একই রং ও নকশা)।
// ট্র্যাকারের নিজস্ব কপি অপরিবর্তিত; এটি অন্য পেজে ব্যবহারের জন্য।
import { histBind, histChange } from "./navHistory.js";

// twoRows = true হলে সোয়াইপ ছাড়া দুই লাইনে সাজায় (MyCare ক্যাটাগরির concern-পিল)।
export function SubPills(tabs, active, onChange, keyPrefix, ariaLabel, twoRows) {
  const hk = (keyPrefix || "sub") + ":" + tabs.map((x) => x[0]).join("|");
  histBind(hk, active, onChange);
  return React.createElement("div", { role: "tablist", "aria-label": ariaLabel || "", style: { ...(twoRows ? { display: "grid", gridTemplateColumns: "repeat(" + Math.ceil(tabs.length / 2) + ", minmax(0, 1fr))" } : { display: "flex" }), gap: "6px", padding: "8px", borderRadius: "16px", background: "var(--hs-chip-bg, #E4F0E9)", boxShadow: "inset 0 1px 3px rgba(14,75,67,0.10)", margin: "0 0 10px" } },
    tabs.map(([id, label]) => {
      const on = id === active;
      return React.createElement("button", { key: id, type: "button", role: "tab", onClick: () => histChange(hk, active, id, onChange), "aria-selected": on, "aria-pressed": on,
        style: { ...(twoRows ? {} : { flex: "1 1 0" }), minWidth: 0, minHeight: "40px", padding: "4px 6px", position: "relative", borderRadius: "10px", fontSize: "13.5px", fontWeight: on ? 800 : 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: twoRows ? "normal" : "nowrap", textAlign: "center",
          border: on ? "1.5px solid var(--hs-primary, #0E4B43)" : "1px solid var(--hs-border, #D9E5DE)", boxShadow: on ? "0 4px 10px rgba(14,75,67,0.28), inset 0 -3px 0 rgba(255,255,255,0.22)" : "0 2px 5px rgba(14,75,67,0.10)",
          background: on ? "var(--hs-primary, #0E4B43)" : "var(--hs-surface, #FFFFFF)", color: on ? "var(--hs-primary-contrast, #fff)" : "var(--hs-text, #1B2430)" } }, label);
    }));
}
