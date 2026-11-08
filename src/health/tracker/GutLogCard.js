// পেটের লক্ষণ-লগ কার্ড (পার্ট ১১) — শুধু UI; হিসাব gutLog.js-এ, লেখা বিদ্যমান createHealthRecord/deleteHealthRecord দিয়ে।
// আজকের ব্রিস্টল-স্কোর ও আজকের `gut`-ট্যাগ খাবারের সংখ্যা শুধু পাশাপাশি — "কারণ" দাবি নেই।

import { ErrorBox } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { createHealthRecord, deleteHealthRecord } from "../records/healthRecordsData.js";
import { todayISO } from "./trackerData.js";
import { weekDatesISO } from "./exercisePlanData.js";
import { T, CARD_STYLE } from "./trackerTheme.js";
import { BRISTOL, entriesOn, checkGutAdd, buildGutRecord, gutWeek } from "./gutLog.js";

const { useState } = React;

export function GutLogCard({ info, familyId, callerMemberId, memberId, gutFoods, onSaved }) {
  const entries = info.gutEntries || [];
  const today = todayISO();
  const todays = entriesOn(entries, today);
  const week = gutWeek(entries, weekDatesISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const run = async (fn) => {
    setErr(null); setBusy(true);
    try { await fn(); await onSaved(); }
    catch (x) { setErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণ/মোছার অনুমতি আপনার নেই।" : (x.message || String(x))); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } }
    finally { setBusy(false); }
  };
  const add = (score) => {
    if (busy) return;
    const bad = checkGutAdd(score, todays.length);
    if (bad) { setErr(bad); return; }
    run(async () => { await createHealthRecord(familyId, memberId, callerMemberId, "observation", buildGutRecord(score, today)); setOpen(false); });
  };
  const del = (id) => run(async () => { await deleteHealthRecord(familyId, id, memberId, callerMemberId); setConfirmId(null); });

  const chip = (bg, color) => ({ display: "inline-block", padding: "4px 10px", borderRadius: "999px", background: bg, color, fontSize: "13px", fontWeight: 700 });
  const label = (n) => (BRISTOL.find((b) => b[0] === n) || [])[1];

  return React.createElement("div", { style: CARD_STYLE },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: T.ink } }, "🩺 পেটের লক্ষণ"),
      React.createElement("button", { onClick: () => { setErr(null); setOpen(!open); }, disabled: busy, style: { minHeight: "40px", padding: "0 14px", borderRadius: "12px", border: "1.5px solid " + T.green, background: open ? T.green : T.surface, color: open ? T.onDark : T.green, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, open ? "বন্ধ" : "＋ আজকের এন্ট্রি")),

    open && React.createElement("div", { style: { marginTop: "10px" } },
      React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginBottom: "6px" } }, "ব্রিস্টল স্কেল (আকৃতি দেখে বাছুন):"),
      BRISTOL.map(([n, text]) => React.createElement("button", { key: n, onClick: () => add(n), disabled: busy, style: { display: "flex", width: "100%", alignItems: "center", gap: "10px", minHeight: "44px", marginBottom: "6px", padding: "0 12px", borderRadius: "12px", border: "1px solid " + T.track, background: T.surface, color: T.ink, fontSize: "14px", cursor: busy ? "default" : "pointer", textAlign: "left", fontFamily: "inherit" } },
        React.createElement("b", { style: { color: T.green, minWidth: "18px" } }, bnNum(n)), text))),

    React.createElement("div", { style: { marginTop: "10px", fontSize: "14px", color: T.ink, lineHeight: 1.8 } },
      todays.length === 0
        ? React.createElement("span", { style: { color: T.muted } }, "আজ কোনো এন্ট্রি নেই।")
        : todays.map((e) => React.createElement("div", { key: e.id, style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          React.createElement("span", { style: chip("#E4F0E9", T.green) }, "স্কোর " + bnNum(e.score)),
          React.createElement("span", { style: { color: T.muted, fontSize: "13px", flex: 1, minWidth: 0 } }, label(e.score)),
          confirmId === e.id
            ? React.createElement("span", null,
              React.createElement("button", { onClick: () => del(e.id), disabled: busy, style: { minHeight: "36px", padding: "0 10px", borderRadius: "10px", border: "none", background: "#C0392B", color: T.onDark, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "মুছুন"),
              React.createElement("button", { onClick: () => setConfirmId(null), disabled: busy, style: { minHeight: "36px", padding: "0 10px", marginLeft: "6px", borderRadius: "10px", border: "1px solid " + T.track, background: T.surface, color: T.ink, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" } }, "না"))
            : React.createElement("button", { onClick: () => setConfirmId(e.id), disabled: busy, "aria-label": "এন্ট্রি মুছুন", style: { minWidth: "36px", minHeight: "36px", borderRadius: "10px", border: "1px solid " + T.track, background: T.surface, color: T.muted, cursor: "pointer", fontFamily: "inherit" } }, "✕")))),

    // পাশাপাশি (কারণ-দাবি নয়): আজকের পেট-ট্যাগ খাবার
    React.createElement("div", { style: { marginTop: "8px", fontSize: "13px", color: T.muted } },
      "আজ ‘পেট’-ট্যাগ করা খাবার: ", React.createElement("b", { style: { color: T.ink } }, bnNum(gutFoods)), "টি"),

    // এই সপ্তাহ (শনি–শুক্র)
    week.some((w) => w.scores.length) && React.createElement("div", { style: { marginTop: "8px", fontSize: "13px", color: T.muted, lineHeight: 1.7 } },
      "এই সপ্তাহ: ", week.filter((w) => w.scores.length).map((w) => React.createElement("span", { key: w.date, style: { marginRight: "10px", whiteSpace: "nowrap" } }, w.date.slice(5).replace("-", "/") + " → " + w.scores.map((s) => bnNum(s)).join(", ")))),

    err && ErrorBox(err),
    React.createElement("div", { style: { marginTop: "8px", fontSize: "12px", color: T.muted, lineHeight: 1.5 } },
      "এটি আপনার নিজের লেখা নোট; কোন খাবার কারণ তা এটি বলে না। রক্ত, তীব্র ব্যথা, জ্বর বা বারবার পাতলা পায়খানা হলে ডাক্তার দেখান।"));
}
