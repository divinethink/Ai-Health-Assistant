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

export function GutLogCard({ info, familyId, callerMemberId, memberId, gutFoods, onSaved, bare }) {
  const entries = info.gutEntries || [];
  const today = todayISO();
  const todays = entriesOn(entries, today);
  const week = gutWeek(entries, weekDatesISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(false); // ডিফল্টে ভাঁজ করা
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
    run(async () => { await createHealthRecord(familyId, memberId, callerMemberId, "observation", buildGutRecord(score, today)); });
  };
  const del = (id) => run(async () => { await deleteHealthRecord(familyId, id, memberId, callerMemberId); setConfirmId(null); });

  const chip = (bg, color) => ({ display: "inline-block", padding: "4px 10px", borderRadius: "999px", background: bg, color, fontSize: "13px", fontWeight: 700 });
  const label = (n) => (BRISTOL.find((b) => b[0] === n) || [])[1];

  const latest = todays.length ? todays[todays.length - 1] : null;
  const R = React.createElement;

  const isOpen = bare || expanded; // bare: হেডার নেই, বাইরের ভাঁজ-চিপ নিয়ন্ত্রণ করে

  return R("div", { style: { ...CARD_STYLE, padding: bare ? "10px 12px 0" : "2px 12px" } },
    // ভাঁজযোগ্য হেডার: এক লাইনে নাম + আজকের স্কোর-সারাংশ + তীর
    !bare && R("button", { onClick: () => { setErr(null); setExpanded(!expanded); }, "aria-expanded": expanded, style: { display: "flex", alignItems: "center", gap: "8px", width: "100%", minHeight: "44px", padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" } },
      R("span", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, "🩺 পেটের লক্ষণ"),
      R("span", { style: { flex: 1, minWidth: 0 } }, latest ? R("span", { style: chip("#E4F0E9", T.green) }, "আজ স্কোর " + bnNum(latest.score)) : R("span", { style: { fontSize: "13px", color: T.muted } }, "আজ এন্ট্রি নেই")),
      R("span", { "aria-hidden": "true", style: { fontSize: "13px", color: T.muted } }, expanded ? "▲" : "▼")),

    isOpen && R("div", { style: { paddingBottom: "10px" } },
      todays.map((e) => R("div", { key: e.id, style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "14px", color: T.ink } },
        R("span", { style: chip("#E4F0E9", T.green) }, "স্কোর " + bnNum(e.score)),
        R("span", { style: { color: T.muted, fontSize: "13px", flex: 1, minWidth: 0 } }, label(e.score)),
        confirmId === e.id
          ? R("span", null,
            R("button", { onClick: () => del(e.id), disabled: busy, style: { minHeight: "36px", padding: "0 10px", borderRadius: "10px", border: "none", background: "#C0392B", color: T.onDark, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "মুছুন"),
            R("button", { onClick: () => setConfirmId(null), disabled: busy, style: { minHeight: "36px", padding: "0 10px", marginLeft: "6px", borderRadius: "10px", border: "1px solid " + T.track, background: T.surface, color: T.ink, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" } }, "না"))
          : R("button", { onClick: () => setConfirmId(e.id), disabled: busy, "aria-label": "এন্ট্রি মুছুন", style: { minWidth: "36px", minHeight: "36px", border: "none", background: "none", color: T.muted, cursor: "pointer", fontFamily: "inherit" } }, "✕"))),

      R("div", { style: { fontSize: "12px", color: T.muted, margin: "6px 0" } }, "ব্রিস্টল স্কেল — আকৃতি দেখে নম্বরে ট্যাপ করুন:"),
      R("div", { style: { display: "flex", gap: "6px" } },
        BRISTOL.map(([n, text]) => R("button", { key: n, onClick: () => add(n), disabled: busy, "aria-label": "স্কোর " + bnNum(n) + ": " + text, style: { flex: 1, minWidth: 0, minHeight: "44px", padding: 0, borderRadius: "10px", border: "1px solid " + T.track, background: T.surface, color: T.green, fontSize: "16px", fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit" } }, bnNum(n)))),
      R("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px", marginTop: "8px", fontSize: "12px", color: T.muted, lineHeight: 1.4 } },
        BRISTOL.map(([n, text]) => R("div", { key: n }, R("b", { style: { color: T.green } }, bnNum(n) + " "), text))),

      // পাশাপাশি (কারণ-দাবি নয়): আজকের পেট-ট্যাগ খাবার
      R("div", { style: { marginTop: "8px", fontSize: "13px", color: T.muted } }, "আজ ‘পেট’-ট্যাগ করা খাবার: ", R("b", { style: { color: T.ink } }, bnNum(gutFoods)), "টি"),

      // এই সপ্তাহ (শনি–শুক্র)
      week.some((w) => w.scores.length) && R("div", { style: { marginTop: "6px", fontSize: "13px", color: T.muted, lineHeight: 1.7 } },
        "এই সপ্তাহ: ", week.filter((w) => w.scores.length).map((w) => R("span", { key: w.date, style: { marginRight: "10px", whiteSpace: "nowrap" } }, w.date.slice(5).replace("-", "/") + " → " + w.scores.map((s) => bnNum(s)).join(", ")))),

      err && ErrorBox(err)));
}
