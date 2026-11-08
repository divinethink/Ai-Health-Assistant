// হেলথ ট্র্যাকার (ধাপ ১) — লক্ষ্য সেটআপ, দৈনিক কার্ড, দৈনিক ইনপুট (ওজন/পানি/স্টেপ/ব্যায়াম/ঘুম)।
// হিসাব trackerCalc.js-এ (ফিক্সড সূত্র); Firestore trackerData.js-এ। এই ফাইলে শুধু UI।
// মিল-প্ল্যান (ধাপ ২), রিমাইন্ডার (ধাপ ৩), Health Connect (ধাপ ৪), ট্রেন্ড (ধাপ ৫) এখনো নেই।

import { ErrorBox, PrimaryButton, SelectField, TabPills } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { getGoal, getDaily, saveGoal, saveDaily, todayISO } from "./trackerData.js";
import {
  GOAL_LABELS, ACTIVITY_LABELS, ageYears, bmiOf, computeGoal, safetyGate, sleepMinutes,
  sleepTargetHours, exerciseTargetMinPerDay, stepsTarget, detectFlagsFromConditions,
} from "./trackerCalc.js";

const { useState, useEffect, useCallback } = React;

const CARD = { background: "var(--hs-surface, #fff)", border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "14px", padding: "12px 14px", marginBottom: "12px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" };
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

// ---------- আজকের অবস্থা ----------
function TodayTab({ info }) {
  const { daily, goal, age, flags, gate } = info;
  const d = daily || {};
  const calc = !gate.blocked && goal && goal.calc ? goal.calc : null;
  const [sMin, sMax] = sleepTargetHours(age);
  const exTarget = exerciseTargetMinPerDay(age);
  const stTarget = stepsTarget(age);
  const sleepH = d.sleepMinutes ? d.sleepMinutes / 60 : null;
  const fmtH = (m) => bnNum(Math.floor(m / 60)) + " ঘ. " + bnNum(m % 60) + " মি.";

  return React.createElement(React.Fragment, null,
    gate.blocked && React.createElement(Notice, null,
      React.createElement("b", null, "ক্যালরি-টার্গেট বন্ধ"), React.createElement("br"), gate.reason,
      React.createElement("br"), "এখানে পানি, ব্যায়াম ও ঘুম ট্র্যাক করা যাবে। ওজন নিয়ে চিন্তা থাকলে ডাক্তারের পরামর্শ নিন।"),
    !gate.blocked && !calc && React.createElement(Notice, { tone: "info" }, "ক্যালরির টার্গেট ঠিক করতে ‘লক্ষ্য’ ট্যাবে যান।"),
    calc && React.createElement(Stat, {
      title: "ক্যালরি", line: "লক্ষ্য: " + bnNum(calc.calorieTarget) + " কিলোক্যালরি/দিন (" + GOAL_LABELS[goal.goalType] + ")",
      pct: (((d.caloriesIn || 0) / calc.calorieTarget) * 100), color: "#E0A100",
      extra: "খাওয়া হয়েছে: " + bnNum(d.caloriesIn || 0) + " (মিল-প্ল্যান পরের ধাপে যোগ হবে)",
    }),
    React.createElement(Stat, {
      title: "ব্যায়াম", line: bnNum(d.exerciseMin || 0) + " / " + bnNum(exTarget) + " মিনিট" + (stTarget ? " · স্টেপ " + bnNum(d.steps || 0) + " / " + bnNum(stTarget) : ""),
      pct: ((d.exerciseMin || 0) / exTarget) * 100, color: "#17705F",
    }),
    !flags.kidney && React.createElement(Stat, {
      title: "পানি", line: bnNum(d.waterGlasses || 0) + " / " + bnNum(age !== null && age < 13 ? 6 : 8) + " গ্লাস",
      pct: ((d.waterGlasses || 0) / (age !== null && age < 13 ? 6 : 8)) * 100, color: "#2F7FD1",
    }),
    flags.kidney && React.createElement(Notice, { tone: "info" }, "কিডনি রোগে পানির পরিমাণ ডাক্তার ঠিক করে দেন — তাই পানির টার্গেট দেখানো হচ্ছে না।"),
    React.createElement(Stat, {
      title: "রাতের ঘুম", line: d.sleepMinutes ? fmtH(d.sleepMinutes) + " · লক্ষ্য " + bnNum(sMin) + "–" + bnNum(sMax) + " ঘণ্টা" + (d.sleep && d.sleep.quality ? " · মান " + bnNum(d.sleep.quality) + "/৫" : "") : "আজ এখনো দেওয়া হয়নি · লক্ষ্য " + bnNum(sMin) + "–" + bnNum(sMax) + " ঘণ্টা",
      pct: sleepH ? (sleepH / sMin) * 100 : 0, color: "#6B5BD2",
    }),
    d.weightKg && React.createElement(Stat, { title: "আজকের ওজন", line: bnNum(d.weightKg) + " কেজি" }),
    React.createElement("p", { style: { fontSize: "12px", color: "#5F716C" } }, "এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।")
  );
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
      const [recs, goal, daily] = await Promise.all([
        listHealthRecords(familyId, selectedMemberId),
        getGoal(familyId, selectedMemberId),
        getDaily(familyId, selectedMemberId, todayISO()),
      ]);
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
      setData({ member, goal, daily, age, flags, detected, heightCm: num(h), weightKg, latestWeight: num(w), gate: safetyGate({ age, flags }) });
    } catch (e) {
      setData(null);
      setErr(e.code === "permission-denied" ? "এই সদস্যের ট্র্যাকার দেখার অনুমতি আপনার নেই।" : (e.message || String(e)));
    }
  }, [familyId, selectedMemberId, members]);

  useEffect(() => { setData(null); load(); }, [load]);

  const tabs = [["today", "আজকের অবস্থা"], ["input", "দৈনিক ইনপুট"], ["goal", "লক্ষ্য"]];
  return React.createElement("div", { className: "hs-page", style: { position: "fixed", top: topPx, left: 0, right: 0, bottom: "56px", zIndex: 40, display: "flex", flexDirection: "column", background: "#F1F6F2", fontFamily: "'Hind Siliguri', sans-serif" } },
    React.createElement("div", { style: { padding: "8px 12px 0", flexShrink: 0 } }, TabPills(tabs, tab, setTab)),
    React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "0 12px 16px" } },
      err && ErrorBox(err),
      !selectedMemberId && React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "সদস্য-তালিকা লোড হচ্ছে..."),
      selectedMemberId && !data && !err && React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে..."),
      data && tab === "today" && React.createElement(TodayTab, { info: data }),
      // key: সদস্য বদলালে ফর্মের state নতুন করে শুরু হয়
      data && tab === "input" && React.createElement(InputTab, { key: selectedMemberId, info: data, familyId, callerMemberId, memberId: selectedMemberId, onSaved: load }),
      data && tab === "goal" && React.createElement(GoalTab, { key: selectedMemberId, info: data, familyId, callerMemberId, memberId: selectedMemberId, onSaved: load })
    )
  );
}
