// আজ ট্যাবের তারিখ-বাছাই শিট — মাসের ক্যালেন্ডার (শনি-শুরু), হিজরি মাসসহ। শুধু UI; নিয়ম dateNav.js-এ।
// props: selected (ISO), today (ISO), marked (রেকর্ড-থাকা তারিখের Set), onPick(iso), onClose, loadMonth(y, m০–১১) → দিনের ডক-তালিকা (যেকোনো পুরনো মাসের ডট)

import { bnNum } from "../../shared/dates.js";
import { T } from "./trackerTheme.js";
import { Sheet, BTN } from "./PlanEditSheets.js";
import { monthGrid, inRange, hijriLabel, hasDayRecord, MIN_YEAR } from "./dateNav.js";

const { useState, useEffect } = React;
const WEEK = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];
const p2 = (n) => String(n).padStart(2, "0");

export function TodayDateSheet({ selected, today, marked, onPick, onClose, loadMonth }) {
  const [sy, sm] = selected.split("-").map(Number);
  const [ym, setYm] = useState({ y: sy, m: sm - 1 });
  const grid = monthGrid(ym.y, ym.m);
  const [ty, tm] = today.split("-").map(Number);
  const [extra, setExtra] = useState({}); // "y-m" → রেকর্ড-থাকা তারিখের Set (শুধু বাছা মাস লোড হয়)
  const [loadingM, setLoadingM] = useState(false);
  useEffect(() => {
    const k = ym.y + "-" + ym.m;
    if (!loadMonth || extra[k]) return undefined;
    let dead = false;
    setLoadingM(true);
    loadMonth(ym.y, ym.m)
      .then((docs) => { if (!dead) setExtra((v) => ({ ...v, [k]: new Set((docs || []).filter(hasDayRecord).map((x) => x.date)) })); })
      .catch(() => { /* ডট ছাড়াই চলবে; তারিখ বাছা/লেখা অক্ষত */ })
      .finally(() => { if (!dead) setLoadingM(false); });
    return () => { dead = true; };
    // eslint-disable-next-line
  }, [ym.y, ym.m]);
  const isMarked = (iso) => (marked && marked.has(iso)) || (extra[ym.y + "-" + ym.m] ? extra[ym.y + "-" + ym.m].has(iso) : false);
  const hFirst = hijriLabel(ym.y + "-" + p2(ym.m + 1) + "-01", false);
  const hLast = hijriLabel(ym.y + "-" + p2(ym.m + 1) + "-" + p2(new Date(ym.y, ym.m + 1, 0).getDate()), false);
  const hijri = hFirst && hLast ? (hFirst === hLast ? hFirst : hFirst.replace(/ \d+ হিজরি$/, "") + " – " + hLast) : "";
  const move = (n) => setYm((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  // ১৯৯০ জানুয়ারির আগে বা আজকের মাসের পরে তীর বন্ধ
  const anyIn = (n) => { const d = new Date(ym.y, ym.m + n, 1); const k = d.getFullYear() * 12 + d.getMonth(); return k >= MIN_YEAR * 12 && k <= ty * 12 + (tm - 1); };
  const setY = (y) => setYm((v) => ({ y, m: y === ty ? Math.min(v.m, tm - 1) : v.m }));
  const setM = (m) => setYm((v) => ({ y: v.y, m }));
  const sel = (value, onChange, options, label, width) => React.createElement("select", { value, onChange: (e) => onChange(Number(e.target.value)), "aria-label": label,
    style: { minHeight: "44px", width, padding: "0 6px", borderRadius: "12px", border: "1.5px solid " + T.border, background: "#fff", color: T.green, fontSize: "15px", fontWeight: 800, fontFamily: "inherit" } },
    options.map((o) => React.createElement("option", { key: o.v, value: o.v }, o.t)));
  const years = Array.from({ length: ty - MIN_YEAR + 1 }, (_, i) => ty - i).map((y) => ({ v: y, t: bnNum(y) }));
  const months = Array.from({ length: ym.y === ty ? tm : 12 }, (_, i) => ({ v: i, t: new Date(2000, i, 1).toLocaleDateString("bn-BD", { month: "long" }) }));
  const arrow = (n, label, ch) => React.createElement("button", { type: "button", onClick: () => move(n), disabled: !anyIn(n), "aria-label": label,
    style: { ...BTN, width: "44px", border: "none", background: T.track, color: T.green, fontSize: "20px", opacity: anyIn(n) ? 1 : 0.35 } }, ch);

  return React.createElement(Sheet, { title: "তারিখ বেছে নিন", subtitle: "যেকোনো পুরনো দিনের তথ্য দেখা ও যোগ করা যায়", onClose },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
      arrow(-1, "আগের মাস", "‹"),
      React.createElement("div", { style: { textAlign: "center", lineHeight: 1.3 } },
        React.createElement("div", { style: { display: "flex", gap: "6px", justifyContent: "center" } }, sel(ym.m, setM, months, "মাস", "104px"), sel(ym.y, setY, years, "বছর", "86px")),
        hijri && React.createElement("div", { style: { fontSize: "12.5px", color: T.muted } }, hijri)),
      arrow(1, "পরের মাস", "›")),
    React.createElement("div", { role: "grid", style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginTop: "10px", textAlign: "center" } },
      WEEK.map((w) => React.createElement("div", { key: w, style: { fontSize: "12px", color: T.muted, paddingBottom: "4px" } }, w)),
      grid.map((c) => {
        const ok = inRange(c.iso, today) && !c.outside;
        const isSel = c.iso === selected, isToday = c.iso === today;
        return React.createElement("button", { key: c.iso, type: "button", disabled: !ok, onClick: () => onPick(c.iso), "aria-label": c.iso + (isToday ? " আজ" : "") + (isMarked(c.iso) ? " রেকর্ড আছে" : ""), "aria-current": isSel ? "date" : undefined,
          style: { position: "relative", minHeight: "44px", minWidth: "0", borderRadius: "50%", border: isSel ? "2px solid " + T.green : "2px solid transparent", background: isToday ? T.orange : "transparent", color: isToday ? T.onDark : ok ? T.ink : "#B9B4A3", fontSize: "15px", fontWeight: isToday || isSel ? 800 : 500, fontFamily: "inherit", cursor: ok ? "pointer" : "default", opacity: c.outside ? 0.3 : 1, padding: 0 } },
          bnNum(c.day),
          isMarked(c.iso) && !c.outside && React.createElement("span", { "aria-hidden": "true", style: { position: "absolute", bottom: "4px", left: "50%", marginLeft: "-2.5px", width: "5px", height: "5px", borderRadius: "50%", background: isToday ? T.onDark : T.leaf } }));
      })),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, textAlign: "center", marginTop: "8px", lineHeight: 1.5 } }, (loadingM ? "ডট লোড হচ্ছে… · " : "") + "● সবুজ ডট = ওই দিনে রেকর্ড আছে · হিজরি তারিখ আনুমানিক (±১ দিন)"),
    React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "12px" } },
      React.createElement("button", { type: "button", onClick: () => onPick(today), style: { ...BTN, flex: 1, border: "none", background: "#E3EFEA", color: T.green } }, "আজ"),
      React.createElement("button", { type: "button", onClick: onClose, style: { ...BTN, flex: 1, border: "1.5px solid " + T.green, background: "#fff", color: T.green } }, "বন্ধ")));
}
