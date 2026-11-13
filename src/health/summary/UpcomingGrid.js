// "আসন্ন" (টিকা/অ্যাপয়েন্টমেন্ট) — ওষুধের মতো ২-কলামের ছোট টাইল। শুধু presentational + একটা self-loading র‍্যাপার।
// ডেটা: বিদ্যমান listCalendarEvents (শুধু পড়া); হিসাব upcomingEvents/whenLabel (todaySummaryCalc.js)।
import { T } from "../tracker/trackerTheme.js";
import { bnNum } from "../../shared/dates.js";
import { whenLabel } from "./todaySummaryCalc.js";

const h = React.createElement;
const EVENT_ICON = { vaccination: "💉", appointment: "🩺" };

export function UpcomingGrid({ events }) {
  return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px" } },
    events.map((e) => {
      const d = new Date(e.date + "T00:00:00");
      return h("div", { key: e.id, style: { display: "flex", alignItems: "center", gap: "8px", minHeight: "48px", padding: "5px 8px", borderRadius: "12px", border: "1px solid " + T.border, background: T.surface, minWidth: 0 } },
        h("div", { "aria-hidden": "true", style: { width: "34px", height: "38px", flexShrink: 0, borderRadius: "9px", background: T.green, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.05 } },
          h("span", { style: { fontSize: "15px", fontWeight: 800 } }, bnNum(d.getDate())),
          h("span", { style: { fontSize: "10px" } }, d.toLocaleDateString("bn-BD", { month: "short" }))),
        h("div", { style: { minWidth: 0, flex: 1 } },
          h("div", { style: { fontSize: "13px", fontWeight: 700, color: T.ink, lineHeight: 1.2, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, (EVENT_ICON[e.eventType] || "📅") + " " + e.title),
          h("div", { style: { fontSize: "11.5px", color: T.muted, lineHeight: 1.25 } }, whenLabel(e))));
    }));
}
