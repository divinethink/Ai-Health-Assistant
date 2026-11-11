// রিমাইন্ডার সেটিং — UI (ধাপ ৩)। হিসাব reminderData.js-এ, সেভ trackerData.js-এ।
import { ErrorBox, PrimaryButton } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { saveReminders } from "./trackerData.js";
import { MEAL_SLOTS } from "./mealPlanData.js";
import { normalizeReminders, MEAL_TITLES, CAL_DAYS_BEFORE } from "./reminderData.js";
import { REMINDERS_CHANGED_EVENT } from "./TrackerReminderRunner.js";

const { useState } = React;
const h = React.createElement;
const GREEN = "var(--hs-primary, #0E4B43)";
const CARD = { background: "var(--hs-surface, #fff)", border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "16px", padding: "12px 14px", marginBottom: "10px", boxShadow: "0 1px 3px rgba(14,75,67,0.06)" };
const TIME = { padding: "8px 10px", border: "1.5px solid #C3D2CA", borderRadius: "10px", fontSize: "15px", minHeight: "44px", boxSizing: "border-box", background: "#F7FAF8", color: "#1F2D2A", fontFamily: "inherit" };
const BANNER = { ...CARD, background: "#E4F0E9", borderColor: "#BFD8CB", color: GREEN, fontSize: "13.5px", lineHeight: 1.5 };

// সুইচ-টগল (role="switch"); স্পর্শ-এরিয়া ≥৪৪px
function Switch({ on, onChange, disabled, label }) {
  return h("button", { type: "button", role: "switch", "aria-checked": !!on, "aria-label": label, disabled, onClick: () => onChange(!on),
    style: { flex: "0 0 auto", width: "52px", height: "44px", padding: 0, border: "none", background: "transparent", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1 } },
    h("span", { style: { display: "block", position: "relative", width: "46px", height: "28px", margin: "0 3px", borderRadius: "14px", background: on ? GREEN : "#C3D2CA", transition: "background .15s" } },
      h("span", { style: { position: "absolute", top: "3px", left: on ? "21px" : "3px", width: "22px", height: "22px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .15s" } })));
}

// icon + শিরোনাম + ছোট ব্যাখ্যা বামে, সুইচ ডানে; চালু থাকলে নিচে সময়/বিকল্প
function Row({ icon, title, on, onToggle, disabled, children, note }) {
  const open = on && !disabled;
  return h("div", { style: CARD },
    h("div", { style: { display: "flex", alignItems: "center", gap: "10px", minHeight: "44px" } },
      h("span", { "aria-hidden": "true", style: { flex: "0 0 auto", width: "36px", height: "36px", borderRadius: "12px", background: "#E4F0E9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px" } }, icon),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontSize: "15.5px", fontWeight: 700, color: "#1F2D2A", lineHeight: 1.3 } }, title),
        note && h("div", { style: { fontSize: "12.5px", color: "#5F716C", lineHeight: 1.45, marginTop: "1px" } }, note)),
      h(Switch, { on: open, onChange: onToggle, disabled, label: title })),
    open && children && h("div", { style: { marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #D9E5DE" } }, children));
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
    return h("div", { style: BANNER }, "রিমাইন্ডার শুধু নিজের প্রোফাইলের জন্য। উপরে নিজের নাম বেছে নিন।");
  }
  const set = (key, patch) => { setOk(false); setS((p) => ({ ...p, [key]: { ...p[key], ...patch } })); };

  const askPermission = () => { if (typeof Notification !== "undefined") Notification.requestPermission().then(setPerm); };
  const save = async () => {
    setErr(null); setOk(false); setBusy(true);
    try {
      await saveReminders(familyId, memberId, callerMemberId, s, goal);
      window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT));
      setOk(true); onSaved();
    } catch (x) { setErr(x.code === "permission-denied" ? "এই তথ্য সংরক্ষণের অনুমতি আপনার নেই।" : (x.message || String(x))); } finally { setBusy(false); }
  };

  return h("div", null,
    perm !== "granted" && h("div", { style: { ...CARD, background: "#FFF6DD", borderColor: "#E8D08A", color: "#7A5B00", fontSize: "13.5px", lineHeight: 1.5 } },
      perm === "denied" ? "ব্রাউজারে নোটিফিকেশন বন্ধ করা আছে। ব্রাউজারের সেটিং থেকে চালু করুন।" : perm === "unsupported" ? "এই ব্রাউজারে নোটিফিকেশন চলে না।" : "নোটিফিকেশন পেতে অনুমতি দিন।",
      perm === "default" && h("button", { onClick: askPermission, style: { display: "block", marginTop: "8px", minHeight: "44px", padding: "8px 16px", borderRadius: "12px", border: "1.5px solid var(--hs-primary, #0E4B43)", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontWeight: 700, cursor: "pointer" } }, "অনুমতি দিন")),
    h("div", { style: { fontSize: "12.5px", color: "#5F716C", lineHeight: 1.5, margin: "0 2px 10px" } }, "এখন অ্যাপ/ট্যাব খোলা থাকলে তবেই নোটিফিকেশন আসবে।"),
    Row({ icon: "💊", title: "ওষুধ", on: s.medicine.on, onToggle: (v) => set("medicine", { on: v }),
      note: s.medicine.on ? "ওষুধের সময় এলে জানানো হবে; “খেয়েছি” দিলে আর আসবে না। সময় বদলাতে: Health → স্বাস্থ্য প্রোফাইল → ওষুধ।" : "বন্ধ থাকলে ওষুধের কোনো নোটিফিকেশন আসবে না।" }),
    Row({ icon: "🍽️", title: "খাবার", on: s.meal.on, onToggle: (v) => set("meal", { on: v }), note: "মিল-প্ল্যান থাকলে নোটিফিকেশনে খাবারের নামও আসে।",
      children: MEAL_SLOTS.map((slot) => h("div", { key: slot.id, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "4px 0" } },
        h("span", { style: { fontSize: "14px", color: "#1F2D2A" } }, MEAL_TITLES[slot.id]),
        timeInput(s.meal.times[slot.id], (v) => set("meal", { times: { ...s.meal.times, [slot.id]: v } }), MEAL_TITLES[slot.id]))) }),
    Row({ icon: "💧", title: "পানি", on: s.water.on, onToggle: (v) => set("water", { on: v }), disabled: flags.kidney,
      note: flags.kidney ? "কিডনি রোগে পানির পরিমাণ ডাক্তার ঠিক করে দেন, তাই পানির রিমাইন্ডার বন্ধ।" : null,
      children: h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "14px" } },
        "প্রতি", h("select", { value: s.water.everyHours, "aria-label": "কত ঘণ্টা পরপর", onChange: (e) => set("water", { everyHours: Number(e.target.value) }), style: TIME }, [1, 2, 3, 4].map((n) => h("option", { key: n, value: n }, bnNum(n)))),
        "ঘণ্টায়", timeInput(s.water.from, (v) => set("water", { from: v }), "শুরু"), "–", timeInput(s.water.to, (v) => set("water", { to: v }), "শেষ")) }),
    Row({ icon: "🏃", title: "ব্যায়াম", on: s.exercise.on, onToggle: (v) => set("exercise", { on: v }), note: "ব্যায়ামের দিনে আজকের রুটিন নোটিফিকেশনে আসে; বিশ্রামের দিনে আসে না।",
      children: timeInput(s.exercise.time, (v) => set("exercise", { time: v }), "ব্যায়ামের সময়") }),
    Row({ icon: "🌙", title: "ঘুমাতে যাওয়া", on: s.sleep.on, onToggle: (v) => set("sleep", { on: v }),
      children: timeInput(s.sleep.time, (v) => set("sleep", { time: v }), "ঘুমাতে যাওয়ার সময়") }),
    Row({ icon: "📅", title: "টিকা ও অ্যাপয়েন্টমেন্ট (ক্যালেন্ডার)", on: s.calendar.on, onToggle: (v) => set("calendar", { on: v }), note: "ক্যালেন্ডারের ইভেন্টের কয়েক দিন আগে ও সেই দিন সকালে জানানো হবে (সম্পন্ন ইভেন্ট বাদ)।",
      children: h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "14px" } },
        h("select", { value: s.calendar.daysBefore, "aria-label": "কত দিন আগে", onChange: (e) => set("calendar", { daysBefore: Number(e.target.value) }), style: TIME }, CAL_DAYS_BEFORE.map((n) => h("option", { key: n, value: n }, bnNum(n)))),
        "দিন আগে") }),
    err && ErrorBox(err),
    ok && h("div", { style: BANNER }, "সংরক্ষিত হয়েছে ✓"),
    PrimaryButton("সংরক্ষণ", save, busy));
}
