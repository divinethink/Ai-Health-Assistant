// ট্রেন্ড-ট্যাবের উপরের অংশ: একটাই হিটম্যাপ-ক্যালেন্ডার (‹ মাস › + সোয়াইপ, রং = দৈনিক স্কোর) + সপ্তাহ|মাস|৩ মাস সুইচ।
// শুধু UI; হিসাব trendScore.js ও trendRange.js-এ (pure)। সপ্তাহ-ভিউ আগের মতোই (weekView prop)।
// মাস = উন্নতি/অবনতি + মাসিক রিভিউ; ৩ মাস = গড় স্কোর, তীরসহ তুলনা, "যেখানে মনোযোগ দরকার"।
// ডেটা: getMonthDaily (বিদ্যমান equality-query; নতুন index/rules লাগে না), মাস-ভিত্তিক ক্যাশ। পানি বাদ।

import { ErrorBox, Skeleton } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { T, HOME_CARD, GRADIENT_HERO } from "./trackerTheme.js";
import { getMonthDaily, todayISO } from "./trackerData.js";
import { targetCtxFor } from "./weeklyTrend.js";
import { swipeDelta } from "./dateNav.js";
import { useAppDesign } from "../../legacy/appDesign.js";
import { renderLayoutCards } from "../../shared/LayoutCards.js";
import { lastNMonths, shiftMonth, monthKey, monthStats, monthReview, compareMonths, compareNotes } from "./trendRange.js";
import { dayScore, scoreLevel, monthInsights, insightLines, levelCounts, monthScores, monthlyAverages, rowArrow, rowNote, weekBuckets, attentionRows, LEVEL_LABELS, MIN_FILLED } from "./trendScore.js";

const { useState, useEffect } = React;

const p2 = (n) => String(n).padStart(2, "0");
const WEEK = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];
const bnPlain = (n) => Number(n).toLocaleString("bn-BD", { useGrouping: false }); // ২০২৬ (কমা ছাড়া)
const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString("bn-BD", { month: "long" });
const mixPrimary = (pct) => "color-mix(in srgb, var(--hs-primary, #0E4B43) " + pct + "%, var(--hs-surface, #fff))";
const mixWith = (c, pct) => "color-mix(in srgb, " + c + " " + pct + "%, var(--hs-surface, #fff))";
// ৫ স্তর: খালি · কম (কমলা-নরম; লাল নয়, লাল শুধু বিপদে) · মাঝারি (অ্যাম্বার) · ভালো · চমৎকার (সবুজ)
const LV_BG = [T.track, mixWith("#E8892B", 42), mixWith("#E0A100", 48), mixPrimary(62), mixPrimary(92)];
const ARROW = { up: ["↑", "উন্নতি", "var(--hs-primary, #0E4B43)"], down: ["↓", "কমেছে", "#C46A12"], flat: ["→", "প্রায় একই", "var(--hs-muted, #5F716C)"] };

// ---------- মাসভিত্তিক ডেটা-লোড ----------
function useMonths(familyId, memberId, list) {
  const [cache, setCache] = useState({});
  const [err, setErr] = useState(null);
  const sig = list.map((x) => monthKey(x.y, x.m)).join(",");
  useEffect(() => {
    list.forEach(({ y, m }) => {
      const k = monthKey(y, m);
      if (cache[k]) return;
      getMonthDaily(familyId, memberId, y, m)
        .then((d) => setCache((c) => ({ ...c, [k]: d })))
        .catch((x) => setErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য দেখার অনুমতি আপনার নেই।" : (x.message || String(x))));
    });
    // eslint-disable-next-line
  }, [familyId, memberId, sig]);
  return { cache, err };
}

// প্রিমিয়াম কার্ড (হোমের HOME_CARD: নরম গ্রেডিয়েন্ট, বড় গোল কোণ, স্তরযুক্ত ছায়া) + আইকন-টালি শিরোনাম
const card = (children, extra) => React.createElement("div", { style: { ...HOME_CARD, padding: "14px", marginBottom: "12px", ...(extra || {}) } }, children);
const title = (t, sub, icon, right) => React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" } },
  icon && React.createElement("span", { "aria-hidden": "true", style: { width: "34px", height: "34px", borderRadius: "11px", background: T.track, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 } }, icon),
  React.createElement("div", { style: { flex: 1, minWidth: 0 } },
    React.createElement("div", { style: { fontSize: "16px", fontWeight: 800, color: T.ink, lineHeight: 1.25 } }, t),
    sub && React.createElement("div", { style: { fontSize: "12.5px", color: T.muted, marginTop: "2px" } }, sub)),
  right);

// ---------- হিটম্যাপ-ক্যালেন্ডার (একটাই; ‹ মাস › + সোয়াইপ) ----------
function monthGridCells(y, m) {
  const lead = (new Date(y, m, 1).getDay() + 1) % 7; // শনি=০
  const n = new Date(y, m + 1, 0).getDate();
  const total = Math.ceil((lead + n) / 7) * 7;
  return Array.from({ length: total }, (_, i) => { const d = i - lead + 1; return d >= 1 && d <= n ? { day: d, iso: y + "-" + p2(m + 1) + "-" + p2(d) } : null; });
}

function DayDetail({ date, doc, score }) {
  const lines = [];
  if (score !== null && score !== undefined) lines.push("স্কোর: " + bnNum(score) + "% (" + LEVEL_LABELS[scoreLevel(score)] + ")");
  if (doc) {
    if (doc.weightKg > 0) lines.push("ওজন: " + bnNum(doc.weightKg) + " কেজি");
    if (doc.caloriesIn > 0) lines.push("ক্যালরি: " + bnNum(Math.round(doc.caloriesIn)) + " kcal");
    if ((doc.exerciseMin || 0) > 0) lines.push("ব্যায়াম: " + bnNum(doc.exerciseMin) + " মিনিট");
    if (doc.sleepMinutes > 0) lines.push("ঘুম: " + bnNum(Math.round((doc.sleepMinutes / 60) * 10) / 10) + " ঘণ্টা");
    if ((doc.waterGlasses || 0) > 0) lines.push("পানি: " + bnNum(doc.waterGlasses) + " গ্লাস");
    if ((doc.steps || 0) > 0) lines.push("স্টেপ: " + bnNum(doc.steps));
  }
  const d = new Date(date + "T00:00:00");
  const head = d.toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long" });
  return React.createElement("div", { "aria-live": "polite", style: { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", background: T.canvas, border: "1px solid " + T.border } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink } }, head),
    lines.length ? lines.map((l, i) => React.createElement("div", { key: i, style: { fontSize: "14px", color: T.ink, marginTop: "3px" } }, l))
      : React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginTop: "3px" } }, "এই দিনে কোনো রেকর্ড নেই।"),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "6px" } }, "এটি শুধু দেখার জন্য। পুরনো দিনের তথ্য বদলাতে Home-এর তারিখ-বাছাই ব্যবহার করুন।"));
}

// ⓘ — স্কোর কীভাবে হয় ও রঙের মানে (Daily Task-এর মতো)
function ScoreInfo({ onClose }) {
  const rowsL = [[4, "৮০% থেকে ১০০%", "চমৎকার"], [3, "৬০% থেকে ৭৯%", "ভালো"], [2, "৪০% থেকে ৫৯%", "মাঝারি"], [1, "১% থেকে ৩৯%", "কম"], [0, "কোনো এন্ট্রি নেই", "খালি"]];
  return React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": "ক্যালেন্ডারের রং কী বোঝায়", onClick: onClose,
    style: { position: "fixed", inset: 0, zIndex: 2000, background: "rgba(10,25,20,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" } },
    React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { background: T.surface, borderRadius: "22px", padding: "18px", width: "100%", maxWidth: "420px", maxHeight: "86vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" } },
      React.createElement("div", { style: { fontSize: "17px", fontWeight: 800, color: T.ink } }, "ⓘ ক্যালেন্ডারের রং কী বোঝায়?"),
      React.createElement("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, margin: "8px 0" } }, "প্রতিদিনের স্কোর = ওই দিন আপনি যা লিখেছেন, তার লক্ষ্য-পূরণের গড়। ক্যালরি, ব্যায়াম ও ঘুম গোনা হয়। ক্যালরি লক্ষ্যের ৮০–১১০% হলে পূর্ণ নম্বর; কম বা বেশি খেলে নম্বর কমে। কম খাওয়া সফল ধরা হয় না। ঘুম/ক্যালরি না লিখলে সেটা গোনা হয় না; ব্যায়াম লক্ষ্য থাকলে ০ মিনিট ০ ধরা হয়। উপবাসের দিনে ক্যালরি গোনা হয় না।"),
      rowsL.map(([l, r, n]) => React.createElement("div", { key: l, style: { display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: T.ink, margin: "8px 0" } },
        React.createElement("span", { "aria-hidden": "true", style: { width: "26px", height: "26px", borderRadius: "8px", background: LV_BG[l], flexShrink: 0 } }), r + " — " + n)),
      React.createElement("div", { style: { fontSize: "12.5px", color: T.muted, margin: "6px 0 10px" } }, "আজকের দিনে কমলা বর্ডার। এটি শুধু আপনার নিজের দেওয়া তথ্যের হিসাব; কোনো রোগনির্ণয় নয়।"),
      React.createElement("button", { type: "button", onClick: onClose, style: { width: "100%", minHeight: "46px", borderRadius: "14px", border: "none", background: T.track, color: T.green, fontSize: "15px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" } }, "বুঝেছি")));
}

function HeatCalendar({ ym, docs, ctx, today, sel, onSel, onMove }) {
  const by = {};
  (docs || []).forEach((d) => { if (d && d.date) by[d.date] = d; });
  const [t0, setT0] = useState(null);
  const cells = monthGridCells(ym.y, ym.m);
  const canPrev = shiftMonth(ym, -1) !== ym, canNext = shiftMonth(ym, 1) !== ym;
  const rows = monthScores(docs, ym.y, ym.m, ctx, today);
  const elapsed = cells.filter((c) => c && c.iso <= today).length;
  const counts = levelCounts(rows);
  const avgScore = rows.length ? Math.round(rows.reduce((t, r) => t + r.score, 0) / rows.length) : null;
  const arrow = (n, label, ch, ok) => React.createElement("button", { type: "button", onClick: () => onMove(n), disabled: !ok, "aria-label": label,
    style: { width: "44px", minHeight: "44px", borderRadius: "12px", border: "none", background: T.track, color: T.green, fontSize: "22px", cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.35, fontFamily: "inherit" } }, ch);
  const selInMonth = sel && sel.slice(0, 7) === ym.y + "-" + p2(ym.m + 1) ? sel : null;
  const chip = (label, value, extra) => React.createElement("div", { style: { flex: 1, minWidth: 0, borderRadius: "12px", padding: "8px 10px", ...extra } },
    React.createElement("div", { style: { fontSize: "12px", opacity: 0.85 } }, label),
    React.createElement("div", { style: { fontSize: "18px", fontWeight: 800 } }, value));
  const [info, setInfo] = useState(false);
  const infoBtn = React.createElement("button", { type: "button", onClick: () => setInfo(true), "aria-label": "ক্যালেন্ডারের রং কী বোঝায়",
    style: { width: "44px", minHeight: "44px", margin: "-6px -8px -6px 0", border: "none", background: "none", color: T.muted, fontSize: "22px", cursor: "pointer", fontFamily: "inherit" } }, "ⓘ");
  return card([
    title("অ্যাক্টিভিটি ক্যালেন্ডার", "প্রতিদিনের রং = ওই দিনের স্কোর", "📅", infoBtn),
    info && React.createElement(ScoreInfo, { key: "i", onClose: () => setInfo(false) }),
    React.createElement("div", { key: "h", style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      arrow(-1, "আগের মাস", "‹", canPrev),
      React.createElement("div", { style: { fontSize: "16px", fontWeight: 800, color: T.green }, "aria-live": "polite" }, monthName(ym.y, ym.m) + " " + bnPlain(ym.y)),
      arrow(1, "পরের মাস", "›", canNext)),
    React.createElement("div", { key: "s", style: { display: "flex", gap: "8px", marginTop: "8px" } },
      chip("গড় স্কোর", avgScore === null ? "—" : bnNum(avgScore) + "%", { background: GRADIENT_HERO, color: T.onDark }),
      chip("রেকর্ড করা দিন", bnNum(rows.length) + "/" + bnNum(elapsed), { background: T.sand, color: T.ink, border: "1px solid " + T.sandBorder })),
    React.createElement("div", { key: "g", style: { touchAction: "pan-y", marginTop: "10px" },
      onTouchStart: (e) => { const t = e.touches[0]; setT0({ x: t.clientX, y: t.clientY }); },
      onTouchEnd: (e) => {
        if (!t0) return;
        const t = e.changedTouches[0];
        const dlt = swipeDelta(t.clientX - t0.x, t.clientY - t0.y);
        setT0(null);
        if (dlt) onMove(dlt);
      } },
      React.createElement("div", { role: "grid", style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", textAlign: "center" } },
        WEEK.map((w) => React.createElement("div", { key: w, style: { fontSize: "12px", color: T.muted, paddingBottom: "2px" } }, w)),
        cells.map((c, i) => {
          if (!c) return React.createElement("div", { key: "e" + i });
          const future = c.iso > today;
          const score = future ? null : dayScore(by[c.iso], ctx, c.iso);
          const lv = scoreLevel(score);
          const isSel = c.iso === selInMonth, isToday = c.iso === today;
          return React.createElement("button", { key: c.iso, type: "button", disabled: future, onClick: () => onSel(c.iso),
            "aria-label": c.iso + (isToday ? " আজ" : "") + (score !== null ? " স্কোর " + score + "%, " + LEVEL_LABELS[lv] : ""), "aria-pressed": isSel,
            style: { minHeight: "44px", minWidth: 0, padding: 0, borderRadius: "10px", fontFamily: "inherit", fontSize: "14px", fontWeight: isToday || isSel ? 800 : 500, cursor: future ? "default" : "pointer",
              border: isSel ? "2px solid " + T.green : isToday ? "2.5px solid " + T.orange : "2px solid transparent", boxShadow: isToday ? "0 0 0 2px color-mix(in srgb, #E8892B 22%, transparent)" : "none",
              background: LV_BG[lv], color: lv >= 3 ? T.onDark : T.ink } }, bnNum(c.day));
        }))),
    React.createElement("div", { key: "lg", style: { display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: "10px", fontSize: "12.5px", color: T.ink, alignItems: "center" } },
      [4, 3, 2, 1, 0].map((l) => React.createElement("span", { key: l, style: { display: "inline-flex", alignItems: "center", gap: "5px" } },
        React.createElement("span", { "aria-hidden": "true", style: { width: "12px", height: "12px", borderRadius: "3px", background: LV_BG[l], display: "inline-block" } }),
        LEVEL_LABELS[l] + (l ? " (" + bnNum(counts[l]) + ")" : "")))),
    rows.length < MIN_FILLED && React.createElement("div", { key: "m", style: { marginTop: "8px", fontSize: "13px", color: T.ink, background: T.canvas, border: "1px solid " + T.border, borderRadius: "10px", padding: "8px 10px" } },
      "আরও " + bnNum(MIN_FILLED - rows.length) + " দিন লিখলে তুলনা আসবে। ছোট ছোট এন্ট্রিই যথেষ্ট।"),
    React.createElement("div", { key: "n", style: { fontSize: "12px", color: T.muted, marginTop: "6px", textAlign: "center" } }, "ডানে-বাঁয়ে টেনে মাস বদলান · রং = ওই দিনের স্কোর"),
    selInMonth && React.createElement(DayDetail, { key: "d", date: selInMonth, doc: by[selInMonth], score: dayScore(by[selInMonth], ctx, selInMonth) }),
  ]);
}

// ---------- মাসের উন্নতি ও অবনতি ----------
function InsightCard({ ins }) {
  const lines = insightLines(ins, bnNum).filter((l) => l.kind !== "more");
  if (!lines.length) return null;
  const mark = { up: ["▲", T.green], down: ["▼", "#C46A12"], flat: ["●", T.muted], weak: ["📅", T.muted] };
  return card([
    title("এ মাসের উন্নতি ও অবনতি", "গত মাসের একই দিন-সংখ্যার সাথে মিলিয়ে", "📈"),
    ...lines.map((l, i) => React.createElement("div", { key: i, style: { display: "flex", gap: "8px", fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: i ? "4px" : 0 } },
      React.createElement("span", { "aria-hidden": "true", style: { color: mark[l.kind][1], flexShrink: 0 } }, mark[l.kind][0]),
      React.createElement("span", null, l.text))),
  ]);
}

// ---------- দিনে দিনে স্কোর (বার) ----------
function DailyBarsCard({ rows, y, m, today, prevAvg }) {
  const n = new Date(y, m + 1, 0).getDate();
  const by = {};
  rows.forEach((r) => { by[Number(r.iso.slice(8))] = r; });
  const H = 84;
  return card([
    title("দিনে দিনে স্কোর", prevAvg !== null ? "ড্যাশ-রেখা = গত মাসের গড় (" + bnNum(prevAvg) + "%)" : "প্রতিটি বার = এক দিনের স্কোর", "📊"),
    React.createElement("div", { key: "b", role: "img", "aria-label": "মাসের দৈনিক স্কোরের বার-চার্ট", style: { position: "relative", display: "flex", alignItems: "flex-end", gap: "2px", height: H + "px", borderBottom: "1px solid " + T.border } },
      prevAvg !== null && React.createElement("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, bottom: (prevAvg / 100) * H + "px", borderTop: "1.5px dashed " + T.muted, opacity: 0.7 } }),
      Array.from({ length: n }, (_, i) => { const r = by[i + 1]; const future = y + "-" + p2(m + 1) + "-" + p2(i + 1) > today;
        return React.createElement("div", { key: i, title: r ? bnNum(i + 1) + ": " + r.score + "%" : "", style: { flex: 1, minWidth: 0, height: r ? Math.max(4, (r.score / 100) * H) + "px" : "3px", borderRadius: "3px 3px 0 0", background: r ? LV_BG[r.level] : T.track, opacity: future ? 0.4 : 1 } }); })),
    React.createElement("div", { key: "x", style: { display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: T.muted, marginTop: "3px" } },
      [1, 8, 15, 22, n].map((d) => React.createElement("span", { key: d }, bnNum(d)))),
  ]);
}

// ---------- সপ্তাহ অনুযায়ী গড় স্কোর: এ মাস বনাম আগের মাস ----------
function WeekCompareCard({ buckets, ym }) {
  const prevName = monthName(ym.m === 0 ? ym.y - 1 : ym.y, ym.m === 0 ? 11 : ym.m - 1);
  const anyPrev = buckets.some((b) => b.prev !== null);
  const H = 90;
  const bar = (v, color, op) => React.createElement("div", { style: { width: "38%", maxWidth: "26px", height: v === null ? "3px" : Math.max(4, (v / 100) * H) + "px", background: v === null ? T.track : color, opacity: op, borderRadius: "6px 6px 0 0" } });
  return card([
    title("সপ্তাহ অনুযায়ী গড় স্কোর", anyPrev ? "গাঢ় = " + monthName(ym.y, ym.m) + " · হালকা = " + prevName : monthName(ym.y, ym.m), "🗓️"),
    React.createElement("div", { key: "c", style: { display: "flex", gap: "8px" } },
      buckets.map((b, i) => React.createElement("div", { key: i, style: { flex: 1, minWidth: 0, textAlign: "center" } },
        React.createElement("div", { style: { fontSize: "12.5px", fontWeight: 800, color: T.ink, minHeight: "18px" } }, b.cur === null ? "—" : bnNum(b.cur) + "%"),
        React.createElement("div", { style: { height: H + "px", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "3px", borderBottom: "1px solid " + T.border } },
          anyPrev && bar(b.prev, T.green2, 0.35), bar(b.cur, T.green, 1)),
        React.createElement("div", { style: { fontSize: "11.5px", color: T.muted, marginTop: "3px" } }, bnNum(b.from) + "–" + bnNum(b.to))))),
  ]);
}

// ---------- বিষয় অনুযায়ী লক্ষ্য-পূরণ: এ মাস বনাম আগের মাস ----------
function MetricCompareCard({ metrics, ym }) {
  if (!metrics.length) return null;
  const prevName = monthName(ym.m === 0 ? ym.y - 1 : ym.y, ym.m === 0 ? 11 : ym.m - 1);
  const row = (label, pct, color, op, key) => React.createElement("div", { key, style: { display: "flex", alignItems: "center", gap: "8px", minHeight: "20px" } },
    React.createElement("span", { style: { width: "56px", flexShrink: 0, fontSize: "12px", color: T.muted } }, label),
    React.createElement("div", { style: { flex: 1, minWidth: 0, height: "10px", borderRadius: "999px", background: T.track, overflow: "hidden" } }, React.createElement("div", { style: { width: (pct || 0) + "%", height: "100%", background: color, opacity: op } })),
    React.createElement("span", { style: { width: "40px", flexShrink: 0, textAlign: "right", fontSize: "12.5px", fontWeight: 700, color: T.ink } }, bnNum(pct) + "%"));
  return card([
    title("বিষয় ধরে তুলনা", "লক্ষ্য পূরণের দিন ÷ তথ্য-দেওয়া দিন", "⚖️"),
    ...metrics.map((x) => React.createElement("div", { key: x.key, style: { margin: "8px 0 10px" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink, marginBottom: "3px" } }, x.label, React.createElement(ArrowTag, { kind: x.diff >= 10 ? "up" : x.diff <= -10 ? "down" : "flat" })),
      row(monthName(ym.y, ym.m), x.cur, T.green, 1, "c"), row(prevName, x.prev, T.green2, 0.4, "p"))),
  ]);
}

function MonthReviewCard({ stats }) {
  const r = monthReview(stats, bnNum);
  return card([
    title("সংখ্যায় সারাংশ", monthName(stats.y, stats.m) + " " + bnPlain(stats.y) + " · শুধু আপনার দেওয়া তথ্য থেকে", "🧾"),
    React.createElement("div", { key: "b", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } },
      stats.loggedDays === 0 ? React.createElement("div", { style: { color: T.muted } }, "এই মাসে কোনো রেকর্ড নেই।")
        : [r.points.map((p, i) => React.createElement("div", { key: "p" + i }, "• " + p)),
          r.comment.map((c, i) => React.createElement("div", { key: "c" + i, style: { marginTop: i === 0 ? "8px" : "4px" } }, c))]),
  ]);
}

// ---------- ৩ মাসের তুলনা ----------
function ArrowTag({ kind }) {
  if (!kind) return null;
  const [g, t, c] = ARROW[kind];
  return React.createElement("span", { role: "img", "aria-label": t, title: t, style: { color: c, fontWeight: 800, marginLeft: "6px", fontSize: "15px" } }, g);
}

function CompareCard({ list, avgs }) {
  const rows = compareMonths(list, bnNum);
  const notes = compareNotes(rows);
  const attn = attentionRows(rows);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  const shortName = (x) => monthName(x.y, x.m);
  const table = [
    { key: "avg", label: "গড় স্কোর", vals: avgs.map((a) => ({ pct: a.avg, text: a.avg === null ? "—" : bnNum(a.avg) + "%" })) },
    by.calories && { key: "calories", label: "ক্যালরি লক্ষ্য", vals: by.calories.vals.map((v) => ({ pct: v.pct, text: v.pct === null ? "—" : bnNum(v.pct) + "%" })) },
    by.exercise && { key: "exercise", label: "ব্যায়াম", vals: by.exercise.vals.map((v) => ({ pct: v.pct, text: v.pct === null ? "—" : bnNum(v.pct) + "%" })) },
    by.sleep && { key: "sleep", label: "ঘুম", vals: by.sleep.vals.map((v) => ({ pct: v.pct, text: v.pct === null ? "—" : bnNum(v.pct) + "%" })) },
  ].filter(Boolean);
  const cols = "minmax(78px, 1.25fr) repeat(" + list.length + ", minmax(0, 1fr)) 22px";
  const pill = (v, i) => React.createElement("div", { key: i, style: { textAlign: "center", borderRadius: "999px", padding: "6px 2px", fontSize: "13px", fontWeight: 800,
    background: v.pct === null ? T.track : LV_BG[scoreLevel(v.pct)], color: v.pct !== null && scoreLevel(v.pct) >= 3 ? T.onDark : T.ink } }, v.text);
  const w = by.weight;
  return card([
    title("৩ মাসের চিত্র", "বামে বিষয়, ওপরে মাস · রং = লক্ষ্য-পূরণের হার", "🗂️"),
    attn.length > 0 && React.createElement("div", { key: "at", style: { background: T.sand, border: "1px solid " + T.sandBorder, borderRadius: "14px", padding: "10px 12px", margin: "4px 0 10px" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 800, color: T.ink } }, "🎯 যেখানে মনোযোগ দরকার"),
      attn.map((r) => React.createElement("div", { key: r.key, style: { fontSize: "14px", color: T.ink, marginTop: "4px" } }, r.label + ": " + r.seq.map((p) => bnNum(p) + "%").join(" → "), React.createElement(ArrowTag, { kind: r.arrow })))),
    React.createElement("div", { key: "h", style: { display: "grid", gridTemplateColumns: cols, gap: "6px", alignItems: "center", fontSize: "12.5px", color: T.muted, fontWeight: 700, padding: "0 0 6px", borderBottom: "1px solid " + T.border } },
      React.createElement("div", null, "আমল ও অভ্যাস"), ...list.map((x, i) => React.createElement("div", { key: i, style: { textAlign: "center" } }, shortName(x))), React.createElement("div", null)),
    ...table.map((r) => React.createElement("div", { key: r.key, style: { padding: "9px 0", borderBottom: "1px solid " + T.border } },
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: cols, gap: "6px", alignItems: "center" } },
        React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink } }, r.label), ...r.vals.map(pill), React.createElement("div", { style: { textAlign: "center" } }, React.createElement(ArrowTag, { kind: rowArrow(r.vals) }))),
      rowNote(r.vals, bnNum) && React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "3px" } }, rowNote(r.vals, bnNum)))),
    w && React.createElement("div", { key: "w", style: { display: "grid", gridTemplateColumns: cols, gap: "6px", alignItems: "center", padding: "9px 0" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink } }, "ওজন (গড় কেজি)"),
      ...w.vals.map((v, i) => React.createElement("div", { key: i, style: { textAlign: "center", borderRadius: "999px", padding: "6px 2px", fontSize: "13px", fontWeight: 800, background: T.track, color: T.ink } }, v.text)), React.createElement("div", null)),
    notes.length > 0 && React.createElement("div", { key: "n", style: { marginTop: "6px", fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, notes.map((n, i) => React.createElement("div", { key: i }, "• " + n))),
  ]);
}

// ---------- মূল ----------
const RANGES = [["week", "সপ্তাহ"], ["month", "মাস"], ["quarter", "৩ মাস"]];

export function TrendRanges({ info, familyId, memberId, weekView }) {
  const today = todayISO();
  const three = lastNMonths(new Date(), 3);
  const [range, setRange] = useState("week");
  const topLayout = useAppDesign("trend").top;
  const [ym, setYm] = useState(three[2]);
  const [sel, setSel] = useState(today);
  const prevYm = shiftMonth(ym, -1) !== ym ? shiftMonth(ym, -1) : null; // আগের মাসের তুলনার জন্য
  const need = [...three];
  [ym, prevYm].forEach((x) => { if (x && !need.some((y) => y.y === x.y && y.m === x.m)) need.push(x); });
  const { cache, err } = useMonths(familyId, memberId, need);
  const ctx = { ...targetCtxFor({ age: info.age, flags: info.flags, goal: info.goal }), waterTarget: null };
  const loaded3 = three.every((x) => cache[monthKey(x.y, x.m)]);
  const move = (n) => { const next = shiftMonth(ym, n); if (next !== ym) { setYm(next); setSel(null); } };

  const pills = React.createElement("div", { className: "hs-trk-pills", style: { marginBottom: "8px" } }, React.createElement("div", { style: { display: "flex", gap: "6px", padding: "2px" } },
    RANGES.map(([id, label]) => {
      const on = id === range;
      return React.createElement("button", { key: id, type: "button", onClick: () => setRange(id), "aria-pressed": on,
        style: { flex: 1, fontSize: "14px", fontWeight: 700, padding: "9px 8px", minHeight: "44px", borderRadius: "999px", cursor: "pointer", fontFamily: "inherit",
          border: on ? "2px solid var(--hs-primary, #0E4B43)" : "1px solid var(--hs-input-border, #C3D2CA)", background: on ? "var(--hs-chip-bg, #E4F0E9)" : "var(--hs-surface, #fff)", color: on ? "var(--hs-primary, #0E4B43)" : "var(--hs-muted, #5F716C)" } }, label);
    })));

  const ymDocs = cache[monthKey(ym.y, ym.m)];
  const prevDocs = prevYm ? cache[monthKey(prevYm.y, prevYm.m)] : null;
  const ready = !!ymDocs && (!prevYm || !!prevDocs);
  let body = null;
  if (range === "week") body = weekView;
  else if (err) body = ErrorBox(err);
  else if (range === "month") {
    body = !ready ? Skeleton(2, 120) : (() => {
      const ins = monthInsights({ curDocs: ymDocs, prevDocs, y: ym.y, m: ym.m, ctx, todayISO: today });
      return React.createElement("div", null,
        React.createElement(InsightCard, { ins }),
        React.createElement(DailyBarsCard, { rows: monthScores(ymDocs, ym.y, ym.m, ctx, today), y: ym.y, m: ym.m, today, prevAvg: ins.prevAvg }),
        React.createElement(WeekCompareCard, { buckets: weekBuckets({ curDocs: ymDocs, prevDocs, y: ym.y, m: ym.m, ctx, todayISO: today }), ym }),
        React.createElement(MetricCompareCard, { metrics: ins.metrics, ym }),
        React.createElement(MonthReviewCard, { stats: monthStats(ymDocs, ym.y, ym.m, ctx, today) }));
    })();
  } else {
    body = !loaded3 ? Skeleton(2, 120) : React.createElement(CompareCard, {
      list: three.map((x) => monthStats(cache[monthKey(x.y, x.m)], x.y, x.m, ctx, today)),
      avgs: monthlyAverages(three, (y, m) => cache[monthKey(y, m)], ctx, today) });
  }

  // হিটম্যাপ-ক্যালেন্ডার: App Creator-এর ডিজাইন (দৃশ্যমানতা/ভাঁজ) অনুযায়ী ("heatmap" কার্ড); ত্রুটি-বার্তা সবসময় দেখায়
  const heatNodes = { heatmap: () => [err && range === "week" ? null : ymDocs ? React.createElement(HeatCalendar, { ym, docs: ymDocs, ctx, today, sel, onSel: setSel, onMove: move }) : Skeleton(1, 260)] };
  return React.createElement("div", null,
    err && range === "week" && ErrorBox(err),
    ...renderLayoutCards("trend", "top", topLayout, heatNodes),
    pills,
    body);
}
