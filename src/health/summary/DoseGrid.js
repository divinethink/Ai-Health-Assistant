// "আজকের ওষুধ" — বেলা-ভিত্তিক গ্রুপ + ২-কলামের ট্যাপ-টাইল (টাইল ট্যাপ = খেয়েছি/ফেরত)।
// শুধু presentational: ডেটা লেখা বাইরের onToggle-এ (বিদ্যমান setMedDoseTaken)। নামের শর্টকাট শুধু দেখানোয়।
// dose = { key, time:"HH:MM", name, meal?, taken, due, memberName? }
import { T, SLOT_TINT } from "../tracker/trackerTheme.js";
import { Icon } from "../../shared/icons.js";
import { bnNum } from "../../shared/dates.js";
import { bnClock } from "./todaySummaryCalc.js";
import { shortMedName, groupDosesByTime } from "./doseGroups.js";

const h = React.createElement;
// বেলা-অ্যাক্সেন্ট: খাবারের বেলার মতোই নরম রঙের টালিতে লাইন-আইকন (SLOT_TINT/লাইন-আইকন একই উৎস)
const slotOf = (hhmm) => { const hh = Number(hhmm.slice(0, 2)); return hh < 11 ? ["sunrise", SLOT_TINT.breakfast] : hh < 17 ? ["sun", SLOT_TINT.lunch] : hh < 20 ? ["sunset", SLOT_TINT.iftar] : ["moon", SLOT_TINT.dinner]; };

function Tile({ d, busy, onToggle, compact }) {
  const { main, sub } = shortMedName(d.name);
  const second = [sub, d.meal, d.memberName].filter(Boolean).join(" · ");
  // বাকি ওষুধ (সময় পার হোক বা ভবিষ্যতের) — নিরপেক্ষ ধূসর; শুধু খাওয়া হলে সবুজ (owner-request ২০২৬-১১-১৬)।
  const border = d.taken ? T.green : T.border;
  const bg = d.taken ? "#E2F3E9" : T.surface;
  return h("button", {
    type: "button", onClick: onToggle, disabled: busy, "aria-pressed": !!d.taken,
    "aria-label": d.name + " " + bnClock(d.time) + (d.taken ? " — খাওয়া হয়েছে, বাতিল করতে চাপুন" : " — খেয়েছি চিহ্নিত করুন"),
    style: { display: "flex", alignItems: "center", gap: compact ? "6px" : "8px", minHeight: compact ? "44px" : "56px", padding: compact ? "5px 8px" : "8px 10px", borderRadius: compact ? "12px" : "14px", border: "1.5px solid " + border, background: bg, color: T.ink, textAlign: "left", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit", minWidth: 0 },
  },
    h("span", { "aria-hidden": "true", style: { width: compact ? "20px" : "24px", height: compact ? "20px" : "24px", flexShrink: 0, borderRadius: "50%", border: "2px solid " + (d.taken ? T.green : T.inputBorder), background: d.taken ? T.green : "transparent", color: "#fff", fontSize: compact ? "12px" : "14px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" } }, d.taken ? "✓" : ""),
    h("span", { style: { minWidth: 0, flex: 1 } },
      h("span", { style: { display: "block", fontSize: compact ? "13px" : "15px", fontWeight: 700, lineHeight: 1.2, overflowWrap: "anywhere", color: d.taken ? T.green : T.ink } }, main),
      second && h("span", { style: { display: "block", fontSize: compact ? "11.5px" : "13px", color: T.muted, lineHeight: 1.25, overflowWrap: "anywhere" } }, second)));
}

export function DoseGrid({ doses, busyKey, onToggle, compact }) {
  return h("div", null, groupDosesByTime(doses).map((g, gi) => {
    const done = g.items.filter((x) => x.taken).length;
    return h("div", { key: g.time, style: { marginTop: gi === 0 ? 0 : (compact ? "8px" : "12px") } },
      h("div", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: compact ? "13px" : "14px", fontWeight: 700, color: T.green, margin: compact ? "0 2px 4px" : "0 2px 6px" } },
        h("span", { "aria-hidden": "true", style: { width: compact ? "26px" : "30px", height: compact ? "26px" : "30px", borderRadius: "9px", background: slotOf(g.time)[1], display: "flex", alignItems: "center", justifyContent: "center", color: T.green, flexShrink: 0 } }, Icon(slotOf(g.time)[0], { size: compact ? 16 : 18 })), bnClock(g.time),
        h("span", { style: { fontWeight: 600, color: T.muted } }, "· " + bnNum(done) + "/" + bnNum(g.items.length))),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: compact ? "6px" : "8px" } },
        g.items.map((d) => h(Tile, { key: d.key, d, busy: busyKey === d.key, onToggle: () => onToggle(d), compact }))));
  }));
}
