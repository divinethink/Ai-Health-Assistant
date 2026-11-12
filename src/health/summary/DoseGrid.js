// "আজকের ওষুধ" — বেলা-ভিত্তিক গ্রুপ + ২-কলামের ট্যাপ-টাইল (টাইল ট্যাপ = খেয়েছি/ফেরত)।
// শুধু presentational: ডেটা লেখা বাইরের onToggle-এ (বিদ্যমান setMedDoseTaken)। নামের শর্টকাট শুধু দেখানোয়।
// dose = { key, time:"HH:MM", name, meal?, taken, due, memberName? }
import { T } from "../tracker/trackerTheme.js";
import { bnNum } from "../../shared/dates.js";
import { bnClock } from "./todaySummaryCalc.js";
import { shortMedName, groupDosesByTime } from "./doseGroups.js";

const h = React.createElement;
const dayIcon = (hhmm) => { const hh = Number(hhmm.slice(0, 2)); return hh < 12 ? "🌅" : hh < 18 ? "☀️" : "🌙"; };

function Tile({ d, busy, onToggle, compact }) {
  const { main, sub } = shortMedName(d.name);
  const second = [sub, d.meal, d.memberName].filter(Boolean).join(" · ");
  const late = !d.taken && d.due;
  const border = d.taken ? T.green : late ? T.amber : T.border;
  const bg = d.taken ? "#E2F3E9" : late ? "#FFF6E0" : T.surface;
  return h("button", {
    type: "button", onClick: onToggle, disabled: busy, "aria-pressed": !!d.taken,
    "aria-label": d.name + " " + bnClock(d.time) + (d.taken ? " — খাওয়া হয়েছে, বাতিল করতে চাপুন" : " — খেয়েছি চিহ্নিত করুন"),
    style: { display: "flex", alignItems: "center", gap: compact ? "6px" : "8px", minHeight: compact ? "44px" : "56px", padding: compact ? "5px 8px" : "8px 10px", borderRadius: compact ? "12px" : "14px", border: "1.5px solid " + border, background: bg, color: T.ink, textAlign: "left", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit", minWidth: 0 },
  },
    h("span", { "aria-hidden": "true", style: { width: compact ? "20px" : "24px", height: compact ? "20px" : "24px", flexShrink: 0, borderRadius: "50%", border: "2px solid " + (d.taken ? T.green : late ? T.amber : T.inputBorder), background: d.taken ? T.green : "transparent", color: "#fff", fontSize: compact ? "12px" : "14px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" } }, d.taken ? "✓" : ""),
    h("span", { style: { minWidth: 0, flex: 1 } },
      h("span", { style: { display: "block", fontSize: compact ? "13px" : "15px", fontWeight: 700, lineHeight: 1.2, overflowWrap: "anywhere", color: d.taken ? T.green : T.ink } }, main),
      second && h("span", { style: { display: "block", fontSize: compact ? "11.5px" : "13px", color: T.muted, lineHeight: 1.25, overflowWrap: "anywhere" } }, second)));
}

export function DoseGrid({ doses, busyKey, onToggle, compact }) {
  return h("div", null, groupDosesByTime(doses).map((g, gi) => {
    const done = g.items.filter((x) => x.taken).length;
    return h("div", { key: g.time, style: { marginTop: gi === 0 ? 0 : (compact ? "8px" : "12px") } },
      h("div", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: compact ? "13px" : "14px", fontWeight: 700, color: T.green, margin: compact ? "0 2px 4px" : "0 2px 6px" } },
        h("span", { "aria-hidden": "true" }, dayIcon(g.time)), bnClock(g.time),
        h("span", { style: { fontWeight: 600, color: T.muted } }, "· " + bnNum(done) + "/" + bnNum(g.items.length))),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: compact ? "6px" : "8px" } },
        g.items.map((d) => h(Tile, { key: d.key, d, busy: busyKey === d.key, onToggle: () => onToggle(d), compact }))));
  }));
}
