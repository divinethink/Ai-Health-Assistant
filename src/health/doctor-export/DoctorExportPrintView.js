// Health Profile — printable view (Architecture Plan Part C §10.5 layout)।
// PDF generation পদ্ধতি: browser native "Print → Save as PDF" (window.print()) —
// DailyTask app-এর PrintReport.jsx-এ প্রমাণিত pattern reuse (Process Rule ২),
// কোনো নতুন dependency/bundle-size-cost ছাড়াই কাজ করে, mobile Chrome-সহ সব
// আধুনিক ব্রাউজারে সাপোর্টেড। DOCX output পরবর্তী ধাপ হিসেবে deferred (নিচে
// UI-নোট)।
import { describeHealthRecord } from "../records/healthRecordsData.js";

const { useEffect } = React;

function fmtAge(m) {
  if (m.ageYears == null) return "?";
  return m.ageYears >= 2 ? Math.floor(m.ageYears) + " বছর" : Math.round(m.ageYears * 12) + " মাস";
}
function fmtDate(ms) {
  if (!ms) return "";
  const d = ms.toMillis ? new Date(ms.toMillis()) : new Date(ms);
  return d.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
}

export function DoctorExportPrintView({ data, onBack }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `Health_Profile_${(data.member.name || "Member").replace(/\s+/g, "_")}`;
    return () => { document.title = prevTitle; };
  }, [data]);

  const m = data.member;

  return React.createElement(
    "div", { style: { position: "fixed", inset: 0, background: "#fff", zIndex: 1000, overflow: "auto", padding: "16px" } },
    React.createElement("style", null, `
      @media print { .no-print { display: none !important; } }
      body { font-family: "Hind Siliguri", "Noto Sans Bengali", sans-serif; }
      table { border-collapse: collapse; width: 100%; margin-top: 6px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; font-size: 12px; text-align: left; }
      th { background: #f0f4f1; }
    `),
    React.createElement(
      "div", { className: "no-print", style: { display: "flex", gap: "8px", marginBottom: "12px" } },
      React.createElement("button", { onClick: onBack, style: { padding: "8px 14px", borderRadius: "8px", border: "1px solid #0E4B43", background: "#fff", color: "#0E4B43", fontWeight: 600 } }, "← ফিরে যান"),
      React.createElement("button", { onClick: () => window.print(), style: { padding: "8px 14px", borderRadius: "8px", border: "none", background: "#0E4B43", color: "#fff", fontWeight: 600 } }, "প্রিন্ট / PDF সেভ করুন")
    ),

    React.createElement("div", { style: { color: "#111", maxWidth: "720px", margin: "0 auto" } },
      React.createElement("div", { style: { textAlign: "center", borderBottom: "2px solid #0E4B43", paddingBottom: "8px" } },
        React.createElement("h2", { style: { margin: 0, color: "#0E4B43" } }, "Health Assistant — রোগী স্বাস্থ্য প্রোফাইল"),
        React.createElement("p", { style: { fontSize: "11px", color: "#666", margin: "4px 0 0" } }, "এটি একটি factual সারাংশ — কোনো AI মতামত/রোগনির্ণয় এখানে নেই")
      ),
      React.createElement("p", { style: { fontSize: "11px", color: "#888", textAlign: "right" } }, "তৈরির তারিখ: " + fmtDate(data.generatedAt)),

      React.createElement("h4", null, "১. ব্যক্তিগত ও মৌলিক তথ্য"),
      React.createElement("table", null,
        React.createElement("tbody", null,
          React.createElement("tr", null, React.createElement("td", null, "নাম"), React.createElement("td", null, m.name)),
          React.createElement("tr", null, React.createElement("td", null, "বয়স"), React.createElement("td", null, fmtAge(m) + (m.ageGroup ? " (" + m.ageGroup + ")" : ""))),
          React.createElement("tr", null, React.createElement("td", null, "লিঙ্গ"), React.createElement("td", null, m.sex || "—")),
          React.createElement("tr", null, React.createElement("td", null, "উচ্চতা / ওজন / BMI"),
            React.createElement("td", null, (m.heightCm || "—") + " cm / " + (m.weightKg || "—") + " kg" + (m.bmi ? " / BMI " + m.bmi : ""))),
          React.createElement("tr", null, React.createElement("td", null, "রক্তের গ্রুপ"), React.createElement("td", null, m.bloodGroup || "—"))
        )
      ),

      React.createElement("div", { style: { background: "#FDEEEE", border: "1px solid #E57373", borderRadius: "6px", padding: "8px", marginTop: "12px" } },
        React.createElement("b", null, "⚠ এলার্জি ও সতর্কতা"),
        data.allergies.length === 0
          ? React.createElement("p", { style: { fontSize: "12px", margin: "4px 0 0" } }, "কোনো জানা এলার্জি নেই।")
          : React.createElement("ul", { style: { margin: "6px 0 0", paddingLeft: "18px" } },
              data.allergies.map((a) => React.createElement("li", { key: a.id, style: { fontSize: "12px" } }, describeHealthRecord(a))))
      ),

      data.currentComplaint && React.createElement(
        "div", { style: { background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: "6px", padding: "8px", marginTop: "12px" } },
        React.createElement("b", null, "২. বর্তমান সমস্যা"),
        React.createElement("p", { style: { fontSize: "12px", margin: "4px 0 0" } },
          (data.currentComplaint.chiefComplaintTag || "—") + (data.currentComplaint.createdAt ? " (" + fmtDate(data.currentComplaint.createdAt) + ")" : ""))
      ),

      React.createElement("h4", null, "৩. সক্রিয় স্বাস্থ্য সমস্যা"),
      data.activeConditions.length === 0
        ? React.createElement("p", { style: { fontSize: "12px", color: "#888" } }, "কোনো সক্রিয় condition নেই।")
        : React.createElement("table", null, React.createElement("tbody", null,
            data.activeConditions.map((c) => React.createElement("tr", { key: c.id },
              React.createElement("td", null, c.name), React.createElement("td", null, describeHealthRecord(c)))))),

      React.createElement("h4", null, "৪. বর্তমান ওষুধ"),
      data.currentMedications.length === 0
        ? React.createElement("p", { style: { fontSize: "12px", color: "#888" } }, "কোনো বর্তমান ওষুধ নেই।")
        : React.createElement("table", null, React.createElement("tbody", null,
            data.currentMedications.map((med) => React.createElement("tr", { key: med.id },
              React.createElement("td", null, med.genericName), React.createElement("td", null, describeHealthRecord(med)))))),

      React.createElement("h4", null, "৫. অতীত রোগের ইতিহাস (সমাধানকৃত)"),
      data.pastHistory.length === 0
        ? React.createElement("p", { style: { fontSize: "12px", color: "#888" } }, "কোনো তথ্য নেই।")
        : React.createElement("table", null, React.createElement("tbody", null,
            data.pastHistory.map((c) => React.createElement("tr", { key: c.id },
              React.createElement("td", null, c.name), React.createElement("td", null, describeHealthRecord(c)))))),

      React.createElement("p", { style: { fontSize: "10px", color: "#888", borderTop: "1px solid #ccc", marginTop: "16px", paddingTop: "6px", textAlign: "center" } },
        "এটি প্রেসক্রিপশন/রোগনির্ণয় নয় — শুধু পরিবার কর্তৃক সংরক্ষিত factual তথ্যের সারাংশ। Health Assistant App।")
    )
  );
}
