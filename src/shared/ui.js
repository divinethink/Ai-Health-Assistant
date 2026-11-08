// ---- ছোট UI primitives (app.js থেকে split, Component-Split — অংশ A) ----
// কোনো functional পরিবর্তন নেই, শুধু নিজস্ব ফাইলে সরানো হয়েছে।

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
  return React.createElement("div", { style: { padding: "24px", maxWidth: "420px", margin: "40px auto", fontFamily: "'Hind Siliguri', sans-serif" } }, children);
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
export function TabPills(tabs, activeId, onChange) {
  return React.createElement(
    "div", { style: { display: "flex", gap: "6px", overflowX: "auto", padding: "2px", marginBottom: "12px" } },
    tabs.map(([id, label]) => {
      const active = id === activeId;
      return React.createElement(
        "button", {
          key: id, onClick: () => onChange(id),
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
  const todayISO = new Date().toISOString().slice(0, 10);
  return React.createElement(
    "div", { style: { marginTop: "14px" } },
    React.createElement("label", { style: { fontSize: "14px", fontWeight: 600, color: "#1F2D2A", display: "block", marginBottom: "6px" } }, label),
    React.createElement("input", {
      type: "date", max: todayISO, value, onChange: (e) => onChange(e.target.value),
      style: { width: "100%", boxSizing: "border-box", padding: "12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px" },
    })
  );
}
