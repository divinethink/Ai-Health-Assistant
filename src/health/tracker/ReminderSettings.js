// রিমাইন্ডার সেটিং — UI (ধাপ ৩)। হিসাব reminderData.js-এ, সেভ trackerData.js-এ।
import { ErrorBox, PrimaryButton } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { saveReminders } from "./trackerData.js";
import { MEAL_SLOTS } from "./mealPlanData.js";
import { normalizeReminders, MEAL_TITLES, CAL_DAYS_BEFORE } from "./reminderData.js";
import { REMINDERS_CHANGED_EVENT } from "./TrackerReminderRunner.js";

const { useState } = React;
const h = React.createElement;
const CARD = { background: "var(--hs-surface, #fff)", border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "14px", padding: "12px 14px", marginBottom: "12px" };
const TIME = { padding: "8px 10px", border: "1.5px solid #C3D2CA", borderRadius: "10px", fontSize: "14px", minHeight: "44px", boxSizing: "border-box" };

function Row({ title, on, onToggle, disabled, children, note }) {
  return h("div", { style: CARD },
    h("label", { style: { display: "flex", alignItems: "center", gap: "10px", minHeight: "44px", fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } },
      h("input", { type: "checkbox", checked: on && !disabled, disabled, onChange: (e) => onToggle(e.target.checked), style: { width: "22px", height: "22px" } }), title),
    note && h("div", { style: { fontSize: "12px", color: "#5F716C", margin: "2px 0 6px" } }, note),
    on && !disabled && children);
}
const timeInput = (value, onChange, label) => h("input", { type: "time", value, "aria-label": label, onChange: (e) => e.target.value && onChange(e.target.value), style: TIME });

export function ReminderSettings({ info, familyId, memberId, callerMemberId, onSaved }) {
  const { goal, flags } = info;
  const [s, setS] = useState(() => normalizeReminders(goal && goal.reminders));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  if (memberId !== callerMemberId) {
    return h("div", { style: { ...CARD, background: "#E4F0E9", color: "#0E4B43", fontSize: "14px" } }, "রিমাইন্ডার শুধু নিজের প্রোফাইলের জন্য। উপরে নিজের নাম বাছুন।");
  }
  const set = (key, patch) => { setOk(false); setS((p) => ({ ...p, [key]: { ...p[key], ...patch } })); };

  const askPermission = () => { if (typeof Notification !== "undefined") Notification.requestPermission().then(setPerm); };
  const save = async () => {
    setErr(null); setOk(false); setBusy(true);
    try {
      await saveReminders(familyId, memberId, callerMemberId, s, goal);
      window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT));
      setOk(true); onSaved();
    } catch (x) { setErr(x.code === "permission-denied" ? "সংরক্ষণের অনুমতি নেই।" : (x.message || String(x))); } finally { setBusy(false); }
  };

  return h("div", null,
    perm !== "granted" && h("div", { style: { ...CARD, background: "#FFF6DD", borderColor: "#E8D08A", color: "#7A5B00", fontSize: "14px", lineHeight: 1.5 } },
      perm === "denied" ? "ব্রাউজারে নোটিফিকেশন বন্ধ করা আছে। ব্রাউজারের সেটিং থেকে চালু করুন।" : perm === "unsupported" ? "এই ব্রাউজারে নোটিফিকেশন চলে না।" : "নোটিফিকেশন পেতে অনুমতি দিন।",
      perm === "default" && h("button", { onClick: askPermission, style: { display: "block", marginTop: "8px", minHeight: "44px", padding: "8px 16px", borderRadius: "12px", border: "1.5px solid #0E4B43", background: "#fff", color: "#0E4B43", fontWeight: 700, cursor: "pointer" } }, "অনুমতি দিন")),
    h("div", { style: { fontSize: "12px", color: "#5F716C", marginBottom: "10px" } }, "এখন অ্যাপ/ট্যাব খোলা থাকলে তবেই নোটিফিকেশন আসবে। ঔষধের রিমাইন্ডার আলাদা — Health → স্বাস্থ্য তথ্য ট্যাবে।"),
    Row({ title: "খাবার", on: s.meal.on, onToggle: (v) => set("meal", { on: v }), note: "মিল-প্ল্যান থাকলে নোটিফিকেশনে খাবারের নামও আসে।",
      children: MEAL_SLOTS.map((slot) => h("div", { key: slot.id, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "4px 0" } },
        h("span", { style: { fontSize: "14px", color: "#1F2D2A" } }, MEAL_TITLES[slot.id]),
        timeInput(s.meal.times[slot.id], (v) => set("meal", { times: { ...s.meal.times, [slot.id]: v } }), MEAL_TITLES[slot.id]))) }),
    Row({ title: "পানি", on: s.water.on, onToggle: (v) => set("water", { on: v }), disabled: flags.kidney,
      note: flags.kidney ? "কিডনি রোগে পানির পরিমাণ ডাক্তার ঠিক করে দেন, তাই পানির রিমাইন্ডার বন্ধ।" : null,
      children: h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "14px" } },
        "প্রতি", h("select", { value: s.water.everyHours, "aria-label": "কত ঘণ্টা পরপর", onChange: (e) => set("water", { everyHours: Number(e.target.value) }), style: TIME }, [1, 2, 3, 4].map((n) => h("option", { key: n, value: n }, bnNum(n)))),
        "ঘণ্টায়", timeInput(s.water.from, (v) => set("water", { from: v }), "শুরু"), "–", timeInput(s.water.to, (v) => set("water", { to: v }), "শেষ")) }),
    Row({ title: "ব্যায়াম", on: s.exercise.on, onToggle: (v) => set("exercise", { on: v }), note: "ব্যায়ামের দিনে আজকের রুটিন নোটিফিকেশনে আসে; বিশ্রামের দিনে আসে না।",
      children: timeInput(s.exercise.time, (v) => set("exercise", { time: v }), "ব্যায়ামের সময়") }),
    Row({ title: "ঘুমাতে যাওয়া", on: s.sleep.on, onToggle: (v) => set("sleep", { on: v }),
      children: timeInput(s.sleep.time, (v) => set("sleep", { time: v }), "ঘুমাতে যাওয়ার সময়") }),
    Row({ title: "টিকা ও অ্যাপয়েন্টমেন্ট (ক্যালেন্ডার)", on: s.calendar.on, onToggle: (v) => set("calendar", { on: v }), note: "ক্যালেন্ডারের ইভেন্টের কয়েক দিন আগে ও সেই দিন সকালে জানানো হবে (সম্পন্ন ইভেন্ট বাদ)।",
      children: h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "14px" } },
        h("select", { value: s.calendar.daysBefore, "aria-label": "কত দিন আগে", onChange: (e) => set("calendar", { daysBefore: Number(e.target.value) }), style: TIME }, CAL_DAYS_BEFORE.map((n) => h("option", { key: n, value: n }, bnNum(n)))),
        "দিন আগে") }),
    err && ErrorBox(err),
    ok && h("div", { style: { ...CARD, background: "#E4F0E9", color: "#0E4B43", fontSize: "14px" } }, "সংরক্ষিত হয়েছে ✓"),
    PrimaryButton("সংরক্ষণ", save, busy));
}
