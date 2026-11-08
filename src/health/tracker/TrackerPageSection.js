// হেলথ ট্র্যাকার (ধাপ ১) — লক্ষ্য সেটআপ, দৈনিক কার্ড, দৈনিক ইনপুট (ওজন/পানি/স্টেপ/ব্যায়াম/ঘুম)।
// হিসাব trackerCalc.js-এ (ফিক্সড সূত্র); Firestore trackerData.js-এ। এই ফাইলে শুধু UI।
// ধাপ B-২: "বদলান" শিট (PlanEditSheets.js) — মিল/ব্যায়াম এডিট; সংরক্ষণ planPrefs.js (pure) + trackerData.js দিয়ে।
// ধাপ ২: মিল-প্ল্যান (mealPlanData.js), ব্যায়াম-প্ল্যান (exercisePlanData.js), "খাওয়া যাবে না"
// (বিদ্যমান DietGuidanceSection reuse — Condition/Allergy/BMI থেকে স্বয়ংক্রিয়)।
// ধাপ ৩: রিমাইন্ডার-সেটিং (ReminderSettings.js); চালক TrackerReminderRunner.js Dashboard-এ বসানো। Health Connect (ধাপ ৪), ট্রেন্ড (ধাপ ৫) এখনো নেই।

import { ErrorBox, PrimaryButton, SelectField, TabPills } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { getGoal, getDaily, getWeekDaily, saveGoal, saveDaily, savePlanPrefs, todayISO } from "./trackerData.js";
import { TodayTab } from "./TodayTab.js";
import { T, CARD_STYLE, SLOT_ICON, SLOT_TINT } from "./trackerTheme.js";
import { last30DatesISO } from "./todaySummary.js";
import { MEAL_SLOTS, buildMealPlan, allergyTagsOf } from "./mealPlanData.js";
import { exercisePlan, plannedWeeklyMinutes, weekDatesISO, bdDayIndex, DAY_LABELS } from "./exercisePlanData.js";
import {
  EXERCISE_TYPES, applyMealPrefs, applyExercisePrefs, caloriesForDay, mealWarnings, exerciseWarnings, sanitizeExtraFoods, sanitizeExerciseLog, recentExtraFoods,
  setSlotPref, clearSlotPref, setDayPref, clearDayPref, reconcileExerciseDone, checkExerciseLog,
} from "./planPrefs.js";
import { MealEditSheet, ExerciseEditSheet, ExerciseLogSheet, EX_ICON } from "./PlanEditSheets.js";
import { ReminderSettings } from "./ReminderSettings.js";
import { TrendChart } from "../reports/TrendChart.js";
import { TrendBars } from "./TrendBars.js";
import { last7DatesISO, buildTrend, reviewPoints, reviewComment } from "./weeklyTrend.js";
import { DietGuidanceSection } from "../nutrition-fitness/DietGuidanceSection.js";
import { activeMedNames } from "./medFoodNotes.js";
import { PlanWhyCard } from "./PlanWhyCard.js";
import { explainMeal, explainExercise } from "./planExplain.js";
import {
  GOAL_LABELS, ACTIVITY_LABELS, ageYears, bmiOf, computeGoal, safetyGate, sleepMinutes,
  sleepTargetHours, detectFlagsFromConditions,
} from "./trackerCalc.js";

const { useState, useEffect, useCallback } = React;

const CARD = CARD_STYLE;
const INPUT = { width: "100%", boxSizing: "border-box", padding: "12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px" };
const LABEL = { fontSize: "14px", fontWeight: 600, color: "#1F2D2A", display: "block", margin: "12px 0 6px" };

function isType(r, names) {
  return r.resourceType === "observation" && names.includes((r.type || "").trim().toLowerCase());
}

function Bar({ pct, color }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return React.createElement("div", { style: { height: "10px", borderRadius: "999px", background: "#E4ECE7", overflow: "hidden", marginTop: "8px" } },
    React.createElement("div", { style: { width: p + "%", height: "100%", background: color } }));
}

function Notice({ children, tone }) {
  const warn = tone !== "info";
  return React.createElement("div", { style: { ...CARD, background: warn ? "#FFF6DD" : "#E4F0E9", borderColor: warn ? "#E8D08A" : "#9CC5B4", color: warn ? "#7A5B00" : "#0E4B43", fontSize: "14px", lineHeight: 1.5 } }, children);
}

function Stat({ title, line, pct, color, extra }) {
  return React.createElement("div", { style: CARD },
    React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, title),
    React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "4px" } }, line),
    pct !== undefined && React.createElement(Bar, { pct, color }),
    extra && React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "6px" } }, extra));
}

// টিক-বাটন (৪৪px)
function Tick({ on, onClick, busy, label }) {
  return React.createElement("button", {
    onClick, disabled: busy, "aria-pressed": on, "aria-label": label,
    style: { width: "44px", height: "44px", flexShrink: 0, borderRadius: "10px", cursor: busy ? "default" : "pointer", fontSize: "20px", fontWeight: 700, lineHeight: 1,
      border: "2px solid #0E4B43", background: on ? "#0E4B43" : "#fff", color: "#fff" },
  }, on ? "✓" : "");
}

function errText(x) {
  return x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x));
}

// ---------- মিল-প্ল্যান ----------
// কার্যকর প্ল্যান = বেস-প্ল্যান + goal.planPrefs ("আমার প্ল্যান"); আজ-শুধু নিজের খাবার = daily.extraFoods (ধাপ B-২)।
function MealTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const { daily, goal, gate, allergyTags, member } = info;
  const d = daily || {};
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sheet, setSheet] = useState(null); // বেলার id
  const calc = !gate.blocked && goal && goal.calc ? goal.calc : null;

  if (gate.blocked) return React.createElement(Notice, null, React.createElement("b", null, "মিল-প্ল্যান বন্ধ"), React.createElement("br"), gate.reason, React.createElement("br"), "সুষম খাবারের সাধারণ গাইড নিচের ‘আজ এড়িয়ে চলুন’ ও নথিপত্র → খাদ্য নির্দেশিকায় দেখুন; নির্দিষ্ট প্ল্যান ডাক্তারের সাথে ঠিক করুন।");
  if (!calc) return React.createElement(Notice, { tone: "info" }, "মিল-প্ল্যানের জন্য আগে ‘লক্ষ্য ও ইনপুট’ ট্যাবের ‘লক্ষ্য’-এ ক্যালরির টার্গেট ঠিক করুন।");

  const base = buildMealPlan(calc.calorieTarget, allergyTags);
  const plan = applyMealPrefs(base, goal.planPrefs, allergyTags);
  const extras = sanitizeExtraFoods(d.extraFoods);
  const eaten = Array.isArray(d.mealsEaten) ? d.mealsEaten : [];
  const warnings = mealWarnings(plan.total, { sex: member && member.sex, target: calc.calorieTarget });
  const slotName = (id) => (MEAL_SLOTS.find((x) => x.id === id) || {}).label;

  // সংরক্ষণের একই পথ: লিখুন → ডেটা রিফ্রেশ (শেষ হওয়া পর্যন্ত busy, তাই double-tap নিরাপদ) → ব্যর্থ হলেও রিফ্রেশ।
  const run = async (fn, closeAfter) => {
    setErr(null); setBusy(true);
    try { await fn(); await onSaved(); if (closeAfter) setSheet(null); }
    catch (x) { setErr(errText(x)); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } }
    finally { setBusy(false); }
  };
  const openSheet = (id) => { setErr(null); setSheet(id); };
  const closeSheet = () => { setErr(null); setSheet(null); };

  const toggle = (slotId) => run(async () => {
    const next = eaten.includes(slotId) ? eaten.filter((x) => x !== slotId) : [...eaten, slotId];
    await saveDaily(familyId, memberId, callerMemberId, todayISO(), { mealsEaten: next, caloriesIn: caloriesForDay(plan, next, extras) }, daily);
  });

  // "প্রতিদিনের জন্য": প্ল্যান বদলালে আজকের caloriesIn নতুন প্ল্যান থেকে আবার হিসাব (শুধু মান বদলালে লেখা হয়)।
  const savePrefs = (prefs) => run(async () => {
    await savePlanPrefs(familyId, memberId, callerMemberId, prefs, goal);
    const cal = caloriesForDay(applyMealPrefs(base, prefs, allergyTags), eaten, extras);
    if (cal !== (d.caloriesIn || 0)) await saveDaily(familyId, memberId, callerMemberId, todayISO(), { caloriesIn: cal }, daily);
  }, true);

  const writeExtras = (next) => run(() => saveDaily(familyId, memberId, callerMemberId, todayISO(), { extraFoods: next, caloriesIn: caloriesForDay(plan, eaten, next) }, daily), false);

  const sheetSlot = sheet ? plan.slots.find((s) => s.id === sheet) : null;

  return React.createElement("div", null,
    React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginBottom: "8px" } },
      "টার্গেট " + bnNum(calc.calorieTarget) + " · প্ল্যানের মোট " + bnNum(plan.total) + " কিলোক্যালরি (আনুমানিক)"),
    React.createElement(Bar, { pct: ((d.caloriesIn || 0) / calc.calorieTarget) * 100, color: T.amber }),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, margin: "4px 0 10px" } }, "আজ খাওয়া হয়েছে " + bnNum(d.caloriesIn || 0) + " কিলোক্যালরি"),
    plan.total < calc.calorieTarget - 100 && warnings.length === 0 && React.createElement(Notice, { tone: "info" }, "প্ল্যানে টার্গেটের পুরোটা ধরে না — বাকিটা স্বাস্থ্যকর খাবার দিয়ে পূরণ করুন।"),
    warnings.map((w, i) => React.createElement(Notice, { key: "w" + i }, w)),
    plan.notes.length > 0 && React.createElement(Notice, null, plan.notes.map((n, i) => React.createElement("div", { key: i }, n))),
    plan.custom.length > 0 && React.createElement(Notice, { tone: "info" }, "আপনার বদলানো বেলা: " + plan.custom.map(slotName).join(", ") + "। ডিফল্টে ফিরতে সেই বেলার ‘বদলান’ → ‘ডিফল্টে ফিরুন’।"),
    err && !sheet && ErrorBox(err),
    plan.slots.map((s) => {
      const mine = extras.map((x, idx) => ({ ...x, idx })).filter((x) => x.slot === s.id);
      return React.createElement("div", { key: s.id, style: CARD },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
          React.createElement("div", { "aria-hidden": "true", style: { width: "44px", height: "44px", flexShrink: 0, borderRadius: "12px", background: SLOT_TINT[s.id] || T.track, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" } }, SLOT_ICON[s.id] || "🍽"),
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, s.label + " · " + bnTimeHM(s.time) + (plan.custom.includes(s.id) ? " · আমার" : "")),
            React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "4px", lineHeight: 1.5 } }, (s.items.length ? s.items.map((i) => i.text).join(", ") : "এই বেলা বাদ") + " · " + bnNum(s.kcal)),
            mine.length > 0 && React.createElement("div", { style: { fontSize: "13px", color: "#7A5B00", marginTop: "4px", lineHeight: 1.5 } }, "আজ নিজের: " + mine.map((x) => x.name + " " + bnNum(x.kcal)).join(", "))),
          React.createElement(Tick, { on: eaten.includes(s.id), onClick: () => toggle(s.id), busy, label: s.label + " খেয়েছি" })),
        React.createElement("button", { onClick: () => openSheet(s.id), disabled: busy, "aria-label": s.label + " বদলান", style: { marginTop: "8px", minHeight: "44px", padding: "8px 16px", borderRadius: "12px", border: "1.5px solid #0E4B43", background: "#fff", color: "#0E4B43", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "✎ বদলান"));
    }),
    sheetSlot && React.createElement(MealEditSheet, {
      key: sheet, slot: sheetSlot, planTotal: plan.total, target: calc.calorieTarget, sex: member && member.sex, allergyTags,
      isCustom: plan.custom.includes(sheet), extras: extras.map((x, idx) => ({ ...x, idx })).filter((x) => x.slot === sheet), extraCount: extras.length, recentFoods: recentExtraFoods(info.recent), activeMeds: info.activeMeds, busy, err,
      onSavePerm: (draft) => savePrefs(setSlotPref(goal.planPrefs, sheet, draft)),
      onReset: () => savePrefs(clearSlotPref(goal.planPrefs, sheet)),
      onAddExtra: (name, kcal) => writeExtras([...extras, { name, kcal, slot: sheet }]),
      onRemoveExtra: (idx) => writeExtras(extras.filter((_, i) => i !== idx)),
      onClose: closeSheet,
    }),
    React.createElement("p", { style: { fontSize: "12px", color: "#5F716C" } }, "ট্যাপ করলে ‘খেয়েছি’ হিসেবে ক্যালরি যোগ হয়। ক্যালরি আনুমানিক; প্রোফাইলের এলার্জি অনুযায়ী খাবার বদলানো হয়েছে, তবু সন্দেহ হলে খাবেন না। এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"));
}

function bnTimeHM(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return bnNum(h > 12 ? h - 12 : h) + ":" + bnNum(String(m).padStart(2, "0"));
}

// ---------- ব্যায়াম-প্ল্যান ----------
// কার্যকর রুটিন = বেস-রুটিন + goal.planPrefs.exercise; "আজ আসলে" = daily.exerciseLog (ধাপ B-২)।
// নিরাপত্তা-গেট বন্ধ হলে (বয়স<১৮/গর্ভবতী/ডায়াবেটিস/কিডনি/৬৫+) রুটিন-এডিট বন্ধ ও সংরক্ষিত prefs উপেক্ষিত; ‘আজ আসলে’ লগ চলে।
function ExerciseTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const { daily, goal, age, flags, weekMin, gate } = info;
  const d = daily || {};
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sheet, setSheet] = useState(null); // { kind: "day", idx } | { kind: "log", type }
  const base = exercisePlan(age, goal ? goal.goalType : null);

  if (!base) return React.createElement(Notice, { tone: "info" }, "ব্যায়াম-প্ল্যানের জন্য প্রোফাইলে জন্মতারিখ দিন।");

  const canEdit = !gate.blocked && !!base.routine;
  const plan = canEdit ? applyExercisePrefs(base, goal && goal.planPrefs) : base;
  const planned = plannedWeeklyMinutes(plan);
  const warnings = canEdit ? exerciseWarnings(plan, planned) : [];
  const todayIdx = bdDayIndex();
  const todayItems = plan.routine ? plan.routine[todayIdx] : [];
  const done = Array.isArray(d.exerciseDone) ? d.exerciseDone : [];
  const log = sanitizeExerciseLog(d.exerciseLog);
  const needsDoctor = flags.pregnant || flags.diabetes || flags.kidney || age >= 65;

  const run = async (fn, closeAfter) => {
    setErr(null); setBusy(true);
    try { await fn(); await onSaved(); if (closeAfter) setSheet(null); }
    catch (x) { setErr(errText(x)); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } }
    finally { setBusy(false); }
  };
  const closeSheet = () => { setErr(null); setSheet(null); };

  const toggle = (item) => run(async () => {
    const on = done.includes(item.key);
    const next = on ? done.filter((x) => x !== item.key) : [...done, item.key];
    const delta = item.counted ? (on ? -item.min : item.min) : 0;
    const fields = { exerciseDone: next };
    if (delta) fields.exerciseMin = Math.max(0, (d.exerciseMin || 0) + delta);
    await saveDaily(familyId, memberId, callerMemberId, todayISO(), fields, daily);
  });

  // দিনের রুটিন সংরক্ষণ। আজকের দিন বদলালে টিক ও exerciseMin নতুন রুটিনের সাথে মেলানো হয়।
  const saveDay = (idx, prefs) => run(async () => {
    await savePlanPrefs(familyId, memberId, callerMemberId, prefs, goal);
    if (idx !== todayIdx) return;
    const r = reconcileExerciseDone(todayItems, applyExercisePrefs(base, prefs).routine[idx], done);
    const fields = {};
    if (r.done.length !== done.length) fields.exerciseDone = r.done;
    if (r.deltaMin) fields.exerciseMin = Math.max(0, (d.exerciseMin || 0) + r.deltaMin);
    if (Object.keys(fields).length) await saveDaily(familyId, memberId, callerMemberId, todayISO(), fields, daily);
  }, true);

  const writeLog = (next, deltaMin) => run(() => {
    const fields = { exerciseLog: next };
    if (deltaMin) fields.exerciseMin = Math.max(0, (d.exerciseMin || 0) + deltaMin);
    return saveDaily(familyId, memberId, callerMemberId, todayISO(), fields, daily);
  }, false);

  const addLog = (type, min) => {
    const e = checkExerciseLog(min, log.length);
    if (e) { setErr(e); return; }
    return writeLog([...log, { type, min }], EXERCISE_TYPES[type].counted ? min : 0);
  };
  const removeLog = (i) => writeLog(log.filter((_, k) => k !== i), EXERCISE_TYPES[log[i].type].counted ? -log[i].min : 0);

  const editBtn = (idx, label) => React.createElement("button", {
    onClick: () => { setErr(null); setSheet({ kind: "day", idx }); }, disabled: busy, "aria-label": DAY_LABELS[idx] + " বদলান",
    style: { flexShrink: 0, minHeight: "44px", padding: "6px 14px", borderRadius: "12px", border: "1.5px solid #0E4B43", background: "#fff", color: "#0E4B43", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  }, label);

  return React.createElement("div", null,
    React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginBottom: "8px", lineHeight: 1.5 } }, plan.summary),
    needsDoctor && React.createElement(Notice, null, "ব্যায়াম শুরুর আগে ডাক্তারের সাথে কথা বলে নিন (গর্ভাবস্থা, ডায়াবেটিস, কিডনি রোগ বা ৬৫+ বয়সে)।"),
    gate.blocked && plan.routine && React.createElement(Notice, { tone: "info" }, "আপনার ক্ষেত্রে রুটিন নিজে বদলানো বন্ধ — ডাক্তারের পরামর্শ অনুযায়ী করুন। নিচে ‘আজ আসলে’ লগ করা যাবে।"),
    warnings.map((w, i) => React.createElement(Notice, { key: "w" + i }, w)),
    plan.weeklyTargetMin && React.createElement(Stat, {
      title: "এই সপ্তাহের লক্ষ্য", line: bnNum(plan.weeklyTargetMin) + " মিনিট · সম্পন্ন " + bnNum(weekMin || 0) + " মিনিট" + (plan.custom && plan.custom.length ? " · পরিকল্পিত " + bnNum(planned) + " মিনিট" : ""),
      pct: ((weekMin || 0) / plan.weeklyTargetMin) * 100, color: "#17705F",
    }),
    err && !sheet && ErrorBox(err),
    plan.routine && React.createElement("div", { style: CARD },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "6px" } },
        React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, "আজ · " + DAY_LABELS[todayIdx]),
        canEdit && editBtn(todayIdx, "✎ বদলান")),
      todayItems.length === 0
        ? React.createElement("div", { style: { fontSize: "14px", color: "#5F716C" } }, "আজ বিশ্রামের দিন।")
        : todayItems.map((it) => React.createElement("div", { key: it.key, style: { display: "flex", alignItems: "center", gap: "12px", padding: "4px 0" } },
          React.createElement(Tick, { on: done.includes(it.key), onClick: () => toggle(it), busy, label: it.label + " করেছি" }),
          React.createElement("div", { style: { fontSize: "14px", color: "#1F2D2A" } }, it.label + " · " + bnNum(it.min) + " মিনিট" + (it.counted ? "" : " · সাপ্তাহিক গণনায় নয়"))))),
    plan.routine && React.createElement("div", { style: CARD },
      React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A", marginBottom: "6px" } }, "সপ্তাহের রুটিন"),
      plan.routine.map((items, i) => React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" } },
        React.createElement("div", { style: { fontSize: "13px", color: i === todayIdx ? "#0E4B43" : "#5F716C", fontWeight: i === todayIdx ? 700 : 400, padding: "3px 0", lineHeight: 1.5 } },
          DAY_LABELS[i] + (plan.custom && plan.custom.includes(i) ? " (আমার)" : "") + ": " + (items.length ? items.map((x) => x.label + " " + bnNum(x.min) + " মি.").join(" + ") : "বিশ্রাম")),
        canEdit && i !== todayIdx && editBtn(i, "✎")))),
    React.createElement("div", { style: CARD },
      React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A", marginBottom: "8px" } }, "আজ আসলে কী করলেন?"),
      log.length > 0 && React.createElement("div", { style: { fontSize: "13px", color: "#1F2D2A", lineHeight: 1.6, marginBottom: "8px" } },
        log.map((x, i) => React.createElement("div", { key: i }, "• " + EXERCISE_TYPES[x.type].label + " " + bnNum(x.min) + " মিনিট"))),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
        ["walk", "cycling", "gym", "sports", "other"].map((t) => React.createElement("button", {
          key: t, onClick: () => { setErr(null); setSheet({ kind: "log", type: t }); }, disabled: busy,
          style: { minHeight: "44px", padding: "6px 14px", borderRadius: "12px", border: "1px solid #C3D2CA", background: "#F1F6F2", color: "#1F2D2A", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
        }, (EX_ICON[t] || "") + " " + EXERCISE_TYPES[t].label)))),
    sheet && sheet.kind === "day" && React.createElement(ExerciseEditSheet, {
      key: "day" + sheet.idx, dayLabel: DAY_LABELS[sheet.idx], items: plan.routine[sheet.idx], isCustom: !!(plan.custom && plan.custom.includes(sheet.idx)), busy, err,
      onSave: (draft) => saveDay(sheet.idx, setDayPref(goal && goal.planPrefs, sheet.idx, draft)),
      onReset: () => saveDay(sheet.idx, clearDayPref(goal && goal.planPrefs, sheet.idx)),
      onClose: closeSheet,
    }),
    sheet && sheet.kind === "log" && React.createElement(ExerciseLogSheet, {
      key: "log", initialType: sheet.type, entries: log, busy, err, onAdd: addLog, onRemove: removeLog, onClose: closeSheet,
    }),
    React.createElement(Notice, null, "বুকে ব্যথা, মাথা ঘোরা বা শ্বাসকষ্ট হলে থামুন ও ডাক্তার দেখান।"),
    React.createElement("p", { style: { fontSize: "12px", color: "#5F716C" } }, "টিক দিলে মিনিট ‘দৈনিক ইনপুট’-এর ব্যায়ামে যোগ হয়। WHO-ভিত্তিক সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"));
}

// ---------- ট্রেন্ড ও সাপ্তাহিক রিভিউ (গত ৭ দিন) ----------
function TrendTab({ info, familyId, memberId }) {
  const { goal, gate, age } = info;
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState(null);
  const dates = last7DatesISO();
  useEffect(() => {
    getWeekDaily(familyId, memberId, last7DatesISO()).then(setDocs).catch((x) => setErr(errText(x)));
  }, [familyId, memberId]);
  if (err) return ErrorBox(err);
  if (!docs) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে...");

  const calorieTarget = !gate.blocked && goal && goal.calc ? goal.calc.calorieTarget : null;
  const [sMin, sMax] = sleepTargetHours(age);
  const plan = exercisePlan(age, goal ? goal.goalType : null);
  const t = buildTrend(docs, dates, { calorieTarget, sleepMinH: sMin, weeklyExerciseTarget: plan ? plan.weeklyTargetMin : null });
  const labels = dates.map((d) => bnNum(Number(d.slice(8))));
  const card = (title, sub, body) => React.createElement("div", { style: CARD },
    React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, title),
    sub && React.createElement("div", { style: { fontSize: "12px", color: "#5F716C", margin: "2px 0 6px" } }, sub), body);
  const none = (txt) => React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", padding: "8px 0" } }, txt);
  const targetKg = !gate.blocked && goal && Number(goal.targetWeightKg) > 0 ? Number(goal.targetWeightKg) : null;
  const wPts = t.days.filter((x) => x.weightKg).map((x) => ({ date: x.date, value: x.weightKg }));
  const points = reviewPoints(t, bnNum);

  return React.createElement("div", null,
    card("ওজন (কেজি)", "গত ৭ দিন", wPts.length ? React.createElement(TrendChart, { unit: "কেজি", referenceRange: null, points: wPts, targetLine: targetKg ? { value: targetKg, label: "লক্ষ্য " + bnNum(targetKg) + " কেজি" } : null }) : none("এই সপ্তাহে ওজন দেওয়া হয়নি।")),
    calorieTarget && card("ক্যালরি (লক্ষ্য " + bnNum(calorieTarget) + ")", "বিন্দু-রেখা = লক্ষ্য", t.calDays ? React.createElement(TrendBars, { labels, values: t.days.map((x) => x.calories), target: calorieTarget, color: "#E0A100" }) : none("এই সপ্তাহে মিল টিক দেওয়া হয়নি।")),
    card("ঘুম (ঘণ্টা, লক্ষ্য " + bnNum(sMin) + "–" + bnNum(sMax) + ")", "বিন্দু-রেখা = সর্বনিম্ন লক্ষ্য", t.sleepDays ? React.createElement(TrendBars, { labels, values: t.days.map((x) => x.sleepH), target: sMin, color: "#6B5BD2" }) : none("এই সপ্তাহে ঘুমের তথ্য দেওয়া হয়নি।")),
    card("সাপ্তাহিক রিভিউ", "শুধু আপনার দেওয়া তথ্য থেকে",
      React.createElement("div", { style: { fontSize: "14px", color: "#1F2D2A", lineHeight: 1.6 } },
        points.map((p, i) => React.createElement("div", { key: "p" + i }, "• " + p)),
        reviewComment(t, bnNum).map((c, i) => React.createElement("div", { key: "c" + i, style: { marginTop: i === 0 ? "8px" : "4px" } }, c)))),
    React.createElement(Notice, null, "এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়। অস্বাভাবিক ওজন বা শরীর খারাপ হলে ডাক্তার দেখান।"));
}

// ---------- প্ল্যান (মিল | ব্যায়াম) — ধাপ A১/A২/A৩ ----------
// "কেন এই প্ল্যান?" + মিলের নিচে "আজ এড়িয়ে চলুন" (বিদ্যমান খাদ্য-নির্দেশিকা, compact; পূর্ণ তালিকা নথিপত্রে)।
function PlanTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const [sub, setSub] = useState("meal");
  const { goal, age, weightKg, heightCm, allergyTags, gate } = info;
  const common = { info, familyId, callerMemberId, memberId, onSaved };
  return React.createElement("div", null,
    TabPills([["meal", "🍽 মিল"], ["exercise", "🏃 ব্যায়াম"]], sub, setSub),
    sub === "meal" && React.createElement(React.Fragment, null,
      !gate.blocked && React.createElement(PlanWhyCard, { lines: explainMeal({ goal, age, weightKg, heightCm, allergyTags }) }),
      React.createElement(MealTab, common),
      React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", margin: "4px 0 0" } }, "তালিকা সদস্যের রোগ, এলার্জি ও BMI থেকে স্বয়ংক্রিয়। খাবারে সন্দেহ থাকলে ডাক্তারকে জিজ্ঞেস করুন।"),
      React.createElement(DietGuidanceSection, { familyId, selectedMemberId: memberId, compact: true }),
      React.createElement("p", { style: { fontSize: "12px", color: "#5F716C" } }, "পূর্ণ তালিকা: নথিপত্র → খাদ্য নির্দেশিকা।")),
    sub === "exercise" && React.createElement(React.Fragment, null,
      React.createElement(PlanWhyCard, { lines: explainExercise({ plan: exercisePlan(age, goal ? goal.goalType : null), age, goalType: goal ? goal.goalType : null }) }),
      React.createElement(ExerciseTab, common)));
}

// ---------- লক্ষ্য ও ইনপুট (লক্ষ্য | দৈনিক ইনপুট) — ধাপ A১ ----------
function SetupTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const [sub, setSub] = useState(info.goal ? "input" : "goal");
  const common = { info, familyId, callerMemberId, memberId, onSaved };
  return React.createElement("div", null,
    TabPills([["input", "দৈনিক ইনপুট"], ["goal", "লক্ষ্য"]], sub, setSub),
    sub === "input" && React.createElement(InputTab, common),
    sub === "goal" && React.createElement(GoalTab, common));
}

// ---------- দৈনিক ইনপুট ----------
function InputTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const { daily, latestWeight } = info;
  const d = daily || {};
  const [weight, setWeight] = useState(d.weightKg ? String(d.weightKg) : "");
  const [exercise, setExercise] = useState(d.exerciseMin !== undefined ? String(d.exerciseMin) : "");
  const [water, setWater] = useState(d.waterGlasses !== undefined ? String(d.waterGlasses) : "");
  const [steps, setSteps] = useState(d.steps !== undefined ? String(d.steps) : "");
  const [bed, setBed] = useState(d.sleep ? d.sleep.bed : "");
  const [wake, setWake] = useState(d.sleep ? d.sleep.wake : "");
  const [quality, setQuality] = useState(d.sleep && d.sleep.quality ? d.sleep.quality : 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);

  const submit = useCallback(async () => {
    setErr(null); setOk(false);
    const fields = {};
    const num = (v, lo, hi, name, int) => {
      if (!String(v).trim()) return undefined;
      const n = Number(v);
      if (Number.isNaN(n) || n < lo || n > hi || (int && !Number.isInteger(n))) throw new Error(name + " সঠিক সংখ্যা দিন।");
      return n;
    };
    try {
      const w = num(weight, 2, 400, "ওজন"); if (w !== undefined) fields.weightKg = w;
      const e = num(exercise, 0, 1440, "ব্যায়ামের মিনিট", true); if (e !== undefined) fields.exerciseMin = e;
      const g = num(water, 0, 40, "পানির গ্লাস", true); if (g !== undefined) fields.waterGlasses = g;
      const s = num(steps, 0, 100000, "স্টেপ", true); if (s !== undefined) fields.steps = s;
      if (bed || wake) {
        const m = sleepMinutes(bed, wake);
        if (!m) throw new Error("ঘুমের জন্য শোয়ার ও ওঠার সময় দুটোই দিন।");
        fields.sleep = { bed, wake, quality: quality || null };
        fields.sleepMinutes = m;
      }
    } catch (x) { setErr(x.message); return; }
    if (!Object.keys(fields).length) { setErr("অন্তত একটি তথ্য দিন।"); return; }
    setBusy(true);
    try {
      await saveDaily(familyId, memberId, callerMemberId, todayISO(), fields, daily);
      setOk(true);
      onSaved();
    } catch (x) {
      setErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x)));
    } finally { setBusy(false); }
  }, [weight, exercise, water, steps, bed, wake, quality, familyId, memberId, callerMemberId, daily, onSaved]);

  const field = (label, value, setter, hint, step) => React.createElement("div", null,
    React.createElement("label", { style: LABEL }, label),
    React.createElement("input", { type: "number", inputMode: "decimal", step: step || "1", value, onChange: (e) => setter(e.target.value), style: INPUT }),
    hint && React.createElement("div", { style: { fontSize: "12px", color: "#5F716C", marginTop: "4px" } }, hint));

  return React.createElement("div", null,
    React.createElement("div", { style: CARD },
      field("ওজন (কেজি)", weight, setWeight, "প্রোফাইলের ওজনেও সংরক্ষিত হবে" + (latestWeight ? " · সর্বশেষ: " + latestWeight + " কেজি" : ""), "0.1")),
    React.createElement("div", { style: CARD },
      field("ব্যায়াম (মিনিট)", exercise, setExercise), field("পানি (গ্লাস)", water, setWater), field("স্টেপ", steps, setSteps)),
    React.createElement("div", { style: CARD },
      React.createElement("b", null, "রাতের ঘুম"),
      React.createElement("div", { style: { display: "flex", gap: "10px" } },
        React.createElement("div", { style: { flex: 1 } }, React.createElement("label", { style: LABEL }, "শোয়া"),
          React.createElement("input", { type: "time", value: bed, onChange: (e) => setBed(e.target.value), style: INPUT })),
        React.createElement("div", { style: { flex: 1 } }, React.createElement("label", { style: LABEL }, "ওঠা"),
          React.createElement("input", { type: "time", value: wake, onChange: (e) => setWake(e.target.value), style: INPUT }))),
      React.createElement("label", { style: LABEL }, "ঘুমের মান"),
      React.createElement("div", { style: { display: "flex", gap: "8px" } },
        [1, 2, 3, 4, 5].map((n) => React.createElement("button", {
          key: n, onClick: () => setQuality(n === quality ? 0 : n), "aria-pressed": n === quality,
          style: { width: "44px", height: "44px", borderRadius: "999px", cursor: "pointer", fontSize: "14px", fontWeight: 700, border: "1px solid #0E4B43", background: n === quality ? "#0E4B43" : "#fff", color: n === quality ? "#fff" : "#0E4B43" },
        }, bnNum(n))))),
    err && ErrorBox(err),
    ok && React.createElement(Notice, { tone: "info" }, "সংরক্ষিত হয়েছে ✓"),
    PrimaryButton("সংরক্ষণ", submit, busy)
  );
}

// ---------- লক্ষ্য ----------
function GoalTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const { goal, age, member, heightCm, weightKg, detected } = info;
  const g = goal || {};
  const [goalType, setGoalType] = useState(g.goalType || "");
  const [activity, setActivity] = useState(g.activity || "medium");
  const [target, setTarget] = useState(g.targetWeightKg ? String(g.targetWeightKg) : "");
  const [weeks, setWeeks] = useState(g.weeks ? String(g.weeks) : "");
  const [pregnant, setPregnant] = useState(!!(g.flags && g.flags.pregnant));
  const [diabetes, setDiabetes] = useState(!!(g.flags && g.flags.diabetes) || detected.diabetes);
  const [kidney, setKidney] = useState(!!(g.flags && g.flags.kidney) || detected.kidney);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

  const flags = { pregnant, diabetes: diabetes || detected.diabetes, kidney: kidney || detected.kidney };
  const gate = safetyGate({ age, flags });
  const showPregnant = member && member.sex === "female" && age !== null && age >= 12 && age <= 55;
  const needsTarget = goalType === "lose" || goalType === "gain";
  const bmi = bmiOf(weightKg, heightCm);

  const submit = useCallback(async () => {
    setErr(null); setResult(null);
    const base = { goalType: goalType || null, activity: goalType ? activity : null, targetWeightKg: target, weeks, flags };
    setBusy(true);
    try {
      if (gate.blocked) {
        await saveGoal(familyId, memberId, callerMemberId, { ...base, goalType: null, activity: null, targetWeightKg: null, weeks: null, calc: null }, goal);
        setResult({ blocked: true, reason: gate.reason });
      } else {
        const calc = computeGoal({ goalType, activity, sex: member && member.sex, age, heightCm, weightKg, targetWeightKg: target, weeks, flags });
        if (calc.error) { setErr(calc.error); return; }
        if (calc.blocked) {
          await saveGoal(familyId, memberId, callerMemberId, { ...base, goalType: null, activity: null, targetWeightKg: null, weeks: null, calc: null }, goal);
          setResult({ blocked: true, reason: calc.reason });
        } else {
          await saveGoal(familyId, memberId, callerMemberId, { ...base, calc: { calorieTarget: calc.calorieTarget, bmr: calc.bmr, tdee: calc.tdee, weeklyRateKg: calc.weeklyRateKg } }, goal);
          setResult(calc);
        }
      }
      onSaved();
    } catch (x) {
      setErr(x.code === "permission-denied" ? "এই সদস্যের লক্ষ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x)));
    } finally { setBusy(false); }
  }, [goalType, activity, target, weeks, flags, gate, member, age, heightCm, weightKg, goal, familyId, memberId, callerMemberId, onSaved]);

  const check = (label, val, setter, locked) => React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", padding: "6px 0", minHeight: "40px" } },
    React.createElement("input", { type: "checkbox", checked: val, disabled: locked, onChange: (e) => setter(e.target.checked), style: { width: "20px", height: "20px" } }),
    label + (locked ? " (প্রোফাইলের রোগ-তালিকা থেকে)" : ""));

  return React.createElement("div", null,
    React.createElement("div", { style: CARD },
      React.createElement("b", null, "প্রোফাইল থেকে"),
      React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "4px" } },
        (age !== null ? bnNum(age) + " বছর" : "বয়স নেই") + " · " + (heightCm ? "উচ্চতা " + bnNum(heightCm) + " সেমি" : "উচ্চতা নেই") + " · " + (weightKg ? "ওজন " + bnNum(weightKg) + " কেজি" : "ওজন নেই") + (bmi ? " · BMI " + bnNum(Math.round(bmi * 10) / 10) : "")),
      (!heightCm || !weightKg) && React.createElement("div", { style: { fontSize: "13px", color: "#7A5B00", marginTop: "6px" } }, "হিসাবের জন্য হোম → প্রোফাইলে উচ্চতা ও ওজন যোগ করুন।")),
    React.createElement("div", { style: CARD },
      React.createElement("b", null, "প্রযোজ্য হলে টিক দিন"),
      showPregnant && check("গর্ভবতী বা বুকের দুধ খাওয়াচ্ছেন", pregnant, setPregnant, false),
      check("ডায়াবেটিস আছে", diabetes || detected.diabetes, setDiabetes, detected.diabetes),
      check("কিডনি রোগ আছে", kidney || detected.kidney, setKidney, detected.kidney)),
    gate.blocked
      ? React.createElement(Notice, null, React.createElement("b", null, "ক্যালরি-টার্গেট বন্ধ"), React.createElement("br"), gate.reason, React.createElement("br"), "পানি, ব্যায়াম ও ঘুম ট্র্যাক করা যাবে।")
      : React.createElement("div", { style: CARD },
        React.createElement("label", { style: LABEL }, "লক্ষ্য বেছে নিন"),
        TabPills(Object.entries(GOAL_LABELS), goalType, setGoalType),
        SelectField("কার্যকলাপ", activity, setActivity, Object.entries(ACTIVITY_LABELS)),
        needsTarget && React.createElement("div", null,
          React.createElement("label", { style: LABEL }, "লক্ষ্য ওজন (কেজি)"),
          React.createElement("input", { type: "number", inputMode: "decimal", step: "0.1", value: target, onChange: (e) => setTarget(e.target.value), style: INPUT }),
          React.createElement("label", { style: LABEL }, "কত সপ্তাহে"),
          React.createElement("input", { type: "number", inputMode: "numeric", value: weeks, onChange: (e) => setWeeks(e.target.value), style: INPUT }))),
    err && ErrorBox(err),
    result && result.blocked && React.createElement(Notice, null, result.reason),
    result && !result.blocked && React.createElement(Notice, { tone: "info" },
      "দৈনিক টার্গেট: ", React.createElement("b", null, bnNum(result.calorieTarget) + " কিলোক্যালরি"),
      result.weeklyRateKg ? " · প্রতি সপ্তাহে প্রায় " + bnNum(result.weeklyRateKg) + " কেজি" : "",
      result.notes.map((n, i) => React.createElement("div", { key: i, style: { marginTop: "6px" } }, n))),
    PrimaryButton(gate.blocked ? "সংরক্ষণ" : "টার্গেট হিসাব করুন", submit, busy)
  );
}

// ---------- মূল পেজ ----------
export function TrackerPageSection({ familyId, callerMemberId, selectedMemberId, members, topOffsetPx }) {
  const [tab, setTab] = useState("today");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const topPx = (topOffsetPx || 44) + "px";

  const load = useCallback(async () => {
    if (!selectedMemberId) return;
    setErr(null);
    try {
      const [recs, goal, daily, recent] = await Promise.all([
        listHealthRecords(familyId, selectedMemberId),
        getGoal(familyId, selectedMemberId),
        getDaily(familyId, selectedMemberId, todayISO()),
        getWeekDaily(familyId, selectedMemberId, last30DatesISO()),
      ]);
      const weekDates = weekDatesISO();
      const weekMin = recent.filter((x) => weekDates.includes(x.date)).reduce((a, x) => a + (x.exerciseMin || 0), 0);
      const allergyTags = allergyTagsOf(recs.filter((r) => r.resourceType === "allergy").map((r) => r.substance));
      const member = (members || []).find((m) => m.id === selectedMemberId) || null;
      const h = recs.find((r) => isType(r, ["height", "উচ্চতা"]));
      const w = recs.find((r) => isType(r, ["weight", "ওজন"]));
      const num = (r) => { const n = r ? parseFloat(r.value) : NaN; return Number.isNaN(n) ? null : n; };
      const detected = detectFlagsFromConditions(recs);
      const age = member ? ageYears(member.dob) : null;
      const flags = {
        pregnant: !!(goal && goal.flags && goal.flags.pregnant),
        diabetes: !!(goal && goal.flags && goal.flags.diabetes) || detected.diabetes,
        kidney: !!(goal && goal.flags && goal.flags.kidney) || detected.kidney,
      };
      const weightKg = (daily && daily.weightKg) || num(w);
      setData({ weekMin, recent, activeMeds: activeMedNames(recs), allergyTags, member, goal, daily, age, flags, detected, heightCm: num(h), weightKg, latestWeight: num(w), gate: safetyGate({ age, flags }) });
    } catch (e) {
      setData(null);
      setErr(e.code === "permission-denied" ? "এই সদস্যের ট্র্যাকার দেখার অনুমতি আপনার নেই।" : (e.message || String(e)));
    }
  }, [familyId, selectedMemberId, members]);

  useEffect(() => { setData(null); load(); }, [load]);

  const tabs = [["today", "আজ"], ["plan", "প্ল্যান"], ["trend", "ট্রেন্ড"], ["reminder", "রিমাইন্ডার"], ["setup", "লক্ষ্য ও ইনপুট"]];
  return React.createElement("div", { className: "hs-page", style: { position: "fixed", top: topPx, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement("div", { style: { padding: "8px 12px 0", flexShrink: 0 } }, TabPills(tabs, tab, setTab)),
    React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "0 12px 16px" } },
      err && ErrorBox(err),
      !selectedMemberId && React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "সদস্য-তালিকা লোড হচ্ছে..."),
      selectedMemberId && !data && !err && React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে..."),
      data && tab === "today" && React.createElement(TodayTab, { key: selectedMemberId, info: data, familyId, callerMemberId, memberId: selectedMemberId, onSaved: load }),
      // key: সদস্য বদলালে ফর্মের state নতুন করে শুরু হয়
      data && tab === "plan" && React.createElement(PlanTab, { key: selectedMemberId, info: data, familyId, callerMemberId, memberId: selectedMemberId, onSaved: load }),
      data && tab === "reminder" && React.createElement(ReminderSettings, { key: selectedMemberId, info: data, familyId, memberId: selectedMemberId, callerMemberId, onSaved: load }),
      data && tab === "trend" && React.createElement(TrendTab, { key: selectedMemberId, info: data, familyId, memberId: selectedMemberId }),
      data && tab === "setup" && React.createElement(SetupTab, { key: selectedMemberId, info: data, familyId, callerMemberId, memberId: selectedMemberId, onSaved: load })
    )
  );
}
