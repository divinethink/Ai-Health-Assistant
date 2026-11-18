// সাপ্তাহিক রিভিউ লক: বৃহস্পতি রাত ৯টা → শনি রাত ১১টা খোলা; বাকি সময় ছোট সারাংশ (ভালো · অবনতি · এ সপ্তাহের লক্ষ্য)।
// শুধু দেখানোর নিয়ম — কিছু সংরক্ষণ হয় না, নতুন schema/rules নেই। হিসাব weekLock.js ও reviewInsights.js-এ (pure)।
import { T, HOME_CARD } from "./trackerTheme.js";
import { ReviewCards } from "./ReviewCards.js";
import { weeklyReport, pickFocus } from "./reviewInsights.js";
import { reviewWindow, remainParts, lockedSummary, TIPS } from "./weekLock.js";

const { useState, useEffect } = React;
const h = React.createElement;
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (s) => String(s).replace(/\d/g, (d) => BN[d]);

const CSS = "@keyframes hs-wk-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.hs-wk-fade{animation:hs-wk-fade .35s ease}@media (prefers-reduced-motion:reduce){.hs-wk-fade{animation:none}}";
const DARK = "linear-gradient(180deg, #386658, #2D5548)";
const sub = { fontSize: "13px", color: "rgba(255,255,255,0.82)", lineHeight: 1.5 };
const pill = (t) => h("span", { style: { display: "inline-block", fontSize: "13px", fontWeight: 800, color: "#fff", background: "rgba(255,255,255,0.2)", borderRadius: "999px", padding: "3px 10px", whiteSpace: "nowrap" } }, bn(t));
const arrow = (d) => (d >= 5 ? "▲ " + d + "%" : d <= -5 ? "▼ " + Math.abs(d) + "%" : "● প্রায় একই");

function remainText(ms) {
  const r = remainParts(ms);
  const parts = [];
  if (r.d) parts.push(bn(r.d) + " দিন");
  if (r.h) parts.push(bn(r.h) + " ঘণ্টা");
  if (!r.d && r.m) parts.push(bn(r.m) + " মিনিট");
  return parts.join(" ");
}

// টাইল: ছোট শিরোনাম · বড় নাম · ছোট বিবরণ · রেখা · নিচের সারি
function Tile({ bg, icon, head, big, small, foot }) {
  return h("div", { style: { background: bg, borderRadius: "18px", padding: "12px", minWidth: 0, display: "flex", flexDirection: "column" } },
    h("div", { style: sub }, icon + " " + head),
    h("div", { style: { fontSize: "18px", fontWeight: 800, color: "#fff", lineHeight: 1.3, marginTop: "4px" } }, big),
    h("div", { style: { ...sub, marginTop: "2px" } }, small),
    foot && h("div", { style: { borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: "10px", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" } }, foot));
}

function LockedWeek({ docs, endISO, scoreCtx, rateCtx, remainMs }) {
  const rep = weeklyReport({ docs, endISO, scoreCtx, rateCtx });
  const focus = pickFocus(rep, rateCtx);
  const s = lockedSummary(rep);
  const few = !s.enough;
  const pct = (x) => bn(x.hit + "/" + x.logged + " দিন লক্ষ্যে");
  const tiles = few
    ? h("div", { style: { ...sub, fontSize: "14px", marginTop: "10px" } }, "গত সপ্তাহের তথ্য কম ছিল — ছোট ছোট এন্ট্রিই যথেষ্ট।")
    : h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" } },
      h(Tile, { bg: "rgba(255,255,255,0.13)", icon: "🌟", head: "ভালো ছিল", big: s.best ? s.best.label : "—", small: s.best ? pct(s.best) : "বিশেষ কিছু নয়",
        foot: s.avg !== null ? [h("span", { key: "l", style: sub }, "📈 গড় স্কোর"), h("span", { key: "v", style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" } }, h("b", { style: { fontSize: "16px", color: "#fff" } }, bn(s.avg) + "%"), s.delta !== null && pill(arrow(s.delta)))] : null }),
      h(Tile, { bg: "rgba(224,167,46,0.3)", icon: "🌧️", head: "পিছিয়ে ছিল", big: s.weak ? s.weak.label : "কিছু নেই", small: s.weak ? pct(s.weak) : "বড় কোনো ঘাটতি নেই",
        foot: s.weak ? [h("span", { key: "l", style: sub }, "💡 ছোট পরামর্শ"), h("span", { key: "v", style: { fontSize: "13.5px", color: "#fff", lineHeight: 1.5 } }, TIPS[s.weak.key])] : null }));
  return h("div", { className: "hs-wk-fade", style: { ...HOME_CARD, padding: "12px", marginBottom: "12px" } },
    h("style", null, CSS),
    h("div", { style: { background: DARK, borderRadius: "22px", padding: "14px" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        h("div", { style: { fontSize: "17px", fontWeight: 800, color: "#fff" } }, "এক নজরে গত সপ্তাহ"),
        s.delta !== null && pill("আগের সপ্তাহের তুলনায় " + arrow(s.delta))),
      tiles),
    h("div", { style: { background: T.track, borderRadius: "18px", padding: "12px 14px", marginTop: "10px" } },
      h("div", { style: { fontSize: "13px", fontWeight: 700, color: T.muted } }, "🎯 এ সপ্তাহের লক্ষ্য"),
      h("div", { style: { fontSize: "21px", fontWeight: 800, color: T.green, lineHeight: 1.3, marginTop: "2px" } }, bn(focus ? focus.label + (focus.pct !== null ? " — গত সপ্তাহে " + focus.pct + "%" : "") : "সব ঠিক আছে — এভাবেই চালিয়ে যান")),
      focus && h("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: "4px" } }, bn(focus.action))),
    h("div", { style: { display: "flex", alignItems: "center", gap: "12px", background: T.sand, border: "1px solid " + T.sandBorder, borderRadius: "18px", padding: "12px 14px", marginTop: "10px" } },
      h("span", { "aria-hidden": "true", style: { fontSize: "30px", flexShrink: 0 } }, "🔒"),
      h("div", { style: { minWidth: 0 } },
        h("div", { style: { fontSize: "16px", fontWeight: 800, color: T.ink } }, "বৃহস্পতিবার রাত ৯টায় খুলবে"),
        h("div", { style: { fontSize: "13.5px", color: T.muted, lineHeight: 1.5, marginTop: "2px" } }, "আর " + remainText(remainMs) + " বাকি · এর মধ্যে এন্ট্রি চালিয়ে যান"))),
    h("div", { style: { fontSize: "12px", color: T.muted, lineHeight: 1.5, marginTop: "10px" } }, "শুধু আপনার দেওয়া তথ্য থেকে। সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"));
}

// props: docs, scoreCtx, rateCtx, ready (ডেটা লোড), weekView (বিদ্যমান সপ্তাহ-চার্ট), gutEntries, showGut
export function WeekLockGate({ docs, scoreCtx, rateCtx, ready, weekView, gutEntries, showGut, skeleton }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const w = reviewWindow(now);
  if (!w.open) return ready ? h(LockedWeek, { docs, endISO: w.endISO, scoreCtx, rateCtx, remainMs: w.remainMs }) : skeleton;
  return h("div", { className: "hs-wk-fade" },
    h("style", null, CSS),
    h("div", { style: { display: "inline-block", fontSize: "12.5px", fontWeight: 700, color: T.green, background: T.track, borderRadius: "999px", padding: "4px 12px", marginBottom: "10px" } }, "🔓 শনি রাত ১১টা পর্যন্ত খোলা"),
    ready ? h(ReviewCards, { docs, endISO: w.endISO, scoreCtx, rateCtx, gutEntries, showGut, full: false, phase: w.provisional ? "provisional" : "final" }) : skeleton,
    weekView);
}
