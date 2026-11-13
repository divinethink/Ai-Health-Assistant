// পেজ কাস্টমাইজ (শুধু App Creator): প্রতিটা কার্ডের ওপরে/নিচে, স্থির/খোলা/বন্ধ, দেখান/লুকান।
// খসড়া লোকাল state-এ; "সেভ করুন" চাপলেই গ্লোবাল ডিজাইনে লেখা হয় (সব সদস্য একই দেখেন)। Reset শুধু খসড়ায়।
import { PAGE_DEFS, FOLDS, FOLD_LABEL, cardTitle, defaultPage, moveCard, updateCard, sameLayout, zonesOf } from "../shared/pageLayout.js";
import { useAppDesign, saveDesignPage } from "../legacy/appDesign.js";

const { useState, useRef } = React;

function Switch({ checked, label, onChange }) {
  return React.createElement("button", { type: "button", role: "switch", "aria-checked": checked, "aria-label": label, onClick: () => onChange(!checked),
    style: { width: "48px", minHeight: "44px", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
    React.createElement("span", { "aria-hidden": "true", style: { position: "relative", display: "inline-block", width: "40px", height: "24px", borderRadius: "999px", background: checked ? "var(--hs-primary, #0E4B43)" : "#B9C4BF", transition: "background .15s" } },
      React.createElement("span", { style: { position: "absolute", top: "2px", left: checked ? "18px" : "2px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .15s" } })));
}

const arrow = (disabled, label, onClick, txt) => React.createElement("button", { type: "button", "aria-label": label, disabled, onClick,
  style: { width: "40px", minHeight: "40px", border: "none", background: "none", fontSize: "16px", cursor: disabled ? "default" : "pointer", color: disabled ? "#B9C4BF" : "var(--hs-primary, #0E4B43)" } }, txt);

export function PageLayoutScreen({ page, onClose }) {
  const saved = useAppDesign(page); // বর্তমান সেভ-করা (বা ডিফল্ট)
  const initial = useRef(saved);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const dirty = !sameLayout(draft, initial.current);
  const def = PAGE_DEFS[page];

  function back() {
    if (dirty && !window.confirm("সেভ না করা পরিবর্তন বাদ দিতে চান?")) return;
    onClose();
  }
  async function save() {
    if (busy || !dirty) return;
    setBusy(true); setError(false);
    try { await saveDesignPage(page, draft); onClose(); } catch (_e) { setError(true); } finally { setBusy(false); }
  }
  const setZone = (z, next) => setDraft({ ...draft, [z]: next });

  return React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", background: "var(--hs-bg, #F1F6F2)", color: "var(--hs-text, #1F2D2A)" } },
    React.createElement("div", { style: { background: "var(--hs-primary, #0E4B43)", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" } },
      React.createElement("button", { type: "button", onClick: back, "aria-label": "ফিরে যান", style: { minWidth: "44px", minHeight: "44px", border: "none", background: "none", color: "#fff", fontSize: "22px", cursor: "pointer" } }, "←"),
      React.createElement("h1", { style: { margin: 0, fontSize: "18px", fontWeight: 700, color: "#fff" } }, def.label + " কাস্টমাইজ")),
    React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "14px 16px" } },
      React.createElement("p", { style: { fontSize: "13px", color: "var(--hs-muted, #5F716C)", margin: "0 0 12px", lineHeight: 1.5 } }, "স্থির = সবসময় খোলা। খোলা/বন্ধ = ভাঁজ করা যাবে, শুরুতে খোলা/বন্ধ থাকবে। আপনার সাজানো ডিজাইন সব সদস্য একই দেখবেন।"),
      zonesOf(page).map((z) => React.createElement("section", { key: z, style: { marginBottom: "16px" } },
        React.createElement("p", { style: { margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "var(--hs-muted, #5F716C)" } }, def.zones[z].label),
        draft[z].map((c, i) => React.createElement("div", { key: c.id, style: { display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px", padding: "6px 4px", borderRadius: "16px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", opacity: c.visible ? 1 : 0.6 } },
          React.createElement("div", { style: { display: "flex", flexDirection: "column", flexShrink: 0 } },
            arrow(i === 0, cardTitle(page, z, c.id) + " ওপরে সরান", () => setZone(z, moveCard(draft[z], c.id, -1)), "▲"),
            arrow(i === draft[z].length - 1, cardTitle(page, z, c.id) + " নিচে সরান", () => setZone(z, moveCard(draft[z], c.id, 1)), "▼")),
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontSize: "15px", fontWeight: 700 } }, cardTitle(page, z, c.id)),
            React.createElement("select", { "aria-label": cardTitle(page, z, c.id) + " ভাঁজের ধরন", value: c.fold, disabled: !c.visible,
              onChange: (e) => setZone(z, updateCard(draft[z], c.id, { fold: e.target.value })),
              style: { marginTop: "4px", minHeight: "40px", borderRadius: "10px", border: "1px solid var(--hs-input-border, #C3D2CA)", background: "var(--hs-bg, #F1F6F2)", color: "var(--hs-text, #1F2D2A)", padding: "0 8px", fontSize: "13px", fontFamily: "inherit" } },
              FOLDS.map((f) => React.createElement("option", { key: f, value: f }, FOLD_LABEL[f])))),
          React.createElement(Switch, { checked: c.visible, label: cardTitle(page, z, c.id) + " দেখান", onChange: (v) => setZone(z, updateCard(draft[z], c.id, { visible: v })) }))))),
      React.createElement("button", { type: "button", onClick: () => setDraft(defaultPage(page)),
        style: { width: "100%", minHeight: "44px", borderRadius: "12px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-chip-bg, #E4F0E9)", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "সব ডিফল্টে ফিরিয়ে নিন")),
    React.createElement("div", { style: { padding: "10px 16px 14px", background: "var(--hs-surface, #fff)", borderTop: "1px solid var(--hs-border, #D9E5DE)" } },
      error && React.createElement("p", { role: "alert", style: { margin: "0 0 8px", textAlign: "center", fontSize: "14px", color: "#B3261E" } }, "সেভ হয়নি। আবার চেষ্টা করুন।"),
      React.createElement("button", { type: "button", onClick: save, disabled: busy || !dirty,
        style: { width: "100%", minHeight: "48px", borderRadius: "14px", border: "none", fontSize: "16px", fontWeight: 700, color: "#fff", background: "var(--hs-primary, #0E4B43)", opacity: busy || !dirty ? 0.5 : 1, cursor: busy || !dirty ? "default" : "pointer", fontFamily: "inherit" } }, busy ? "সেভ হচ্ছে…" : "সেভ করুন")));
}
