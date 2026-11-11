// হেলথ ট্র্যাকার (ধাপ ১) — লক্ষ্য সেটআপ, দৈনিক কার্ড, দৈনিক ইনপুট (ওজন/পানি/স্টেপ/ব্যায়াম/ঘুম)।
// হিসাব trackerCalc.js-এ (ফিক্সড সূত্র); Firestore trackerData.js-এ। এই ফাইলে শুধু UI।
// ধাপ B-২: "বদলান" শিট (PlanEditSheets.js) — মিল/ব্যায়াম এডিট; সংরক্ষণ planPrefs.js (pure) + trackerData.js দিয়ে।
// ধাপ ২: মিল-প্ল্যান (mealPlanData.js), ব্যায়াম-প্ল্যান (exercisePlanData.js), "খাওয়া যাবে না"
// (বিদ্যমান DietGuidanceSection reuse — Condition/Allergy/BMI থেকে স্বয়ংক্রিয়)।
// ধাপ ৩: রিমাইন্ডার-সেটিং (ReminderSettings.js); চালক TrackerReminderRunner.js Dashboard-এ বসানো। Health Connect (ধাপ ৪), ট্রেন্ড (ধাপ ৫) এখনো নেই।

import { ErrorBox, PrimaryButton, TabPills, Skeleton } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { getGoal, getDaily, getWeekDaily, saveGoal, saveGoalExtras, saveDaily, savePlanPrefs, todayISO } from "./trackerData.js";
import { TodayTab } from "./TodayTab.js";
import { TodaySummary } from "../summary/TodaySummary.js";
import { T, CARD_STYLE, SLOT_ICON, SLOT_TINT } from "./trackerTheme.js";
import { last30DatesISO } from "./todaySummary.js";
import { MEAL_SLOTS, buildMealPlan, allergyTagsOf } from "./mealPlanData.js";
import { exercisePlan, plannedWeeklyMinutes, weekDatesISO, bdDayIndex, DAY_LABELS } from "./exercisePlanData.js";
import {
  EXERCISE_TYPES, applyMealPrefs, applyExercisePrefs, caloriesForDay, mealWarnings, exerciseWarnings, sanitizeExtraFoods, sanitizeExerciseLog, recentExtraFoods,
  setSlotPref, clearSlotPref, setFoodOverride, setDayPref, clearDayPref, reconcileExerciseDone, checkExerciseLog,
} from "./planPrefs.js";
import { MealEditSheet, ExerciseEditSheet, ExerciseLogSheet, EX_ICON } from "./PlanEditSheets.js";
import { ReminderSettings } from "./ReminderSettings.js";
import { TrendChart } from "../reports/TrendChart.js";
import { TrendBars } from "./TrendBars.js";
import { last7DatesISO, buildTrend, reviewPoints, reviewComment } from "./weeklyTrend.js";
import { activeMedNames } from "./medFoodNotes.js";
import { gutEntries, gutFoodCount, entriesOn } from "./gutLog.js";
import { GutLogCard } from "./GutLogCard.js";
import { PlanWhyCard } from "./PlanWhyCard.js";
import { AvoidCard } from "./AvoidCard.js";
import { conditionKeysOf } from "./avoidRules.js";
import { explainMeal, explainExercise } from "./planExplain.js";
import {
  GOAL_LABELS, ageYears, bmiOf, computeGoal, safetyGate,
  sleepTargetHours, detectFlagsFromConditions, effectivePregnant, MAX_FAST_DAYS, activeFastDays, fastModeGate, isFastDate, sanitizeFastDays, checkFastDaysInput, checkWaterTargetInput, waterTargetFor } from "./trackerCalc.js";

const { useState, useEffect, useCallback } = React;

const CARD = CARD_STYLE;
const INPUT = { width: "100%", boxSizing: "border-box", padding: "12px", border: "1.5px solid " + T.inputBorder, borderRadius: "12px", fontSize: "14px" };
const LABEL = { fontSize: "14px", fontWeight: 600, color: T.ink, display: "block", margin: "12px 0 6px" };

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
  return React.createElement("div", { style: { ...CARD, background: warn ? "#FFF6DD" : "#E4F0E9", borderColor: warn ? "#E8D08A" : "#9CC5B4", color: warn ? "#7A5B00" : T.green, fontSize: "14px", lineHeight: 1.5 } }, children);
}

function Stat({ title, line, pct, color, extra }) {
  return React.createElement("div", { style: CARD },
    React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, title),
    React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginTop: "4px" } }, line),
    pct !== undefined && React.createElement(Bar, { pct, color }),
    extra && React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginTop: "6px" } }, extra));
}

// চেকলিস্ট-টিক: দেখতে ২০px বক্স, ট্যাপ-জায়গা ৪০px (বাটনটি স্বচ্ছ)
function Tick({ on, onClick, busy, label }) {
  return React.createElement("button", {
    onClick, disabled: busy, "aria-pressed": on, "aria-label": label,
    style: { width: "40px", height: "40px", flexShrink: 0, padding: 0, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "default" : "pointer" },
  }, React.createElement("span", { "aria-hidden": "true", style: { width: "20px", height: "20px", boxSizing: "border-box", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, lineHeight: 1,
    border: "2px solid " + T.green, background: on ? T.green : "#fff", color: "#fff" } }, on ? "✓" : ""));
}

// ছোট ✎ আইকন-বাটন — বর্ডার/ব্যাকগ্রাউন্ড ছাড়া; ট্যাপ-জায়গা size px (ডিফল্ট ৪০); নাম aria-label ও title-এ
function EditIcon({ onClick, disabled, label, size }) {
  const s = (size || 40) + "px";
  return React.createElement("button", { onClick, disabled, "aria-label": label, title: label,
    style: { width: s, height: s, flexShrink: 0, padding: 0, border: "none", background: "none", color: T.green, fontSize: "18px", fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, fontFamily: "inherit" } }, "✎");
}

const SHORT_DAYS = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];

// পিল-সারির নিচের স্ক্রলবার-দাগ লুকাতে (শুধু ট্র্যাকারের ভেতরে; শেয়ার্ড TabPills বদলায়নি)
const PILL_CSS = ".hs-trk-pills>div{scrollbar-width:none;-ms-overflow-style:none;margin-bottom:8px!important}.hs-trk-pills>div::-webkit-scrollbar{display:none}";
function Pills(tabs, active, onChange, leading) {
  return React.createElement("div", { className: "hs-trk-pills" }, TabPills(tabs, active, onChange, leading, "trk:" + tabs.map((x) => x[0]).join("|")));
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

  if (gate.blocked) return React.createElement(Notice, null, React.createElement("b", null, "মিল-প্ল্যান বন্ধ"), React.createElement("br"), gate.reason, React.createElement("br"), "সুষম খাবারের সাধারণ গাইড নিচের ‘আজ এড়িয়ে চলুন’ ও নথি → খাদ্য নির্দেশিকায় দেখুন; নির্দিষ্ট প্ল্যান ডাক্তারের সাথে ঠিক করুন।");
  if (!calc) return React.createElement(Notice, { tone: "info" }, "মিল-প্ল্যানের জন্য আগে ‘লক্ষ্য ও প্ল্যান’ ট্যাবের ‘আমার লক্ষ্য’-এ ক্যালরির টার্গেট ঠিক করুন।");

  const base = buildMealPlan(calc.calorieTarget, allergyTags, goal.planPrefs);
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
    const cal = caloriesForDay(applyMealPrefs(buildMealPlan(calc.calorieTarget, allergyTags, prefs), prefs, allergyTags), eaten, extras);
    if (cal !== (d.caloriesIn || 0)) await saveDaily(familyId, memberId, callerMemberId, todayISO(), { caloriesIn: cal }, daily);
  }, true);

  // ধাপ ৩: খাবারের ✎ এডিট — শিট খোলা থাকে (closeAfter=false); entry=null মানে মূল মানে ফেরা
  const saveFood = (key, entry) => run(async () => {
    const prefs = setFoodOverride(goal.planPrefs, key, entry);
    await savePlanPrefs(familyId, memberId, callerMemberId, prefs, goal);
    const cal = caloriesForDay(applyMealPrefs(buildMealPlan(calc.calorieTarget, allergyTags, prefs), prefs, allergyTags), eaten, extras);
    if (cal !== (d.caloriesIn || 0)) await saveDaily(familyId, memberId, callerMemberId, todayISO(), { caloriesIn: cal }, daily);
  }, false);

  const writeExtras = (next) => run(() => saveDaily(familyId, memberId, callerMemberId, todayISO(), { extraFoods: next, caloriesIn: caloriesForDay(plan, eaten, next) }, daily), false);

  const sheetSlot = sheet ? plan.slots.find((s) => s.id === sheet) : null;

  return React.createElement("div", null,
    isFastDate(todayISO(), info.fastDays) && React.createElement(Notice, { tone: "info" }, "🌙 আজ সিয়াম/ফাস্টিং-এর দিন (পরিকল্পিত) — দিনের বেলা খাবার লগ করলে সিয়াম ধরা হবে না। মিল-প্ল্যান শুধু দেখার জন্য।"),
    React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginBottom: "4px" } },
      "টার্গেট " + bnNum(calc.calorieTarget) + " · প্ল্যানের মোট " + bnNum(plan.total) + " কিলোক্যালরি (আনুমানিক)"),
    React.createElement(Bar, { pct: ((d.caloriesIn || 0) / calc.calorieTarget) * 100, color: T.amber }),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, margin: "4px 0 8px" } }, "আজ খাওয়া হয়েছে " + bnNum(d.caloriesIn || 0) + " কিলোক্যালরি"),
    plan.total < calc.calorieTarget - 100 && warnings.length === 0 && React.createElement(Notice, { tone: "info" }, "প্ল্যানে টার্গেটের পুরোটা ধরে না — বাকিটা স্বাস্থ্যকর খাবার দিয়ে পূরণ করুন।"),
    warnings.map((w, i) => React.createElement(Notice, { key: "w" + i }, w)),
    plan.notes.length > 0 && React.createElement(Notice, null, plan.notes.map((n, i) => React.createElement("div", { key: i }, n))),
    err && !sheet && ErrorBox(err),
    plan.slots.map((s) => {
      const mine = extras.map((x, idx) => ({ ...x, idx })).filter((x) => x.slot === s.id);
      return React.createElement("div", { key: s.id, style: CARD },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
          React.createElement("div", { "aria-hidden": "true", style: { width: "34px", height: "34px", flexShrink: 0, borderRadius: "10px", background: SLOT_TINT[s.id] || T.track, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" } }, SLOT_ICON[s.id] || "🍽"),
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink } }, s.label + " · " + bnTimeHM(s.time) + (plan.custom.includes(s.id) ? " · আমার" : ""),
              React.createElement("span", { style: { fontWeight: 400, color: T.muted, fontSize: "12px" } }, " · " + bnNum(s.kcal) + " কিলো")),
            React.createElement("div", { style: { fontSize: "12.5px", color: T.muted, marginTop: "1px", lineHeight: 1.4 } }, s.items.length ? s.items.map((i) => i.text).join(", ") : "এই বেলা বাদ"),
            mine.length > 0 && React.createElement("div", { style: { fontSize: "12px", color: "#7A5B00", marginTop: "2px", lineHeight: 1.4 } }, "আজ নিজের: " + mine.map((x) => x.name + " " + bnNum(x.kcal)).join(", "))),
          React.createElement(EditIcon, { onClick: () => openSheet(s.id), disabled: busy, label: s.label + " বদলান" }),
          React.createElement(Tick, { on: eaten.includes(s.id), onClick: () => toggle(s.id), busy, label: s.label + " খেয়েছি" })));
    }),
    sheetSlot && React.createElement(MealEditSheet, {
      key: sheet, slot: sheetSlot, planTotal: plan.total, target: calc.calorieTarget, sex: member && member.sex, allergyTags, avoidCtx: { age: info.age, flags: info.flags, condKeys: info.condKeys },
      isCustom: plan.custom.includes(sheet), extras: extras.map((x, idx) => ({ ...x, idx })).filter((x) => x.slot === sheet), extraCount: extras.length, recentFoods: recentExtraFoods(info.recent), activeMeds: info.activeMeds, busy, err,
      onFoodSave: saveFood,
      onSavePerm: (draft) => savePrefs(setSlotPref(goal.planPrefs, sheet, draft)),
      onReset: () => savePrefs(clearSlotPref(goal.planPrefs, sheet)),
      onAddExtra: (name, kcal) => writeExtras([...extras, { name, kcal, slot: sheet }]),
      onRemoveExtra: (idx) => writeExtras(extras.filter((_, i) => i !== idx)),
      onClose: closeSheet,
    }),
    React.createElement("p", { style: { fontSize: "12px", color: T.muted } }, "ট্যাপ করলে ‘খেয়েছি’ হিসেবে ক্যালরি যোগ হয়। ক্যালরি আনুমানিক; প্রোফাইলের অ্যালার্জি অনুযায়ী খাবার বদলানো হয়েছে, তবু সন্দেহ হলে খাবেন না। এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"));
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
  const [panel, setPanel] = useState(null); // "why" | "week" | null
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

  const editBtn = (idx) => React.createElement(EditIcon, { onClick: () => { setErr(null); setSheet({ kind: "day", idx }); }, disabled: busy, label: DAY_LABELS[idx] + " বদলান" });

  return React.createElement("div", null,
    React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "8px" } },
      FoldChip("why", "💡 কেন এই প্ল্যান?", null, panel, setPanel),
      plan.weeklyTargetMin && FoldChip("week", "🎯 এই সপ্তাহের লক্ষ্য", bnNum(Math.min(100, Math.round(((weekMin || 0) / plan.weeklyTargetMin) * 100))) + "%", panel, setPanel)),
    panel === "why" && React.createElement(PlanWhyCard, { bare: true, lines: explainExercise({ plan: base, age, goalType: goal ? goal.goalType : null }) }),
    needsDoctor && React.createElement(Notice, null, "ব্যায়াম শুরুর আগে ডাক্তারের সাথে কথা বলে নিন (গর্ভাবস্থা, ডায়াবেটিস, কিডনি রোগ বা ৬৫+ বয়সে)।"),
    gate.blocked && plan.routine && React.createElement(Notice, { tone: "info" }, "আপনার ক্ষেত্রে রুটিন নিজে বদলানো বন্ধ — ডাক্তারের পরামর্শ অনুযায়ী করুন। নিচে ‘আজ আসলে’ লগ করা যাবে।"),
    warnings.map((w, i) => React.createElement(Notice, { key: "w" + i }, w)),
    panel === "week" && plan.weeklyTargetMin && React.createElement(Stat, {
      title: "এই সপ্তাহের লক্ষ্য", line: bnNum(plan.weeklyTargetMin) + " মিনিট · সম্পন্ন " + bnNum(weekMin || 0) + " মিনিট" + (plan.custom && plan.custom.length ? " · পরিকল্পিত " + bnNum(planned) + " মিনিট" : ""),
      pct: ((weekMin || 0) / plan.weeklyTargetMin) * 100, color: T.green2,
    }),
    err && !sheet && ErrorBox(err),
    plan.routine && React.createElement("div", { style: CARD },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "4px" } },
        React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, "আজ · " + DAY_LABELS[todayIdx]),
        canEdit && editBtn(todayIdx)),
      todayItems.length === 0
        ? React.createElement("div", { style: { fontSize: "14px", color: T.muted } }, "আজ বিশ্রামের দিন।")
        : React.createElement("div", { style: { display: "grid", gridTemplateColumns: todayItems.length > 1 ? "1fr 1fr" : "1fr", gap: "8px" } },
          todayItems.map((it) => {
            const on = done.includes(it.key);
            return React.createElement("div", { key: it.key, style: { display: "flex", alignItems: "center", gap: "2px", minWidth: 0, padding: "2px 8px 2px 0", borderRadius: "10px", background: on ? "#E4F0E9" : T.canvas, border: "1px solid " + (on ? "#9CC5B4" : T.border) } },
              React.createElement(Tick, { on, onClick: () => toggle(it), busy, label: it.label + " করেছি" }),
              React.createElement("div", { style: { minWidth: 0, lineHeight: 1.35 } },
                React.createElement("div", { style: { fontSize: "13.5px", fontWeight: 600, color: T.ink } }, it.label),
                React.createElement("div", { style: { fontSize: "12px", color: T.muted } }, bnNum(it.min) + " মিনিট" + (it.counted ? "" : " · গণনায় নয়"))));
          }))),
    plan.routine && React.createElement("div", { style: CARD },
      React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink, marginBottom: "4px" } }, "সপ্তাহের রুটিন"),
      plan.routine.map((items, i) => {
        const isToday = i === todayIdx;
        return React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 6px", borderRadius: "10px", background: isToday ? "#E4F0E9" : "transparent", borderBottom: !isToday && i < 6 ? "1px solid " + T.track : "1px solid transparent" } },
          React.createElement("div", { "aria-label": DAY_LABELS[i], style: { width: "44px", flexShrink: 0, fontSize: "13px", fontWeight: 700, color: isToday ? T.green : T.ink } },
            SHORT_DAYS[i], plan.custom && plan.custom.includes(i) && React.createElement("span", { style: { display: "block", fontSize: "12px", fontWeight: 600, color: T.muted } }, "আমার")),
          React.createElement("div", { style: { flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: "4px" } },
            items.length
              ? items.map((x, k) => React.createElement("span", { key: k, style: { padding: "2px 8px", borderRadius: "8px", background: isToday ? "#fff" : T.canvas, border: "1px solid " + T.border, fontSize: "12px", color: T.ink, lineHeight: 1.5 } }, x.label.split(" (")[0] + " " + bnNum(x.min) + " মি."))
              : React.createElement("span", { style: { fontSize: "12px", color: T.muted } }, "বিশ্রাম")),
          isToday
            ? React.createElement("span", { style: { flexShrink: 0, fontSize: "12px", fontWeight: 700, color: T.green, padding: "0 6px" } }, "আজ")
            : (canEdit && React.createElement(EditIcon, { onClick: () => { setErr(null); setSheet({ kind: "day", idx: i }); }, disabled: busy, label: DAY_LABELS[i] + " বদলান", size: 36 })));
      })),
    React.createElement("div", { style: CARD },
      React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink, marginBottom: "8px" } }, "আজ আসলে কী করলেন?"),
      log.length > 0 && React.createElement("div", { style: { fontSize: "13px", color: T.ink, lineHeight: 1.6, marginBottom: "8px" } },
        log.map((x, i) => React.createElement("div", { key: i }, "• " + EXERCISE_TYPES[x.type].label + " " + bnNum(x.min) + " মিনিট"))),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
        ["walk", "cycling", "gym", "sports", "other"].map((t) => React.createElement("button", {
          key: t, onClick: () => { setErr(null); setSheet({ kind: "log", type: t }); }, disabled: busy,
          style: { minHeight: "40px", padding: "4px 12px", borderRadius: "12px", border: "1px solid " + T.inputBorder, background: T.canvas, color: T.ink, fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
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
    React.createElement(AvoidCard, { domain: "exercise", age: info.age, flags: info.flags, condKeys: info.condKeys }),
    React.createElement(Notice, null, "বুকে ব্যথা, মাথা ঘোরা বা শ্বাসকষ্ট হলে থামুন ও ডাক্তার দেখান।"),
    React.createElement("p", { style: { fontSize: "12px", color: T.muted } }, "টিক দিলে মিনিট ‘দৈনিক ইনপুট’-এর ব্যায়ামে যোগ হয়। সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"));
}

// ---------- ট্রেন্ড ও সাপ্তাহিক রিভিউ (গত ৭ দিন) ----------
function TrendTab({ info, familyId, memberId, onGoInput }) {
  const { goal, gate, age } = info;
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState(null);
  const dates = last7DatesISO();
  useEffect(() => {
    getWeekDaily(familyId, memberId, last7DatesISO()).then(setDocs).catch((x) => setErr(errText(x)));
  }, [familyId, memberId]);
  if (err) return ErrorBox(err);
  if (!docs) return Skeleton(3, 96);

  const calorieTarget = !gate.blocked && goal && goal.calc ? goal.calc.calorieTarget : null;
  const [sMin, sMax] = sleepTargetHours(age);
  const plan = exercisePlan(age, goal ? goal.goalType : null);
  const t = buildTrend(docs, dates, { calorieTarget, fastDays: info.fastDays, sleepMinH: sMin, weeklyExerciseTarget: plan ? plan.weeklyTargetMin : null });
  const labels = dates.map((d) => bnNum(Number(d.slice(8))));
  const card = (title, sub, body) => React.createElement("div", { style: CARD },
    React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, title),
    sub && React.createElement("div", { style: { fontSize: "12px", color: T.muted, margin: "1px 0 4px" } }, sub), body);
  const none = (txt) => React.createElement("div", { style: { fontSize: "13px", color: T.muted, padding: "2px 0" } }, txt);
  const targetKg = !gate.blocked && goal && Number(goal.targetWeightKg) > 0 ? Number(goal.targetWeightKg) : null;
  const wPts = t.days.filter((x) => x.weightKg).map((x) => ({ date: x.date, value: x.weightKg }));
  const points = reviewPoints(t, bnNum);
  // ১টা মাপে চার্ট অর্থহীন → মান-কার্ড; ২+ হলে চার্ট (ধাপ ২)
  const lastW = wPts.length ? wPts[wPts.length - 1].value : null;
  const gapKg = lastW !== null && targetKg ? Math.round(Math.abs(lastW - targetKg) * 10) / 10 : null;
  const weightValueCard = wPts.length === 1 && React.createElement("div", null,
    React.createElement("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" } },
      React.createElement("span", { style: { color: T.green, whiteSpace: "nowrap" } }, React.createElement("b", { style: { fontSize: "28px" } }, bnNum(lastW)), React.createElement("span", { style: { fontSize: "14px", color: T.muted, marginLeft: "4px" } }, "কেজি")),
      targetKg && React.createElement("span", { style: { fontSize: "13px", color: T.muted } }, "লক্ষ্য " + bnNum(targetKg))),
    React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginTop: "4px" } }, (gapKg !== null ? (gapKg < 0.1 ? "লক্ষ্য ওজনে আছেন · " : "আরও " + bnNum(gapKg) + " কেজি বাকি · ") : "") + "আরেকটা মাপ যোগ হলে চার্ট দেখা যাবে"));
  // মাত্র ১ দিনের ডেটা হলে গ্রাফ অর্থবহ নয় — বার্তা + "দৈনিক ইনপুট" বাটন
  const fewData = t.loggedDays <= 1;

  return React.createElement("div", null,
    fewData && React.createElement("div", { style: { ...CARD, background: "#E4F0E9", borderColor: "#9CC5B4" } },
      React.createElement("div", { style: { fontSize: "14px", color: T.green, fontWeight: 700 } }, "২ দিনের ডেটা দিলে গ্রাফ শুরু হবে"),
      onGoInput && React.createElement("button", { onClick: onGoInput, style: { marginTop: "8px", minHeight: "44px", padding: "0 16px", borderRadius: "12px", border: "1px solid " + T.green, background: T.surface, color: T.green, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "হোমে তথ্য দিন")),
    card("ওজন (কেজি)", "গত ৭ দিন", wPts.length === 1 ? weightValueCard : wPts.length ? React.createElement(TrendChart, { height: 110, unit: "কেজি", referenceRange: null, points: wPts, targetLine: targetKg ? { value: targetKg, label: "লক্ষ্য " + bnNum(targetKg) + " কেজি" } : null }) : none("এই সপ্তাহে ওজন দেওয়া হয়নি।")),
    // ক্যালরি ও ঘুম — এক লাইনে পাশাপাশি, আলাদা কার্ড (ক্যালরি-টার্গেট না থাকলে ঘুম পুরো প্রস্থে)
    React.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "stretch" } },
      calorieTarget && React.createElement("div", { style: { flex: 1, minWidth: 0, display: "flex" } },
        React.createElement("div", { style: { ...CARD, flex: 1, minWidth: 0 } },
          React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, "ক্যালরি"),
          React.createElement("div", { style: { fontSize: "12px", color: T.muted, margin: "1px 0 4px" } }, "লক্ষ্য " + bnNum(calorieTarget)),
          t.calDays ? React.createElement(TrendBars, { labels, values: t.days.map((x) => x.calories), target: calorieTarget, color: "#E0A100", width: 160 }) : none("মিল টিক দেওয়া হয়নি।"))),
      React.createElement("div", { style: { flex: 1, minWidth: 0, display: "flex" } },
        React.createElement("div", { style: { ...CARD, flex: 1, minWidth: 0 } },
          React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, "ঘুম (ঘণ্টা)"),
          React.createElement("div", { style: { fontSize: "12px", color: T.muted, margin: "1px 0 4px" } }, "লক্ষ্য " + bnNum(sMin) + "–" + bnNum(sMax)),
          t.sleepDays ? React.createElement(TrendBars, { labels, values: t.days.map((x) => x.sleepH), target: sMin, color: "#6B5BD2", width: 160 }) : none("ঘুমের তথ্য দেওয়া হয়নি।")))),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, margin: "-2px 0 8px" } }, "বিন্দু-রেখা = লক্ষ্য (ঘুমে সর্বনিম্ন)"),
    card("সাপ্তাহিক রিভিউ", "শুধু আপনার দেওয়া তথ্য থেকে",
      React.createElement("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } },
        points.map((p, i) => React.createElement("div", { key: "p" + i }, "• " + p)),
        reviewComment(t, bnNum).map((c, i) => React.createElement("div", { key: "c" + i, style: { marginTop: i === 0 ? "8px" : "4px" } }, c)))),
    React.createElement(Notice, null, "এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়। অস্বাভাবিক ওজন বা শরীর খারাপ হলে ডাক্তার দেখান।"));
}

// ভাঁজযোগ্য চিপ (মিল ও ব্যায়ামে একই) — panel/setPanel বাইরে থেকে
function FoldChip(id, text, badge, panel, setPanel) {
  return React.createElement("button", { key: id, onClick: () => setPanel(panel === id ? null : id), "aria-expanded": panel === id,
    style: { flex: 1, minWidth: 0, minHeight: "44px", display: "flex", alignItems: "center", gap: "6px", padding: "0 12px", borderRadius: "14px", border: "1px solid " + T.sandBorder, background: T.sand, color: T.ink, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left" } },
    React.createElement("span", { style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, text),
    badge && React.createElement("span", { style: { flexShrink: 0, minWidth: "20px", padding: "0 6px", borderRadius: "999px", background: "#E4F0E9", color: T.green, fontSize: "12px", textAlign: "center" } }, badge),
    React.createElement("span", { "aria-hidden": "true", style: { flexShrink: 0, fontSize: "12px", color: T.muted } }, panel === id ? "▲" : "▼"));
}

// ---------- মিল প্ল্যান — ধাপ A১/A২/A৩ ----------
// "কেন এই প্ল্যান?" + মিলের নিচে "আজ এড়িয়ে চলুন" (বিদ্যমান খাদ্য-নির্দেশিকা, compact; পূর্ণ তালিকা নথিপত্রে)।
function MealPlanTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const [panel, setPanel] = useState(null); // "why" | "gut" | null — মিল-ট্যাবের দুই ভাঁজযোগ্য চিপ
  const { goal, age, weightKg, heightCm, allergyTags, gate } = info;
  const common = { info, familyId, callerMemberId, memberId, onSaved };
  // পেটের লক্ষণ-লগ এখন প্ল্যানের আগে (খাবার বাছাইয়ের সুবিধা); গেট বন্ধ থাকলেও দেখায়
  const d = info.daily || {};
  const calc = !gate.blocked && goal && goal.calc ? goal.calc : null;
  const gutFoods = gutFoodCount(calc ? applyMealPrefs(buildMealPlan(calc.calorieTarget, allergyTags, goal.planPrefs), goal.planPrefs, allergyTags) : null, d.mealsEaten, sanitizeExtraFoods(d.extraFoods));
  const todayGut = entriesOn(info.gutEntries, todayISO());
  const latestGut = todayGut.length ? todayGut[todayGut.length - 1] : null;
  const foldChip = (id, text, badge) => FoldChip(id, text, badge, panel, setPanel);
  return React.createElement("div", null,
    React.createElement(React.Fragment, null,
      React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "8px" } },
        !gate.blocked && foldChip("why", "💡 কেন এই প্ল্যান?"),
        foldChip("gut", "🩺 পেটের লক্ষণ", latestGut ? bnNum(latestGut.score) : null)),
      panel === "why" && !gate.blocked && React.createElement(PlanWhyCard, { bare: true, lines: explainMeal({ goal, age, weightKg, heightCm, allergyTags }) }),
      panel === "gut" && React.createElement(GutLogCard, { bare: true, info, familyId, callerMemberId, memberId, gutFoods, onSaved }),
      React.createElement(MealTab, common),
      React.createElement("div", { style: { fontSize: "13px", color: T.muted, margin: "4px 0 0" } }, "তালিকা সদস্যের রোগ, অ্যালার্জি ও BMI থেকে স্বয়ংক্রিয়। খাবারে সন্দেহ থাকলে ডাক্তারকে জিজ্ঞেস করুন।"))
  );
}


// ---------- লক্ষ্য ও প্ল্যান (লক্ষ্য সেট করুন | মিল প্ল্যান | ব্যায়াম প্ল্যান) ----------
// লক্ষ্য না থাকলে প্রথমে "আমার লক্ষ্য", থাকলে "মিল প্ল্যান"।
function GoalPlanTab(props) {
  const [sub, setSub] = useState("goal"); // ট্র্যাকার নেভে ঢুকলে সবসময় "আমার লক্ষ্য"
  return React.createElement("div", null,
    Pills([["goal", "আমার লক্ষ্য"], ["meal", "মিল প্ল্যান"], ["exercise", "ব্যায়াম প্ল্যান"]], sub, setSub),
    sub === "goal" && React.createElement(GoalTab, props),
    sub === "meal" && React.createElement(MealPlanTab, props),
    sub === "exercise" && React.createElement(ExerciseTab, props));
}

// ---------- উপবাস-দিবস মোড + ব্যক্তিগত পানির লক্ষ্য (পার্ট ১০) ----------
// fastModeGate: ব্লক নয়, শুধু সতর্কতা (Approved Deviation ১০ নভেম্বর ২০২৬) — বয়স/রোগ-গ্রুপে ⚠ বার্তা, দিন-বাছাই সবার জন্য খোলা।
function FastWaterCard({ goal, age, flags, familyId, memberId, callerMemberId, onSaved }) {
  const g = goal || {};
  const gate = fastModeGate({ age, flags });
  const [days, setDays] = useState(() => sanitizeFastDays(g.fastDays));
  const [water, setWater] = useState(g.waterTarget ? String(g.waterTarget) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);
  const defaultWater = waterTargetFor(age, flags);
  const waterLocked = defaultWater === null; // কিডনি/<২ বছর: ওভাররাইড চলে না
  const toggle = (i) => { setOk(false); setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : d.length >= MAX_FAST_DAYS ? d : [...d, i].sort((a, b) => a - b))); };

  const submit = async () => {
    setErr(null); setOk(false);
    const fd = days;
    const e = checkFastDaysInput(fd, { age, flags }) || (waterLocked ? null : checkWaterTargetInput(water));
    if (e) { setErr(e); return; }
    setBusy(true);
    try {
      await saveGoalExtras(familyId, memberId, callerMemberId, { fastDays: fd, waterTarget: waterLocked ? null : water }, goal);
      setOk(true);
      await onSaved();
    } catch (x) {
      setErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x)));
    } finally { setBusy(false); }
  };

  return React.createElement("div", { style: CARD },
    React.createElement("b", null, "সিয়াম/ফাস্টিং ও পানির লক্ষ্য (ঐচ্ছিক)"),
    React.createElement("div", null,
      gate.warn && React.createElement("div", { style: { marginTop: "8px" } }, React.createElement(Notice, null, gate.reason)),
        React.createElement("label", { style: LABEL }, "সিয়াম/ফাস্টিং-এর দিন (সর্বোচ্চ " + bnNum(MAX_FAST_DAYS) + "টি)"),
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
          DAY_LABELS.map((lbl, i) => React.createElement("button", {
            key: i, onClick: () => toggle(i), "aria-pressed": days.includes(i), disabled: busy,
            style: { minHeight: "44px", padding: "8px 12px", borderRadius: "999px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, border: "1px solid " + T.green, background: days.includes(i) ? T.green : "#fff", color: days.includes(i) ? "#fff" : T.green },
          }, lbl))),
        React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "6px", lineHeight: 1.5 } }, "সিয়াম/ফাস্টিং-এর দিনে ক্যালরি-টার্গেট স্থগিত থাকে। শরীর খারাপ লাগলে সিয়াম/ফাস্টিং ভাঙুন ও ডাক্তারের পরামর্শ নিন।")),
    !waterLocked && React.createElement("div", null,
      React.createElement("label", { style: LABEL }, "পানির লক্ষ্য (গ্লাস/দিন) — খালি রাখলে সাধারণ গাইড: " + bnNum(defaultWater)),
      React.createElement("input", { type: "number", inputMode: "numeric", min: 1, max: 20, value: water, placeholder: String(defaultWater), onChange: (e) => { setWater(e.target.value); setOk(false); }, style: INPUT }),
      React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "6px" } }, "ডাক্তার/ডায়েটিশিয়ান আলাদা পরিমাণ বললে সেটা দিন। সাধারণ গাইড চিকিৎসা পরামর্শ নয়।")),
    waterLocked && React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginTop: "8px" } }, "এই ক্ষেত্রে পানির পরিমাণ ডাক্তার ঠিক করেন — তাই লক্ষ্য দেওয়া যায় না।"),
    err && ErrorBox(err),
    ok && React.createElement(Notice, { tone: "info" }, "সংরক্ষিত হয়েছে ✓"),
    PrimaryButton("সংরক্ষণ", submit, busy));
}

const WEEK_CHOICES = [4, 8, 12, 20];
const GOAL_HINTS = { lose: "ধীরে ও নিরাপদে ওজন কমানো", gain: "ধীরে ও সুস্থভাবে ওজন বাড়ানো", fit: "এখনকার ওজন ও সুস্থতা ধরে রাখা", muscle: "ব্যায়ামের সাথে শক্তি ও পেশি বাড়ানো" };
// ACTIVITY_LABELS-এর মান (low/medium/high) অপরিবর্তিত; শুধু বোঝানোর লেখা
const ACTIVITY_CHOICES = { low: ["বসে কাজ বেশি", "অফিস/বাসায় বসে বা হালকা চলাফেরা"], medium: ["মাঝারি চলাফেরা", "সারাদিন কিছু হাঁটাহাঁটি/ঘরের কাজ"], high: ["অনেক পরিশ্রম", "সারাদিন দাঁড়িয়ে/হেঁটে বা কায়িক কাজ"] };

// ---------- লক্ষ্য ----------
function GoalTab({ info, familyId, callerMemberId, memberId, onSaved }) {
  const { goal, age, member, heightCm, weightKg, detected } = info;
  const pregnant = !!(info.flags && info.flags.pregnant); // প্রোফাইল থেকে (ধাপ ৬) — এখানে আর আলাদা টগল নেই
  const g = goal || {};
  const [goalType, setGoalType] = useState(g.goalType || "");
  const [activity, setActivity] = useState(g.activity || "medium");
  const [target, setTarget] = useState(g.targetWeightKg ? String(g.targetWeightKg) : "");
  const [weeks, setWeeks] = useState(g.weeks ? String(g.weeks) : "");
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

  // টিক-কার্ড: পুরো কার্ড ট্যাপযোগ্য; প্রোফাইল থেকে ধরা পড়লে লক
  const tile = (label, val, setter, locked) => React.createElement("button", { role: "checkbox", "aria-checked": !!val, disabled: locked, onClick: () => setter(!val),
    style: { flex: "1 1 120px", minWidth: 0, minHeight: "56px", display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "14px", textAlign: "left", fontFamily: "inherit", cursor: locked ? "default" : "pointer",
      border: "1px solid " + (val ? "#9CC5B4" : T.border), background: val ? "#E4F0E9" : T.surface, color: T.ink, boxShadow: "0 2px 8px rgba(14,75,67,0.06)" } },
    React.createElement("span", { "aria-hidden": "true", style: { width: "20px", height: "20px", boxSizing: "border-box", flexShrink: 0, borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, lineHeight: 1, border: "2px solid " + T.green, background: val ? T.green : "#fff", color: "#fff" } }, val ? "✓" : ""),
    React.createElement("span", { style: { minWidth: 0, fontSize: "14px", fontWeight: 600, lineHeight: 1.3 } }, label,
      locked && React.createElement("span", { style: { display: "block", fontSize: "12px", fontWeight: 400, color: T.muted } }, "প্রোফাইল থেকে")));
  // ধাপ-কার্ড: ক্রমিক নম্বর + প্রশ্ন + উত্তর-ঘর
  const stepCard = (n, title, ...kids) => React.createElement("div", { style: CARD },
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } },
      React.createElement("span", { "aria-hidden": "true", style: { width: "24px", height: "24px", borderRadius: "50%", background: T.green, color: "#fff", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, n),
      React.createElement("b", { style: { fontSize: "15px", color: T.ink } }, title)),
    ...kids);
  const HINT = { fontSize: "12px", color: T.muted, marginTop: "6px", lineHeight: 1.5 };
  // সপ্তাহে কত কেজি — শুধু দেখানোর হিসাব; আসল হিসাব/গেট computeGoal-এ অপরিবর্তিত
  const paceText = (() => {
    const tw = parseFloat(target), wk = parseFloat(weeks);
    if (!weightKg || !(tw > 0) || !(wk > 0)) return null;
    const rate = Math.abs(weightKg - tw) / wk; const r = bnNum(Math.round(rate * 100) / 100);
    if (goalType === "lose" && tw >= weightKg) return { ok: false, text: "লক্ষ্য ওজন এখনকার ওজনের চেয়ে কম হতে হবে।" };
    if (goalType === "gain" && tw <= weightKg) return { ok: false, text: "লক্ষ্য ওজন এখনকার ওজনের চেয়ে বেশি হতে হবে।" };
    const max = goalType === "lose" ? 0.5 : 0.25;
    return rate <= max ? { ok: true, text: "সপ্তাহে প্রায় " + r + " কেজি — নিরাপদ গতি ✓" } : { ok: false, text: "সপ্তাহে প্রায় " + r + " কেজি — একটু দ্রুত; সময় বাড়ান।" };
  })();

  return React.createElement("div", null,
    React.createElement("div", { style: CARD },
      React.createElement("b", null, "প্রোফাইল থেকে"),
      React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginTop: "4px" } },
        (age !== null ? bnNum(age) + " বছর" : "বয়স নেই") + " · " + (heightCm ? "উচ্চতা " + bnNum(heightCm) + " সেমি" : "উচ্চতা নেই") + " · " + (weightKg ? "ওজন " + bnNum(weightKg) + " কেজি" : "ওজন নেই") + (bmi ? " · BMI " + bnNum(Math.round(bmi * 10) / 10) : "")),
      (!heightCm || !weightKg) && React.createElement("div", { style: { fontSize: "13px", color: "#7A5B00", marginTop: "6px" } }, "হিসাবের জন্য Health → স্বাস্থ্য প্রোফাইলে উচ্চতা ও ওজন যোগ করুন।")),
    gate.blocked
      ? React.createElement(Notice, null, React.createElement("b", null, "ক্যালরি-টার্গেটের জন্য তথ্য লাগবে"), React.createElement("br"), gate.reason, React.createElement("br"), "পানি, ব্যায়াম ও ঘুম ট্র্যাক করা যাবে।")
      : React.createElement("div", null,
        gate.warn && React.createElement(Notice, null, gate.reason),
        stepCard("১", "আপনার লক্ষ্য কী?",
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" } },
            Object.entries(GOAL_LABELS).map(([id, lbl]) => { const on = id === goalType; return React.createElement("button", { key: id, onClick: () => setGoalType(id), "aria-pressed": on,
              style: { minHeight: "44px", borderRadius: "999px", cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 600, border: on ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA", background: on ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "#fff", color: on ? "#fff" : "#2B3A36" } }, lbl); })),
          goalType && React.createElement("div", { style: HINT }, GOAL_HINTS[goalType])),
        needsTarget && stepCard("২", "কত কেজিতে যেতে চান?",
          React.createElement("input", { type: "number", inputMode: "decimal", step: "0.1", placeholder: "লক্ষ্য ওজন (কেজি)", "aria-label": "লক্ষ্য ওজন (কেজি)", value: target, onChange: (e) => setTarget(e.target.value), style: INPUT }),
          React.createElement("div", { style: HINT }, weightKg ? "এখন আপনার ওজন " + bnNum(weightKg) + " কেজি" : "আগে Health ▸ প্রোফাইলে ওজন যোগ করুন")),
        needsTarget && stepCard("৩", "কত সপ্তাহে?",
          React.createElement("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
            WEEK_CHOICES.map((w) => { const on = String(w) === String(weeks); return React.createElement("button", { key: w, onClick: () => setWeeks(String(w)), "aria-pressed": on,
              style: { flex: "1 1 60px", minHeight: "44px", borderRadius: "999px", cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 600, border: on ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA", background: on ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "#fff", color: on ? "#fff" : "#2B3A36" } }, bnNum(w) + " সপ্তাহ"); })),
          React.createElement("input", { type: "number", inputMode: "numeric", placeholder: "অন্য সংখ্যা লিখুন", "aria-label": "কত সপ্তাহে", value: weeks, onChange: (e) => setWeeks(e.target.value), style: { ...INPUT, marginTop: "8px" } }),
          paceText && React.createElement("div", { style: { ...HINT, color: paceText.ok ? T.green : "#7A5B00", fontWeight: 600 } }, paceText.text)),
        stepCard(needsTarget ? "৪" : "২", "দৈনিক কাজকর্ম কেমন?",
          React.createElement("div", { style: { display: "grid", gap: "6px" } },
            Object.entries(ACTIVITY_CHOICES).map(([v, [name, eg]]) => { const on = v === activity; return React.createElement("button", { key: v, onClick: () => setActivity(v), "aria-pressed": on,
              style: { minHeight: "48px", borderRadius: "14px", textAlign: "left", padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", border: on ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA", background: on ? "#E4F0E9" : "#fff", color: T.ink } },
              React.createElement("b", { style: { fontSize: "14px" } }, (on ? "● " : "○ ") + name), React.createElement("span", { style: { display: "block", fontSize: "12px", color: T.muted } }, eg)); })))),
    stepCard(needsTarget ? "৫" : "৩", "স্বাস্থ্য-নিরাপত্তা",
      React.createElement("div", { style: { fontSize: "13px", color: T.muted, marginBottom: "6px" } }, "ডায়াবেটিস বা কিডনি রোগ আছে? (ওজন কমানোর নিরাপদ সীমা ঠিক করতে লাগে)"),
      React.createElement("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
        tile("ডায়াবেটিস", diabetes || detected.diabetes, setDiabetes, detected.diabetes),
        tile("কিডনি রোগ", kidney || detected.kidney, setKidney, detected.kidney))),
    pregnant && React.createElement(Notice, { tone: "info" }, "🤰 গর্ভাবস্থা/বুকের দুধ — প্রোফাইল থেকে নেওয়া হয়েছে। বদলাতে: Health ▸ প্রোফাইল।"),
    !pregnant && showPregnant && React.createElement("div", { style: { fontSize: "13px", color: T.muted, margin: "0 2px 8px" } }, "গর্ভবতী বা বুকের দুধ খাওয়ালে Health ▸ প্রোফাইলে একবার জানান — এখানে নিজে থেকে ধরা পড়বে।"),
    React.createElement("details", { style: { marginBottom: "8px" } },
      React.createElement("summary", { style: { cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700, color: T.green } }, "⚙ আরও সেটিং (ঐচ্ছিক) — সিয়াম/ফাস্টিং, পানির লক্ষ্য"),
      React.createElement(FastWaterCard, { goal, age, flags, familyId, memberId, callerMemberId, onSaved })),
    err && ErrorBox(err),
    result && result.blocked && React.createElement(Notice, null, result.reason),
    result && !result.blocked && React.createElement(Notice, { tone: "info" },
      "দৈনিক টার্গেট: ", React.createElement("b", null, bnNum(result.calorieTarget) + " কিলোক্যালরি"),
      result.weeklyRateKg ? " · প্রতি সপ্তাহে প্রায় " + bnNum(result.weeklyRateKg) + " কেজি" : "",
      result.notes.map((n, i) => React.createElement("div", { key: i, style: { marginTop: "6px" } }, n))),
    PrimaryButton(gate.blocked ? "সংরক্ষণ" : "প্ল্যান বানান", submit, busy)
  );
}

// ---------- মূল পেজ ----------
// টপ-বারে প্রোফাইল-চিপ নেই; নির্বাচিত সদস্য ডিফল্টে নিজে (app.js), মেনু-পেজের চিপ থেকে বদলানো যায়।
export function TrackerPageSection({ familyId, callerMemberId, selectedMemberId, members, topOffsetPx, mode = "plan", onGoHome }) {
  // mode "today" = হোম ট্যাব (আজ পেজ, পিল নেই); "plan" = ট্র্যাকার ট্যাব (লক্ষ্য ও প্ল্যান | ট্রেন্ড | রিমাইন্ডার)
  const isToday = mode === "today";
  const [tab, setTab] = useState(isToday ? "today" : "plan");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const topPx = (topOffsetPx == null ? 44 : topOffsetPx) + "px";

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
      const allergies = recs.filter((r) => r.resourceType === "allergy" && r.substance && String(r.substance).trim()).map((r) => String(r.substance).trim());
      const conds = recs.filter((r) => r.resourceType === "condition" && r.status !== "resolved" && r.name && String(r.name).trim()).map((r) => ({ name: String(r.name).trim(), status: r.status }));
      const member = (members || []).find((m) => m.id === selectedMemberId) || null;
      const h = recs.find((r) => isType(r, ["height", "উচ্চতা"]));
      const w = recs.find((r) => isType(r, ["weight", "ওজন"]));
      const num = (r) => { const n = r ? parseFloat(r.value) : NaN; return Number.isNaN(n) ? null : n; };
      const detected = detectFlagsFromConditions(recs);
      const age = member ? ageYears(member.dob) : null;
      const flags = {
        pregnant: effectivePregnant(goal, recs),
        diabetes: !!(goal && goal.flags && goal.flags.diabetes) || detected.diabetes,
        kidney: !!(goal && goal.flags && goal.flags.kidney) || detected.kidney,
      };
      const weightKg = (daily && daily.weightKg) || num(w);
      setData({ allergies, conds, condKeys: conditionKeysOf(recs), weekMin, recent, activeMeds: activeMedNames(recs), gutEntries: gutEntries(recs), fastDays: activeFastDays(goal, { age, flags }), allergyTags, member, goal, daily, age, flags, detected, heightCm: num(h), weightKg, latestWeight: num(w), gate: safetyGate({ age, flags }) });
    } catch (e) {
      setData(null);
      setErr(e.code === "permission-denied" ? "এই সদস্যের ট্র্যাকার দেখার অনুমতি আপনার নেই।" : (e.message || String(e)));
    }
  }, [familyId, selectedMemberId, members]);

  useEffect(() => { setData(null); load(); }, [load]);

  const tabs = [["plan", "লক্ষ্য ও প্ল্যান"], ["trend", "ট্রেন্ড"], ["reminder", "রিমাইন্ডার"]];
  return React.createElement("div", { className: "hs-page", style: { position: "fixed", top: topPx, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement("style", null, PILL_CSS),
    !isToday && React.createElement("div", { style: { padding: "8px 12px 0", flexShrink: 0 } }, Pills(tabs, tab, setTab)),
    React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: isToday ? "8px 12px 88px" : "0 12px 16px" } }, // হোমে নিচে বাড়তি ফাঁকা: ভাসমান + বাটন শেষ কার্ডের উপর না পড়ে
      err && ErrorBox(err),
      (!selectedMemberId || (!data && !err)) && Skeleton(3, 88),
      data && isToday && React.createElement(TodayTab, { key: selectedMemberId, info: data, familyId, callerMemberId, memberId: selectedMemberId, onSaved: load,
        homeExtra: React.createElement(TodaySummary, { key: "meds-" + selectedMemberId, onlyMeds: true, familyId, callerMemberId, selectedMemberId }) }),
      // key: সদস্য বদলালে ফর্মের state নতুন করে শুরু হয়
      data && !isToday && tab === "plan" && React.createElement(GoalPlanTab, { key: selectedMemberId, info: data, familyId, callerMemberId, memberId: selectedMemberId, onSaved: load }),
      data && !isToday && tab === "trend" && React.createElement(TrendTab, { key: selectedMemberId, info: data, familyId, memberId: selectedMemberId, onGoInput: onGoHome }),
      data && !isToday && tab === "reminder" && React.createElement(ReminderSettings, { key: selectedMemberId, info: data, familyId, memberId: selectedMemberId, callerMemberId, onSaved: load })
    )
  );
}
