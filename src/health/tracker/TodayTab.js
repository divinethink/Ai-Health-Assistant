// "আজ" ট্যাব (ধাপ C) — রিং কার্ড, পানির ১-ট্যাপ, স্ট্রিক, সাপ্তাহিক সারাংশ। শুধু UI;
// হিসাব todaySummary.js/trackerCalc.js-এ, লেখা saveDaily দিয়ে (নির্দিষ্ট ডক-ID, set+merge)।

import { ErrorBox } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { saveDaily, todayISO } from "./trackerData.js";
import { weekDatesISO } from "./exercisePlanData.js";
import { GOAL_LABELS, sleepTargetHours, exerciseTargetMinPerDay, stepsTarget, waterTargetFor, isFastDate } from "./trackerCalc.js";
import { T, GRADIENT_HERO, CARD_STYLE, MAX_WATER } from "./trackerTheme.js";
import { ringDash, pctOf, streakOf, weekSummary } from "./todaySummary.js";
import { MEAL_SLOTS, buildMealPlan } from "./mealPlanData.js";
import { applyMealPrefs, caloriesForDay, sanitizeExtraFoods, sanitizeExerciseLog, checkExerciseLog, EXERCISE_TYPES } from "./planPrefs.js";
import { entryAmountText, fmtMacro, sumNutrition, slotBudgets } from "./foodCalc.js";
import { FoodLogSheet } from "./FoodLogSheet.js";
import { ExerciseLogSheet } from "./PlanEditSheets.js";
import { DailyInputSheet } from "./DailyInputSheet.js";

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

// ধাপ ৩: ট্যাপ করলে ইনপুট-শিট খোলে (role=button); ডানকোণে ছোট ＋ হিন্ট।
function MiniRing({ value, pct, color, caption, label, onTap }) {
  const key = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } };
  return React.createElement("div", { role: "button", tabIndex: 0, "aria-label": label + " যোগ/বদলান", onClick: onTap, onKeyDown: key,
    style: { ...CARD_STYLE, position: "relative", flex: 1, minWidth: 0, marginBottom: 0, padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" } },
    React.createElement("span", { "aria-hidden": "true", style: { position: "absolute", top: "6px", right: "6px", width: "22px", height: "22px", borderRadius: "50%", background: T.track, color: T.green, fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 } }, "＋"),
    React.createElement(Ring, { pct, size: 54, stroke: 7, color, track: T.track, label },
      React.createElement("span", { style: { fontSize: "11px", fontWeight: 700, color: T.ink } }, bnNum(Math.round(Math.min(pct, 999))) + "%")),
    React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink, textAlign: "center" } }, value),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, textAlign: "center", lineHeight: 1.3 } }, caption));
}

export function TodayTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const { daily, goal, age, flags, gate, recent } = info;
  const fastDays = info.fastDays || []; // সেফটি-গেট প্রয়োগের পর (activeFastDays)
  const d = daily || {};
  const calc = !gate.blocked && goal && goal.calc ? goal.calc : null;
  const [sMin, sMax] = sleepTargetHours(age);
  const exTarget = exerciseTargetMinPerDay(age);
  const stTarget = stepsTarget(age);
  const waterTarget = waterTargetFor(age, flags, goal && goal.waterTarget);
  const today = todayISO();
  const ctx = { calorieTarget: calc ? calc.calorieTarget : null, exTarget, waterTarget, sleepMinH: sMin, fastDays };
  const onFast = isFastDate(today, fastDays);
  const streak = streakOf(recent, today, ctx);
  const week = weekSummary(recent, weekDatesISO(), today, ctx);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [foodOpen, setFoodOpen] = useState(false);
  const [foodErr, setFoodErr] = useState(null);
  const fmtH = (m) => bnNum(Math.floor(m / 60)) + " ঘ. " + bnNum(m % 60) + " মি.";

  // পানি: আজকের লোড-করা মান থেকে absolute হিসাব → set; রিফ্রেশ শেষ না হওয়া পর্যন্ত বাটন বন্ধ (double-tap নিরাপদ)।
  const setWater = async (next) => {
    if (busy || next < 0 || next > MAX_WATER) return;
    setErr(null); setBusy(true);
    try { await saveDaily(familyId, memberId, callerMemberId, today, { waterGlasses: next }, daily); await onSaved(); }
    catch (x) { setErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x))); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } }
    finally { setBusy(false); }
  };

  // ধাপ ২: খাবার-লগ (extraFoods) — ক্যালরি-টার্গেট চালু থাকলে (গেট-ব্লক/উপবাস-দিনে নয়)। caloriesIn = প্ল্যানের টিক + নিজে-যোগ-করা (MealTab-এর একই সূত্র)।
  const extras = sanitizeExtraFoods(d.extraFoods);
  const canLog = !onFast && !!calc;
  const macros = sumNutrition(extras);
  const plan = canLog ? applyMealPrefs(buildMealPlan(calc.calorieTarget, info.allergyTags, goal.planPrefs), goal.planPrefs, info.allergyTags) : null;
  const eatenIds = Array.isArray(d.mealsEaten) ? d.mealsEaten : [];
  const writeExtras = async (next) => {
    if (busy || !plan) return false;
    setFoodErr(null); setBusy(true);
    try { await saveDaily(familyId, memberId, callerMemberId, today, { extraFoods: next, caloriesIn: caloriesForDay(plan, eatenIds, next) }, daily); await onSaved(); return true; }
    catch (x) { setFoodErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x))); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } return false; }
    finally { setBusy(false); }
  };
  const openFood = () => { setFoodErr(null); setFoodOpen(true); };

  // ধাপ ৩: ব্যায়াম/ঘুম/স্টেপ/ওজন শিট। saveDaily একই (নির্দিষ্ট ডক-ID + merge); busy লক = double-tap নিরাপদ।
  const [inKind, setInKind] = useState(null); // "exercise" | "sleep" | "steps" | "weight" | null
  const [inErr, setInErr] = useState(null);
  const openIn = (k) => { setInErr(null); setInKind(k); };
  const closeIn = () => { setInErr(null); setInKind(null); };
  const exLog = sanitizeExerciseLog(d.exerciseLog);
  const writeIn = async (fields, closeAfter) => {
    if (busy) return;
    setInErr(null); setBusy(true);
    try { await saveDaily(familyId, memberId, callerMemberId, today, fields, daily); await onSaved(); if (closeAfter) setInKind(null); }
    catch (x) { setInErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x))); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } }
    finally { setBusy(false); }
  };
  // ব্যায়াম: ExerciseTab-এর একই নিয়ম — শুধু counted ধরনের মিনিট exerciseMin-এ যোগ/বিয়োগ।
  const writeExLog = (next, deltaMin) => writeIn({ exerciseLog: next, ...(deltaMin ? { exerciseMin: Math.max(0, (d.exerciseMin || 0) + deltaMin) } : {}) }, false);
  const addExLog = (type, min) => {
    const e = checkExerciseLog(min, exLog.length);
    if (e) { setInErr(e); return; }
    return writeExLog([...exLog, { type, min }], EXERCISE_TYPES[type].counted ? min : 0);
  };
  const removeExLog = (i) => writeExLog(exLog.filter((_, k) => k !== i), EXERCISE_TYPES[exLog[i].type].counted ? -exLog[i].min : 0);

  const glasses = d.waterGlasses || 0;
  const eaten = d.caloriesIn || 0;
  const left = calc ? calc.calorieTarget - eaten : 0;

  return React.createElement(React.Fragment, null,
    gate.blocked && React.createElement(Notice, null,
      React.createElement("b", null, "ক্যালরি-টার্গেট বন্ধ"), React.createElement("br"), gate.reason,
      React.createElement("br"), "এখানে পানি, ব্যায়াম ও ঘুম ট্র্যাক করা যাবে। ওজন নিয়ে চিন্তা থাকলে ডাক্তারের পরামর্শ নিন।"),
    !gate.blocked && !calc && React.createElement(Notice, { tone: "info" }, "ক্যালরির টার্গেট ঠিক করতে ‘লক্ষ্য ও প্ল্যান’ ট্যাবের ‘লক্ষ্য সেট করুন’-এ যান।"),

    // উপবাস-দিন (পার্ট ১০): ক্যালরি-টার্গেট স্থগিত; স্ট্রিক ভাঙে না
    onFast && React.createElement("div", { style: { ...CARD_STYLE, background: GRADIENT_HERO, border: "none", color: T.onDark, padding: "16px" } },
      React.createElement("div", { style: { fontSize: "20px", fontWeight: 800 } }, "🌙 আজ রোজা/উপবাস"),
      React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft, marginTop: "6px", lineHeight: 1.6 } },
        "আজ ক্যালরি-টার্গেট স্থগিত। পানি পান করুন; সেহরি/ইফতারে হালকা ও সুষম খাবার নিন। শরীর খারাপ লাগলে উপবাস ভাঙুন ও ডাক্তারের পরামর্শ নিন।"),
      React.createElement("div", { style: { display: "inline-block", marginTop: "10px", padding: "6px 12px", borderRadius: "999px", background: "rgba(255,255,255,0.16)", fontSize: "13px", fontWeight: 600 } },
        streak > 0 ? "🔥 " + bnNum(streak) + (streak >= 30 ? "+" : "") + " দিনের স্ট্রিক — আজ ভাঙবে না" : "🔥 স্ট্রিক আজ ভাঙবে না")),

    // ক্যালরি হিরো-কার্ড + স্ট্রিক
    !onFast && calc && React.createElement("div", { role: "button", tabIndex: 0, "aria-label": "খাবার যোগ করুন", onClick: openFood, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFood(); } },
      style: { ...CARD_STYLE, background: GRADIENT_HERO, border: "none", color: T.onDark, display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", cursor: "pointer" } },
      React.createElement(Ring, { pct: pctOf(eaten, calc.calorieTarget), size: 96, stroke: 11, color: T.amberSoft, track: T.ringTrackOnDark, label: "ক্যালরি " + bnNum(eaten) + " / " + bnNum(calc.calorieTarget) },
        React.createElement("span", { style: { fontSize: "20px", fontWeight: 800, lineHeight: 1.1 } }, bnNum(eaten)),
        React.createElement("span", { style: { fontSize: "11px", color: T.onDarkSoft } }, "কিলোক্যালরি")),
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
        React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft } }, "আজকের টার্গেট"),
        React.createElement("div", { style: { fontSize: "24px", fontWeight: 800, lineHeight: 1.15 } }, bnNum(calc.calorieTarget)),
        React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft, marginTop: "2px" } }, (left >= 0 ? "বাকি " + bnNum(left) : "টার্গেটের বেশি " + bnNum(-left)) + " · " + GOAL_LABELS[goal.goalType]),
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" } },
          React.createElement("span", { style: { padding: "4px 10px", borderRadius: "999px", background: "rgba(255,255,255,0.16)", fontSize: "13px", fontWeight: 600 } },
            streak > 0 ? "🔥 " + bnNum(streak) + (streak >= 30 ? "+" : "") + " দিনের স্ট্রিক" : "🔥 আজ থেকে স্ট্রিক শুরু করুন"),
          React.createElement("span", { "aria-hidden": "true", style: { padding: "4px 10px", borderRadius: "999px", background: T.amberSoft, color: "#4A3200", fontSize: "13px", fontWeight: 700 } }, "＋ খাবার")))),

    // ধাপ ৪: আজকের ম্যাক্রো-সারাংশ — শুধু যোগফল (গ্রাম); কোনো টার্গেট/শতাংশ নেই।
    canLog && macros.withMacro > 0 && React.createElement("div", { style: CARD_STYLE, "aria-label": "আজকের ম্যাক্রো-সারাংশ" },
      React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginBottom: "6px" } }, "আজ পর্যন্ত (গ্রাম)"),
      React.createElement("div", { style: { display: "flex", gap: "8px" } },
        [["প্রোটিন", macros.p, T.green], ["কার্ব", macros.c, T.orange], ["ফ্যাট", macros.f, T.purple], ["ফাইবার", macros.fib, T.blue]].map(([name, v, col]) =>
          React.createElement("div", { key: name, style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontSize: "12.5px", color: T.muted } }, name),
            React.createElement("div", { style: { fontSize: "18px", fontWeight: 800, color: T.ink } }, fmtMacro(v)),
            React.createElement("div", { "aria-hidden": "true", style: { height: "4px", borderRadius: "4px", background: col, marginTop: "4px" } })))),
      React.createElement("div", { style: { fontSize: "11.5px", color: T.muted, marginTop: "8px", lineHeight: 1.5 } },
        "শুধু নিজে-যোগ-করা খাবারের হিসাব; প্ল্যানের টিক ধরা হয়নি।" + (macros.withMacro < macros.total ? " " + bnNum(macros.total - macros.withMacro) + "টি পুরনো এন্ট্রিতে ম্যাক্রো নেই।" : ""))),

    // আজকের খাবার-লগ (নিজে যোগ করা; প্ল্যানের টিক আলাদা — লক্ষ্য ও প্ল্যান → মিল)
    canLog && React.createElement("div", { style: CARD_STYLE },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: T.ink } }, "🍽 আজকের খাবার-লগ"),
          React.createElement("div", { style: { fontSize: "12.5px", color: T.muted } }, "নিজে যোগ করা · আজ মোট " + bnNum(eaten) + " কিলোক্যালরি (প্ল্যানের টিকসহ)")),
        React.createElement("button", { onClick: openFood, style: { minHeight: "44px", padding: "0 16px", borderRadius: "999px", border: "none", background: T.green, color: T.onDark, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "＋ যোগ")),
      foodErr && !foodOpen && ErrorBox(foodErr),
      extras.length === 0 && React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginTop: "8px" } }, "এখনও নিজে কিছু যোগ করা হয়নি। যা খেলেন, ‘＋ যোগ’ চেপে লিখে রাখুন।"),
      MEAL_SLOTS.map((s) => {
        const mine = extras.map((x, idx) => ({ ...x, idx })).filter((x) => x.slot === s.id);
        if (!mine.length) return null;
        return React.createElement("div", { key: s.id, style: { marginTop: "10px" } },
          React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: T.ink } }, s.label + " · " + bnNum(mine.reduce((a, x) => a + x.kcal, 0)) + " কিলোক্যালরি"),
          mine.map((x) => React.createElement("div", { key: x.idx, style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderTop: "1px solid " + T.border } },
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { fontSize: "14px", color: T.ink } }, x.name),
              React.createElement("div", { style: { fontSize: "12px", color: T.muted } }, [entryAmountText(x), x.p !== undefined ? "প্রো " + fmtMacro(x.p) + " · কার্ব " + fmtMacro(x.c) + " · ফ্যাট " + fmtMacro(x.f) : ""].filter(Boolean).join(" · "))),
            React.createElement("span", { style: { fontSize: "14px", fontWeight: 700, color: T.ink } }, bnNum(x.kcal)),
            React.createElement("button", { onClick: () => writeExtras(extras.filter((_, i) => i !== x.idx)), disabled: busy, "aria-label": x.name + " মুছুন", style: { minWidth: "44px", minHeight: "44px", borderRadius: "12px", border: "none", background: "#FDECEA", color: "#A32018", fontSize: "16px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 } }, "✕"))));
      })),
    foodOpen && canLog && React.createElement(FoodLogSheet, {
      allergyTags: info.allergyTags, avoidCtx: { age: info.age, flags: info.flags, condKeys: info.condKeys }, activeMeds: info.activeMeds,
      count: extras.length, slotBudgets: slotBudgets(plan, eatenIds, extras), busy, err: foodErr, onAdd: (entry) => writeExtras([...extras, entry]), onClose: () => { setFoodErr(null); setFoodOpen(false); },
    }),

    // ব্যায়াম / ঘুম / স্টেপ — ছোট রিং
    React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "8px" } },
      React.createElement(MiniRing, { value: bnNum(d.exerciseMin || 0) + "/" + bnNum(exTarget), pct: pctOf(d.exerciseMin, exTarget), color: T.orange, caption: "ব্যায়াম (মি.)", label: "ব্যায়াম", onTap: () => openIn("exercise") }),
      React.createElement(MiniRing, { value: d.sleepMinutes ? fmtH(d.sleepMinutes) : "—", pct: pctOf(d.sleepMinutes, sMin * 60), color: T.purple, caption: d.sleepMinutes ? "গত রাতের ঘুম" : "ঘুম দেওয়া হয়নি · লক্ষ্য " + bnNum(sMin) + "–" + bnNum(sMax) + " ঘ.", label: "ঘুম", onTap: () => openIn("sleep") }),
      stTarget && React.createElement(MiniRing, { value: bnNum(d.steps || 0), pct: pctOf(d.steps, stTarget), color: T.leaf, caption: "স্টেপ / " + bnNum(stTarget), label: "স্টেপ", onTap: () => openIn("steps") })),

    // পানি (কিডনি রোগে টার্গেট দেখানো হয় না)
    waterTarget && React.createElement("div", { style: CARD_STYLE },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: T.ink } }, "💧 পানি"),
        React.createElement("div", { style: { fontSize: "13px", color: T.muted } }, React.createElement("b", { style: { color: T.blue } }, bnNum(glasses)), " / " + bnNum(waterTarget) + " গ্লাস")),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "5px", margin: "8px 0" }, "aria-hidden": "true" },
        Array.from({ length: Math.max(waterTarget, Math.min(glasses, 16)) }, (_, i) => React.createElement("div", { key: i, style: { width: "24px", height: "24px", borderRadius: "7px", background: i < glasses ? T.blue : T.blueSoft } }))),
      React.createElement("div", { style: { display: "flex", gap: "8px" } },
        React.createElement("button", { onClick: () => setWater(glasses + 1), disabled: busy || glasses >= MAX_WATER, style: { flex: 1, minHeight: "44px", borderRadius: "12px", border: "none", background: busy ? "#9BB9D6" : T.blue, color: T.onDark, fontSize: "15px", fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit" } }, "＋ ১ গ্লাস পানি"),
        React.createElement("button", { onClick: () => setWater(glasses - 1), disabled: busy || glasses <= 0, "aria-label": "১ গ্লাস কমান", style: { minWidth: "44px", minHeight: "44px", borderRadius: "12px", border: "1.5px solid " + T.blue, background: T.surface, color: T.blue, fontSize: "20px", fontWeight: 700, cursor: "pointer", opacity: glasses <= 0 ? 0.4 : 1, fontFamily: "inherit" } }, "−")),
      err && ErrorBox(err)),
    flags.kidney && React.createElement(Notice, { tone: "info" }, "কিডনি রোগে পানির পরিমাণ ডাক্তার ঠিক করে দেন — তাই পানির টার্গেট দেখানো হচ্ছে না।"),
    !flags.kidney && waterTarget === null && React.createElement(Notice, { tone: "info" }, "২ বছরের কম বয়সে পানির পরিমাণ শিশুর দুধ/খাবারের সাথে ডাক্তারের নির্দেশমতো ঠিক হয় — তাই পানির টার্গেট দেখানো হচ্ছে না।"),

    // আজকের ওজন — ট্যাপে শিট (ধাপ ৩)
    React.createElement("div", { role: "button", tabIndex: 0, "aria-label": "আজকের ওজন যোগ/বদলান", onClick: () => openIn("weight"), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIn("weight"); } },
      style: { ...CARD_STYLE, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", cursor: "pointer", minHeight: "44px" } },
      React.createElement("div", null,
        React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, "⚖️ আজকের ওজন "),
        React.createElement("span", { style: { color: T.muted } }, d.weightKg ? bnNum(d.weightKg) + " কেজি" : "দেওয়া হয়নি")),
      React.createElement("span", { "aria-hidden": "true", style: { width: "32px", height: "32px", borderRadius: "50%", background: T.track, color: T.green, fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" } }, "＋")),

    inKind === "exercise" && React.createElement(ExerciseLogSheet, { key: "ex", initialType: "walk", entries: exLog, busy, err: inErr, onAdd: addExLog, onRemove: removeExLog, onClose: closeIn }),
    (inKind === "sleep" || inKind === "steps" || inKind === "weight") && React.createElement(DailyInputSheet, {
      key: inKind, kind: inKind, daily, latestWeight: info.latestWeight, stepsTarget: stTarget, busy, err: inErr,
      onSave: (fields) => writeIn(fields, true), onClose: closeIn,
    }),

    // সাপ্তাহিক সারাংশ
    React.createElement("div", { style: { ...CARD_STYLE, background: T.sand, borderColor: T.sandBorder } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: T.ink } }, "এই সপ্তাহ"),
        React.createElement("div", { style: { fontSize: "13px", color: T.muted } }, bnNum(week.hitCount) + "/৭ দিন টার্গেটে")),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "6px" } },
        week.days.map((x, i) => {
          const hit = x.state === "hit", isToday = x.state === "today", isFast = x.state === "fast";
          return React.createElement("div", { key: x.date, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1 } },
            React.createElement("span", { style: { fontSize: "11px", color: T.muted } }, SHORT_DAYS[i]),
            React.createElement("div", { "aria-label": SHORT_DAYS[i] + (hit ? " টার্গেটে" : isFast ? " উপবাস-দিন" : isToday ? " আজ" : ""), style: { width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700,
              background: hit ? T.green : isToday ? T.orange : isFast ? T.sand : "transparent", color: hit || isToday ? T.onDark : T.muted,
              border: hit || isToday ? "none" : "1.5px " + (x.state === "future" ? "dashed" : "solid") + " " + (isFast ? T.sandBorder : "#C9C3D6") } }, hit ? "✓" : isToday ? "আজ" : isFast ? "🌙" : ""));
        })),
      React.createElement("div", { style: { fontSize: "11.5px", color: T.muted, marginTop: "6px" } }, "দিন গোনা হয় ক্যালরি/ব্যায়াম/পানি/ঘুমের অন্তত ২টি লক্ষ্য পূরণ হলে।" + (fastDays.length ? " 🌙 উপবাস-দিনে ক্যালরি ধরা হয় না, স্ট্রিকও ভাঙে না।" : ""))),

    React.createElement("p", { style: { fontSize: "12px", color: T.muted } }, "এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।")
  );
}
