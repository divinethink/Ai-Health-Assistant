// AI Health Summary — printable view (Architecture Plan Part C §10.3/§10.5)।
// DoctorExportPrintView.js-এর একই shell-pattern (window.print()-based PDF,
// header/footer/style) — আলাদা ফাইল রাখা হয়েছে যাতে ইতিমধ্যে-verified Health
// Profile view-তে কোনো ঝুঁকি না থাকে (Zero-Risk Discipline)।
const { useEffect } = React;

function fmtDate(ms) {
  if (!ms) return "";
  const d = ms.toMillis ? new Date(ms.toMillis()) : new Date(ms);
  return d.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
}

export function AiSummaryPrintView({ data, onBack }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `AI_Health_Summary_${(data.memberName || "Member").replace(/\s+/g, "_")}`;
    return () => { document.title = prevTitle; };
  }, [data]);

  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, background: "#fff", zIndex: 1000, overflow: "auto", padding: "16px" } },
    React.createElement("style", null, `
      @media print { .no-print { display: none !important; } }
      body { font-family: "Hind Siliguri", "Noto Sans Bengali", sans-serif; }
    `),
    React.createElement(
      "div", { className: "no-print", style: { display: "flex", gap: "8px", marginBottom: "12px" } },
      React.createElement("button", { onClick: onBack, style: { padding: "8px 14px", borderRadius: "8px", border: "1px solid #0E4B43", background: "#fff", color: "#0E4B43", fontWeight: 600 } }, "← ফিরে যান"),
      React.createElement("button", { onClick: () => window.print(), style: { padding: "8px 14px", borderRadius: "8px", border: "none", background: "#0E4B43", color: "#fff", fontWeight: 600 } }, "প্রিন্ট / PDF সেভ করুন")
    ),

    React.createElement("div", { style: { color: "#111", maxWidth: "720px", margin: "0 auto" } },
      React.createElement("div", { style: { textAlign: "center", borderBottom: "2px solid #0E4B43", paddingBottom: "8px" } },
        React.createElement("h2", { style: { margin: 0, color: "#0E4B43" } }, "Health Assistant — AI Health Summary")
      ),
      React.createElement("p", { style: { fontSize: "11px", color: "#888", textAlign: "right" } }, "তৈরির তারিখ: " + fmtDate(data.generatedAt)),
      React.createElement("p", null, "সদস্য: ", React.createElement("b", null, data.memberName || "—")),

      React.createElement("div", { style: { background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: "6px", padding: "10px" } },
        React.createElement("div", { style: { fontSize: "10px", fontWeight: 700, color: "#7A5B00", letterSpacing: "0.2px" } }, "AI Health Guidance — Not a Medical Prescription"),
        React.createElement("p", { style: { fontSize: "12px", margin: "6px 0 2px" } }, "প্রধান সমস্যা: " + (data.chiefComplaintTag || "—") + (data.episodeCreatedAt ? " (" + fmtDate(data.episodeCreatedAt) + ")" : "")),
        React.createElement("p", { style: { fontSize: "12px", margin: "2px 0" } }, "Risk Level: " + (data.riskLevel || "—")),
        data.recommendedAction && React.createElement("p", { style: { fontSize: "12px", margin: "2px 0" } },
          "পরামর্শ: " + (data.recommendedAction.action || "—") + (data.recommendedAction.timeframe ? " — " + data.recommendedAction.timeframe : ""))
      ),

      React.createElement("h4", null, "বিস্তারিত AI Guidance"),
      React.createElement("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap" } }, data.guidanceText),

      React.createElement("p", { style: { fontSize: "10px", color: "#888", borderTop: "1px solid #ccc", marginTop: "16px", paddingTop: "6px", textAlign: "center" } },
        "এটি প্রেসক্রিপশন/রোগনির্ণয় নয় — AI-generated guidance, চূড়ান্ত সিদ্ধান্তের জন্য ডাক্তারের পরামর্শ নিন।")
    )
  );
}
