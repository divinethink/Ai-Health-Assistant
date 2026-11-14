// "আজ" ট্যাব (ধাপ C) — হিরো (ক্যালরি রিং + আজকের হিসাব), পানি ও খাবার, সাপ্তাহিক সারাংশ। শুধু UI;
// হিসাব todaySummary.js/trackerCalc.js-এ, লেখা saveDaily দিয়ে (নির্দিষ্ট ডক-ID, set+merge)।
// তারিখ-নেভিগেশন: হিরোর "📅" বাটন / সপ্তাহের বৃত্ত / সোয়াইপ — যেকোনো পুরনো দিন (dateNav.js); গত ৩০ দিনের বাইরের দিনের ডক আলাদা লোড (শেষ না হওয়া পর্যন্ত লেখা বন্ধ); আজ ছাড়া অন্য দিনেও একই সেভ-পথ।

import { ErrorBox } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { saveDaily, todayISO, getDaily, getMonthDaily } from "./trackerData.js";
import { macroTargets } from "./macroTargets.js";
import { weekDatesISO } from "./exercisePlanData.js";
import { GOAL_LABELS, sleepTargetHours, exerciseTargetMinPerDay, stepsTarget, waterTargetFor, isFastDate, fastModeGate, bmiOf } from "./trackerCalc.js";
import { Icon } from "../../shared/icons.js";
import { T, GRADIENT_HERO, CARD_STYLE, HOME_CARD, MAX_WATER, SLOT_TINT, SLOT_LINE } from "./trackerTheme.js";
import { ringDash, pctOf, weekSummary, last30DatesISO } from "./todaySummary.js";
import { buildMealPlan, FOODS } from "./mealPlanData.js";
import { foodStatus, STATUS_COLORS } from "./foodStatus.js";
import { fastOnDate, slotsForDay, fastDefaultSlot } from "./fastDay.js";
import { applyMealPrefs, caloriesForDay, sanitizeExtraFoods, sanitizeExerciseLog, checkExerciseLog, recentExerciseEntries, EXERCISE_TYPES } from "./planPrefs.js";
import { entryAmountText, fmtMacro, sumNutrition, slotBudgets, recentFoodEntries, tickedPlanEntries } from "./foodCalc.js";
import { FoodLogSheet } from "./FoodLogSheet.js";
import { ExerciseLogSheet, Sheet } from "./PlanEditSheets.js";
import { DietGuidanceSection } from "../nutrition-fitness/DietGuidanceSection.js";
import { DailyInputSheet } from "./DailyInputSheet.js";
import { GutLogCard } from "./GutLogCard.js";
import { entriesOn, gutFoodCount } from "./gutLog.js";
import { TodayDateSheet } from "./TodayDateSheet.js";
import { shiftISO, inRange, clampISO, swipeDelta, hasDayRecord } from "./dateNav.js";
import { useAppDesign } from "../../legacy/appDesign.js";
import { renderLayoutCards } from "../../shared/LayoutCards.js";

const { useState, useEffect, useRef } = React;
import { takeQuickIntent, peekQuickIntent } from "../../shared/quickIntent.js";

let keepSel = { memberId: null, date: null }; // ⊕ দ্রুত-যোগের রিমাউন্টে বাছা তারিখ রাখার জন্য (শুধু মেমোরিতে)

const SHORT_DAYS = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];

function Notice({ children, tone }) {
  const warn = tone !== "info";
  return React.createElement("div", { style: { ...CARD_STYLE, background: warn ? "#FFF6DD" : "#E4F0E9", borderColor: warn ? "#E8D08A" : "#9CC5B4", color: warn ? "#7A5B00" : T.green, fontSize: "14px", lineHeight: 1.5 } }, children);
}

// SVG রিং — ১২ o'clock থেকে ঘড়ির কাঁটার দিকে ভরে
function Ring({ pct, size, stroke, color, track, children, label, redFrom }) {
  const r = (size - stroke) / 2;
  const { circ, dash } = ringDash(pct, r);
  // redFrom (০–১০০): টার্গেট ছাড়ালে রিংয়ের শেষ অংশ লাল (সম্পূর্ণ রিং = মোট খাওয়া; অ্যাম্বার = টার্গেট পর্যন্ত)
  const over = typeof redFrom === "number" && redFrom > 0 && redFrom < 100;
  const cap = over ? "butt" : "round";
  return React.createElement("div", { style: { position: "relative", width: size + "px", height: size + "px", flexShrink: 0 }, role: "img", "aria-label": label },
    React.createElement("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size, style: { transform: "rotate(-90deg)" }, "aria-hidden": "true" },
      React.createElement("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: track, strokeWidth: stroke }),
      dash > 0 && React.createElement("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: cap, strokeDasharray: dash + " " + circ }),
      over && React.createElement("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "#FF6A4D", strokeWidth: stroke, strokeLinecap: "butt", strokeDasharray: ringDash(100 - redFrom, r).dash + " " + circ, strokeDashoffset: -(circ * redFrom / 100) })),
    React.createElement("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" } }, children));
}

// ধাপ ৩: ট্যাপ করলে ইনপুট-শিট খোলে (role=button); ডানকোণে ছোট ＋ হিন্ট।
function MiniRing({ value, pct, color, caption, label, onTap, empty, icon }) { // empty: আজ এখনো কিছু নেই → ০% নয়, রঙিন আইকন + "লক্ষ্য …" (কার্ড মৃত দেখায় না)
  const key = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } };
  return React.createElement("div", { role: "button", tabIndex: 0, "aria-label": label + " যোগ/বদলান", onClick: onTap, onKeyDown: key,
    style: { ...HOME_CARD, position: "relative", flex: 1, minWidth: 0, marginBottom: 0, padding: "9px 4px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" } },
    React.createElement("span", { "aria-hidden": "true", style: { position: "absolute", top: "7px", right: "7px", width: "22px", height: "22px", borderRadius: "50%", background: T.track, color: T.green, display: "flex", alignItems: "center", justifyContent: "center" } }, Icon("plus", { size: 14, stroke: 2.4 })),
    React.createElement(Ring, { pct: empty ? 0 : pct, size: 50, stroke: 6, color, track: color + "33", label },
      empty
        ? Icon(icon, { size: 20, color })
        : React.createElement("span", { style: { fontSize: "12px", fontWeight: 700, color: T.ink } }, bnNum(Math.round(Math.min(pct, 999))) + "%")),
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: T.ink, textAlign: "center", lineHeight: 1.25 } }, empty ? label : value),
    React.createElement("div", { style: { fontSize: "12px", color: T.muted, textAlign: "center", lineHeight: 1.3, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, caption));
}

// হোমের উপরের সতর্ক-সারি: এলার্জি (লাল) + চলমান অসুস্থতা। এলার্জি-রেকর্ড না থাকলে "নেই" বা সবুজ নয়,
// শুধু "তথ্য দেওয়া হয়নি" — যাতে "নেই" মানে "নিরাপদ" মনে না হয় (safe-default)।
function AlertStrip({ allergies, conds, onDiet }) { // onDiet: রোগ থাকলে "ট্রিগার খাবার দেখুন ›" বাটন (নিচ থেকে শিট; নতুন ডেটা নেই)
  if (!allergies.length && !conds.length) return null; // কিছু না থাকলে সারিই নেই; রেকর্ড দিলে অটো আসবে
  const chip = (key, content, bg, fg) => React.createElement("span", { key, style: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "999px", background: bg, color: fg, fontSize: "14px", fontWeight: 700 } }, content);
  const shown = conds.slice(0, 3);
  return React.createElement("div", { style: { padding: "0 4px", marginBottom: "6px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }, "aria-label": "অ্যালার্জি ও চলমান অসুস্থতা" },
    allergies.length
      ? chip("al", "⚠️ অ্যালার্জি: " + allergies.join(", "), "#FDECEA", "#A32018")
      : null,
    shown.map((c, i) => chip("c" + i, [Icon("health", { key: "i", size: 16 }), c.name], "var(--hs-chip-bg, #E4F0E9)", T.green)),
    conds.length > shown.length && React.createElement("span", { style: { fontSize: "13px", color: T.muted } }, "+" + bnNum(conds.length - shown.length) + "টি"),
    conds.length > 0 && onDiet && React.createElement("button", { type: "button", onClick: onDiet, "aria-label": "রোগ অনুযায়ী ট্রিগার ও এড়ানোর খাবার দেখুন",
      style: { marginLeft: "auto", minHeight: "36px", padding: "0 6px", border: "none", background: "none", color: T.green, fontSize: "14px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" } }, "ট্রিগার খাবার দেখুন ›"));
}

export function TodayTab({ info, familyId, callerMemberId, memberId, onSaved: onSavedProp, homeExtra, onOpenTrend }) {
  const { daily, goal, age, flags, gate, recent } = info;
  const fastDays = info.fastDays || []; // সেফটি-গেট প্রয়োগের পর (activeFastDays)
  // নির্বাচিত দিন (ডিফল্ট আজ)। পরিসীমা গত ৩০ দিন = `recent`-এ লোড-করা ডক; আজকের ডক `daily`।
  const today = todayISO();
  // ⊕ দ্রুত-যোগে পেজ নতুন করে আঁকা হয় — তখন বাছা তারিখ ধরে রাখি (নইলে গতকালের বদলে আজকে লেখা হতো)
  const [selDate, setSelDate] = useState(() => (peekQuickIntent(["weight", "sleep", "food", "water"]) && keepSel.memberId === memberId && keepSel.date && inRange(keepSel.date, today) ? keepSel.date : today));
  useEffect(() => { keepSel = { memberId, date: selDate }; }, [memberId, selDate]);
  const [weekInfo, setWeekInfo] = useState(false);
  const [editIdx, setEditIdx] = useState(null); // খাবার-লগে ট্যাপ করে এডিট: extras-এর index
  const [dietOpen, setDietOpen] = useState(false);
  const [gutOpen, setGutOpen] = useState(false);
  const viewDate = clampISO(selDate, today);
  const isViewToday = viewDate === today;
  // গত ৩০ দিন = `recent`-এ লোড-করা; তার আগের দিন আলাদা getDaily (একই equality-query, নতুন index নয়)
  const inWindow = viewDate >= last30DatesISO()[0];
  const [old, setOld] = useState({ date: null, doc: null, loading: false, err: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (inWindow) return undefined;
    let dead = false;
    setOld({ date: viewDate, doc: null, loading: true, err: null });
    getDaily(familyId, memberId, viewDate)
      .then((doc) => { if (!dead) setOld({ date: viewDate, doc, loading: false, err: null }); })
      .catch(() => { if (!dead) setOld({ date: viewDate, doc: null, loading: false, err: "এই দিনের তথ্য লোড হয়নি।" }); });
    return () => { dead = true; };
  }, [viewDate, inWindow, familyId, memberId, retry]);
  // পুরনো দিনের ডক পুরোপুরি লোড না হওয়া পর্যন্ত লেখা বন্ধ (ভুল মান/ডেটা-নষ্ট এড়াতে)
  const oldReady = inWindow || (old.date === viewDate && !old.loading && !old.err);
  const onSaved = async () => {
    await onSavedProp();
    if (!inWindow) { try { setOld({ date: viewDate, doc: await getDaily(familyId, memberId, viewDate), loading: false, err: null }); } catch (_e) { setOld({ date: viewDate, doc: null, loading: false, err: "এই দিনের তথ্য লোড হয়নি।" }); } }
  };
  const dayDoc = isViewToday ? daily : inWindow ? ((info.recent || []).find((x) => x && x.date === viewDate) || null) : (old.date === viewDate ? old.doc : null);
  const d = dayDoc || {};
  const calc = !gate.blocked && goal && goal.calc ? goal.calc : null;
  const [sMin, sMax] = sleepTargetHours(age);
  const exTarget = exerciseTargetMinPerDay(age);
  const stTarget = stepsTarget(age);
  const waterTarget = waterTargetFor(age, flags, goal && goal.waterTarget);
  const ctx = { calorieTarget: calc ? calc.calorieTarget : null, exTarget, waterTarget, sleepMinH: sMin, fastDays };
  // পরিকল্পিত সিয়ামের দিন বনাম বাস্তব: দিনের বেলার খাবার লগ হলে onFast=false (fastDay.js)। সতর্কতা সবার জন্য খোলা (Approved Deviation)।
  const plannedFast = isFastDate(viewDate, fastDays);
  const onFast = fastOnDate(viewDate, fastDays, dayDoc);
  const fastWarn = plannedFast && fastModeGate({ age, flags }).warn;
  const week = weekSummary(recent, weekDatesISO(), today, ctx);
  const [busyS, setBusy] = useState(false);
  const busy = busyS || !oldReady;
  const [err, setErr] = useState(null);
  const [foodOpen, setFoodOpen] = useState(false);
  const [foodSlot, setFoodSlot] = useState(null); // বেলার "＋" থেকে খুললে সেই বেলা আগে থেকে বাছা
  const [foodErr, setFoodErr] = useState(null);
  const fmtH = (m) => bnNum(Math.floor(m / 60)) + " ঘ. " + bnNum(m % 60) + " মি.";

  // পানি: ট্যাপে সংখ্যা সাথে সাথে বাড়ে (স্থানীয় মান); সেভ পরে একটাই absolute লেখায় (০.৫ সেকেন্ড থামলে)। ধারাবাহিক লেখা — একসাথে দুটো নয়।
  const [wLocal, setWLocal] = useState(null);
  const wWant = useRef(null), wTimer = useRef(null), wSaving = useRef(false), wDate = useRef(viewDate), wDoc = useRef(dayDoc);
  wDoc.current = dayDoc;
  useEffect(() => { // দিন বদলালে অপেক্ষমাণ টোকা বাতিল (ভুল দিনে লেখা এড়াতে)
    if (wDate.current !== viewDate) { clearTimeout(wTimer.current); wWant.current = null; wDate.current = viewDate; setWLocal(null); }
  }, [viewDate]);
  useEffect(() => () => clearTimeout(wTimer.current), []);
  const flushWater = async () => {
    if (wSaving.current) return;
    wSaving.current = true;
    try {
      while (wWant.current !== null) {
        const v = wWant.current; wWant.current = null;
        try { await saveDaily(familyId, memberId, callerMemberId, wDate.current, { waterGlasses: v }, wDoc.current); await onSaved(); }
        catch (x) { wWant.current = null; setErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x))); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } }
      }
    } finally { wSaving.current = false; if (wWant.current === null) setWLocal(null); }
  };
  const setWater = (next) => {
    if (!oldReady || next < 0 || next > MAX_WATER) return;
    setErr(null); setWLocal(next); wWant.current = next;
    clearTimeout(wTimer.current);
    wTimer.current = setTimeout(flushWater, 500);
  };

  // ধাপ ২: খাবার-লগ (extraFoods) — ক্যালরি-টার্গেট চালু থাকলে (গেট-ব্লকে নয়; সিয়ামের দিনেও চালু)। caloriesIn = প্ল্যানের টিক + নিজে-যোগ-করা (MealTab-এর একই সূত্র)।
  const extras = sanitizeExtraFoods(d.extraFoods);
  const canLog = !!calc;
  const mt = calc && !onFast ? macroTargets({ kcal: calc.calorieTarget, age, weightKg: info.weightKg, flags }) : null; // টার্গেট/সর্বোচ্চ সীমা (ক্যালরি-টার্গেট থেকে হিসাব, সংরক্ষণ হয় না)
  const plan = canLog ? applyMealPrefs(buildMealPlan(calc.calorieTarget, info.allergyTags, goal.planPrefs, { flags: info.flags, condKeys: info.condKeys }), goal.planPrefs, info.allergyTags) : null;
  const eatenIds = Array.isArray(d.mealsEaten) ? d.mealsEaten : [];
  const macros = sumNutrition([...extras, ...tickedPlanEntries(plan, eatenIds)]); // নিজে-যোগ-করা + টিক-করা প্ল্যান — ক্যালরি-রিংয়ের একই উৎস
  const budgetTarget = calc && !onFast ? calc.calorieTarget : null; // সিয়ামের দিনে টার্গেট স্থগিত → আগের প্ল্যান-ভিত্তিক সংখ্যা
  const budgets = plan ? slotBudgets(plan, eatenIds, extras, budgetTarget) : {};
  const writeExtras = async (next) => {
    if (busy || !plan) return false;
    setFoodErr(null); setBusy(true);
    try { await saveDaily(familyId, memberId, callerMemberId, viewDate, { extraFoods: next, caloriesIn: caloriesForDay(plan, eatenIds, next) }, dayDoc); await onSaved(); return true; }
    catch (x) { setFoodErr(x.code === "permission-denied" ? "এই সদস্যের তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x))); try { await onSaved(); } catch (_e) { /* রিফ্রেশ ব্যর্থ — মূল ত্রুটিই দেখানো হচ্ছে */ } return false; }
    finally { setBusy(false); }
  };
  const openFood = (slotId) => { setFoodErr(null); setEditIdx(null); setFoodSlot(typeof slotId === "string" ? slotId : null); setFoodOpen(true); };
  const openEdit = (idx) => { if (busy || !extras[idx]) return; setFoodErr(null); setEditIdx(idx); setFoodSlot(extras[idx].slot); setFoodOpen(true); };
  const closeFood = () => { setFoodErr(null); setEditIdx(null); setFoodOpen(false); };

  // ধাপ ৩: ব্যায়াম/ঘুম/স্টেপ/ওজন শিট। saveDaily একই (নির্দিষ্ট ডক-ID + merge); busy লক = double-tap নিরাপদ।
  const [wFlash, setWFlash] = useState(false);
  const [inKind, setInKind] = useState(null); // "exercise" | "sleep" | "steps" | "weight" | null
  const [inErr, setInErr] = useState(null);
  const openIn = (k) => { setInErr(null); setInKind(k); };
  // "+ দ্রুত যোগ" থেকে এলে বিদ্যমান ফর্ম/শিট খোলা (ধাপ ৯); নতুন কোনো লেখার পথ নয়
  useEffect(() => {
    const k = takeQuickIntent(["weight", "sleep", "food", "water"]);
    if (k === "food") openFood();
    else if (k === "water") { if (waterTarget) { setWater(glasses + 1); setWFlash(true); setTimeout(() => setWFlash(false), 1800); } } // "＋ → পানি": বিদ্যমান ＋১ গ্লাস পথেই; কার্ড কিছুক্ষণ নীল বর্ডারে
    else if (k) openIn(k);
    // eslint-disable-next-line
  }, []);
  const closeIn = () => { setInErr(null); setInKind(null); };
  const exLog = sanitizeExerciseLog(d.exerciseLog);
  const writeIn = async (fields, closeAfter) => {
    if (busy) return;
    setInErr(null); setBusy(true);
    try { await saveDaily(familyId, memberId, callerMemberId, viewDate, fields, dayDoc); await onSaved(); if (closeAfter) setInKind(null); }
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

  // তারিখ-নেভিগেশন: ক্যালেন্ডার-শিট, সোয়াইপ। শিট খোলা থাকলে সোয়াইপ বন্ধ (ইনপুটে টান দিয়ে দিন বদলে না যায়)।
  const [calOpen, setCalOpen] = useState(false);
  const touch = useRef(null);
  const pickDay = (iso) => { if (inRange(iso, today)) { setSelDate(iso); setEditIdx(null); setFoodOpen(false); setInKind(null); setCalOpen(false); } };
  const goDay = (n) => pickDay(shiftISO(viewDate, n));
  const swipeOk = !(foodOpen || inKind || calOpen);
  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    const blocked = !swipeOk || !t || e.touches.length !== 1 || (e.target && e.target.closest && e.target.closest("input,textarea,select,[role=dialog]"));
    touch.current = blocked ? null : { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const s0 = touch.current; touch.current = null;
    const t = e.changedTouches && e.changedTouches[0];
    if (!s0 || !t) return;
    const n = swipeDelta(t.clientX - s0.x, t.clientY - s0.y);
    if (n) goDay(n);
  };
  const dateText = isViewToday ? "" : new Date(viewDate + "T00:00:00").toLocaleDateString("bn-BD", { day: "numeric", month: "long" });
  const markedDates = new Set((info.recent || []).filter(hasDayRecord).map((x) => x.date));
  const _vd = new Date(viewDate + "T00:00:00");
  const shortDate = _vd.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  // হিরোতে BMI-এর ডানে ছোট তারিখ-বাটন; অন্য দিনে কমলা + "আজ ↩"। ট্যাপ-এরিয়া ৪৪px (ভিজ্যুয়াল ছোট)।
  const pill = (bg, fg) => ({ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "999px", background: bg, color: fg, fontSize: "12.5px", fontWeight: 700, whiteSpace: "nowrap" });
  const hitBtn = { minHeight: "44px", margin: "-8px 0", padding: "0 2px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center" };
  // ‹ › = আগের/পরের দিন (আজকে › বন্ধ, ৩০ দিনের সীমায় ‹ বন্ধ); "আজ ↩" বাটন বাদ (owner-approved ২০২৬-১১-১৪) — সোয়াইপ আগের মতোই
  const canPrev = inRange(shiftISO(viewDate, -1), today), canNext = inRange(shiftISO(viewDate, 1), today);
  const navBtn = (dir, ok, dark) => React.createElement("button", { type: "button", disabled: !ok, onClick: () => goDay(dir), "aria-label": dir < 0 ? "আগের দিন" : "পরের দিন",
    style: { ...hitBtn, minWidth: "36px", justifyContent: "center", margin: "-8px -6px", cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.35 } },
    React.createElement("span", { style: { width: "26px", height: "26px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: dark ? "rgba(255,255,255,0.18)" : "var(--hs-chip-bg)", color: dark ? T.onDark : T.green } },
      Icon(dir < 0 ? "chevronLeft" : "chevronRight", { size: 16, stroke: 2.4 })));
  const mkChip = (dark) => React.createElement("span", { style: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "2px", flexShrink: 0 } },
    navBtn(-1, canPrev, dark),
    React.createElement("button", { type: "button", onClick: () => setCalOpen(true), "aria-label": "তারিখ বেছে নিন, এখন " + shortDate, style: hitBtn },
      React.createElement("span", { style: pill(isViewToday ? "#F3E6CC" : T.orange, isViewToday ? T.green : T.onDark) }, Icon("calendar", { size: 14 }), shortDate)),
    navBtn(1, canNext, dark));
  const dateChip = mkChip(true);

  const glasses = wLocal !== null ? wLocal : (d.waterGlasses || 0);
  const bmiVal = bmiOf(info.weightKg, info.heightCm);
  const eaten = d.caloriesIn || 0;
  const left = calc ? calc.calorieTarget - eaten : 0;

  const layout = useAppDesign("home").main;
  const heroFixed = layout.some((c) => c.id === "hero" && c.visible && c.fold === "fixed");
  // App Creator-এর ডিজাইন অনুযায়ী কার্ড (ক্রম/দৃশ্যমানতা/ভাঁজ)। ডিফল্ট = আগের ক্রম হুবহু।
  const nodes = {
    hero: () => [
    // উপবাস-দিন (পার্ট ১০): ক্যালরি-টার্গেট স্থগিত
    onFast && !calc && React.createElement("div", { style: { ...HOME_CARD, background: GRADIENT_HERO, border: "none", color: T.onDark, padding: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "20px", fontWeight: 700 } }, [Icon("moon", { key: "m", size: 20 }), " আজ সিয়াম/ফাস্টিং"]),
      React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft, marginTop: "6px", lineHeight: 1.6 } },
        "আজ ক্যালরি-টার্গেট স্থগিত। পানি পান করুন; সেহরি/ইফতারে হালকা ও সুষম খাবার নিন। শরীর খারাপ লাগলে সিয়াম/ফাস্টিং ভাঙুন ও ডাক্তারের পরামর্শ নিন।")),

    // হিরো-কার্ড: নাম/বয়স/BMI + ক্যালরি রিং + আজকের হিসাব (গ্রাম, শুধু যোগফল — টার্গেট/শতাংশ নেই)। AlertStrip নিচে।
    calc && React.createElement("div", { style: { ...HOME_CARD, background: "radial-gradient(circle at 92% -10%, rgba(255,200,107,0.28), transparent 52%), " + GRADIENT_HERO, border: "none", borderRadius: "20px", color: T.onDark, padding: "11px 14px 10px", boxShadow: "0 8px 20px rgba(14,75,67,0.26)", marginBottom: "8px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", flexWrap: "nowrap", gap: "10px", marginBottom: "6px" } },
        React.createElement("span", { style: { fontSize: "21px", fontWeight: 700, letterSpacing: "0.2px", color: T.onDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" } }, info.member && info.member.name ? info.member.name : "আমার"),
        // বয়স + BMI: দুই লাইনের ছোট স্তম্ভ (ইংরেজি সংখ্যা); BMI-তে ট্যাপে আজকের ওজন যোগ/বদলের শিট
        React.createElement("span", { style: { display: "inline-flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0, lineHeight: 1.15 } },
          info.age !== null && info.age !== undefined && React.createElement("span", { style: { fontSize: "11.5px", fontWeight: 600, color: T.onDarkSoft, whiteSpace: "nowrap" } }, String(info.age) + (info.age === 1 ? " year" : " years")),
          React.createElement("button", { type: "button", onClick: () => openIn("weight"), "aria-label": "আজকের ওজন যোগ/বদলান", style: { minHeight: "16px", padding: 0, border: "none", background: "transparent", color: T.onDark, fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "4px", lineHeight: 1.15 } },
            bmiVal ? "BMI " + (Math.round(bmiVal * 10) / 10).toFixed(1) : "ওজন দিন",
            React.createElement("span", { "aria-hidden": "true", style: { fontSize: "11px", opacity: 0.75 } }, "✎"))),
        dateChip),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "16px" } },
        React.createElement(Ring, { pct: onFast ? 0 : (eaten > calc.calorieTarget ? 100 : pctOf(eaten, calc.calorieTarget)), redFrom: !onFast && eaten > calc.calorieTarget ? (calc.calorieTarget / eaten) * 100 : undefined, size: 96, stroke: 9, color: T.amberSoft, track: T.ringTrackOnDark, label: "ক্যালরি " + bnNum(eaten) + " / " + bnNum(calc.calorieTarget) },
          // রিংয়ের ভেতরের ব্যাস ≈ ৭৮px: সংখ্যা ১৬px + লেবেল ১০.৫px (nowrap) এর ভেতরেই ধরে
          React.createElement("span", { style: { fontSize: "17px", fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap" } }, bnNum(eaten)),
          React.createElement("span", { style: { fontSize: "12px", color: T.onDarkSoft, whiteSpace: "nowrap", lineHeight: 1.2 } }, "কিলোক্যালরি")),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
          onFast
            ? React.createElement(React.Fragment, null,
              React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft } }, "আজ"),
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "21px", fontWeight: 700, lineHeight: 1.2 } }, [Icon("moon", { key: "m", size: 20 }), " সিয়াম/ফাস্টিং"]),
              React.createElement("div", { style: { fontSize: "12.5px", color: T.onDarkSoft, marginTop: "2px", lineHeight: 1.4 } }, "ক্যালরি-টার্গেট স্থগিত · সেহরি/ইফতার লগ করুন"))
            : React.createElement(React.Fragment, null,
              React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft } }, isViewToday ? "আজকের টার্গেট" : dateText + "-এর টার্গেট"),
              React.createElement("div", { style: { fontSize: "26px", fontWeight: 700, lineHeight: 1.1 } }, bnNum(calc.calorieTarget)),
              React.createElement("div", { style: { fontSize: "13px", color: T.onDarkSoft, marginTop: "2px" } }, (left >= 0 ? "বাকি " + bnNum(left) : "টার্গেটের বেশি " + bnNum(-left)) + " · " + GOAL_LABELS[goal.goalType])))),
      fastWarn && React.createElement("div", { style: { marginTop: "8px", fontSize: "12px", lineHeight: 1.45, color: "#FFE3A8" } }, "⚠ আপনার ক্ষেত্রে সিয়াম/ফাস্টিং-এর আগে ডাক্তারের পরামর্শ নিন; শরীর খারাপ লাগলে ভাঙুন।")),
    ],
    macros: () => [
    // পুষ্টির হিসাব: হিরো-কার্ডের নিচে আলাদা কার্ডে (owner-request ২০২৬-১১-১২)। খালি অবস্থায়ও থাকে (০ ও টার্গেট); ডেটা বদলায় না, শুধু দেখানো।
    calc && canLog && React.createElement("div", { style: { ...HOME_CARD, padding: "6px 12px 7px", color: T.ink, marginBottom: "8px" }, "aria-label": "আজকের পুষ্টির হিসাব (গ্রাম, আনুমানিক)" },
      React.createElement("div", { style: { display: "flex", gap: "10px", alignItems: "flex-end" } },
        [["প্রোটিন", macros.p, "#2E9E5B", "p"], ["কার্ব", macros.c, "#E0892B", "c"], ["ফ্যাট", macros.f, "#8A6FD6", "f"], ["ফাইবার", macros.fib, "#3C86D6", "fib"]].map(([name, v, col, key]) => {
          const tg = mt ? (key === "fib" ? mt.fiber : mt[key]) : null; // null = এই ম্যাক্রোর টার্গেট নেই
          const over = tg && key !== "fib" && v > tg; // ফাইবার বেশি হলে লাল নয়
          return React.createElement("div", { key: name, style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontSize: "11.5px", color: T.muted, lineHeight: 1.2 } }, name),
            React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: over ? "#B3261E" : T.ink, lineHeight: 1.15, whiteSpace: "nowrap" } }, fmtMacro(v)),
            mt && React.createElement("div", { style: { fontSize: "11px", color: T.muted, whiteSpace: "nowrap", lineHeight: 1.15 } }, tg ? (mt.mode === "max" && key !== "fib" ? "≤ " : "/ ") + bnNum(tg) + " গ্রাম" : "—"),
            React.createElement("div", { "aria-hidden": "true", style: { height: "3px", borderRadius: "3px", background: tg ? T.border : col, marginTop: "2px" } },
              tg ? React.createElement("div", { style: { height: "3px", borderRadius: "3px", width: Math.min(100, (v / tg) * 100) + "%", background: over ? "#B3261E" : col } }) : null));
        })),
      macros.total > 0 && macros.withMacro < macros.total && React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "6px" } }, bnNum(macros.total - macros.withMacro) + "টি এন্ট্রিতে ম্যাক্রোর তথ্য নেই (আংশিক হিসাব)।")),
    ],
    alert: () => [
    React.createElement(AlertStrip, { allergies: info.allergies || [], conds: info.conds || [], onDiet: () => setDietOpen(true) }),
    ],
    rings: () => [
    // ব্যায়াম / ঘুম / স্টেপ — ছোট রিং
    React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "8px" } },
      React.createElement(MiniRing, { empty: !d.exerciseMin, icon: "activity", value: bnNum(d.exerciseMin || 0) + "/" + bnNum(exTarget), pct: pctOf(d.exerciseMin, exTarget), color: T.orange, caption: d.exerciseMin ? "ব্যায়াম (মি.)" : "লক্ষ্য " + bnNum(exTarget) + " মি.", label: "ব্যায়াম", onTap: () => openIn("exercise") }),
      React.createElement(MiniRing, { empty: !d.sleepMinutes, icon: "moon", value: d.sleepMinutes ? fmtH(d.sleepMinutes) : "—", pct: pctOf(d.sleepMinutes, sMin * 60), color: T.purple, caption: d.sleepMinutes ? "গত রাতের ঘুম" : "লক্ষ্য " + bnNum(sMin) + "–" + bnNum(sMax) + " ঘ.", label: "ঘুম", onTap: () => openIn("sleep") }),
      stTarget && React.createElement(MiniRing, { empty: !d.steps, icon: "steps", value: bnNum(d.steps || 0), pct: pctOf(d.steps, stTarget), color: T.leaf, caption: d.steps ? "স্টেপ / " + bnNum(stTarget) : "লক্ষ্য " + bnNum(stTarget), label: "স্টেপ", onTap: () => openIn("steps") }),
      // হিরো না থাকলে (উপবাস/টার্গেট-ব্লক) BMI কার্ড এখানে ফেরে — নইলে ওজন দেওয়ার পথ থাকত না
      !calc && React.createElement("div", { role: "button", tabIndex: 0, "aria-label": "আজকের ওজন যোগ/বদলান", onClick: () => openIn("weight"), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIn("weight"); } },
        style: { ...HOME_CARD, flex: 1, minWidth: 0, marginBottom: 0, padding: "6px 4px 7px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", cursor: "pointer" } },
        React.createElement("span", { "aria-hidden": "true", style: { fontSize: "22px", lineHeight: 1.2 } }, "⚖️"),
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 800, color: T.ink } }, bmiVal ? bnNum(Math.round(bmiVal * 10) / 10) : "—"),
        React.createElement("div", { style: { fontSize: "12px", color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" } }, bmiVal && info.weightKg ? "BMI · " + bnNum(info.weightKg) + " কেজি" : "ওজন দিন"))),
    ],
    waterFood: () => [
    // পানি (৩/৪) + খাবার-যোগ (১/৪) এক সারিতে — আলাদা কার্ড। খাবার-কার্ড শুধু লগ-যোগ্য হলে; নইলে পানি পুরো প্রস্থে।
    (waterTarget || canLog) && React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "8px", alignItems: "stretch" } },
      waterTarget && React.createElement("div", { style: { ...HOME_CARD, ...(wFlash ? { border: "2px solid " + T.blue } : {}), flex: 3, minWidth: 0, marginBottom: 0, padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: "6px" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "4px" } },
          React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "15px", fontWeight: 700, color: T.ink } }, Icon("droplet", { size: 18, color: T.blue }), "পানি"),
          React.createElement("span", { style: { fontSize: "13px", color: T.muted, whiteSpace: "nowrap" } }, React.createElement("b", { style: { color: T.blue, fontSize: "17px" } }, bnNum(glasses)), " / " + bnNum(waterTarget))),
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" }, "aria-hidden": "true" },
          Array.from({ length: Math.max(waterTarget, Math.min(glasses, 16)) }, (_, i) => React.createElement("div", { key: i, style: { width: "13px", height: "14px", borderRadius: "3px 3px 5px 5px", background: i < glasses ? "linear-gradient(180deg, #6BB1EE, " + T.blue + ")" : T.blueSoft } }))),
        React.createElement("div", { style: { display: "flex", gap: "6px", marginTop: "auto" } },
          React.createElement("button", { onClick: () => setWater(glasses + 1), disabled: !oldReady || glasses >= MAX_WATER, "aria-label": "১ গ্লাস পানি যোগ", style: { flex: 1, minHeight: "36px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", borderRadius: "12px", border: "none", background: !oldReady ? "#8FAFA9" : T.green, color: T.onDark, fontSize: "14px", fontWeight: 700, cursor: !oldReady ? "default" : "pointer", fontFamily: "inherit", padding: "0 4px", boxShadow: !oldReady ? "none" : "0 4px 10px rgba(14,75,67,0.28)" } }, [Icon("plus", { key: "p", size: 16, stroke: 2.2 }), " ১ গ্লাস"]),
          React.createElement("button", { onClick: () => setWater(glasses - 1), disabled: !oldReady || glasses <= 0, "aria-label": "১ গ্লাস কমান", style: { minWidth: "44px", minHeight: "36px", borderRadius: "12px", border: "1px solid " + T.inputBorder, background: T.track, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: glasses <= 0 ? 0.45 : 1, fontFamily: "inherit" } }, Icon("minus", { size: 18, stroke: 2.4 })))),
      canLog && React.createElement("button", { type: "button", onClick: () => openFood(), "aria-label": "খাবার যোগ করুন", style: { ...HOME_CARD, marginBottom: 0, flex: 1, minWidth: 0, color: T.green, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", padding: "6px 4px", cursor: "pointer", fontFamily: "inherit" } },
        React.createElement("span", { "aria-hidden": "true", style: { width: "36px", height: "36px", borderRadius: "50%", background: T.track, display: "flex", alignItems: "center", justifyContent: "center" } }, Icon("plus", { size: 20, stroke: 2.2 })),
        React.createElement("span", { style: { fontSize: "14px", fontWeight: 800 } }, "খাবার"))),
    flags.kidney && React.createElement(Notice, { tone: "info" }, "কিডনি রোগে পানির পরিমাণ ডাক্তার ঠিক করে দেন — তাই পানির টার্গেট দেখানো হচ্ছে না।"),
    !flags.kidney && waterTarget === null && React.createElement(Notice, { tone: "info" }, "২ বছরের কম বয়সে পানির পরিমাণ শিশুর দুধ/খাবারের সাথে ডাক্তারের নির্দেশমতো ঠিক হয় — তাই পানির টার্গেট দেখানো হচ্ছে না।"),
    ],
    week: () => [
    // সাপ্তাহিক সারাংশ — বৃত্তে ট্যাপ করলে সেই দিনের পাতা
    React.createElement("div", { style: { ...HOME_CARD, background: "var(--hs-surface, #fff)", borderColor: "var(--hs-border, #DCE6E0)", padding: "8px 12px" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: T.ink } }, "এই সপ্তাহ"),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
          React.createElement("span", { style: { fontSize: "13px", color: T.muted } }, bnNum(week.hitCount) + "/৭ দিন টার্গেটে"),
          React.createElement("button", { type: "button", onClick: () => setWeekInfo((v) => !v), "aria-label": "সপ্তাহের হিসাবের নিয়ম", "aria-expanded": weekInfo, style: { minWidth: "44px", minHeight: "44px", margin: "-12px -8px -12px -6px", border: "none", background: "none", color: T.green, fontSize: "18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "ⓘ"),
          // পুরো ট্রেন্ড হোমে নয় — শুধু প্রবেশ-পথ (হোম হালকা থাকে); ট্যাপ এরিয়া ৪৪px, ভিজ্যুয়াল ছোট
          onOpenTrend && React.createElement("button", { type: "button", onClick: onOpenTrend, "aria-label": "অ্যাক্টিভিটি রিভিউ দেখুন", style: { minHeight: "44px", margin: "-12px -6px -12px 0", padding: "0 6px", border: "none", background: "none", color: T.green, fontSize: "13.5px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" } }, "রিভিউ ›"))),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "6px" } },
        week.days.map((x, i) => {
          const hit = x.state === "hit", isToday = x.state === "today", isFast = x.state === "fast";
          const partial = !hit && !isFast && x.metCount > 0; // ১টা লক্ষ্য পূরণ: হালকা সবুজ বৃত্তে সংখ্যা
          const canPick = inRange(x.date, today), isSel = x.date === viewDate;
          return React.createElement("button", { key: x.date, type: "button", disabled: !canPick, onClick: () => pickDay(x.date), "aria-pressed": isSel, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, minHeight: "44px", padding: 0, border: "none", background: "none", fontFamily: "inherit", cursor: canPick ? "pointer" : "default" } },
            React.createElement("span", { style: { fontSize: "12px", color: T.muted } }, SHORT_DAYS[i]),
            React.createElement("div", { "aria-label": SHORT_DAYS[i] + (hit ? " টার্গেটে" : partial ? " " + x.metCount + "টি লক্ষ্য পূরণ" : isFast ? " সিয়াম/ফাস্টিং-এর দিন" : isToday ? " আজ" : ""), style: { width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700,
              background: hit ? T.green : partial ? "#D4EADF" : isToday ? T.orange : isFast ? T.sand : "transparent", color: hit || (isToday && !partial) ? T.onDark : partial ? T.green : T.muted,
              boxShadow: isSel ? "0 0 0 2px var(--hs-surface, #fff), 0 0 0 4px " + T.green : "none",
              border: partial ? "2px solid " + (isToday ? T.orange : T.green) : hit || isToday ? "none" : "1.5px " + (x.state === "future" ? "dashed" : "solid") + " " + (isFast ? T.sandBorder : "#C9C3D6") } }, hit ? "✓" : partial ? bnNum(x.metCount) : isToday ? "আজ" : isFast ? "🌙" : ""));
        })),
      React.createElement("div", { style: { fontSize: "11.5px", color: T.muted, marginTop: "6px" } }, "✓ = টার্গেট (২+ লক্ষ্য) · সংখ্যা = পূরণ হওয়া লক্ষ্য"),
      weekInfo && React.createElement("div", { role: "note", style: { marginTop: "8px", padding: "8px 10px", borderRadius: "12px", background: "var(--hs-chip-bg, #E4F0E9)", fontSize: "12.5px", lineHeight: 1.6, color: T.ink } },
        React.createElement("div", { style: { fontWeight: 700 } }, "বৃত্তের সংখ্যা = ওই দিন কয়টি লক্ষ্য পূরণ হয়েছে"),
        calc && React.createElement("div", null, "• ক্যালরি: টার্গেটের ৮০%–১১০% (" + bnNum(Math.round(calc.calorieTarget * 0.8)) + "–" + bnNum(Math.round(calc.calorieTarget * 1.1)) + ")"),
        React.createElement("div", null, "• ব্যায়াম: কমপক্ষে " + bnNum(exTarget) + " মিনিট"),
        waterTarget && React.createElement("div", null, "• পানি: কমপক্ষে " + bnNum(waterTarget) + " গ্লাস"),
        React.createElement("div", null, "• ঘুম: কমপক্ষে " + bnNum(sMin) + " ঘণ্টা"),
        React.createElement("div", { style: { marginTop: "4px" } }, "✓ = ২টি বা বেশি লক্ষ্য পূরণ। স্টেপ এই গণনায় নেই। সিয়ামের দিনে ক্যালরি ধরা হয় না."))),
    ],
    meds: () => [
    // হোম: আজকের ওষুধ + আসন্ন (TodaySummary onlyMeds)
    homeExtra || null,
    ],
    foodHead: () => [
    // আজকের খাবার-লগ হেডার + পাশে "পেট ডায়েরি" (এক লাইনের আলাদা কার্ড; উচ্চতা বাড়ে না — দুটোই একই সারিতে সমান উচ্চতা)।
    // নিজে-যোগ-করা খাবারই এখানে; প্ল্যানের টিক আলাদা (লক্ষ্য ও প্ল্যান → মিল), তবে হিরো-কার্ডের মোটে ধরা হয়।
    React.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "stretch", marginBottom: "8px" } },
      canLog && React.createElement("div", { style: { ...HOME_CARD, flex: 1, minWidth: 0, marginBottom: 0, background: "#E8F1EC", borderColor: "#B7D3C6", padding: "8px 12px" } },
        React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, isViewToday ? "আজকের খাবার-লগ" : dateText + "-এর খাবার-লগ"),
        React.createElement("div", { title: "প্ল্যানের টিকসহ", style: { fontSize: "12px", color: T.muted, marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, "মোট " + bnNum(eaten) + " / " + bnNum(calc.calorieTarget) + " কিলোক্যালরি"),
        foodErr && !foodOpen && ErrorBox(foodErr)),
      React.createElement("button", { type: "button", onClick: () => setGutOpen(true), "aria-label": "পেট ডায়েরি খুলুন" + (entriesOn(info.gutEntries, today).length ? " (আজ লগ আছে)" : ""),
        style: { ...HOME_CARD, flex: canLog ? "0 0 auto" : 1, marginBottom: 0, padding: "0 12px", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit", fontSize: "13.5px", fontWeight: 800, color: T.green,
          background: entriesOn(info.gutEntries, today).length ? "var(--hs-chip-bg, #E4F0E9)" : "var(--hs-surface, #fff)" } }, [Icon("health", { key: "i", size: 18 }), "পেট ডায়েরি"])),
    ],
    slots: () => [
    canLog && slotsForDay(plannedFast, dayDoc).map((sl) => {
      const mine = extras.map((x, idx) => ({ ...x, idx })).filter((x) => x.slot === sl.id);
      const sm = sumNutrition(mine);
      const bud = budgets[sl.id];
      const head = [bud ? bnNum(bud.eaten) + " / " + bnNum(bud.planned) + " কিলোক্যালরি" : bnNum(sm.kcal) + " কিলোক্যালরি"].concat(sm.withMacro > 0 ? ["প্রো " + bnNum(Math.round(sm.p)), "কার্ব " + bnNum(Math.round(sm.c)), "ফ্যাট " + bnNum(Math.round(sm.f))] : []).join(" · ");
      return React.createElement("div", { key: sl.id, style: { ...HOME_CARD, padding: "8px 10px", opacity: mine.length ? 1 : 0.8 } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
          React.createElement("span", { "aria-hidden": "true", style: { width: "34px", height: "34px", borderRadius: "10px", background: SLOT_TINT[sl.id], display: "flex", alignItems: "center", justifyContent: "center", color: T.green, flexShrink: 0 } }, Icon(SLOT_LINE[sl.id] || "sun", { size: 20 })),
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color: T.ink } }, sl.label),
            React.createElement("div", { style: { fontSize: "12.5px", color: bud && bud.eaten > bud.planned ? "#B26A00" : T.muted, fontWeight: bud && bud.eaten > bud.planned ? 700 : 400 } }, mine.length ? head : bud ? "এখনও কিছু যোগ হয়নি · " + bnNum(bud.eaten) + " / " + bnNum(bud.planned) + " কিলোক্যালরি" : "এখনও কিছু যোগ হয়নি")),
          React.createElement("button", { type: "button", onClick: () => openFood(sl.id), "aria-label": sl.label + "-এ খাবার যোগ করুন", style: { flexShrink: 0, width: "44px", height: "44px", margin: "-6px -6px -6px 0", padding: 0, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit" } },
            React.createElement("span", { "aria-hidden": "true", style: { width: "30px", height: "30px", borderRadius: "50%", background: T.track, color: T.green, fontSize: "20px", fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" } }, "＋"))),
        mine.map((x) => { const st = x.key && Object.prototype.hasOwnProperty.call(FOODS, x.key) ? foodStatus(x.key, FOODS[x.key], { allergyTags: info.allergyTags, ctx: { age: info.age, flags: info.flags, condKeys: info.condKeys } }) : null; const sc = st && STATUS_COLORS[st.level]; return React.createElement("div", { key: x.idx, title: st ? st.label + (st.reasons.length ? " — " + st.reasons.join("; ") : "") : undefined, style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "10px", border: "1px solid " + (sc ? sc.border : "transparent"), background: sc ? sc.bg : "transparent", marginTop: "6px" } },
          React.createElement("div", { role: "button", tabIndex: 0, "aria-label": x.name + " বদলান", onClick: () => openEdit(x.idx), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(x.idx); } }, style: { flex: 1, minWidth: 0, cursor: busy ? "default" : "pointer" } },
            React.createElement("div", { style: { fontSize: "14px", color: sc ? sc.text : T.ink, fontWeight: sc ? 600 : 400 } }, st ? st.icon + " " + x.name : x.name),
            st && st.level !== "green" && React.createElement("div", { style: { fontSize: "12px", color: sc.text } }, st.label + (st.reasons.length ? " — " + st.reasons[0] : "")),
            React.createElement("div", { style: { fontSize: "12px", color: T.muted } }, [entryAmountText(x), bnNum(x.kcal) + " ক্যাল", x.p !== undefined ? "প্রো " + fmtMacro(x.p) + " · কার্ব " + fmtMacro(x.c) + " · ফ্যাট " + fmtMacro(x.f) : ""].filter(Boolean).join(" · "))),
          React.createElement("span", { style: { fontSize: "14px", fontWeight: 700, color: T.ink } }, bnNum(x.kcal)),
          React.createElement("button", { onClick: () => writeExtras(extras.filter((_, i) => i !== x.idx)), disabled: busy, "aria-label": x.name + " মুছুন", style: { minWidth: "44px", minHeight: "44px", borderRadius: "12px", border: "none", background: "#FDECEA", color: "#A32018", fontSize: "16px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 } }, "✕")); }));
    }),
    ],
  };

  return React.createElement("div", { onTouchStart, onTouchEnd },
    // হিরো না থাকলে (গেট/উপবাস) তারিখ-বাটন আলাদা সারিতে
    (!calc || !heroFixed) && React.createElement("div", { style: { display: "flex", marginBottom: "6px" } }, mkChip(false)),
    gate.blocked && React.createElement(Notice, null,
      React.createElement("b", null, "ক্যালরি-টার্গেটের জন্য তথ্য লাগবে"), React.createElement("br"), gate.reason,
      React.createElement("br"), "এখানে পানি, ব্যায়াম ও ঘুম ট্র্যাক করা যাবে।"),
    // গেট শুধু সতর্কতা (Approved Deviation ১০ নভেম্বর ২০২৬) — হিরো ও খাবার-লগ খোলা
    gate.warn && React.createElement(Notice, null, gate.reason),
    !gate.blocked && !calc && !onFast && React.createElement("div", { style: { ...HOME_CARD, background: GRADIENT_HERO, border: "none", borderRadius: "20px", color: T.onDark, padding: "16px" } },
      React.createElement("div", { style: { fontSize: "18px", fontWeight: 800, marginBottom: "6px" } }, "🎯 প্রোফাইল সেটআপ"),
      React.createElement("div", { style: { fontSize: "14px", lineHeight: 1.5, color: T.onDark } }, "প্রথমে Health profile এ গিয়ে আপনার ওজন, উচ্চতা ও চলমান অসুখ থাকলে যুক্ত করুন।"),
      React.createElement("div", { style: { fontSize: "12.5px", marginTop: "2px", color: T.onDarkSoft } }, "Health ▸ Health Profile"),
      React.createElement("div", { style: { fontSize: "14px", lineHeight: 1.5, color: T.onDark, marginTop: "10px" } }, "এরপর Tracker ট্যাবে গিয়ে আপনার লক্ষ্য সেট করুন।"),
      React.createElement("div", { style: { fontSize: "12.5px", marginTop: "2px", color: T.onDarkSoft } }, "Tracker ▸ লক্ষ্য ও প্ল্যান ▸ লক্ষ্য সেট করুন")),

    // হোমের কার্ডগুলো এক জায়গায় (ক্রম/ভাঁজ ডিজাইন অনুযায়ী); ত্রুটি/লোডিং-বার্তা সবসময় উপরে
    err && ErrorBox(err),
    !oldReady && React.createElement(Notice, { tone: old.err ? "warn" : "info" }, old.err ? [old.err + " ", React.createElement("button", { key: "r", type: "button", onClick: () => setRetry((n) => n + 1), style: { minHeight: "44px", padding: "0 12px", borderRadius: "12px", border: "1.5px solid " + T.green, background: "#fff", color: T.green, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" } }, "আবার চেষ্টা")] : "এই দিনের তথ্য লোড হচ্ছে… (শেষ না হওয়া পর্যন্ত লেখা বন্ধ)"),
    ...renderLayoutCards("home", "main", layout, nodes),

    dietOpen && React.createElement(Sheet, { title: "খাদ্য নির্দেশিকা", subtitle: (info.conds || []).map((c) => c.name).join(", ") || undefined, onClose: () => setDietOpen(false) },
      React.createElement(DietGuidanceSection, { familyId, selectedMemberId: memberId })),

    foodOpen && canLog && React.createElement(FoodLogSheet, {
      dateText, slots: slotsForDay(plannedFast, dayDoc), initialSlot: foodSlot || fastDefaultSlot(plannedFast), pickFirst: foodSlot === null, allergyTags: info.allergyTags, avoidCtx: { age: info.age, flags: info.flags, condKeys: info.condKeys }, activeMeds: info.activeMeds,
      count: editIdx !== null ? extras.length - 1 : extras.length, editEntry: editIdx !== null ? extras[editIdx] : null, slotBudgets: slotBudgets(plan, eatenIds, extras, budgetTarget), recent: recentFoodEntries(info.recent, { days: 30, limit: 8 }), busy, err: foodErr, onAdd: (entry) => writeExtras(editIdx !== null ? extras.map((x, i) => (i === editIdx ? entry : x)) : [...extras, entry]), onClose: closeFood,
    }),





    inKind === "exercise" && React.createElement(ExerciseLogSheet, { key: "ex", dateText, initialType: "walk", entries: exLog, recent: recentExerciseEntries(info.recent), busy, err: inErr, onAdd: addExLog, onRemove: removeExLog, onClose: closeIn }),
    (inKind === "sleep" || inKind === "steps" || inKind === "weight") && React.createElement(DailyInputSheet, {
      key: inKind, dateText, kind: inKind, daily: dayDoc, latestWeight: info.latestWeight, stepsTarget: stTarget, busy, err: inErr,
      onSave: (fields) => writeIn(fields, true), onClose: closeIn,
    }),

    calOpen && React.createElement(TodayDateSheet, { selected: viewDate, today, marked: markedDates, onPick: pickDay, onClose: () => setCalOpen(false), loadMonth: (y, m) => getMonthDaily(familyId, memberId, y, m) }),



    gutOpen && React.createElement(Sheet, { title: "🩺 পেট ডায়েরি", subtitle: "আজকের পেটের অবস্থা (ব্রিস্টল স্কেল)", onClose: () => setGutOpen(false) },
      React.createElement(GutLogCard, { bare: true, info, familyId, callerMemberId, memberId, gutFoods: gutFoodCount(plan, eatenIds, extras), onSaved })),
    React.createElement("p", { style: { fontSize: "12px", color: T.muted } }, "এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।")
  );
}
