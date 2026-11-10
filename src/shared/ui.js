// ---- ছোট UI primitives (app.js থেকে split, Component-Split — অংশ A) ----
// কোনো functional পরিবর্তন নেই, শুধু নিজস্ব ফাইলে সরানো হয়েছে।

import { histBind, histChange } from "./navHistory.js";
import { localISO } from "./dates.js";

export function ErrorBox(msg) {
  return React.createElement("div", {
    style: { marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: "#FDECEA", border: "1px solid #E5A29A", color: "#7A1F14", fontSize: "14px", lineHeight: 1.5 },
  }, msg);
}

export function SuccessBox(children) {
  return React.createElement("div", {
    style: { marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: "#E4F0E9", border: "1px solid #9CC5B4", color: "#0E4B43", fontSize: "14px", lineHeight: 1.5 },
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

export function PrimaryButton(label, onClick, busy) {
  return React.createElement("button", {
    onClick, disabled: busy,
    style: { marginTop: "16px", width: "100%", minHeight: "50px", padding: "12px", border: "none", borderRadius: "14px", background: busy ? "#8FAFA9" : "linear-gradient(135deg, #0E4B43, #17705F)", color: "#fff", fontSize: "15px", fontWeight: 700, cursor: busy ? "default" : "pointer", boxShadow: busy ? "none" : "0 4px 12px rgba(14,75,67,0.28)" },
  }, busy ? "অপেক্ষা করুন..." : label);
}

export function SecondaryButton(label, onClick, busy) {
  return React.createElement("button", {
    onClick, disabled: busy,
    style: { marginTop: "10px", width: "100%", minHeight: "48px", padding: "10px", borderRadius: "14px", background: "#fff", color: "#0E4B43", fontSize: "14px", fontWeight: 700, border: "1.5px solid #0E4B43", cursor: busy ? "default" : "pointer" },
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
            border: active ? "1px solid #0E4B43" : "1px solid #C3D2CA",
            background: active ? "linear-gradient(135deg, #0E4B43, #17705F)" : "#fff", color: active ? "#fff" : "#2B3A36",
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
