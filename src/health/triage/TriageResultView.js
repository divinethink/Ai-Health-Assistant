// TriageResult রেন্ডার — riskLevel অনুযায়ী রং-কোডেড card + emergency-হলে কল-বাটন।
// roadmap §9.4 Emergency Quick Access-এর সবচেয়ে ছোট প্রথম সংস্করণ (শুধু ৯৯৯, পূর্ণ Verified Care-Escalation Directory §12.5.1 P8-এ আছে)।
// ধাপ ৩: শুধু সাজানো/লেখা বদল (বাংলা লেবেল, জরুরিতে লাল কার্ড + বড় সাদা কল-বাটন, "কেন এই ফল?" এক বাক্সে)।
// result-এর ডেটা, riskLevel, নিয়ম ও কল-নম্বর অপরিবর্তিত — এই ফাইল কিছু হিসাব করে না।

const RISK_STYLE = {
  emergency: { bg: "#C0392B", border: "#C0392B", color: "#FFFFFF", label: "জরুরি — এখনই", icon: "⚠️", solid: true },
  urgent: { bg: "#FFF3E0", border: "#E67E22", color: "#8A4B00", label: "দ্রুত — আজকের মধ্যে ডাক্তার দেখান", icon: "⚠️" },
  "needs-attention": { bg: "#FFF8E1", border: "#E8C46B", color: "#7A5B00", label: "নজর দিন", icon: "🔶" },
  routine: { bg: "#E8F3EC", border: "var(--hs-primary, #0E4B43)", color: "var(--hs-primary, #0E4B43)", label: "সাধারণ", icon: "✅" },
  "self-care": { bg: "#E8F3EC", border: "var(--hs-primary, #0E4B43)", color: "var(--hs-primary, #0E4B43)", label: "ঘরোয়া যত্ন", icon: "🏠" },
};

const h = React.createElement;
const bnDigits = (x) => String(x).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]); // গ্রুপিং-কমা ছাড়া (যেমন ১৬২৬৩)

export function TriageResultView({ result }) {
  const style = RISK_STYLE[result.riskLevel] || RISK_STYLE.routine;
  const contact = result.recommendedAction.emergencyContact;
  const sources = [...new Set(result.triggeredRules.map((r) => r.ruleSource).filter(Boolean))];
  return h("div", { style: { marginTop: "14px" } },
    h("div", { style: { padding: "14px", borderRadius: "18px", background: style.bg, border: "1px solid " + style.border } },
      h("div", { style: { fontSize: "20px", fontWeight: 800, color: style.color } }, h("span", { "aria-hidden": "true" }, style.icon + " "), style.label),
      h("div", { style: { fontSize: "15px", marginTop: "6px", lineHeight: 1.5, color: style.solid ? "rgba(255,255,255,0.95)" : "#1F2D2A" } }, "পরামর্শ: " + result.recommendedAction.timeframe),
      contact && h("a", {
        href: "tel:" + contact.number,
        style: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "12px", minHeight: "56px", padding: "0 16px", background: "#FFFFFF", color: "#C0392B", border: "2px solid #C0392B", borderRadius: "14px", fontWeight: 800, textDecoration: "none", fontSize: "20px" },
      }, h("span", { "aria-hidden": "true" }, "📞"), bnDigits(contact.number) + " কল করুন")),
    result.triggeredRules.length > 0 && h("div", { style: { marginTop: "10px", padding: "10px 14px", borderRadius: "14px", background: "#fff", border: "1px solid #D9E5DE" } },
      h("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, "কেন এই ফল?"),
      h("div", { style: { fontSize: "14px", marginTop: "4px", lineHeight: 1.5, color: "#3E4E49" } },
        "আপনার বাছাই: " + result.triggeredRules.map((r) => r.description).join("; ") + (sources.length ? "। নিয়ম: " + sources.join("; ") : ""))),
    h("div", { style: { marginTop: "10px", padding: "10px 14px", borderRadius: "14px", background: "#FFF6DD", border: "1px solid #E8D08A", fontSize: "14px", color: "#7A5B00", lineHeight: 1.5 } },
      h("b", null, "AI স্বাস্থ্য-নির্দেশনা — প্রেসক্রিপশন নয়।"), " ডাক্তারের বিকল্প নয়।"),
    result.uncertaintyLevel === "high" && result.missingInformation.length > 0 && h("div", { style: { fontSize: "14px", color: "#5F716C", marginTop: "8px" } },
      result.missingInformation.join(" "))
  );
}
