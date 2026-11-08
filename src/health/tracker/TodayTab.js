// "আজ" ট্যাব (ধাপ C) — রিং কার্ড, পানির ১-ট্যাপ, স্ট্রিক, সাপ্তাহিক সারাংশ। শুধু UI;
// হিসাব todaySummary.js/trackerCalc.js-এ, লেখা saveDaily দিয়ে (নির্দিষ্ট ডক-ID, set+merge)।

import { ErrorBox } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { saveDaily, todayISO } from "./trackerData.js";
import { weekDatesISO } from "./exercisePlanData.js";
import { GOAL_LABELS, sleepTargetHours, exerciseTargetMinPerDay, stepsTarget } from "./trackerCalc.js";
import { T, GRADIENT_HERO, CARD_STYLE, MAX_WATER } from "./trackerTheme.js";
import { ringDash, pctOf, streakOf, weekSummary } from "./todaySummary.js";

const { useState } = React;

const SHORT_DAYS = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];

function Notice({ children, tone }) {
  const warn = tone !== "info";
  return React.createElement("div", { style: { ...CARD_STYLE, background: warn ? "#FFF6DD" : "#E4F0E9", borderColor: warn ? "#E8D08A" : "#9CC5B4", color: warn ? "#7A5B00" : T.green, fontSize: "14px", lineHeight: 1.5 } }, children);
}

// SVG রিং — ১২ o'clock থেকে ঘড়ির কাঁটার দিকে ভরে
function Ring({ pct, size, stroke, color, track, children, label }) {
  const r = (size - stroke) / 2;
  const { circ, dash } = ringDash(pct, r);
  return React.createElement("div", { style: { position: "relative", width: size + "px", height: size + "px", flexShrink: 0 }, role: "img", "aria-label": label },
    React.createElement("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size, style: { transform: "rotate(-90deg)" }, "aria-hidden": "true" },
      React.createElement("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: track, strokeWidth: stroke }),
      dash > 0 && React.createElement("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeDasharray: dash + " " + circ })),
    React.createElement("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" } }, children));
}

function MiniRing({ value, pct, color, caption, label }) {
  return React.createElement("div", { style: { ...CARD_STYLE, flex: 1, minWidth: 0, marginBottom: 0, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" } },
    React.createElement(Ring, { pct, size: 64, stroke: 8, color, track: T.track, label },
      React.createElement("span", { style: { fontSize: "11px", fontWeight: 700, color: T.ink } }, bnNum(Math.round(Math.min(pct, 999))) + "%")),
    React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink, textAlign: "center" } }, value),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, textAlign: "center", lineHeight: 1.3 } }, caption));
}

export function TodayTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const { daily, goal, age, flags, gate, recent } = info;
  const d = daily || {};
  const calc = !gate.blocked && goal && goal.calc ? goal.calc : null;
  const [sMin, sMax] = sleepTargetHours(age);
  const exTarget = exerciseTargetMinPerDay(age);
  const stTarget = stepsTarget(age);
  const waterTarget = flags.kidney ? null : (age !== null && age < 13 ? 6 : 8);
  const today = todayISO();
  const ctx = { calorieTarget: calc ? calc.calorieTarget : null, exTarget, waterTarget, sleepMinH: sMin };
  const streak = streakOf(recent, today, ctx);
  const week = weekSummary(recent, weekDatesISO(), today, ctx);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fmtH = (m) => bnNum(Math.floor(m / 60)) + " ঘ. " + bnNum(m % 60) + " মি.";

  // পানি: আজকের লোড-করা মান থেকে absolute হিসাব → set; রিফ্রেশ শেষ না হওয়া পর্যন্ত বাটন বন্ধ (double-tap নিরাপদ)।
  const setWater = async (next) => {
    if (busy || next < 0 || next > MAX_WATER) return;
    setErr(null); setBusy(true);
    try { await saveDaily(familyId, memberId, callerMemberId, today, { waterGlasses: next }, daily); await onSaved(); }
    catch (x) { setErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x))); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } }
    finally { setBusy(false); }
  };

  const glasses = d.waterGlasses || 0;
  const eaten = d.caloriesIn || 0;
  const left = calc ? calc.calorieTarget - eaten : 0;

  return React.createElement(React.Fragment, null,
    gate.blocked && React.createElement(Notice, null,
      React.createElement("b", null, "ক্যালরি-টার্গেট বন্ধ"), React.createElement("br"), gate.reason,
      React.createElement("br"), "এখানে পানি, ব্যায়াম ও ঘুম ট্র্যাক করা যাবে। ওজন নিয়ে চিন্তা থাকলে ডাক্তারের পরামর্শ নিন।"),
    !gate.blocked && !calc && React.createElement(Notice, { tone: "info" }, "ক্যালরির টার্গেট ঠিক করতে ‘লক্ষ্য ও ইনপুট’ ট্যাবের ‘লক্ষ্য’-এ যান।"),

    // ক্যালরি হিরো-কার্ড + স্ট্রিক
    calc && React.createElement("div", { style: { ...CARD_STYLE, background: GRADIENT_HERO, border: "none", color: T.onDark, display: "flex", alignItems: "center", gap: "16px", padding: "16px" } },
      React.createElement(Ring, { pct: pctOf(eaten, calc.calorieTarget), size: 112, stroke: 13, color: T.amberSoft, track: T.ringTrackOnDark, label: "ক্যালরি " + bnNum(eaten) + " / " + bnNum(calc.calorieTarget) },
        React.createElement("span", { style: { fontSize: "22px", fontWeight: 800, lineHeight: 1.1 } }, bnNum(eaten)),
        React.createElement("span", { style: { fontSize: "11px", color: T.onDarkSoft } }, "কিলোক্যালরি")),
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
        React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft } }, "আজকের টার্গেট"),
        React.createElement("div", { style: { fontSize: "26px", fontWeight: 800, lineHeight: 1.2 } }, bnNum(calc.calorieTarget)),
        React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft, marginTop: "2px" } }, (left >= 0 ? "বাকি " + bnNum(left) : "টার্গেটের বেশি " + bnNum(-left)) + " · " + GOAL_LABELS[goal.goalType]),
        React.createElement("div", { style: { display: "inline-block", marginTop: "10px", padding: "6px 12px", borderRadius: "999px", background: "rgba(255,255,255,0.16)", fontSize: "13px", fontWeight: 600 } },
          streak > 0 ? "🔥 " + bnNum(streak) + (streak >= 30 ? "+" : "") + " দিনের স্ট্রিক" : "🔥 আজ থেকে স্ট্রিক শুরু করুন"))),

    // ব্যায়াম / ঘুম / স্টেপ — ছোট রিং
    React.createElement("div", { style: { display: "flex", gap: "10px", marginBottom: "12px" } },
      React.createElement(MiniRing, { value: bnNum(d.exerciseMin || 0) + "/" + bnNum(exTarget), pct: pctOf(d.exerciseMin, exTarget), color: T.orange, caption: "ব্যায়াম (মি.)", label: "ব্যায়াম" }),
      React.createElement(MiniRing, { value: d.sleepMinutes ? fmtH(d.sleepMinutes) : "—", pct: pctOf(d.sleepMinutes, sMin * 60), color: T.purple, caption: d.sleepMinutes ? "গত রাতের ঘুম" : "ঘুম দেওয়া হয়নি · লক্ষ্য " + bnNum(sMin) + "–" + bnNum(sMax) + " ঘ.", label: "ঘুম" }),
      stTarget && React.createElement(MiniRing, { value: bnNum(d.steps || 0), pct: pctOf(d.steps, stTarget), color: T.leaf, caption: "স্টেপ / " + bnNum(stTarget), label: "স্টেপ" })),

    // পানি (কিডনি রোগে টার্গেট দেখানো হয় না)
    waterTarget && React.createElement("div", { style: CARD_STYLE },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: T.ink } }, "💧 পানি"),
        React.createElement("div", { style: { fontSize: "13px", color: T.muted } }, React.createElement("b", { style: { color: T.blue } }, bnNum(glasses)), " / " + bnNum(waterTarget) + " গ্লাস")),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", margin: "12px 0" }, "aria-hidden": "true" },
        Array.from({ length: Math.max(waterTarget, Math.min(glasses, 16)) }, (_, i) => React.createElement("div", { key: i, style: { width: "26px", height: "28px", borderRadius: "8px", background: i < glasses ? T.blue : T.blueSoft } }))),
      React.createElement("div", { style: { display: "flex", gap: "8px" } },
        React.createElement("button", { onClick: () => setWater(glasses + 1), disabled: busy || glasses >= MAX_WATER, style: { flex: 1, minHeight: "48px", borderRadius: "14px", border: "none", background: busy ? "#9BB9D6" : T.blue, color: T.onDark, fontSize: "15px", fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit" } }, "＋ ১ গ্লাস পানি"),
        React.createElement("button", { onClick: () => setWater(glasses - 1), disabled: busy || glasses <= 0, "aria-label": "১ গ্লাস কমান", style: { minWidth: "48px", minHeight: "48px", borderRadius: "14px", border: "1.5px solid " + T.blue, background: T.surface, color: T.blue, fontSize: "20px", fontWeight: 700, cursor: "pointer", opacity: glasses <= 0 ? 0.4 : 1, fontFamily: "inherit" } }, "−")),
      err && ErrorBox(err)),
    flags.kidney && React.createElement(Notice, { tone: "info" }, "কিডনি রোগে পানির পরিমাণ ডাক্তার ঠিক করে দেন — তাই পানির টার্গেট দেখানো হচ্ছে না।"),

    // সাপ্তাহিক সারাংশ
    React.createElement("div", { style: { ...CARD_STYLE, background: T.sand, borderColor: T.sandBorder } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: T.ink } }, "এই সপ্তাহ"),
        React.createElement("div", { style: { fontSize: "13px", color: T.muted } }, bnNum(week.hitCount) + "/৭ দিন টার্গেটে")),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "10px" } },
        week.days.map((x, i) => {
          const hit = x.state === "hit", isToday = x.state === "today";
          return React.createElement("div", { key: x.date, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1 } },
            React.createElement("span", { style: { fontSize: "11px", color: T.muted } }, SHORT_DAYS[i]),
            React.createElement("div", { "aria-label": SHORT_DAYS[i] + (hit ? " টার্গেটে" : isToday ? " আজ" : ""), style: { width: "34px", height: "34px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700,
              background: hit ? T.green : isToday ? T.orange : "transparent", color: hit || isToday ? T.onDark : T.muted,
              border: hit || isToday ? "none" : "1.5px " + (x.state === "future" ? "dashed" : "solid") + " #C9C3D6" } }, hit ? "✓" : isToday ? "আজ" : ""));
        })),
      React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "8px" } }, "দিন গোনা হয় ক্যালরি/ব্যায়াম/পানি/ঘুমের অন্তত ২টি লক্ষ্য পূরণ হলে।")),

    d.weightKg && React.createElement("div", { style: CARD_STYLE },
      React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, "আজকের ওজন "), React.createElement("span", { style: { color: T.muted } }, bnNum(d.weightKg) + " কেজি")),
    React.createElement("p", { style: { fontSize: "12px", color: T.muted } }, "এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।")
  );
}
