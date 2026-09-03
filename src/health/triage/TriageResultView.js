// TriageResult রেন্ডার — riskLevel অনুযায়ী রং-কোডেড card + emergency-হলে কল-বাটন।
// roadmap §9.4 Emergency Quick Access-এর সবচেয়ে ছোট প্রথম সংস্করণ (শুধু ৯৯৯,
// পূর্ণ Verified Care-Escalation Directory §12.5.1 P8-এ যোগ হবে)।

const RISK_STYLE = {
  emergency: { bg: "#FDECEA", border: "#C0392B", color: "#7A1F14", label: "🚨 Emergency — এখনই ব্যবস্থা নিন" },
  urgent: { bg: "#FFF3E0", border: "#E67E22", color: "#8A4B00", label: "⚠️ Urgent — আজকের মধ্যে ডাক্তার দেখান" },
  "needs-attention": { bg: "#FFF8E1", border: "#E8C46B", color: "#7A5B00", label: "🔶 Needs Attention" },
  routine: { bg: "#E8F3EC", border: "#0E4B43", color: "#0E4B43", label: "✅ Routine" },
  "self-care": { bg: "#E8F3EC", border: "#0E4B43", color: "#0E4B43", label: "🏠 Self-care" },
};

export function TriageResultView({ result }) {
  const style = RISK_STYLE[result.riskLevel] || RISK_STYLE.routine;
  return React.createElement(
    "div",
    { style: { marginTop: "14px", padding: "12px", borderRadius: "8px", background: style.bg, border: "1px solid " + style.border } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: style.color } }, style.label),
    result.triggeredRules.length > 0 && React.createElement(
      "div", { style: { fontSize: "13px", marginTop: "6px", color: style.color } },
      "কারণ: " + result.triggeredRules.map((r) => r.description).join("; ")
    ),
    React.createElement(
      "div", { style: { fontSize: "13px", marginTop: "6px", color: "#333" } },
      "পরামর্শ: " + result.recommendedAction.timeframe
    ),
    result.recommendedAction.emergencyContact && React.createElement(
      "a",
      {
        href: "tel:" + result.recommendedAction.emergencyContact.number,
        style: {
          display: "inline-block", marginTop: "10px", padding: "10px 16px", background: "#C0392B",
          color: "#fff", borderRadius: "8px", fontWeight: 700, textDecoration: "none", fontSize: "14px",
        },
      },
      "☎ এখনই কল করুন — " + result.recommendedAction.emergencyContact.number
    ),
    result.uncertaintyLevel === "high" && result.missingInformation.length > 0 && React.createElement(
      "div", { style: { fontSize: "11px", color: "#888", marginTop: "8px" } },
      result.missingInformation.join(" ")
    )
  );
}
