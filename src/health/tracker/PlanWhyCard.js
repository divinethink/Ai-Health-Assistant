// "💡 কেন এই প্ল্যান?" — ভাঁজযোগ্য কার্ড (শুধু UI)। লাইন আসে planExplain.js থেকে। ধাপ A২।

const { useState } = React;

export function PlanWhyCard({ lines, bare }) {
  const [open, setOpen] = useState(false); // ডিফল্টে ভাঁজ করা; ট্যাপে খোলে
  if (!lines || !lines.length) return null;
  // bare: হেডার ছাড়া শুধু ভেতরের লাইন (ভাঁজ-চিপ বাইরে থেকে নিয়ন্ত্রিত)
  if (bare) {
    return React.createElement("div", { style: { background: "#FBF1DF", border: "1px solid #EBD9B4", borderRadius: "14px", padding: "10px 14px", marginBottom: "8px", fontSize: "13px", color: "#4A5A55", lineHeight: 1.65 } },
      lines.map((l, i) => React.createElement("div", { key: i, style: { marginTop: i ? "4px" : 0 } }, "• " + l)));
  }
  return React.createElement("div", {
    style: { background: "#FBF1DF", border: "1px solid #EBD9B4", borderRadius: "14px", padding: "12px 14px", marginBottom: "12px" },
  },
    React.createElement("button", {
      onClick: () => setOpen(!open), "aria-expanded": open,
      style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: "44px", padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" },
    },
      React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, "💡 কেন এই প্ল্যান?"),
      React.createElement("span", { "aria-hidden": "true", style: { fontSize: "13px", color: "#5F716C" } }, open ? "▲" : "▼")),
    open && React.createElement("div", { style: { fontSize: "13px", color: "#4A5A55", lineHeight: 1.65, marginTop: "4px" } },
      lines.map((l, i) => React.createElement("div", { key: i, style: { marginTop: i ? "4px" : 0 } }, "• " + l))));
}
