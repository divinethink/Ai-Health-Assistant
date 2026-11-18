// সাপ্তাহিক রিভিউ লক: বৃহস্পতি রাত ৯টা → শনি রাত ১১টা খোলা; বাকি সময় ছোট সারাংশ (ভালো · অবনতি · এ সপ্তাহের লক্ষ্য)।
// শুধু দেখানোর নিয়ম — কিছু সংরক্ষণ হয় না, নতুন schema/rules নেই। হিসাব weekLock.js ও reviewInsights.js-এ (pure)।
import { T, HOME_CARD } from "./trackerTheme.js";
import { ReviewCards } from "./ReviewCards.js";
import { weeklyReport, pickFocus } from "./reviewInsights.js";
import { reviewWindow, remainParts, lockedSplit } from "./weekLock.js";

const { useState, useEffect } = React;
const h = React.createElement;
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (s) => String(s).replace(/\d/g, (d) => BN[d]);

const CSS = "@keyframes hs-wk-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.hs-wk-fade{animation:hs-wk-fade .35s ease}@media (prefers-reduced-motion:reduce){.hs-wk-fade{animation:none}}";
const card = (key, bg, children) => h("div", { key, style: { ...HOME_CARD, padding: "14px", marginBottom: "12px", ...(bg ? { background: bg, border: "none" } : null) } }, children);
const head = (icon, t, color) => h("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: 800, color: color || T.ink, marginBottom: "8px" } }, h("span", { "aria-hidden": "true" }, icon), t);
const line = (t, i, color) => h("div", { key: i, style: { fontSize: "14px", lineHeight: 1.6, color: color || T.ink, marginTop: i ? "4px" : 0 } }, bn(t));

function remainText(ms) {
  const r = remainParts(ms);
  const parts = [];
  if (r.d) parts.push(bn(r.d) + " দিন");
  if (r.h) parts.push(bn(r.h) + " ঘণ্টা");
  if (!r.d && r.m) parts.push(bn(r.m) + " মিনিট");
  return parts.join(" ");
}

function LockedWeek({ docs, endISO, scoreCtx, rateCtx, remainMs }) {
  const rep = weeklyReport({ docs, endISO, scoreCtx, rateCtx });
  const focus = pickFocus(rep, rateCtx);
  const { good, bad } = lockedSplit(rep);
  const few = !rep.enough;
  const fewMsg = "গত সপ্তাহের তথ্য কম ছিল — ছোট ছোট এন্ট্রিই যথেষ্ট।";
  return h("div", { className: "hs-wk-fade" },
    h("style", null, CSS),
    card("lock", null, h("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
      h("span", { "aria-hidden": "true", style: { width: "40px", height: "40px", borderRadius: "13px", background: T.track, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 } }, "🔒"),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontSize: "16px", fontWeight: 800, color: T.ink } }, "সাপ্তাহিক রিভিউ বৃহস্পতি রাত ৯টায় খুলবে"),
        h("div", { style: { fontSize: "13px", color: T.muted, marginTop: "2px" } }, "আর " + remainText(remainMs) + " বাকি")))),
    card("good", null, [head("✅", "গত সপ্তাহে ভালো", T.green), ...(good.length ? good.map((t, i) => line(t, i)) : [line(few ? fewMsg : "এ সপ্তাহে ভালো দিকগুলো আরও বাড়িয়ে নিন।", 0)])]),
    card("bad", null, [head("🔻", "অবনতি", "#C46A12"), ...(bad.length ? bad.map((t, i) => line(t, i)) : [line(few ? fewMsg : "বড় কোনো অবনতি নেই।", 0)])]),
    card("focus", "linear-gradient(180deg, color-mix(in srgb, var(--hs-primary, #0E4B43) 92%, #000), var(--hs-primary, #0E4B43))", [
      head("🎯", "এ সপ্তাহের লক্ষ্য", "#fff"),
      h("div", { key: "t", style: { fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1.3 } }, bn(focus ? focus.label + (focus.pct !== null ? " — গত সপ্তাহে " + focus.pct + "%" : "") : "সব ঠিক আছে — এভাবেই চালিয়ে যান")),
      focus && h("div", { key: "a", style: { fontSize: "14px", color: "rgba(255,255,255,0.92)", lineHeight: 1.6, marginTop: "6px" } }, bn(focus.action))]),
    h("div", { style: { fontSize: "12px", color: T.muted, lineHeight: 1.5 } }, "শুধু আপনার দেওয়া তথ্য থেকে। সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"));
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
