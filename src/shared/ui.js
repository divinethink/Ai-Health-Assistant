// ---- ছোট UI primitives (app.js থেকে split, Component-Split — অংশ A) ----
// কোনো functional পরিবর্তন নেই, শুধু নিজস্ব ফাইলে সরানো হয়েছে।

export function ErrorBox(msg) {
  return React.createElement("div", {
    style: { marginTop: "12px", padding: "10px", borderRadius: "8px", background: "#FDECEA", border: "1px solid #C0392B", color: "#7A1F14", fontSize: "13px" },
  }, msg);
}

export function SuccessBox(children) {
  return React.createElement("div", {
    style: { marginTop: "12px", padding: "10px", borderRadius: "8px", background: "#E8F3EC", border: "1px solid #0E4B43", color: "#0E4B43", fontSize: "13px" },
  }, children);
}

export function TextField(label, value, onChange, placeholder) {
  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, label),
    React.createElement("input", {
      type: "text", value, placeholder, onChange: (e) => onChange(e.target.value),
      style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
    })
  );
}

export function PrimaryButton(label, onClick, busy) {
  return React.createElement("button", {
    onClick, disabled: busy,
    style: { marginTop: "14px", width: "100%", padding: "12px", border: "none", borderRadius: "8px", background: busy ? "#8FAFA9" : "#0E4B43", color: "#fff", fontSize: "15px", fontWeight: 600, cursor: busy ? "default" : "pointer" },
  }, busy ? "অপেক্ষা করুন..." : label);
}

export function SecondaryButton(label, onClick, busy) {
  return React.createElement("button", {
    onClick, disabled: busy,
    style: { marginTop: "8px", width: "100%", padding: "10px", borderRadius: "8px", background: "#fff", color: "#0E4B43", fontSize: "14px", fontWeight: 600, border: "1px solid #0E4B43", cursor: busy ? "default" : "pointer" },
  }, label);
}

export function Card(children) {
  return React.createElement("div", { style: { padding: "24px", maxWidth: "420px", margin: "40px auto", fontFamily: "'Hind Siliguri', sans-serif" } }, children);
}

// dropdown ও date-picker — Health Record ফর্মে বারবার লাগে।
export function SelectField(label, value, onChange, options) {
  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, label),
    React.createElement(
      "select", { value, onChange: (e) => onChange(e.target.value),
        style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" } },
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
            flexShrink: 0, fontSize: "12px", fontWeight: 600, padding: "7px 12px", borderRadius: "999px", cursor: "pointer",
            border: active ? "1px solid #0E4B43" : "1px solid #CBD5E1",
            background: active ? "#0E4B43" : "#fff", color: active ? "#fff" : "#333",
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
    "div", { style: { border: "1px solid var(--hs-border, #E2E8F0)", borderRadius: "8px", marginBottom: "12px", overflow: "hidden" } },
    React.createElement(
      "div", {
        onClick: () => setOpen((o) => !o),
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--hs-chip-bg, #F5F5F0)", cursor: "pointer" },
      },
      React.createElement("span", { style: { fontSize: "14px", fontWeight: 600, color: "var(--hs-primary, #0E4B43)" } }, title),
      React.createElement("span", { style: { fontSize: "13px", color: "var(--hs-primary, #0E4B43)" } }, open ? "▲" : "▼")
    ),
    open && React.createElement("div", { style: { padding: "12px", color: "var(--hs-text, #1B2430)" } }, children)
  );
}

export function DateField(label, value, onChange) {
  const todayISO = new Date().toISOString().slice(0, 10);
  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    React.createElement("label", { style: { fontSize: "13px", color: "#333", display: "block", marginBottom: "4px" } }, label),
    React.createElement("input", {
      type: "date", max: todayISO, value, onChange: (e) => onChange(e.target.value),
      style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" },
    })
  );
}
