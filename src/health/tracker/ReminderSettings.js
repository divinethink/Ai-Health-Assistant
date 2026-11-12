// রিমাইন্ডার সেটিং — UI (ধাপ ৩)। হিসাব reminderData.js-এ, সেভ trackerData.js-এ।
import { ErrorBox, PrimaryButton } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { saveReminders } from "./trackerData.js";
import { MEAL_SLOTS } from "./mealPlanData.js";
import { normalizeReminders, MEAL_TITLES, CAL_DAYS_BEFORE } from "./reminderData.js";
import { REMINDERS_CHANGED_EVENT } from "./TrackerReminderRunner.js";
import { FamilyHealthCalendar } from "../calendar/FamilyHealthCalendar.js";

const { useState } = React;
const h = React.createElement;
const GREEN = "var(--hs-primary, #0E4B43)";
const CARD = { background: "var(--hs-surface, #fff)", border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "16px", padding: "12px 14px", marginBottom: "10px", boxShadow: "0 1px 3px rgba(14,75,67,0.06)" };
const TIME = { padding: "8px 10px", border: "1.5px solid #C3D2CA", borderRadius: "10px", fontSize: "15px", minHeight: "44px", boxSizing: "border-box", background: "#F7FAF8", color: "#1F2D2A", fontFamily: "inherit" };
const BANNER = { ...CARD, background: "#E4F0E9", borderColor: "#BFD8CB", color: GREEN, fontSize: "13.5px", lineHeight: 1.5 };

// ছোট সুইচ-টগল (role="switch"); স্পর্শ-এরিয়া ≥৪৪px
function Switch({ on, onChange, disabled, label }) {
  return h("button", { type: "button", role: "switch", "aria-checked": !!on, "aria-label": label, disabled, onClick: (e) => { e.stopPropagation(); onChange(!on); },
    style: { flex: "0 0 auto", width: "44px", height: "44px", padding: 0, border: "none", background: "transparent", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1 } },
    h("span", { style: { display: "block", position: "relative", width: "36px", height: "21px", margin: "0 4px", borderRadius: "11px", background: on ? GREEN : "#C3D2CA", transition: "background .15s" } },
      h("span", { style: { position: "absolute", top: "2.5px", left: on ? "17px" : "2.5px", width: "16px", height: "16px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .15s" } })));
}

// গ্রিড-টাইল: ট্যাপে নির্বাচন (নিচে বিস্তারিত খোলে), নিচের সুইচে চালু/বন্ধ। এক লাইনে ৩টি।
function Tile({ icon, title, on, selected, onSelect, onToggle, disabled }) {
  return h("div", { style: { background: selected ? "#F1F8F4" : "var(--hs-surface, #fff)", border: selected ? "1.5px solid " + GREEN : "1.5px solid var(--hs-border, #D9E5DE)", borderRadius: "18px", boxShadow: selected ? "0 4px 12px rgba(14,75,67,0.14)" : "0 1px 3px rgba(14,75,67,0.06)", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0, transition: "box-shadow .15s, background .15s" } },
    h("button", { type: "button", onClick: onSelect, "aria-pressed": !!selected, "aria-label": title,
      style: { width: "100%", minHeight: "72px", padding: "10px 4px 0", border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", fontFamily: "inherit" } },
      h("span", { "aria-hidden": "true", style: { width: "36px", height: "36px", borderRadius: "12px", background: on && !disabled ? "linear-gradient(135deg,#D5EBDF,#E9F4EE)" : "#EEF3F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px", opacity: on && !disabled ? 1 : 0.6 } }, icon),
      h("span", { style: { fontSize: "12.5px", fontWeight: 700, color: "#1F2D2A", lineHeight: 1.25, textAlign: "center", wordBreak: "break-word" } }, title)),
    h(Switch, { on: on && !disabled, onChange: onToggle, disabled, label: title }));
}

// নির্বাচিত টাইলের বিস্তারিত: পূর্ণ নাম, ব্যাখ্যা, চালু থাকলে সময়/বিকল্প
function Detail({ icon, title, note, open, children }) {
  return h("div", { style: { ...CARD, marginTop: "10px", boxShadow: "0 2px 10px rgba(14,75,67,0.08)", borderRadius: "18px" } },
    h("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, h("span", { "aria-hidden": "true" }, icon), title),
    note && h("div", { style: { fontSize: "12.5px", color: "#5F716C", lineHeight: 1.45, marginTop: "4px" } }, note),
    open && children && h("div", { style: { marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #D9E5DE" } }, children));
}
const timeInput = (value, onChange, label) => h("input", { type: "time", value, "aria-label": label, onChange: (e) => e.target.value && onChange(e.target.value), style: TIME });

export function ReminderSettings({ info, familyId, memberId, callerMemberId, onSaved }) {
  const { goal, flags } = info;
  const [s, setS] = useState(() => normalizeReminders(goal && goal.reminders));
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  if (memberId !== callerMemberId) {
    return h("div", null,
      h("div", { style: BANNER }, "রিমাইন্ডার শুধু নিজের প্রোফাইলের জন্য। উপরে নিজের নাম বেছে নিন।"),
      h(FamilyHealthCalendar, { familyId, callerMemberId }));
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

  const selectEl = (value, onCh, label, opts) => h("select", { value, "aria-label": label, onChange: onCh, style: TIME }, opts);
  const flexRow = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "14px" };
  const tiles = [
    { key: "medicine", icon: "💊", short: "ওষুধ", title: "ওষুধ", on: s.medicine.on },
    { key: "meal", icon: "🍽️", short: "খাবার", title: "খাবার", on: s.meal.on, note: "মিল-প্ল্যান থাকলে নোটিফিকেশনে খাবারের নামও আসে।",
      children: MEAL_SLOTS.map((slot) => h("div", { key: slot.id, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "4px 0" } },
        h("span", { style: { fontSize: "14px", color: "#1F2D2A" } }, MEAL_TITLES[slot.id]),
        timeInput(s.meal.times[slot.id], (v) => set("meal", { times: { ...s.meal.times, [slot.id]: v } }), MEAL_TITLES[slot.id]))) },
    { key: "water", icon: "💧", short: "পানি", title: "পানি", on: s.water.on, disabled: flags.kidney,
      note: flags.kidney ? "কিডনি রোগে পানির পরিমাণ ডাক্তার ঠিক করে দেন, তাই পানির রিমাইন্ডার বন্ধ।" : null,
      children: h("div", { style: flexRow }, "প্রতি",
        selectEl(s.water.everyHours, (e) => set("water", { everyHours: Number(e.target.value) }), "কত ঘণ্টা পরপর", [1, 2, 3, 4].map((n) => h("option", { key: n, value: n }, bnNum(n)))),
        "ঘণ্টায়", timeInput(s.water.from, (v) => set("water", { from: v }), "শুরু"), "–", timeInput(s.water.to, (v) => set("water", { to: v }), "শেষ")) },
    { key: "exercise", icon: "🏃", short: "ব্যায়াম", title: "ব্যায়াম", on: s.exercise.on, note: "ব্যায়ামের দিনে আজকের রুটিন নোটিফিকেশনে আসে; বিশ্রামের দিনে আসে না।",
      children: timeInput(s.exercise.time, (v) => set("exercise", { time: v }), "ব্যায়ামের সময়") },
    { key: "sleep", icon: "🌙", short: "ঘুম", title: "ঘুমাতে যাওয়া", on: s.sleep.on,
      children: timeInput(s.sleep.time, (v) => set("sleep", { time: v }), "ঘুমাতে যাওয়ার সময়") },
    { key: "calendar", icon: "📅", short: "টিকা/ইভেন্ট", title: "টিকা ও অ্যাপয়েন্টমেন্ট (ক্যালেন্ডার)", on: s.calendar.on, note: "ক্যালেন্ডারের ইভেন্টের কয়েক দিন আগে ও সেই দিন সকালে জানানো হবে (সম্পন্ন ইভেন্ট বাদ)।",
      children: h("div", { style: flexRow },
        selectEl(s.calendar.daysBefore, (e) => set("calendar", { daysBefore: Number(e.target.value) }), "কত দিন আগে", CAL_DAYS_BEFORE.map((n) => h("option", { key: n, value: n }, bnNum(n)))),
        "দিন আগে") },
  ];
  const cur = tiles.find((x) => x.key === sel);
  const showDetail = cur && (cur.note || (cur.on && !cur.disabled && cur.children));

  return h("div", null,
    perm !== "granted" && h("div", { style: { ...CARD, background: "#FFF6DD", borderColor: "#E8D08A", color: "#7A5B00", fontSize: "13.5px", lineHeight: 1.5 } },
      perm === "denied" ? "ব্রাউজারে নোটিফিকেশন বন্ধ করা আছে। ব্রাউজারের সেটিং থেকে চালু করুন।" : perm === "unsupported" ? "এই ব্রাউজারে নোটিফিকেশন চলে না।" : "নোটিফিকেশন পেতে অনুমতি দিন।",
      perm === "default" && h("button", { onClick: askPermission, style: { display: "block", marginTop: "8px", minHeight: "44px", padding: "8px 16px", borderRadius: "12px", border: "1.5px solid var(--hs-primary, #0E4B43)", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontWeight: 700, cursor: "pointer" } }, "অনুমতি দিন")),
    h("div", { style: { fontSize: "12.5px", color: "#5F716C", lineHeight: 1.5, margin: "0 2px 10px" } }, "নোটিফিকেশন পেতে সুইচ অন করুন।"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" } },
      tiles.map((x) => h(Tile, { key: x.key, icon: x.icon, title: x.short, on: x.on, disabled: x.disabled, selected: sel === x.key, onSelect: () => setSel(x.key), onToggle: (v) => set(x.key, { on: v }) }))),
    showDetail && h(Detail, { icon: cur.icon, title: cur.title, note: cur.note, open: cur.on && !cur.disabled }, cur.children),
    err && ErrorBox(err),
    ok && h("div", { style: BANNER }, "সংরক্ষিত হয়েছে ✓"),
    PrimaryButton("সংরক্ষণ", save, busy),
    h("div", { style: { marginTop: "18px" } }, h(FamilyHealthCalendar, { familyId, callerMemberId })));
}
