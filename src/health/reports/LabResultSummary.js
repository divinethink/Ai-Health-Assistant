// src/health/reports/LabResultSummary.js
//
// ধাপ ৬ — সেভের পর ল্যাব-ফল: 🔴 আগে (ডাক্তারকে দেখান), 🟢 ভাঁজ করা। labAlerts.js-এর ফল দেখায়, নতুন কিছু সংরক্ষণ নেই।
// রঙ + লেবেল + আইকন তিনটাই (রঙ-নির্ভর নয়)। রোগনির্ণয়ের ভাষা নেই।

import { alertLine, bnCount } from "./labAlerts.js";

const { useState } = React;
const h = React.createElement;
const RED = "#B3261E", GREEN = "#1E8A57", MUTED = "#5F716C";

const tile = (n, label, bg, color) => h("div", { style: { flex: 1, padding: "10px", borderRadius: "14px", background: bg, color, textAlign: "center" } },
  h("div", { style: { fontSize: "24px", fontWeight: 700, lineHeight: 1.2 } }, bnCount(n)),
  h("div", { style: { fontSize: "13px" } }, label));

/** @param {{summary: {alerts: object[], ok: object[], unchecked: number}, savedCount: number}} props */
export function LabResultSummary({ summary, savedCount }) {
  const [open, setOpen] = useState(false);
  const { alerts, ok, unchecked } = summary;
  return h("div", { style: { marginTop: "12px" } },
    h("div", { role: "status", style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)", fontWeight: 600, marginBottom: "8px" } }, "✓ " + bnCount(savedCount) + "টা মান সংরক্ষণ করা হয়েছে।"),
    h("div", { style: { display: "flex", gap: "8px" } },
      tile(alerts.length, "🔴 ডাক্তারকে দেখান", "#FDEBE8", RED),
      tile(ok.length, "🟢 ঠিক আছে", "#E4F0E9", GREEN)),
    alerts.map((a) => h("div", { key: a.testId, role: "alert", style: { marginTop: "8px", padding: "12px", borderRadius: "14px", background: "#FFF7F6", border: "1px solid #E8B4AE" } },
      h("div", { style: { fontSize: "15px", fontWeight: 700, color: RED, overflowWrap: "anywhere" } }, "🔴 " + alertLine(a)),
      h("div", { style: { fontSize: "13px", color: RED, marginTop: "2px" } }, "ডাক্তারকে দেখান"))),
    ok.length > 0 && h("div", { style: { marginTop: "8px", padding: "4px 12px", borderRadius: "14px", background: "#fff", border: "1px solid #D3E0D9" } },
      h("button", { type: "button", "aria-expanded": open, onClick: () => setOpen((o) => !o), style: { width: "100%", minHeight: "44px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0, fontSize: "14px", fontWeight: 600, color: GREEN, cursor: "pointer" } },
        h("span", null, "🟢 আরও " + bnCount(ok.length) + "টি পরীক্ষা ঠিক আছে"), h("span", null, open ? "▲" : "▼")),
      open && ok.map((o, i) => h("div", { key: i, style: { fontSize: "14px", color: "#3E4E49", padding: "4px 0" } }, "🟢 " + o.name + " — " + o.value + (o.unit ? " " + o.unit : "")))),
    unchecked > 0 && h("div", { style: { fontSize: "13px", color: MUTED, marginTop: "8px" } }, "ℹ️ " + bnCount(unchecked) + "টি মান অ্যাপের পরিচিত তালিকায় নেই, তাই সতর্কতা যাচাই হয়নি।"),
    h("div", { style: { marginTop: "8px", padding: "10px 12px", borderRadius: "12px", background: "#FFF6E5", color: "#8A5A00", fontSize: "14px", lineHeight: 1.5 } },
      "এটি রোগনির্ণয় নয়। রেঞ্জের বাইরের মান মানেই অসুখ নয় — ডাক্তার ব্যাখ্যা করবেন।"));
}
