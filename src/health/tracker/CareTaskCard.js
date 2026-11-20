// ট্র্যাকার রিভিউ: "আজকের যত্ন"-এর পানি/পেট ডায়েরি টাস্কের সাপ্তাহিক টিক (শনি–শুক্র)। শুধু দেখানো; সদস্যের নিজের টিক।
// পড়া ব্যর্থ বা কোনো টিক না থাকলে কার্ড লুকানো — রিভিউ-পেজ অক্ষত থাকে।
import { T, HOME_CARD } from "./trackerTheme.js";
import { getCareLog } from "../mycare/careLogData.js";
import { weekCells, isoOf, TASK_WATER, TASK_GUT } from "../mycare/careLogCore.js";
import { IconBox } from "../mycare/careIcons.js";
import { bnNum } from "../../shared/dates.js";

const { useState, useEffect } = React;
const h = React.createElement;
const DAYS = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];
const TASKS = [["all", "sparkle", "#1F7A5C", "আজকের যত্ন সম্পূর্ণ"], [TASK_WATER, "water", "#3B82B6", "পানি পান"], [TASK_GUT, "gut", "#7A5BB0", "পেট ডায়েরি"]];

export function CareTaskCard({ familyId, memberId }) {
  const [days, setDays] = useState(null);
  useEffect(() => {
    if (!familyId || !memberId) { setDays(null); return undefined; }
    let alive = true;
    getCareLog(familyId, memberId).then((r) => { if (alive) setDays(r ? r.days : null); }).catch(() => { if (alive) setDays(null); });
    return () => { alive = false; };
  }, [familyId, memberId]);
  if (!days) return null;
  const cells = weekCells(days, isoOf(new Date()));
  const has = (c, key) => (days[c.iso] || []).includes(key);
  const rows = TASKS.map(([key, icon, color, label]) => ({ key, icon, color, label, n: cells.filter((c) => has(c, key)).length })).filter((r) => r.n > 0);
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.n, 0);
  const dot = (c, key) => {
    const on = has(c, key);
    return h("div", { key: c.iso, style: { textAlign: "center" } },
      h("div", { style: { fontSize: "11.5px", color: T.muted, marginBottom: "3px" } }, DAYS[c.index]),
      h("div", { "aria-label": c.iso + (on ? " ✓" : ""), style: { width: "26px", height: "26px", margin: "0 auto", borderRadius: "50%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#fff", background: on ? T.green : "transparent", border: on ? "2px solid " + T.green : "2px " + (c.state === "future" ? "dashed " : "solid ") + T.border } }, on ? "✓" : ""));
  };
  return h("div", { style: { ...HOME_CARD, padding: "14px", marginBottom: "12px" } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", marginBottom: "8px" } },
      h("span", { style: { fontSize: "16px", fontWeight: 800, color: T.ink } }, "যত্নের টাস্ক"),
      h("span", { style: { fontSize: "12.5px", color: T.muted } }, "এই সপ্তাহে ✓ " + bnNum(total))),
    rows.map((r) => h("div", { key: r.key, style: { marginTop: "8px" } },
      h("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
        h(IconBox, { id: r.icon, color: r.color, size: 26 }),
        h("span", { style: { flex: 1, fontSize: "14px", fontWeight: 700, color: T.ink } }, r.label),
        h("span", { style: { fontSize: "12.5px", fontWeight: 800, color: T.green } }, bnNum(r.n) + "/৭")),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "2px" } }, cells.map((c) => dot(c, r.key))))),
    h("div", { style: { marginTop: "8px", fontSize: "12px", color: T.muted } }, "আজকের যত্ন-এ আপনার দেওয়া টিক থেকে। সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"));
}
