// src/health/nextstep/NextStepCard.js
//
// ধাপ ১০ (গ২) — "এরপর কী করবেন?" (ঐচ্ছিক) প্রস্তাব-কার্ড। মকআপ: শিরোনাম + "ঐচ্ছিক", প্রতি প্রস্তাব আলাদা কার্ড
// (আইকন+শিরোনাম, ছোট বর্ণনা, [মূল বাটন][দ্বিতীয় বাটন]), নিচে "প্রস্তাবগুলো শুধু আপনার অনুমতিতে কাজ করে"।
// নিজে নিজে কিছু লেখে না — শুধু বাটন চাপলে। "পরে/দরকার নেই" শুধু এই স্ক্রিনে কার্ড লুকায় (কিছু সংরক্ষণ হয় না)।
// দুই ব্যবহার: PrescriptionNextSteps (প্রেসক্রিপশন সেভের পর) · ReportNextSteps (অস্বাভাবিক রিপোর্ট সেভের পর)।

import { localISO, bnDate, bnNum } from "../../shared/dates.js";
import { courseEndPlan, foodMedNoteItems, doctorNoteSummary, addDays } from "./nextStepCalc.js";
import { REMINDERS_CHANGED_EVENT } from "../tracker/TrackerReminderRunner.js";
import { addFollowUpEvent, addCourseEndEvents, addDoctorVisitEvent } from "./nextStepData.js";

const { useState, useCallback } = React;
const h = React.createElement;
const G = "#0E4B43", RED = "#B3261E", MUTED = "var(--hs-muted, #5F716C)";

const btn = (primary, disabled) => ({
  minHeight: "44px", padding: "8px 18px", borderRadius: "999px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit",
  cursor: disabled ? "default" : "pointer", border: "1.5px solid " + G,
  background: primary ? (disabled ? "#8FAFA9" : G) : "var(--hs-surface, #fff)", color: primary ? "#fff" : G,
});
const dateInputStyle = { minHeight: "44px", boxSizing: "border-box", padding: "8px 10px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "15px", fontFamily: "inherit" };

/**
 * একটা প্রস্তাব-কার্ড।
 * step: { id, icon, title, desc, yes, no?, run?(date)→Promise<string> (সাফল্যের বার্তা), date?: {init, min, label}, details?: string[] }
 *   details থাকলে মূল বাটন শুধু ভাঁজ খোলে/বন্ধ করে (কোনো লেখা নেই)।
 */
function Step({ step }) {
  const [state, setState] = useState("idle"); // idle | busy | done | hidden
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(null);
  const [date, setDate] = useState(step.date ? step.date.init : "");
  const [editDate, setEditDate] = useState(false);
  const [open, setOpen] = useState(false);

  const yes = useCallback(async () => {
    if (state === "busy" || state === "done") return; // double-tap রোধ
    if (step.details) { setOpen((o) => !o); return; }
    if (step.date && !(date >= step.date.min)) { setErr("আজ বা পরের একটা তারিখ বেছে নিন।"); return; }
    setErr(null); setState("busy");
    try { setMsg(await step.run(date)); setState("done"); window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT)); /* রানার নতুন ইভেন্ট পড়ে */ }
    catch (e) { setErr(e.code === "permission-denied" ? "ক্যালেন্ডারে যোগ করার অনুমতি নেই।" : (e.message || String(e))); setState("idle"); }
  }, [state, step, date]);

  if (state === "hidden") return null;
  const done = state === "done", busy = state === "busy";
  return h("div", { style: { marginBottom: "12px", padding: "14px", borderRadius: "16px", border: "1px solid var(--hs-border, #E8E1D0)", background: "var(--hs-surface, #fff)" } },
    h("div", { style: { fontSize: "16px", fontWeight: 700, color: G, overflowWrap: "anywhere" } }, step.icon + " " + step.title),
    h("div", { style: { fontSize: "14px", color: MUTED, margin: "6px 0 10px", lineHeight: 1.5, overflowWrap: "anywhere" } }, step.desc),
    step.date && !done && h("div", { style: { margin: "0 0 10px" } },
      editDate
        ? h("input", { type: "date", min: step.date.min, value: date, "aria-label": step.date.label, onChange: (e) => setDate(e.target.value), style: dateInputStyle })
        : h("button", { type: "button", onClick: () => setEditDate(true), style: { minHeight: "44px", padding: "0 4px", border: "none", background: "none", color: G, fontSize: "14px", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" } }, "তারিখ: " + bnDate(date) + " — বদলান")),
    open && h("div", { style: { margin: "0 0 10px", padding: "10px 12px", borderRadius: "12px", background: "#F7F6F1", fontSize: "14px", lineHeight: 1.6, color: "#3E4E49" } },
      step.details.map((t, i) => h("div", { key: i, style: { marginBottom: i < step.details.length - 1 ? "6px" : 0 } }, "• " + t))),
    err && h("div", { role: "alert", style: { margin: "0 0 10px", color: RED, fontSize: "14px" } }, err),
    done
      ? h("div", { role: "status", style: { fontSize: "14px", fontWeight: 600, color: G } }, "✓ " + msg)
      : h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h("button", { type: "button", onClick: yes, disabled: busy, "aria-expanded": step.details ? open : undefined, style: btn(true, busy) }, busy ? "অপেক্ষা করুন..." : (step.details && open ? "লুকান" : step.yes)),
          step.no && h("button", { type: "button", onClick: () => setState("hidden"), disabled: busy, style: btn(false, busy) }, step.no)));
}

function Shell({ steps }) {
  if (!steps || steps.length === 0) return null;
  return h("div", { style: { marginTop: "16px" } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" } },
      h("h4", { style: { margin: 0, fontSize: "17px", color: G } }, "এরপর কী করবেন?"),
      h("span", { style: { fontSize: "14px", color: MUTED } }, "ঐচ্ছিক")),
    steps.map((s) => h(Step, { key: s.id, step: s })),
    h("div", { style: { fontSize: "13px", color: MUTED, margin: "4px 2px", lineHeight: 1.5 } }, "প্রস্তাবগুলো শুধু আপনার অনুমতিতে কাজ করে — নিজে নিজে কিছু যোগ হয় না।"));
}

/**
 * প্রেসক্রিপশন সেভের পর।
 * @param {object} props.saved - { res: {saved[]…}, finals: [{name, days}…] } (PrescriptionReviewForm.onSaved)
 * @param {object|null} props.followUp - extractFollowUpDate() ফল
 */
export function PrescriptionNextSteps({ familyId, targetMemberId, callerMemberId, saved, followUp }) {
  const today = localISO();
  const names = saved.res.saved || [];
  if (names.length === 0) return null; // কিছু সংরক্ষণ না হলে "এরপর"-ও নেই
  const steps = [];

  if (followUp) {
    steps.push({
      id: "followup", icon: "📅", title: "ফলো-আপ " + bnDate(followUp.date),
      desc: followUp.relative
        ? "প্রেসক্রিপশনে লেখা “" + followUp.raw + "” — আজ থেকে গুনে এই তারিখ ধরা হয়েছে, মিলিয়ে নিন। ক্যালেন্ডারে যোগ করবেন?"
        : "প্রেসক্রিপশনে লেখা তারিখ (“" + followUp.raw + "”)। ক্যালেন্ডারে যোগ করবেন?",
      yes: "যোগ করুন", no: "পরে", date: { init: followUp.date, min: today, label: "ফলো-আপের তারিখ" },
      run: async (d) => { const n = await addFollowUpEvent(familyId, callerMemberId, targetMemberId, d, followUp.line); return n ? "ক্যালেন্ডারে যোগ হয়েছে" : "ক্যালেন্ডারে আগেই ছিল"; },
    });
  }

  const plan = courseEndPlan(saved.finals, names, today);
  if (plan.length > 0) {
    steps.push({
      id: "courseend", icon: "⏳", title: "ওষুধ শেষের আগে মনে করান",
      desc: plan.slice(0, 3).map((p) => p.name + " " + bnNum(p.days) + " দিনের").join(", ") + (plan.length > 3 ? " …" : "") + " — শেষের ২ দিন আগে ক্যালেন্ডারে জানানো হবে।",
      yes: "চালু করুন", no: "দরকার নেই",
      run: async () => {
        const r = await addCourseEndEvents(familyId, callerMemberId, targetMemberId, plan);
        if (r.failed > 0 && r.created === 0) throw new Error("ক্যালেন্ডারে যোগ করা যায়নি। আবার চেষ্টা করুন।");
        return r.created > 0 ? "মনে করানো চালু হয়েছে" : "আগেই চালু ছিল";
      },
    });
  }

  const notes = foodMedNoteItems(names);
  if (notes.length > 0) {
    const medNames = [...new Set(notes.map((n) => n.med))];
    steps.push({ id: "foodnote", icon: "🍽️", title: "খাবার-ওষুধ নোট দেখুন", desc: medNames.join(", ") + "-এর সাথে কী খাওয়ার সতর্কতা", yes: "দেখুন", details: notes.map((n) => n.text) });
  }

  return h(Shell, { steps });
}

/**
 * রিপোর্ট সেভের পর, অস্বাভাবিক মান থাকলে (labAlerts)। রোগনির্ণয়ের ভাষা নেই; শুধু "ডাক্তারকে দেখান"-এর স্মরণ।
 * @param {Array<object>} props.alerts - labAlerts (name, level, …)
 */
export function ReportNextSteps({ familyId, targetMemberId, callerMemberId, alerts }) {
  const sum = doctorNoteSummary(alerts);
  if (!sum) return null;
  const today = localISO();
  return h(Shell, {
    steps: [{
      id: "doctor", icon: "🩺", title: "ডাক্তারকে রিপোর্ট দেখান",
      desc: bnNum(sum.count) + "টি মান স্বাভাবিক সীমার বাইরে (" + sum.names.join(", ") + (sum.count > sum.names.length ? " …" : "") + ")। ডাক্তার দেখানোর দিন ক্যালেন্ডারে রাখবেন?",
      yes: "যোগ করুন", no: "পরে", date: { init: addDays(today, 3), min: today, label: "ডাক্তার দেখানোর তারিখ" },
      run: async (d) => { const n = await addDoctorVisitEvent(familyId, callerMemberId, targetMemberId, d, sum.names); return n ? "ক্যালেন্ডারে যোগ হয়েছে" : "ক্যালেন্ডারে আগেই ছিল"; },
    }],
  });
}
