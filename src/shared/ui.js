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
