// src/health/reports/LabAlertBox.js
//
// ধাপ ৫ — রেঞ্জের বাইরের মানের লাল সতর্কতা-বক্স (labAlerts.js-এর ফল দেখায়)। শুধু presentation।
// ৩টার বেশি হলে "আরও N টি"। রোগনির্ণয়ের ভাষা নয় — ডিসক্লেইমার সবসময় থাকে।

import { alertLine, summarizeAlerts, bnCount } from "./labAlerts.js";

// docsById: { [docId]: {fileName, cloudinaryUrl} } (ঐচ্ছিক) — উৎস-রিপোর্টের লিংক; onEdit(recordId): ভুল মান সংশোধনে ✎ (ঐচ্ছিক)
// onAck(recordId): "✓ দেখেছি, সতর্কতা সরান" (ঐচ্ছিক; এই বক্স ও হিরো থেকে সরে, পরিমাপের লাল থাকে); ackBusy: চলমান সরানোর recordId
export function LabAlertBox({ alerts, max, docsById, onEdit, onAck, ackBusy }) {
  const s = summarizeAlerts(alerts, max || 3);
  if (s.total === 0) return null;
  const red = "#B3261E";
  return React.createElement("div", { role: "alert", style: { marginTop: "12px", padding: "12px", borderRadius: "14px", background: "#FDF0EE", border: "1px solid #E8B4AE" } },
    React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: red } }, "🔴 " + bnCount(s.total) + "টি মান রেঞ্জের বাইরে — ডাক্তারকে দেখান"),
    s.shown.map((a) => {
      const d = a.sourceDocId && docsById ? docsById[a.sourceDocId] : null;
      return React.createElement("div", { key: a.testId, style: { fontSize: "14px", color: red, marginTop: "6px", overflowWrap: "anywhere" } },
        "🔴 " + alertLine(a),
        (d && d.cloudinaryUrl) || a.sourceDocName
          ? React.createElement("div", { style: { fontSize: "13px", color: "#5F716C" } }, d && d.cloudinaryUrl
              ? React.createElement("a", { href: d.cloudinaryUrl, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--hs-primary, #0E4B43)", fontWeight: 600 } }, "📄 " + d.fileName + " — দেখুন")
              : "📄 " + a.sourceDocName)
          : React.createElement("div", { style: { fontSize: "13px", color: "#5F716C" } }, "উৎস রিপোর্ট যুক্ত নেই"),
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "2px" } },
          onEdit && a.recordId && React.createElement("button", { type: "button", onClick: () => onEdit(a.recordId), style: { minHeight: "44px", padding: "0 12px", borderRadius: "12px", border: "1px solid " + red, background: "#fff", color: red, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } }, "✎ মান/রেঞ্জ সংশোধন"),
          onAck && a.recordId && React.createElement("button", { type: "button", disabled: !!ackBusy, onClick: () => onAck(a.recordId), "aria-label": "সতর্কতা সরান: " + a.name, style: { minHeight: "44px", padding: "0 12px", borderRadius: "12px", border: "1px solid #5F716C", background: "#fff", color: "#2B3A36", fontSize: "13px", fontWeight: 600, cursor: ackBusy ? "default" : "pointer", opacity: ackBusy ? 0.6 : 1, fontFamily: "inherit" } }, ackBusy === a.recordId ? "সরানো হচ্ছে..." : "✓ দেখেছি, সতর্কতা সরান")));
    }),
    s.more > 0 && React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", marginTop: "6px" } }, "আরও " + bnCount(s.more) + " টি — নিচের তালিকায় দেখুন"),
    React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "8px", lineHeight: 1.5 } },
      "এটি রোগনির্ণয় নয়। রেঞ্জের বাইরের মান মানেই অসুখ নয়, ডাক্তার ব্যাখ্যা করবেন। শুধু অ্যাপের পরিচিত টেস্টে এই সতর্কতা কাজ করে।",
      onAck && " সতর্কতা সরালেও নিচের \"পরিমাপে\" মানটি লাল থাকবে; মান বদলালে সতর্কতা আবার আসবে."));
}
