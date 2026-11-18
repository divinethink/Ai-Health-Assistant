// মাসিক রিভিউ লক: মাসের শেষ দিন রাত ৯টা → পরের মাসের ৩ তারিখ রাত ১১টা খোলা; বাকি সময় চলতি মাসের গ্রাফ + ১ লাইন + লক্ষ্য।
// শুধু দেখানোর নিয়ম — কিছু সংরক্ষণ হয় না, নতুন schema/rules নেই। হিসাব monthLock.js ও monthAdvice.js-এ (pure)।
import { T, HOME_CARD, GRADIENT_HERO } from "./trackerTheme.js";
import { bnNum } from "../../shared/dates.js";
import { remainParts } from "./weekLock.js";
import { monthWindow, lockLine, monthGoal, goalProgress } from "./monthLock.js";
import { attentionItems } from "./monthAdvice.js";
import { monthStats } from "./trendRange.js";
import { monthInsights, monthScores, dayScore, scoreLevel, levelCounts, LEVEL_LABELS } from "./trendScore.js";
import { monthDatesISO } from "./dateNav.js";

const { useState, useEffect } = React;
const h = React.createElement;

const bnDigits = (t) => String(t).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString("bn-BD", { month: "long" });
const bnPlain = (n) => Number(n).toLocaleString("bn-BD", { useGrouping: false });
const mixWith = (c, pct) => "color-mix(in srgb, " + c + " " + pct + "%, var(--hs-surface, #fff))";
const mixPrimary = (pct) => "color-mix(in srgb, var(--hs-primary, #0E4B43) " + pct + "%, var(--hs-surface, #fff))";
const LV = [T.track, mixWith("#E8892B", 42), mixWith("#E0A100", 48), mixPrimary(62), mixPrimary(92)];
const MARK = { up: ["▲", T.green], down: ["▼", "#C46A12"], flat: ["●", T.muted], more: ["●", T.muted] };

const CSS = "@keyframes hs-mk-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.hs-mk-fade{animation:hs-mk-fade .35s ease}@media (prefers-reduced-motion:reduce){.hs-mk-fade{animation:none}}";

const card = (children, extra) => h("div", { style: { ...HOME_CARD, padding: "14px", marginBottom: "12px", ...(extra || {}) } }, children);
const title = (t, sub, icon) => h("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" } },
  icon && h("span", { "aria-hidden": "true", style: { width: "34px", height: "34px", borderRadius: "11px", background: T.track, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 } }, icon),
  h("div", { style: { flex: 1, minWidth: 0 } },
    h("div", { style: { fontSize: "16px", fontWeight: 800, color: T.ink, lineHeight: 1.25 } }, t),
    sub && h("div", { style: { fontSize: "12.5px", color: T.muted, marginTop: "2px" } }, sub)));

function remainText(ms) {
  const r = remainParts(ms);
  const parts = [];
  if (r.d) parts.push(bnNum(r.d) + " দিন");
  if (r.h) parts.push(bnNum(r.h) + " ঘণ্টা");
  if (!r.d && r.m) parts.push(bnNum(r.m) + " মিনিট");
  return parts.join(" ");
}

// দিনভিত্তিক স্কোরের ছোট বার-গ্রাফ (চলতি মাস)। রং = ওই দিনের স্কোর-স্তর।
function DayBars({ docs, y, m, ctx, today }) {
  const by = {};
  (docs || []).forEach((d) => { if (d && d.date) by[d.date] = d; });
  const dates = monthDatesISO(y, m);
  const rows = monthScores(docs, y, m, ctx, today);
  const avg = rows.length ? Math.round(rows.reduce((t, r) => t + r.score, 0) / rows.length) : null;
  const elapsed = dates.filter((d) => d <= today).length;
  const counts = levelCounts(rows);
  const BAR_H = 76;
  const label = monthName(y, m) + " মাসের দৈনিক স্কোর: " + rows.length + " দিন রেকর্ড" + (avg !== null ? ", গড় " + avg + "%" : "");
  const chip = (l, v, extra) => h("div", { style: { flex: 1, minWidth: 0, borderRadius: "12px", padding: "8px 10px", ...extra } },
    h("div", { style: { fontSize: "12px", opacity: 0.85 } }, l), h("div", { style: { fontSize: "18px", fontWeight: 800 } }, v));
  return h("div", null,
    h("div", { style: { display: "flex", gap: "8px" } },
      chip("গড় স্কোর", avg === null ? "—" : bnNum(avg) + "%", { background: GRADIENT_HERO, color: T.onDark }),
      chip("রেকর্ড করা দিন", bnNum(rows.length) + "/" + bnNum(elapsed), { background: T.sand, color: T.ink, border: "1px solid " + T.sandBorder })),
    h("div", { role: "img", "aria-label": label, style: { display: "flex", alignItems: "flex-end", gap: "2px", height: BAR_H + "px", marginTop: "12px" } },
      dates.map((iso) => {
        const future = iso > today;
        const sc = future ? null : dayScore(by[iso], ctx, iso);
        const lv = scoreLevel(sc);
        const ht = sc === null ? 4 : Math.max(8, Math.round((sc / 100) * BAR_H));
        return h("div", { key: iso, style: { flex: 1, minWidth: 0, height: ht + "px", borderRadius: "4px 4px 2px 2px", background: sc === null ? T.track : LV[lv], opacity: future ? 0.45 : 1 } });
      })),
    h("div", { "aria-hidden": "true", style: { display: "flex", justifyContent: "space-between", fontSize: "12px", color: T.muted, marginTop: "4px" } },
      [1, 8, 15, 22, dates.length].map((d) => h("span", { key: d }, bnNum(d)))),
    h("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: "8px", fontSize: "12.5px", color: T.ink } },
      [4, 3, 2, 1].map((l) => h("span", { key: l, style: { display: "inline-flex", alignItems: "center", gap: "5px" } },
        h("span", { "aria-hidden": "true", style: { width: "12px", height: "12px", borderRadius: "3px", background: LV[l], display: "inline-block" } }),
        LEVEL_LABELS[l] + " (" + bnNum(counts[l]) + ")"))));
}

// লক-অবস্থা: চলতি মাসের গ্রাফ · ১ লাইন উন্নতি/অবনতি · এ মাসের লক্ষ্য · লক-বার্তা
export function MonthLockedView({ docs, prevDocs, y, m, today, ctx, rateCtx, remainMs, lastDay }) {
  const py = m === 0 ? y - 1 : y, pm = m === 0 ? 11 : m - 1;
  const ins = monthInsights({ curDocs: docs, prevDocs, y, m, ctx, todayISO: today });
  const line = lockLine(ins, bnNum);
  const prevSt = prevDocs ? monthStats(prevDocs, py, pm, rateCtx, today) : null;
  const goal = monthGoal(prevSt, rateCtx);
  return h("div", { className: "hs-mk-fade" },
    h("style", null, CSS),
    card([
      h("div", { key: "t" }, title("চলতি মাসের চিত্র", monthName(y, m) + " " + bnPlain(y) + " · দিনের স্কোর, চলমান", "📊")),
      h(DayBars, { key: "g", docs, y, m, ctx, today }),
      h("div", { key: "l", style: { display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: "12px", fontSize: "14px", lineHeight: 1.6, color: T.ink } },
        line.map((p, i) => h("span", { key: i, style: { display: "inline-flex", gap: "6px" } },
          h("span", { "aria-hidden": "true", style: { color: MARK[p.kind][1] } }, MARK[p.kind][0]), h("span", null, p.text)))),
      h("div", { key: "g2", style: { background: T.track, borderRadius: "18px", padding: "12px 14px", marginTop: "12px" } },
        h("div", { style: { fontSize: "13px", fontWeight: 700, color: T.muted } }, "🎯 এ মাসের লক্ষ্য"),
        h("div", { style: { fontSize: "20px", fontWeight: 800, color: T.green, lineHeight: 1.3, marginTop: "2px" } },
          goal ? goal.label + (goal.pct !== null ? " — গত মাসে " + bnNum(goal.pct) + "%" : "") : "সব ঠিক আছে — এভাবেই চালিয়ে যান"),
        goal && h("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: "4px" } }, bnDigits(goal.action))),
      h("div", { key: "k", style: { display: "flex", alignItems: "center", gap: "12px", background: T.sand, border: "1px solid " + T.sandBorder, borderRadius: "18px", padding: "12px 14px", marginTop: "10px" } },
        h("span", { "aria-hidden": "true", style: { fontSize: "30px", flexShrink: 0 } }, "🔒"),
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { fontSize: "16px", fontWeight: 800, color: T.ink } }, bnNum(lastDay) + " " + monthName(y, m) + " রাত ৯টায় খুলবে"),
          h("div", { style: { fontSize: "13.5px", color: T.muted, lineHeight: 1.5, marginTop: "2px" } }, "আর " + remainText(remainMs) + " বাকি · পুরো মাসের রিভিউ, মনোযোগের জায়গা ও প্রতিকার তখন দেখা যাবে"))),
      h("div", { key: "f", style: { fontSize: "12px", color: T.muted, lineHeight: 1.5, marginTop: "10px" } }, "শুধু আপনার দেওয়া তথ্য থেকে। সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"),
    ]));
}

// আনলক-অবস্থার ব্যাজ
export function MonthOpenNote({ w }) {
  return h("div", { style: { marginBottom: "10px" } },
    h("div", { style: { display: "inline-block", fontSize: "12.5px", fontWeight: 700, color: T.green, background: T.track, borderRadius: "999px", padding: "4px 12px" } }, "🔓 ৩ তারিখ রাত ১১টা পর্যন্ত খোলা"),
    w.provisional && h("div", { style: { fontSize: "13px", color: T.muted, marginTop: "6px" } }, "আজকের তথ্য যোগ হলে রিভিউ বদলাতে পারে।"));
}

// আনলক-অবস্থা: মনোযোগ দরকার — সম্ভাব্য কারণ ও প্রতিকার
export function MonthAttentionCard({ st, prevSt, monthDocs, docs, endISO, rateCtx }) {
  if (!st || st.loggedDays === 0) return null;
  const a = attentionItems({ st, prevSt, monthDocs, docs, endISO, rateCtx, bn: bnNum });
  const gp = goalProgress(prevSt, st);
  const none = !a.items.length && !a.logging;
  const gpMark = gp ? MARK[gp.kind] : null;
  return card([
    h("div", { key: "t" }, title("কোথায় মনোযোগ দরকার", "সম্ভাব্য কারণ ও প্রতিকার · লগের মিল, প্রমাণ নয়", "🎯")),
    gp && h("div", { key: "gp", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, background: T.track, borderRadius: "12px", padding: "8px 10px", marginBottom: "10px" } },
      h("span", { "aria-hidden": "true", style: { color: gpMark[1] } }, gpMark[0] + " "), "গত মাসের লক্ষ্য ছিল " + gp.label + ": " + bnNum(gp.from) + "% → " + bnNum(gp.to) + "%"),
    none && h("div", { key: "n", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "এ মাসে বড় কোনো ঘাটতি চোখে পড়েনি। এভাবেই চালিয়ে যান।"),
    ...a.items.map((it, i) => h("div", { key: it.key, style: { padding: "10px 0", borderTop: i || gp ? "1px solid " + T.border : "none" } },
      h("div", { style: { fontSize: "15px", fontWeight: 800, color: T.ink } }, (it.prev !== null && it.pct > it.prev ? "▲ " : "▼ ") + it.label + " — " + bnNum(it.pct) + "% দিন লক্ষ্যে" + (it.prev !== null ? " (গত মাস " + bnNum(it.prev) + "%)" : "")),
      it.causes.length > 0 && h("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: "4px" } },
        h("b", null, "সম্ভাব্য কারণ: "), it.causes.join(" ")),
      h("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: "4px" } }, h("b", null, "প্রতিকার: "), bnDigits(it.remedy)))),
    a.logging && h("div", { key: "lg", style: { padding: "10px 0", borderTop: "1px solid " + T.border } },
      h("div", { style: { fontSize: "15px", fontWeight: 800, color: T.ink } }, "📝 তথ্য লেখা কম"),
      h("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: "4px" } }, a.logging.text),
      h("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: "4px" } }, h("b", null, "প্রতিকার: "), a.logging.remedy)),
    h("div", { key: "f", style: { fontSize: "12px", color: T.muted, lineHeight: 1.5, marginTop: "6px" } }, "শুধু আপনার দেওয়া তথ্য থেকে। সাধারণ গাইড; কোনো ঘাটতি নিয়ে চিন্তা হলে ডাক্তারের পরামর্শ নিন।"),
  ]);
}

// গেট: সময় অনুযায়ী খোলা/লক বেছে নেয় (৩০ সেকেন্ডে একবার সময় দেখে)
export function MonthLockGate({ renderOpen, renderLocked }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const w = monthWindow(now);
  return w.open ? renderOpen(w) : renderLocked(w);
}
