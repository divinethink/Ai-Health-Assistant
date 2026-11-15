// "ওজন" কার্ডের সাপ্তাহিক ইঙ্গিত (UI)। হিসাব weighDay.js-এ (pure)। কার্ড সারা সপ্তাহ একই জায়গায় থাকে —
// ওজনের আগের দিন সন্ধ্যা ৭টা থেকে ওজনের দিন শেষ পর্যন্ত, ইনপুট বাকি থাকলে চারপাশে লাল আভা (স্পন্দিত), দিন পেরোলে আর কিছু নয়।
// রঙ-নির্ভর নয়: আভার সাথে সবসময় লেখা থাকে। শিশু/গেট-ব্লক (soft) সদস্যে আভা নেই, শুধু নরম লেখা।
import { bnNum } from "../../shared/dates.js";
import { Icon } from "../../shared/icons.js";
import { T } from "./trackerTheme.js";
import { daysAgoText } from "./weighDay.js";

const CSS = "@keyframes hs-weigh-pulse{0%,100%{box-shadow:0 0 0 2px #E5484D,0 0 10px 1px rgba(229,72,77,.32)}50%{box-shadow:0 0 0 2px #E5484D,0 0 22px 7px rgba(229,72,77,.55)}}"
  + ".hs-weigh-due{animation:hs-weigh-pulse 1.9s ease-in-out infinite;border-color:#E5484D!important}"
  + "@media (prefers-reduced-motion:reduce){.hs-weigh-due{animation:none;box-shadow:0 0 0 2px #E5484D,0 0 16px 4px rgba(229,72,77,.5)!important}}";
let cssOn = false;
function ensureCss() {
  if (cssOn || typeof document === "undefined") return;
  cssOn = true;
  try { const el = document.createElement("style"); el.setAttribute("data-hs", "weigh-cue"); el.textContent = CSS; document.head.appendChild(el); } catch (_e) { /* আভা ছাড়াই চলবে — লেখা ঠিকই দেখায় */ }
}

// ws = weighState() ফল; dayName = "শুক্রবার" ইত্যাদি
export function weighCue(ws, dayName) {
  ensureCss();
  const pending = ws.kind === "due";
  const glow = pending && !ws.soft;
  return {
    pending, glow,
    className: glow ? "hs-weigh-due" : undefined,
    label: ws.kind === "due" ? dayName + " ওজন ইনপুট দিন" : null, // আগের সন্ধ্যা ৭টা থেকে ওজনের দিন শেষ পর্যন্ত, ইনপুট দিলেই চলে যায়
    color: !pending ? null : ws.soft ? T.green : "#D6393F",
    dot: !glow ? null : "#E5484D",
  };
}

// হিরো-কার্ড থাকলে পানির পাশের ছোট "ওজন" বাটন
export function WeighButton({ ws, dayName, onClick, cardStyle }) {
  const cue = weighCue(ws, dayName);
  const info = !cue.label && ws.lastKg ? [bnNum(ws.lastKg) + " কেজি", daysAgoText(ws.daysAgo, bnNum)] : null;
  return React.createElement("button", {
    type: "button", onClick, className: cue.className,
    "aria-label": "ওজন যোগ/বদলান" + (cue.label ? " — " + cue.label : info ? " — শেষ ওজন " + info.join(", ") : ""),
    style: { ...cardStyle, color: T.green, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px", padding: "4px 3px", cursor: "pointer", fontFamily: "inherit" },
  },
    React.createElement("span", { "aria-hidden": "true", style: { width: "26px", height: "26px", borderRadius: "50%", background: cue.dot || T.track, color: cue.dot ? "#fff" : T.green, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" } }, Icon("plus", { size: 17, stroke: 2.4 })),
    React.createElement("span", { style: { fontSize: "14px", fontWeight: 800, lineHeight: 1.2 } }, "ওজন"),
    cue.label && React.createElement("span", { style: { fontSize: "11.5px", fontWeight: 700, lineHeight: 1.2, color: cue.color, textAlign: "center", maxWidth: "100%" } }, cue.label),
    info && React.createElement("span", { style: { fontSize: "12px", fontWeight: 700, lineHeight: 1.15, color: T.ink, whiteSpace: "nowrap" } }, info[0]),
    info && React.createElement("span", { style: { fontSize: "11px", lineHeight: 1.1, color: T.muted, whiteSpace: "nowrap" } }, info[1]));
}
