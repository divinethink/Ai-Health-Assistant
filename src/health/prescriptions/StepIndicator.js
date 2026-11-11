// src/health/prescriptions/StepIndicator.js
//
// ধাপ ৬ — প্রেসক্রিপশনের ৩-ধাপ ইন্ডিকেটর (১. ছবি · ২. দেখে নিন · ৩. যোগ)। শুধু presentation।
const h = React.createElement;
const G = "#0E4B43";
const LABELS = ["১. ছবি", "২. দেখে নিন", "৩. যোগ"];

export function StepIndicator({ step }) {
  return h("div", { "aria-label": "ধাপ " + step + "/৩", style: { display: "flex", gap: "8px", margin: "4px 0 12px" } },
    LABELS.map((l, i) => h("div", { key: i, style: { flex: 1 } },
      h("div", { style: { height: "4px", borderRadius: "4px", background: i < step ? G : "#E2DCCB" } }),
      h("div", { style: { fontSize: "12px", marginTop: "4px", fontWeight: i + 1 === step ? 700 : 400, color: i + 1 === step ? G : "#5F716C" } }, l))));
}
