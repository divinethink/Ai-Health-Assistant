// ৩ সারির compact ডাক্তার-ফিল্ড (Doctor Details ও Health Record — দুই জায়গায় একই)।
// সারি ১: নাম | 📇 কার্ড; সারি ২: বিশেষত্ব | এলাকা; সারি ৩: প্রতিষ্ঠান | ফোন।
// "আরও (ঠিকানা/সময়)" ভাঁজে chamberAddress — ডেটা হারায় না (value.chamberAddress সংরক্ষিত)।
// Controlled: value, onChange(patch), suggestions (pure doctorSuggest থেকে), onPick(candidate)।

import { DOCTOR_CATEGORIES } from "./doctorDetailsData.js";

const { useState } = React;

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px", minHeight: "44px" };
const rowStyle = { display: "flex", gap: "8px", marginTop: "10px", alignItems: "stretch" };
const cell = { flex: 1, minWidth: 0 };

export function DoctorFieldsRow({ value, onChange, suggestions, onPick, onCardClick, cardLabel, showCategory = true }) {
  const [open, setOpen] = useState(false);
  const v = value || {};
  const set = (k) => (e) => onChange({ [k]: e.target.value });
  const list = suggestions || [];

  return React.createElement(
    "div", null,
    // সারি ১
    React.createElement("div", { style: { ...rowStyle, position: "relative" } },
      React.createElement("div", { style: cell },
        React.createElement("input", { type: "text", value: v.name || "", placeholder: "ডাক্তারের নাম (যেমন: ডা. রহিম)", "aria-label": "ডাক্তারের নাম", onChange: (e) => { onChange({ name: e.target.value }); setOpen(true); }, onFocus: () => setOpen(true), onBlur: () => setTimeout(() => setOpen(false), 150), style: inputStyle }),
        open && list.length > 0 && React.createElement("div", { role: "listbox", style: { position: "absolute", zIndex: 5, left: 0, right: 0, top: "100%", background: "#fff", border: "1px solid #C3D2CA", borderRadius: "12px", boxShadow: "0 4px 12px rgba(14,75,67,0.15)", maxHeight: "220px", overflowY: "auto" } },
          list.map((c, i) => React.createElement("div", { key: (c.id || "r") + i, role: "option", onMouseDown: (e) => { e.preventDefault(); onPick(c); setOpen(false); }, style: { padding: "10px 12px", fontSize: "14px", borderBottom: "1px solid #EEF3F0", cursor: "pointer" } },
            React.createElement("div", { style: { fontWeight: 600, color: "#1F2D2A" } }, c.name),
            React.createElement("div", { style: { fontSize: "12px", color: "#5F716C" } }, [c.hospital, c.phone].filter(Boolean).join(" · ") || (c.source === "record" ? "আগের রেকর্ড থেকে" : "")))))),
      onCardClick && React.createElement("button", { type: "button", onClick: onCardClick, "aria-label": "ভিজিটিং কার্ড", style: { minWidth: "48px", minHeight: "44px", border: "1.5px solid #C3D2CA", borderRadius: "12px", background: "#F9FBFA", fontSize: "18px", cursor: "pointer" } }, cardLabel || "📇")),
    // সারি ২
    React.createElement("div", { style: rowStyle },
      showCategory && React.createElement("select", { value: v.specialtyCategory || DOCTOR_CATEGORIES[0][0], onChange: set("specialtyCategory"), "aria-label": "বিশেষত্ব", style: { ...inputStyle, ...cell } },
        DOCTOR_CATEGORIES.map(([k, l]) => React.createElement("option", { key: k, value: k }, l))),
      React.createElement("input", { type: "text", value: v.area || "", placeholder: "এলাকা", "aria-label": "এলাকা", onChange: set("area"), style: { ...inputStyle, ...cell } })),
    // সারি ৩
    React.createElement("div", { style: rowStyle },
      React.createElement("input", { type: "text", value: v.hospital || "", placeholder: "প্রতিষ্ঠান/চেম্বার", "aria-label": "প্রতিষ্ঠান", onChange: set("hospital"), style: { ...inputStyle, ...cell } }),
      React.createElement("input", { type: "tel", value: v.phone || "", placeholder: "ফোন", "aria-label": "ফোন", onChange: set("phone"), style: { ...inputStyle, ...cell } })),
    // ভাঁজ
    React.createElement("details", { style: { marginTop: "10px" }, open: !!v.chamberAddress },
      React.createElement("summary", { style: { fontSize: "14px", color: "#0E4B43", cursor: "pointer", minHeight: "32px" } }, "আরও (ঠিকানা/সময়)"),
      React.createElement("input", { type: "text", value: v.chamberAddress || "", placeholder: "চেম্বারের ঠিকানা/সময়সূচি", "aria-label": "চেম্বার-ঠিকানা", onChange: set("chamberAddress"), style: { ...inputStyle, marginTop: "6px" } }))
  );
}
