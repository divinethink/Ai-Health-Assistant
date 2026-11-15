// পেটের লক্ষণ-লগ কার্ড (পার্ট ১১) — শুধু UI; হিসাব gutLog.js-এ, লেখা বিদ্যমান createHealthRecord/deleteHealthRecord দিয়ে।
// আজকের ব্রিস্টল-স্কোর ও আজকের `gut`-ট্যাগ খাবারের সংখ্যা শুধু পাশাপাশি — "কারণ" দাবি নেই।

import { ErrorBox } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { createHealthRecord, deleteHealthRecord } from "../records/healthRecordsData.js";
import { todayISO, getWeekDaily } from "./trackerData.js";
import { weekDatesISO } from "./exercisePlanData.js";
import { T, CARD_STYLE } from "./trackerTheme.js";
import { BRISTOL, entriesOn, checkGutAdd, buildGutRecord } from "./gutLog.js";
import { gutAlert, looseStreak3, weekBars } from "./gutInsights.js";
import { triggerSearch, windowDates } from "./reviewInsights.js";

const { useState, useEffect } = React;

const WD = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"]; // weekDatesISO() শনি→শুক্র
const ALERT_TEXT = {
  loose: "টানা ২ দিন নরম/তরল পায়খানা (স্কোর ৫–৭) লগ হয়েছে।",
  hard: "টানা ২ দিন শক্ত বা কষ্টকর পায়খানা (স্কোর ১–২) লগ হয়েছে।",
  mixed: "টানা ২ দিন পেটের অবস্থা স্বাভাবিকের (৩–৪) বাইরে ছিল।",
};

export function GutLogCard({ info, familyId, callerMemberId, memberId, gutFoods, onSaved, bare }) {
  const entries = info.gutEntries || [];
  const today = todayISO();
  const todays = entriesOn(entries, today);
  const week = weekBars(entries, weekDatesISO());
  const alert = gutAlert(entries, today);
  const loose3 = looseStreak3(entries, today);
  const [docs, setDocs] = useState(null); // সতর্কতা থাকলে গত ১৫ দিনের খাবার-লগ (null=আনছে, "err"=ব্যর্থ)
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
  const sel = latest ? latest.score : null; // নির্বাচিত (আজকের সর্বশেষ) স্কোর — হাইলাইট হয়
  const R = React.createElement;

  const isOpen = bare || expanded; // bare: হেডার নেই, বাইরের ভাঁজ-চিপ নিয়ন্ত্রণ করে

  // খাবারের মিল শুধু সতর্কতা চালু ও কার্ড খোলা থাকলেই আনি (অকারণ read নয়); ব্যর্থ হলে চুপচাপ বার্তা, কার্ড ভাঙে না
  const alertOn = !!alert;
  useEffect(() => {
    if (!alertOn || !isOpen) return undefined;
    let alive = true;
    setDocs(null);
    getWeekDaily(familyId, memberId, windowDates(today, 15)).then((d) => alive && setDocs(d)).catch(() => alive && setDocs("err"));
    return () => { alive = false; };
  }, [alertOn, isOpen, familyId, memberId, today]);
  const trg = Array.isArray(docs) ? triggerSearch({ docs, gutEntries: entries, endISO: today, days: 15, max: 5, badHigh: 5 }) : null;

  return R("div", { style: { ...CARD_STYLE, padding: bare ? "10px 12px 0" : "2px 12px" } },
    // ভাঁজযোগ্য হেডার: এক লাইনে নাম + আজকের স্কোর-সারাংশ + তীর
    !bare && R("button", { onClick: () => { setErr(null); setExpanded(!expanded); }, "aria-expanded": expanded, style: { display: "flex", alignItems: "center", gap: "8px", width: "100%", minHeight: "44px", padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" } },
      R("span", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, "🩺 পেট ডায়েরি"),
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
        BRISTOL.map(([n, text]) => R("button", { key: n, onClick: () => add(n), disabled: busy, "aria-pressed": n === sel, "aria-label": "স্কোর " + bnNum(n) + ": " + text, style: { flex: 1, minWidth: 0, minHeight: "44px", padding: 0, borderRadius: "10px", border: "1.5px solid " + (n === sel ? T.green : T.track), background: n === sel ? T.green : T.surface, color: n === sel ? T.onDark : T.green, fontSize: "16px", fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit" } }, bnNum(n)))),
      sel && R("div", { style: { marginTop: "8px", padding: "10px 12px", borderRadius: "12px", background: "#E4F0E9", border: "1px solid #B7D3C6", color: T.ink } },
        R("div", { style: { fontSize: "13px", color: T.muted } }, "আজ নির্বাচিত"),
        R("div", { style: { fontSize: "17px", fontWeight: 800, color: T.green, marginTop: "2px" } }, "স্কোর " + bnNum(sel)),
        R("div", { style: { fontSize: "14px", marginTop: "2px" } }, label(sel))),

      // সতর্কতা: টানা ২ দিন স্বাভাবিকের বাইরে (রোগনির্ণয় নয়; খাবার-মিল শুধু পাশাপাশি দেখানো)
      alert && R("div", { role: "status", style: { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", background: "#FFF8E6", border: "1px solid #EBD9B4", color: T.ink, fontSize: "14px", lineHeight: 1.6 } },
        R("div", { style: { fontWeight: 800, color: "#7A5200" } }, "⚠ পেটের লক্ষণ লক্ষ্য করুন"),
        R("div", null, ALERT_TEXT[alert.kind]),
        loose3 && R("div", { style: { marginTop: "4px" } }, "টানা ৩ দিন তরল ধরনের (৬–৭) — পানিশূন্যতা এড়াতে পর্যাপ্ত পানি ও তরল (যেমন খাবার স্যালাইন) নিন; না কমলে ডাক্তার দেখান।"),
        docs === null && R("div", { style: { marginTop: "6px", fontSize: "13px", color: T.muted } }, "খাবার-লগের সাথে মিল দেখা হচ্ছে…"),
        docs === "err" && R("div", { style: { marginTop: "6px", fontSize: "13px", color: T.muted } }, "খাবার-লগ আনা যায়নি — পরে আবার খুলে দেখুন।"),
        trg && !trg.enough && R("div", { style: { marginTop: "6px", fontSize: "13px", color: T.muted } }, "খাবারের সাথে মিল খুঁজতে আরও লগ লাগবে — পেট ডায়েরি ও ‘আজকের খাবার-লগ’ কয়েক দিন একসাথে রাখুন।"),
        trg && trg.enough && !trg.items.length && R("div", { style: { marginTop: "6px", fontSize: "13px", color: T.muted } }, "গত ১৫ দিনে নির্দিষ্ট কোনো খাবারের সাথে স্পষ্ট মিল পাওয়া যায়নি।"),
        trg && trg.items.length > 0 && R("div", { style: { marginTop: "6px" } },
          R("div", { style: { fontWeight: 700 } }, "গত ১৫ দিনে অস্বস্তির দিনের সাথে এই খাবারগুলো বেশি মিলেছে:"),
          trg.items.map((x) => R("div", { key: x.name, style: { paddingLeft: "10px", overflowWrap: "anywhere" } }, "• " + x.name + " — অস্বস্তির " + bnNum(x.bad) + "টি দিনে (মোট " + bnNum(x.total) + " দিনের মধ্যে)")),
          R("div", { style: { marginTop: "4px", fontSize: "13px", color: T.muted } }, "এগুলো কিছুদিন বাদ দিয়ে দেখুন; লক্ষণ থাকলে ডাক্তারকে দেখান। এটি শুধু আপনার লগের মিল — কারণ প্রমাণ নয়।"))),

      R("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px", marginTop: "8px", fontSize: "12px", color: T.muted, lineHeight: 1.4 } },
        BRISTOL.map(([n, text]) => R("div", { key: n, style: n === sel ? { background: "#E4F0E9", borderRadius: "6px", padding: "0 4px", color: T.ink, fontWeight: 700 } : undefined }, R("b", { style: { color: T.green } }, bnNum(n) + " "), text))),

      // পাশাপাশি (কারণ-দাবি নয়): আজকের পেট-ট্যাগ খাবার
      R("div", { style: { marginTop: "8px", fontSize: "13px", color: T.muted } }, "আজ ‘পেট’-ট্যাগ করা খাবার: ", R("b", { style: { color: T.ink } }, bnNum(gutFoods)), "টি"),

      // এই সপ্তাহ (শনি–শুক্র): সবুজ = সব ৩–৪; হলুদ = ১–২ বা ৫–৭ আছে; ধূসর = এন্ট্রি নেই। সংখ্যা = ওই দিনের সবচেয়ে অস্বাভাবিক স্কোর
      R("div", { style: { marginTop: "10px" } },
        R("div", { style: { fontSize: "12.5px", color: T.muted, marginBottom: "4px" } }, "এই সপ্তাহ"),
        R("div", { style: { display: "flex", gap: "4px" } },
          week.map((w, i) => R("div", { key: w.date, style: { flex: 1, minWidth: 0, textAlign: "center" } },
            R("div", { style: { fontSize: "11.5px", color: T.muted } }, WD[i]),
            R("div", { "aria-label": WD[i] + (w.score ? ": স্কোর " + bnNum(w.score) : ": এন্ট্রি নেই"), style: { margin: "2px auto 0", width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, boxSizing: "border-box",
              background: w.state === "ok" ? "#E4F0E9" : w.state === "off" ? "#FFE7B8" : T.track, color: w.state === "ok" ? T.green : w.state === "off" ? "#7A5200" : T.muted,
              border: w.date === today ? "2px solid " + T.green : "2px solid transparent" } }, w.score ? bnNum(w.score) : "–")))),
        R("div", { style: { fontSize: "11.5px", color: T.muted, marginTop: "4px" } }, "সবুজ = ৩–৪ · হলুদ = ১–২ বা ৫–৭")),

      R("div", { style: { marginTop: "10px", fontSize: "12.5px", color: T.muted, lineHeight: 1.5 } }, "জরুরি লক্ষণ: পায়খানায় রক্ত, কালো মল, তীব্র পেটব্যথা, জ্বর, বারবার বমি বা পানিশূন্যতার লক্ষণ হলে দেরি না করে ডাক্তারের কাছে যান।"),

      err && ErrorBox(err)));
}
