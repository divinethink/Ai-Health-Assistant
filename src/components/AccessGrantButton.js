// Take-Access বাটন — প্রতি non-self/non-structural member-row-এ বসে (Architecture
// Plan §11.1)। State/logic-এর মালিক caller component (MemberList) — এটা শুধু
// props/callback দিয়ে কাজ করে (Process ফাইল Rule ১১, presentational)।

const btnBase = { fontSize: "12px", padding: "4px 8px", borderRadius: "5px", cursor: "pointer" };

export function AccessGrantButton({ status, busy, onRequest, onCancelPending, onCancelApproved }) {
  if (status === "approved") {
    return React.createElement(
      "div", { style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" } },
      React.createElement("span", { style: { fontSize: "12px", color: "#0E4B43" } }, "Access Granted ✓"),
      React.createElement("button", {
        onClick: onCancelApproved, disabled: busy,
        style: { ...btnBase, border: "1px solid #C0392B", background: "#fff", color: "#C0392B" },
      }, "Cancel Access")
    );
  }
  if (status === "pending-outgoing") {
    return React.createElement(
      "div", { style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" } },
      React.createElement("button", {
        disabled: true,
        style: { ...btnBase, border: "1px solid #ccc", background: "#f5f5f5", color: "#888", cursor: "default" },
      }, "Pending for Approval"),
      React.createElement("button", {
        onClick: onCancelPending, disabled: busy, title: "অনুরোধ বাতিল করুন",
        style: { ...btnBase, border: "1px solid #C0392B", background: "#fff", color: "#C0392B" },
      }, "✕")
    );
  }
  return React.createElement(
    "div", { style: { marginTop: "4px" } },
    React.createElement("button", {
      onClick: onRequest, disabled: busy,
      style: { ...btnBase, border: "1px solid #0E4B43", background: "#0E4B43", color: "#fff" },
    }, "Take Access")
  );
}
