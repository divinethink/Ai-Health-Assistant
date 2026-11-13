// ট্রেন্ড-ট্যাবের উপরের অংশ: হিটম্যাপ + সপ্তাহ|মাস|৩ মাস সুইচ। শুধু UI; হিসাব trendRange.js-এ (pure)।
// সপ্তাহ-ভিউ আগের মতোই (weekView prop)। মাস = সোয়াইপ-ক্যালেন্ডার + মাসিক রিভিউ; ৩ মাস = টাস্কভিত্তিক তুলনা।
// ডেটা: getMonthDaily (বিদ্যমান equality-query; নতুন index/rules লাগে না), মাস-ভিত্তিক ক্যাশ। পানি বাদ।

import { ErrorBox, Skeleton } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { T, CARD_STYLE } from "./trackerTheme.js";
import { getMonthDaily, todayISO } from "./trackerData.js";
import { targetCtxFor } from "./weeklyTrend.js";
import { swipeDelta } from "./dateNav.js";
import { lastNMonths, shiftMonth, monthKey, heatLevel, heatWeeks, monthStats, monthReview, compareMonths, compareNotes } from "./trendRange.js";

const { useState, useEffect } = React;

const p2 = (n) => String(n).padStart(2, "0");
const WEEK = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];
const bnPlain = (n) => Number(n).toLocaleString("bn-BD", { useGrouping: false }); // ২০২৬ (কমা ছাড়া)
const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString("bn-BD", { month: "long" });
const mixPrimary = (pct) => "color-mix(in srgb, var(--hs-primary, #0E4B43) " + pct + "%, var(--hs-surface, #fff))";
const LV_BG = [T.track, mixPrimary(28), mixPrimary(58), mixPrimary(92)];
const LV_TEXT = ["রেকর্ড নেই", "রেকর্ড আছে", "কিছু লক্ষ্য পূরণ", "টার্গেটে"];

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

const card = (children, extra) => React.createElement("div", { style: { ...CARD_STYLE, ...(extra || {}) } }, children);
const title = (t, sub) => React.createElement("div", { style: { marginBottom: "6px" } },
  React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, t),
  sub && React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "1px" } }, sub));

// ---------- হিটম্যাপ ----------
function Heatmap({ weeks }) {
  const days = weeks.flat().filter((c) => !c.out);
  const hit = days.filter((c) => c.level === 3).length;
  const rec = days.filter((c) => c.level > 0).length;
  const monthLabels = weeks.map((w) => { const c = w.find((x) => !x.out && x.iso.slice(8) === "01"); return c ? monthName(Number(c.iso.slice(0, 4)), Number(c.iso.slice(5, 7)) - 1) : ""; });
  const cols = "18px repeat(" + weeks.length + ", minmax(0, 1fr))";
  return card([
    title("হিটম্যাপ — শেষ ৩ মাস", bnNum(hit) + " দিন টার্গেটে · " + bnNum(rec) + " দিনে রেকর্ড"),
    React.createElement("div", { key: "g", role: "img", "aria-label": "শেষ ৩ মাসে " + bnNum(hit) + " দিন টার্গেটে, " + bnNum(rec) + " দিনে রেকর্ড",
      style: { display: "grid", gridTemplateColumns: cols, gap: "3px", alignItems: "center" } },
      React.createElement("div", { key: "m0" }),
      ...monthLabels.map((l, i) => React.createElement("div", { key: "m" + (i + 1), style: { fontSize: "11px", color: T.muted, whiteSpace: "nowrap", overflow: "visible" } }, l)),
      ...WEEK.flatMap((w, r) => [
        React.createElement("div", { key: "d" + r, style: { fontSize: "10px", color: T.muted, lineHeight: 1 } }, w.slice(0, 1)),
        ...weeks.map((wk, ci) => { const c = wk[r]; return React.createElement("div", { key: "c" + r + "_" + ci, "aria-hidden": "true", title: c.iso,
          style: { aspectRatio: "1 / 1", borderRadius: "4px", background: c.out ? "transparent" : LV_BG[c.level] } }); }),
      ])),
    React.createElement("div", { key: "lg", style: { display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: "8px", fontSize: "12px", color: T.muted, alignItems: "center" } },
      [0, 1, 2, 3].map((l) => React.createElement("span", { key: l, style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
        React.createElement("span", { "aria-hidden": "true", style: { width: "12px", height: "12px", borderRadius: "3px", background: LV_BG[l], display: "inline-block" } }),
        LV_TEXT[l]))),
  ]);
}

// ---------- সোয়াইপ ক্যালেন্ডার (মাস) ----------
function monthGridCells(y, m) {
  const lead = (new Date(y, m, 1).getDay() + 1) % 7; // শনি=০
  const n = new Date(y, m + 1, 0).getDate();
  const total = Math.ceil((lead + n) / 7) * 7;
  return Array.from({ length: total }, (_, i) => { const d = i - lead + 1; return d >= 1 && d <= n ? { day: d, iso: y + "-" + p2(m + 1) + "-" + p2(d) } : null; });
}

function DayDetail({ date, doc, level }) {
  const lines = [];
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
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink } }, head + (level === 3 ? " · ✅ টার্গেটে" : "")),
    lines.length ? lines.map((l, i) => React.createElement("div", { key: i, style: { fontSize: "14px", color: T.ink, marginTop: "3px" } }, l))
      : React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginTop: "3px" } }, "এই দিনে কোনো রেকর্ড নেই।"),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "6px" } }, "এটি শুধু দেখার জন্য। পুরনো দিনের তথ্য বদলাতে Home-এর তারিখ-বাছাই ব্যবহার করুন।"));
}

function MonthCalendar({ ym, docs, ctx, today, sel, onSel, onMove }) {
  const by = {};
  (docs || []).forEach((d) => { if (d && d.date) by[d.date] = d; });
  const [t0, setT0] = useState(null);
  const cells = monthGridCells(ym.y, ym.m);
  const canPrev = shiftMonth(ym, -1) !== ym, canNext = shiftMonth(ym, 1) !== ym;
  const arrow = (n, label, ch, ok) => React.createElement("button", { type: "button", onClick: () => onMove(n), disabled: !ok, "aria-label": label,
    style: { width: "44px", minHeight: "44px", borderRadius: "12px", border: "none", background: T.track, color: T.green, fontSize: "20px", cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.35, fontFamily: "inherit" } }, ch);
  const selInMonth = sel && sel.slice(0, 7) === ym.y + "-" + p2(ym.m + 1) ? sel : null;
  return card([
    React.createElement("div", { key: "h", style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      arrow(-1, "আগের মাস", "‹", canPrev),
      React.createElement("div", { style: { fontSize: "16px", fontWeight: 800, color: T.green }, "aria-live": "polite" }, monthName(ym.y, ym.m) + " " + bnPlain(ym.y)),
      arrow(1, "পরের মাস", "›", canNext)),
    React.createElement("div", { key: "g", style: { touchAction: "pan-y", marginTop: "8px" },
      onTouchStart: (e) => { const t = e.touches[0]; setT0({ x: t.clientX, y: t.clientY }); },
      onTouchEnd: (e) => {
        if (!t0) return;
        const t = e.changedTouches[0];
        const dlt = swipeDelta(t.clientX - t0.x, t.clientY - t0.y);
        setT0(null);
        if (dlt) onMove(dlt);
      } },
      React.createElement("div", { role: "grid", style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", textAlign: "center" } },
        WEEK.map((w) => React.createElement("div", { key: w, style: { fontSize: "12px", color: T.muted, paddingBottom: "2px" } }, w)),
        cells.map((c, i) => {
          if (!c) return React.createElement("div", { key: "e" + i });
          const future = c.iso > today;
          const lv = future ? 0 : heatLevel(by[c.iso], ctx, c.iso);
          const isSel = c.iso === selInMonth, isToday = c.iso === today;
          return React.createElement("button", { key: c.iso, type: "button", disabled: future, onClick: () => onSel(c.iso),
            "aria-label": c.iso + (isToday ? " আজ" : "") + (lv === 3 ? " টার্গেটে" : lv > 0 ? " রেকর্ড আছে" : ""), "aria-pressed": isSel,
            style: { minHeight: "44px", minWidth: 0, padding: 0, borderRadius: "10px", fontFamily: "inherit", fontSize: "14px", fontWeight: isToday || isSel ? 800 : 500, cursor: future ? "default" : "pointer",
              border: isSel ? "2px solid " + T.green : isToday ? "2px solid " + T.orange : "2px solid transparent",
              background: future ? "transparent" : LV_BG[lv], color: future ? T.border : lv === 3 ? T.onDark : T.ink } }, bnNum(c.day));
        }))),
    React.createElement("div", { key: "n", style: { fontSize: "12px", color: T.muted, marginTop: "6px", textAlign: "center" } }, "ডানে-বাঁয়ে টেনে মাস বদলান · রং যত গাঢ়, তত বেশি লক্ষ্য পূরণ"),
    selInMonth && React.createElement(DayDetail, { key: "d", date: selInMonth, doc: by[selInMonth], level: heatLevel(by[selInMonth], ctx, selInMonth) }),
  ]);
}

function MonthReviewCard({ stats }) {
  const r = monthReview(stats, bnNum);
  return card([
    title("মাসিক রিভিউ", monthName(stats.y, stats.m) + " " + bnPlain(stats.y) + " · শুধু আপনার দেওয়া তথ্য থেকে"),
    React.createElement("div", { key: "b", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } },
      stats.loggedDays === 0 ? React.createElement("div", { style: { color: T.muted } }, "এই মাসে কোনো রেকর্ড নেই।")
        : [r.points.map((p, i) => React.createElement("div", { key: "p" + i }, "• " + p)),
          r.comment.map((c, i) => React.createElement("div", { key: "c" + i, style: { marginTop: i === 0 ? "8px" : "4px" } }, c))]),
  ]);
}

// ---------- ৩ মাসের তুলনা ----------
function CompareCard({ list }) {
  const rows = compareMonths(list, bnNum);
  const notes = compareNotes(rows);
  const last = list.length - 1;
  return card([
    title("৩ মাসের তুলনা", "টাস্কভিত্তিক — লক্ষ্য-পূরণের দিন ÷ তথ্য-দেওয়া দিন"),
    ...rows.map((r) => React.createElement("div", { key: r.key, style: { margin: "10px 0 4px" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink, marginBottom: "4px" } }, r.label),
      r.vals.map((v, i) => React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: "8px", minHeight: "24px" } },
        React.createElement("span", { style: { width: "64px", flexShrink: 0, fontSize: "12.5px", color: i === last ? T.green : T.muted, fontWeight: i === last ? 700 : 400 } }, monthName(list[i].y, list[i].m)),
        React.createElement("div", { style: { flex: 1, minWidth: 0, height: "10px", borderRadius: "999px", background: T.track, overflow: "hidden" } },
          React.createElement("div", { style: { width: (v.pct || 0) + "%", height: "100%", background: i === last ? T.green : T.green2, opacity: i === last ? 1 : 0.55 } })),
        React.createElement("span", { style: { width: "78px", flexShrink: 0, fontSize: "12.5px", color: T.ink, textAlign: "right" } }, v.text))))),
    notes.length > 0 && React.createElement("div", { key: "n", style: { marginTop: "8px", fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, notes.map((n, i) => React.createElement("div", { key: i }, "• " + n))),
  ]);
}

// ---------- মূল ----------
const RANGES = [["week", "সপ্তাহ"], ["month", "মাস"], ["quarter", "৩ মাস"]];

export function TrendRanges({ info, familyId, memberId, weekView }) {
  const today = todayISO();
  const three = lastNMonths(new Date(), 3);
  const [range, setRange] = useState("week");
  const [ym, setYm] = useState(three[2]);
  const [sel, setSel] = useState(today);
  const need = [...three];
  if (!need.some((x) => x.y === ym.y && x.m === ym.m)) need.push(ym);
  const { cache, err } = useMonths(familyId, memberId, need);
  const ctx = { ...targetCtxFor({ age: info.age, flags: info.flags, goal: info.goal }), waterTarget: null };
  const loaded3 = three.every((x) => cache[monthKey(x.y, x.m)]);
  const docs3 = loaded3 ? three.flatMap((x) => cache[monthKey(x.y, x.m)]) : null;
  const start = three[0].y + "-" + p2(three[0].m + 1) + "-01";
  const move = (n) => { const next = shiftMonth(ym, n); if (next !== ym) { setYm(next); setSel(null); } };

  const pills = React.createElement("div", { className: "hs-trk-pills", style: { marginBottom: "8px" } }, React.createElement("div", { style: { display: "flex", gap: "6px", padding: "2px" } },
    RANGES.map(([id, label]) => {
      const on = id === range;
      return React.createElement("button", { key: id, type: "button", onClick: () => setRange(id), "aria-pressed": on,
        style: { flex: 1, fontSize: "14px", fontWeight: 700, padding: "9px 8px", minHeight: "44px", borderRadius: "999px", cursor: "pointer", fontFamily: "inherit",
          border: on ? "2px solid var(--hs-primary, #0E4B43)" : "1px solid var(--hs-input-border, #C3D2CA)", background: on ? "var(--hs-chip-bg, #E4F0E9)" : "var(--hs-surface, #fff)", color: on ? "var(--hs-primary, #0E4B43)" : "var(--hs-muted, #5F716C)" } }, label);
    })));

  const ymDocs = cache[monthKey(ym.y, ym.m)];
  let body = null;
  if (range === "week") body = weekView;
  else if (err) body = ErrorBox(err);
  else if (range === "month") {
    body = !ymDocs ? Skeleton(2, 120) : React.createElement("div", null,
      React.createElement(MonthCalendar, { ym, docs: ymDocs, ctx, today, sel, onSel: setSel, onMove: move }),
      React.createElement(MonthReviewCard, { stats: monthStats(ymDocs, ym.y, ym.m, ctx, today) }));
  } else {
    body = !loaded3 ? Skeleton(2, 120) : React.createElement(CompareCard, { list: three.map((x) => monthStats(cache[monthKey(x.y, x.m)], x.y, x.m, ctx, today)) });
  }

  return React.createElement("div", null,
    err && range === "week" ? ErrorBox(err) : docs3 ? React.createElement(Heatmap, { weeks: heatWeeks(docs3, ctx, start, today) }) : Skeleton(1, 150),
    pills,
    body);
}
