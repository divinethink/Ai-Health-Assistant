// ---- ছোট UI primitives (app.js থেকে split, Component-Split — অংশ A) ----
// কোনো functional পরিবর্তন নেই, শুধু নিজস্ব ফাইলে সরানো হয়েছে।

import { createPortal } from "react-dom";
import { histBind, histChange } from "./navHistory.js";
import { localISO } from "./dates.js";

export function ErrorBox(msg) {
  return React.createElement("div", {
    style: { marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: "#FDECEA", border: "1px solid #E5A29A", color: "#7A1F14", fontSize: "14px", lineHeight: 1.5 },
  }, msg);
}

export function SuccessBox(children) {
  return React.createElement("div", {
    style: { marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: "#E4F0E9", border: "1px solid #9CC5B4", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", lineHeight: 1.5 },
  }, children);
}

export function TextField(label, value, onChange, placeholder) {
  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("label", { style: { fontSize: "14px", fontWeight: 600, color: "#1F2D2A", display: "block", marginBottom: "6px" } }, label),
    React.createElement("input", {
      type: "text", value, placeholder, onChange: (e) => onChange(e.target.value),
      style: { width: "100%", boxSizing: "border-box", padding: "12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px" },
    })
  );
}

// disabled (ঐচ্ছিক ৪র্থ আর্গ): বাটন অচল ও ধূসর, কিন্তু লেখা বদলায় না (busy হলে "অপেক্ষা করুন...")
export function PrimaryButton(label, onClick, busy, disabled) {
  const off = !!busy || !!disabled;
  return React.createElement("button", {
    onClick, disabled: off,
    style: { marginTop: "16px", width: "100%", minHeight: "50px", padding: "12px", border: "none", borderRadius: "14px", background: off ? "#8FAFA9" : "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))", color: "#fff", fontSize: "15px", fontWeight: 700, cursor: off ? "default" : "pointer", boxShadow: off ? "none" : "0 4px 12px rgba(14,75,67,0.28)" },
  }, busy ? "অপেক্ষা করুন..." : label);
}

export function SecondaryButton(label, onClick, busy) {
  return React.createElement("button", {
    onClick, disabled: busy,
    style: { marginTop: "10px", width: "100%", minHeight: "48px", padding: "10px", borderRadius: "14px", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", fontWeight: 700, border: "1.5px solid var(--hs-primary, #0E4B43)", cursor: busy ? "default" : "pointer" },
  }, label);
}

export function Card(children) {
  // লগইন/লোডিং/ত্রুটির স্ক্রিন — নরম সবুজ জমির ওপর কেন্দ্রে সাদা কার্ড
  return React.createElement(
    "div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", boxSizing: "border-box", background: "linear-gradient(160deg, #E4F0E9 0%, #F1F6F2 55%, #FFFFFF 100%)", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement("div", { className: "hs-page", style: { width: "100%", maxWidth: "400px", padding: "28px 24px", boxSizing: "border-box", background: "#fff", borderRadius: "24px", boxShadow: "0 12px 36px rgba(14,75,67,0.14)", border: "1px solid #D9E5DE" } }, children)
  );
}

// লোডিং skeleton — "লোড হচ্ছে…" লেখার বদলে ধূসর শিমার-কার্ড (reduced-motion হলে অ্যানিমেশন নেই)
const SKEL_CSS = "@keyframes hs-skel{0%{background-position:200% 0}100%{background-position:-200% 0}}.hs-skel{background:linear-gradient(90deg,#E4ECE7 25%,#F1F6F2 50%,#E4ECE7 75%);background-size:200% 100%;animation:hs-skel 1.4s linear infinite}@media (prefers-reduced-motion:reduce){.hs-skel{animation:none}}";
export function Skeleton(rows, height) {
  const n = rows || 3, h = (height || 56) + "px";
  return React.createElement("div", { role: "status", "aria-busy": "true", "aria-label": "লোড হচ্ছে" },
    React.createElement("style", null, SKEL_CSS),
    Array.from({ length: n }, (_, i) => React.createElement("div", { key: "sk" + i, className: "hs-skel", style: { height: h, borderRadius: "14px", marginBottom: "8px", width: i === n - 1 && n > 1 ? "70%" : "100%" } })));
}

// dropdown ও date-picker — Health Record ফর্মে বারবার লাগে।
export function SelectField(label, value, onChange, options) {
  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("label", { style: { fontSize: "14px", fontWeight: 600, color: "#1F2D2A", display: "block", marginBottom: "6px" } }, label),
    React.createElement(
      "select", { value, onChange: (e) => onChange(e.target.value),
        style: { width: "100%", boxSizing: "border-box", padding: "12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px" } },
      options.map(([v, l]) => React.createElement("option", { key: v, value: v }, l))
    )
  );
}

// Sub-tab pill row — full-page section-এর ভেতরের একাধিক component-কে
// পাশাপাশি স্তূপ না করে ট্যাব হিসেবে ভাগ করার জন্য (roadmap §1_5-এর "sub-tab
// pill" pattern, প্রথম ব্যবহার: AI চ্যাট ও Documents full-page reorg, ২০২৬-০৯-১৬)।
// শুধু presentation primitive — কোনো state/business-logic এখানে নেই।
export function TabPills(tabs, activeId, onChange, leading, histKey) {
  if (histKey) histBind(histKey, activeId, onChange); // Back বাটনে এই পিল-সারির আগের অবস্থায় ফেরা
  return React.createElement(
    "div", { style: { display: "flex", gap: "6px", overflowX: "auto", padding: "2px", marginBottom: "12px" } },
    leading || null,
    tabs.map(([id, label]) => {
      const active = id === activeId;
      return React.createElement(
        "button", {
          key: id, onClick: () => (histKey ? histChange(histKey, activeId, id, onChange) : onChange(id)),
          style: {
            flexShrink: 0, fontSize: "14px", fontWeight: 600, padding: "9px 16px", minHeight: "42px", borderRadius: "999px", cursor: "pointer",
            border: active ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid var(--hs-input-border, #C3D2CA)",
            background: active ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "var(--hs-surface, #fff)", color: active ? "#fff" : "var(--hs-text, #2B3A36)",
            boxShadow: active ? "0 3px 8px rgba(14,75,67,0.25)" : "none",
          },
        },
        label
      );
    })
  );
}

// Collapsible/accordion section — একবারে-ব্যবহৃত ফর্ম-জাতীয় component
// (upload-form, report-analysis, care-escalation category-group ইত্যাদি)
// ডিফল্ট-বন্ধ রেখে scroll কমানোর জন্য। প্রকৃত React component (props:
// {title, defaultOpen, children}) — অবশ্যই React.createElement(CollapsibleSection,
// {...}) দিয়ে call করতে হবে, plain function-call না (ভেতরে useState থাকায়
// .map()-লুপে plain-call করলে Hooks Rule ভাঙে/hook-isolation নষ্ট হয়)।
export function CollapsibleSection({ title, defaultOpen, children }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return React.createElement(
    "div", { style: { border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "16px", marginBottom: "14px", overflow: "hidden", background: "var(--hs-surface, #fff)", boxShadow: "0 2px 8px rgba(14,75,67,0.07)" } },
    React.createElement(
      "div", {
        onClick: () => setOpen((o) => !o),
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", minHeight: "52px", background: "var(--hs-chip-bg, #E4F0E9)", cursor: "pointer" },
      },
      React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "var(--hs-primary, #0E4B43)" } }, title),
      React.createElement("span", { style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)" } }, open ? "▲" : "▼")
    ),
    open && React.createElement("div", { style: { padding: "14px 16px", color: "var(--hs-text, #1B2430)" } }, children)
  );
}

export function DateField(label, value, onChange) {
  const todayISO = localISO();
  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("label", { style: { fontSize: "14px", fontWeight: 600, color: "#1F2D2A", display: "block", marginBottom: "6px" } }, label),
    React.createElement("input", {
      type: "date", max: todayISO, value, onChange: (e) => onChange(e.target.value),
      style: { width: "100%", boxSizing: "border-box", padding: "12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px" },
    })
  );
}

// ---- SheetFrame: ফুল-স্ক্রিন শিট (ওপরে ডানে স্থির ✕, নিজস্ব স্ক্রল, ঐচ্ছিক স্থির footer) ----
// scrollKey বদলালে (যেমন ধাপ বদল) শিটের স্ক্রল ওপরে ফেরে। পেছনের পেজের স্ক্রল-জায়গা প্রভাবিত হয় না।
// Esc চাপলেও বন্ধ। শুধু presentation — কোনো ডেটা/state-logic নেই।
export function CloseX(onClick, label) {
  return React.createElement("button", {
    type: "button", onClick, "aria-label": label || "বন্ধ করুন",
    style: { flexShrink: 0, minWidth: "44px", minHeight: "44px", border: "none", borderRadius: "12px", background: "rgba(14,75,67,0.08)", color: "var(--hs-primary, #0E4B43)", fontSize: "20px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  }, "✕");
}

export function SheetFrame({ title, onClose, scrollKey, footer, accent, children }) {
  const ac = accent ? ACCENTS[accent] : null;
  const bodyRef = React.useRef(null);
  React.useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [scrollKey]);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // document.body-তে আঁকা: হেলথ-পেজের (z-index ৪০) ভেতরে থাকলে নিচের নেভ-বার (৪৫) ফর্মের সংরক্ষণ বাটন ঢেকে দিত
  return createPortal(React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": title, style: { position: "fixed", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", background: ac ? ac.tint : "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif", ...(ac ? accentVars(accent) : {}) } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "calc(6px + env(safe-area-inset-top, 0px)) 8px 6px 14px", background: "#fff", borderBottom: ac ? "3px solid " + ac.main : "1px solid #D9E5DE", flexShrink: 0 } },
      React.createElement("div", { style: { flex: 1, minWidth: 0, fontSize: "16px", fontWeight: 700, color: "var(--hs-primary, #0E4B43)", overflowWrap: "anywhere" } }, title),
      CloseX(onClose)),
    React.createElement("div", { ref: bodyRef, style: { flex: 1, overflowY: "auto", overflowAnchor: "none", padding: "10px 12px 24px", WebkitOverflowScrolling: "touch" } }, children),
    footer && React.createElement("div", { style: { flexShrink: 0, padding: "8px 12px calc(8px + env(safe-area-inset-bottom, 0px))", background: "#fff", borderTop: "1px solid #D9E5DE" } }, footer)), document.body);
}

// ---- ধরন-ভিত্তিক রং: প্রতিটা "যোগ"-পেজ আলাদা রঙে চেনা যায় ----
// accentVars() CSS-variable বদলায় (--hs-primary), তাই ভেতরের বাটন/শিরোনাম/চিপ নিজে থেকে ওই রঙ নেয়।
export const ACCENTS = {
  condition: { main: "#2B5EA7", main2: "#3F78C4", tint: "#EEF4FC", border: "#B7CDEB" },
  allergy: { main: "#B45309", main2: "#D2691E", tint: "#FFF5EA", border: "#F0CBA0" },
  medicationStatement: { main: "#6A4BB0", main2: "#8466C9", tint: "#F4F0FC", border: "#D3C7EE" },
  observation: { main: "#0B7A85", main2: "#169AA6", tint: "#E9F6F7", border: "#B3DADE" },
  lab: { main: "#B03A5B", main2: "#C9536F", tint: "#FDF0F3", border: "#EFC3CF" },
};
export function accentVars(kind) {
  const a = ACCENTS[kind];
  return a ? { "--hs-primary": a.main, "--hs-primary-2": a.main2 } : {};
}

// ---- ConfirmDialog: স্ট্যান্ডার্ড মোছার নিশ্চিতকরণ (মাঝখানে ডায়ালগ; ডিফল্ট ফোকাস "বাতিল") ----
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, busy, onConfirm, onCancel }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);
  const btn = { flex: 1, minHeight: "48px", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  const dlg = React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement("div", { onClick: busy ? undefined : onCancel, "aria-hidden": "true", style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" } }),
    React.createElement("div", { role: "alertdialog", "aria-modal": "true", "aria-label": title, style: { position: "relative", width: "100%", maxWidth: "340px", background: "#fff", borderRadius: "20px", padding: "20px 18px 16px", boxShadow: "0 16px 40px rgba(0,0,0,0.3)" } },
      React.createElement("div", { style: { fontSize: "18px", fontWeight: 800, color: "#1F2D2A" } }, title || "মুছে ফেলবেন?"),
      message && React.createElement("div", { style: { fontSize: "14px", color: "#4B5C57", marginTop: "8px", lineHeight: 1.5, overflowWrap: "anywhere" } }, message),
      React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "18px" } },
        React.createElement("button", { type: "button", autoFocus: true, onClick: onCancel, disabled: busy, style: { ...btn, border: "1.5px solid #C3D2CA", background: "#fff", color: "#2B3A36" } }, cancelLabel || "বাতিল"),
        React.createElement("button", { type: "button", onClick: onConfirm, disabled: busy, style: { ...btn, border: "none", background: busy ? "#D9A39D" : "#B3261E", color: "#fff" } }, busy ? "মুছছে..." : (confirmLabel || "মুছুন")))));
  return createPortal(dlg, document.body);
}
