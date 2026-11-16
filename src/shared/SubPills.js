// দ্বিতীয় স্তরের পিল-সারি (ট্র্যাকারের "আমার লক্ষ্য | ডায়েট প্ল্যান | ব্যায়াম প্ল্যান"-এর একই রং ও নকশা)।
// ট্র্যাকারের নিজস্ব কপি অপরিবর্তিত; এটি অন্য পেজে ব্যবহারের জন্য।
import { histBind, histChange } from "./navHistory.js";

export function SubPills(tabs, active, onChange, keyPrefix, ariaLabel) {
  const hk = (keyPrefix || "sub") + ":" + tabs.map((x) => x[0]).join("|");
  histBind(hk, active, onChange);
  return React.createElement("div", { role: "tablist", "aria-label": ariaLabel || "", style: { display: "flex", gap: "6px", padding: "8px", borderRadius: "16px", background: "var(--hs-pill-tray, #EFE4D2)", boxShadow: "inset 0 1px 3px rgba(90,60,10,0.12)", margin: "0 0 10px" } },
    tabs.map(([id, label]) => {
      const on = id === active;
      return React.createElement("button", { key: id, type: "button", role: "tab", onClick: () => histChange(hk, active, id, onChange), "aria-selected": on, "aria-pressed": on,
        style: { flex: "1 1 0", minWidth: 0, minHeight: "40px", padding: "4px 6px", position: "relative", borderRadius: "10px", fontSize: "13.5px", fontWeight: on ? 800 : 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", textAlign: "center",
          border: on ? "1.5px solid var(--hs-pill, #8B5A2B)" : "1px solid var(--hs-pill-border, #D6C3A5)", boxShadow: on ? "0 4px 10px rgba(90,60,10,0.34), inset 0 -3px 0 rgba(255,255,255,0.30)" : "0 2px 5px rgba(90,60,10,0.16), inset 0 -2px 0 rgba(90,60,10,0.06)",
          background: on ? "linear-gradient(135deg, var(--hs-pill, #8B5A2B), var(--hs-pill-2, #A5703A))" : "linear-gradient(180deg, var(--hs-pill-top, #FFFFFF), var(--hs-pill-tint, #F6EEE0))", color: on ? "var(--hs-pill-text, #fff)" : "var(--hs-pill-ink, #4F3414)" } }, label);
    }));
}
