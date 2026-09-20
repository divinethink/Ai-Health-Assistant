// Medication Reminder/Adherence Tracker (owner-request, ২০২৬-০৯-১২, item ২) —
// existing MedicationStatement (healthRecords, resourceType: "medicationStatement")
// reuse করা হয়েছে, নতুন `reminderTimes` optional field (healthRecordsData.js
// setMedicationReminderTimes()) ছাড়া কোনো schema/rules পরিবর্তন লাগেনি।
//
// **সীমাবদ্ধতা (owner-কে জানানো জরুরি, honest disclosure):** এটা true background-push
// না — Firebase Spark-plan-এ Cloud Function/push-server নেই (Architecture Plan §6.1
// নীতি অপরিবর্তিত)। ব্রাউজার Notification API ব্যবহার করে, তাই শুধুমাত্র app/ট্যাব খোলা
// অবস্থায় (বা background tab, ব্রাউজার বন্ধ না থাকলে) reminder কাজ করবে। App সম্পূর্ণ
// বন্ধ থাকলে notification আসবে না। এটাই honest সীমা, UI-তে স্পষ্ট করে বলা আছে।

import { ErrorBox } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { listHealthRecords, setMedicationReminderTimes, setMedicationCalendarEvents } from "./healthRecordsData.js";
import { authorizeGoogleCalendar, createMedicationCalendarEvents, deleteCalendarEventsByIds } from "../../legacy/googleCalendar.js";

const { useState, useEffect, useRef } = React;

// লোকাল তারিখ (UTC না) — বাংলাদেশে রাত ১২টা–ভোর ৬টায় UTC-তারিখ আগের দিন দেখাত।
function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// সংরক্ষণ সবসময় 24-ঘণ্টা "HH:MM" (আগের data/notification-check অপরিবর্তিত); UI-তে ১২-ঘণ্টা।
function to12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return { h: h % 12 === 0 ? 12 : h % 12, m, ap: h < 12 ? "AM" : "PM" };
}
function to24({ h, m, ap }) {
  const hh = (h % 12) + (ap === "PM" ? 12 : 0);
  return String(hh).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
function label12(hhmm) {
  const t = to12(hhmm);
  return t.h + ":" + String(t.m).padStart(2, "0") + " " + t.ap;
}

const DEFAULT_SLOTS = ["08:00", "14:00", "20:00", "11:00", "17:00", "23:00"];
const MEAL_LABELS = { before: "খাবারের আগে", after: "খাবারের পরে", any: "যেকোনো সময়" };

// endDate না থাকলে শুরুর তারিখ + কতদিন থেকে হিসাব (দুটোই থাকলে)।
function fallbackEndDate(startDate, durationDays) {
  if (!startDate || !durationDays) return "";
  const d = new Date(startDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(durationDays) - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function sel(value, onChange, options, width) {
  return React.createElement("select", {
    value, onChange: (e) => onChange(e.target.value),
    style: { padding: "7px 4px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", background: "#fff", width: width || "auto" },
  }, options.map(([v, l]) => React.createElement("option", { key: v, value: v }, l)));
}

export function MedicationReminders({ familyId, callerMemberId }) {
  const [meds, setMeds] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [savedFlash, setSavedFlash] = useState(null);
  const [calBusy, setCalBusy] = useState(null); // recordId
  const [calMsg, setCalMsg] = useState(null); // { recordId, ok, text }
  const [permission, setPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const notifiedRef = useRef({}); // { "recordId_HH:MM": "YYYY-MM-DD" } — একই দিনে দ্বিতীয়বার notify এড়াতে

  async function loadMeds() {
    setLoadErr(null);
    try {
      const members = await listMembers(familyId);
      const perMember = await Promise.all(
        members.map((m) => listHealthRecords(familyId, m.id).then((records) => ({ member: m, records })))
      );
      const flat = [];
      perMember.forEach(({ member, records }) => {
        records
          .filter((r) => r.resourceType === "medicationStatement" && r.status === "active")
          .forEach((r) => flat.push({ recordId: r.id, memberId: member.id, memberName: member.name, genericName: r.genericName, frequency: r.frequency || null, durationDays: r.durationDays || null, startDate: r.startDate || null, endDate: r.endDate || null, mealTiming: r.mealTiming || null, calendarEventIds: (r.calendarEventIds && Array.isArray(r.calendarEventIds[callerMemberId])) ? r.calendarEventIds[callerMemberId] : [], reminderTimes: Array.isArray(r.reminderTimes) ? r.reminderTimes : [] }));
      });
      setMeds(flat);
      const ev = {};
      flat.forEach((m) => { ev[m.recordId] = { slots: [...m.reminderTimes], endDate: m.endDate || fallbackEndDate(m.startDate, m.durationDays), mealTiming: m.mealTiming || "any" }; });
      setEditValues(ev);
    } catch (e) {
      setLoadErr(e.message || String(e));
    }
  }

  useEffect(() => { loadMeds(); }, [familyId]);

  // প্রতি ৬০ সেকেন্ডে current time-এর সাথে মিলিয়ে দেখা — client-side, কোনো
  // backend/Cloud Function লাগে না, উপরের সীমাবদ্ধতা-নোট প্রযোজ্য।
  useEffect(() => {
    if (!meds || permission !== "granted") return;
    const interval = setInterval(() => {
      const nowHHMM = new Date().toTimeString().slice(0, 5);
      const today = todayStr();
      meds.forEach((m) => {
        if (!m.reminderTimes.includes(nowHHMM)) return;
        if (m.endDate && today > m.endDate) return; // মেয়াদ শেষ — আর notify নয়
        const key = m.recordId + "_" + nowHHMM;
        if (notifiedRef.current[key] === today) return;
        notifiedRef.current[key] = today;
        try {
          new Notification("ওষুধ সেবনের সময়", { body: m.memberName + " — " + m.genericName + (m.mealTiming && m.mealTiming !== "any" ? " (" + MEAL_LABELS[m.mealTiming] + ")" : "") });
        } catch (e) { /* notification ব্যর্থ হলে চুপচাপ ignore, app আটকাবে না */ }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [meds, permission]);

  function requestPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => setPermission(p));
  }

  function setEdit(recordId, patch) {
    setEditValues((prev) => ({ ...prev, [recordId]: { ...prev[recordId], ...patch } }));
  }

  function setSlotCount(recordId, n) {
    const cur = (editValues[recordId] && editValues[recordId].slots) || [];
    const next = cur.slice(0, n);
    while (next.length < n) next.push(DEFAULT_SLOTS[next.length] || "08:00");
    setEdit(recordId, { slots: next });
  }

  // সেভ করে { times, endDate, mealTiming } ফেরত দেয়; ব্যর্থ হলে null।
  async function saveSchedule(recordId) {
    setSavedFlash(null);
    const ev = editValues[recordId] || { slots: [], endDate: "", mealTiming: "any" };
    const times = [...new Set(ev.slots)].sort();
    const endDate = ev.endDate || null;
    try {
      await setMedicationReminderTimes(familyId, recordId, callerMemberId, times, { endDate, mealTiming: ev.mealTiming });
      setMeds((prev) => prev.map((m) => (m.recordId === recordId ? { ...m, reminderTimes: times, endDate, mealTiming: ev.mealTiming } : m)));
      setEdit(recordId, { slots: times });
      setSavedFlash(recordId);
      return { times, endDate, mealTiming: ev.mealTiming };
    } catch (e) {
      setLoadErr(e.message || String(e));
      return null;
    }
  }

  async function handleSave(recordId) { await saveSchedule(recordId); }

  // Google Calendar-এ যোগ/আপডেট: (১) সম্মতি (user-gesture-এর মধ্যেই, আগে) (২) সেভ
  // (৩) পুরনো event সরানো (৪) নতুন recurring event তৈরি (৫) event-ID সংরক্ষণ।
  async function handleCalendarSync(m) {
    setCalMsg(null);
    setCalBusy(m.recordId);
    try {
      await authorizeGoogleCalendar();
      const saved = await saveSchedule(m.recordId);
      if (!saved) return;
      if (m.calendarEventIds.length > 0) await deleteCalendarEventsByIds(m.calendarEventIds);
      const ids = await createMedicationCalendarEvents({
        memberName: m.memberName, genericName: m.genericName,
        mealTimingLabel: saved.mealTiming && saved.mealTiming !== "any" ? MEAL_LABELS[saved.mealTiming] : "",
        times: saved.times, startDate: m.startDate, endDate: saved.endDate,
      });
      await setMedicationCalendarEvents(familyId, m.recordId, callerMemberId, ids);
      setMeds((prev) => prev.map((x) => (x.recordId === m.recordId ? { ...x, calendarEventIds: ids } : x)));
      setCalMsg({ recordId: m.recordId, ok: true, text: "✓ Google Calendar-এ যুক্ত হয়েছে (" + ids.length + "টি বেলা, প্রতিদিন)" });
    } catch (e) {
      setCalMsg({ recordId: m.recordId, ok: false, text: e.message || String(e) });
    } finally {
      setCalBusy(null);
    }
  }

  async function handleCalendarRemove(m) {
    setCalMsg(null);
    setCalBusy(m.recordId);
    try {
      await authorizeGoogleCalendar();
      await deleteCalendarEventsByIds(m.calendarEventIds);
      await setMedicationCalendarEvents(familyId, m.recordId, callerMemberId, []);
      setMeds((prev) => prev.map((x) => (x.recordId === m.recordId ? { ...x, calendarEventIds: [] } : x)));
      setCalMsg({ recordId: m.recordId, ok: true, text: "✓ Google Calendar থেকে সরানো হয়েছে" });
    } catch (e) {
      setCalMsg({ recordId: m.recordId, ok: false, text: e.message || String(e) });
    } finally {
      setCalBusy(null);
    }
  }

  if (loadErr) return React.createElement("div", { style: { marginTop: "14px" } }, ErrorBox(loadErr));
  if (!meds) return null;

  return React.createElement(
    "div", { style: { marginTop: "14px", background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #E0E4E2" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 8px" } }, "💊 ওষুধ সেবনের রিমাইন্ডার"),
    React.createElement("div", { style: { fontSize: "12px", color: "#666", marginBottom: "8px" } },
      "কয় বেলা খাবেন, প্রতি বেলার সময় (১২-ঘণ্টা), খাবারের আগে/পরে এবং কত তারিখ পর্যন্ত খাবেন — বেছে নিয়ে সেভ করুন। ⚠️ app-এর নিজস্ব reminder শুধু app খোলা/ব্যাকগ্রাউন্ড ট্যাব অবস্থায় কাজ করে (কোনো backend push-server নেই) — app বন্ধ থাকলেও পেতে \"Google Calendar-এ যোগ করুন\" ব্যবহার করুন।"
    ),
    permission !== "granted" && permission !== "unsupported" && React.createElement(
      "button", {
        onClick: requestPermission,
        style: { marginBottom: "10px", padding: "8px 12px", border: "1px solid #0E4B43", borderRadius: "6px", background: "#fff", color: "#0E4B43", fontSize: "13px", cursor: "pointer" },
      }, "🔔 নোটিফিকেশন অনুমতি দিন (রিমাইন্ডার সক্রিয় করতে প্রয়োজন)"
    ),
    permission === "unsupported" && React.createElement("div", { style: { fontSize: "12px", color: "#C0392B", marginBottom: "8px" } }, "এই ব্রাউজার/ডিভাইসে Notification সাপোর্ট নেই।"),

    meds.length === 0 && React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "কোনো active ওষুধ (medicationStatement) পাওয়া যায়নি।"),

    meds.map((m) => {
      const ev = editValues[m.recordId] || { slots: [], endDate: "", mealTiming: "any" };
      const expired = m.endDate && todayStr() > m.endDate;
      const lbl = { fontSize: "12px", color: "#555", margin: "8px 0 3px" };
      return React.createElement(
        "div", { key: m.recordId, style: { marginTop: "10px", padding: "10px", background: "#F7FAF9", borderRadius: "8px", border: "1px solid #E0E4E2" } },
        React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#333" } }, m.memberName + " — " + m.genericName),
        (m.frequency || m.durationDays) && React.createElement("div", { style: { fontSize: "12px", color: "#666" } }, (m.frequency || "") + (m.durationDays ? " · " + m.durationDays + " দিন" : "")),
        m.reminderTimes.length > 0 && React.createElement("div", { style: { fontSize: "12px", color: "#0E4B43", marginTop: "2px" } },
          "⏰ " + m.reminderTimes.map(label12).join(", ") + (m.mealTiming && m.mealTiming !== "any" ? " · " + MEAL_LABELS[m.mealTiming] : "") + (m.endDate ? " · " + m.endDate + " পর্যন্ত" : "")),
        expired && React.createElement("div", { style: { fontSize: "12px", color: "#B3261E", marginTop: "2px" } }, "⏹ মেয়াদ শেষ — রিমাইন্ডার আর আসবে না"),

        React.createElement("div", { style: lbl }, "কয় বেলা"),
        sel(String(ev.slots.length), (v) => setSlotCount(m.recordId, Number(v)), [["0", "রিমাইন্ডার নেই"], ["1", "১ বেলা"], ["2", "২ বেলা"], ["3", "৩ বেলা"], ["4", "৪ বেলা"], ["5", "৫ বেলা"], ["6", "৬ বেলা"]]),

        ev.slots.map((slot, i) => {
          const t = to12(slot);
          const upd = (patch) => setEdit(m.recordId, { slots: ev.slots.map((x, j) => (j === i ? to24({ ...t, ...patch }) : x)) });
          return React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" } },
            React.createElement("span", { style: { fontSize: "12px", color: "#555", minWidth: "48px" } }, (i + 1) + "ম বেলা"),
            sel(String(t.h), (v) => upd({ h: Number(v) }), Array.from({ length: 12 }, (_, k) => [String(k + 1), String(k + 1)]), "56px"),
            React.createElement("span", null, ":"),
            sel(String(t.m), (v) => upd({ m: Number(v) }), Array.from({ length: 60 }, (_, k) => [String(k), String(k).padStart(2, "0")]), "60px"),
            sel(t.ap, (v) => upd({ ap: v }), [["AM", "AM"], ["PM", "PM"]], "64px")
          );
        }),

        React.createElement("div", { style: lbl }, "খাবারের আগে না পরে"),
        sel(ev.mealTiming || "any", (v) => setEdit(m.recordId, { mealTiming: v }), [["before", MEAL_LABELS.before], ["after", MEAL_LABELS.after], ["any", MEAL_LABELS.any]]),

        React.createElement("div", { style: lbl }, "কত তারিখ পর্যন্ত খাবেন" + (!m.endDate && ev.endDate ? " (শুরুর তারিখ + দিন থেকে হিসাব, বদলানো যাবে)" : "")),
        React.createElement("input", {
          type: "date", value: ev.endDate || "",
          onChange: (e) => setEdit(m.recordId, { endDate: e.target.value }),
          style: { padding: "7px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px" },
        }),

        React.createElement("div", null,
          React.createElement(
            "button", {
              onClick: () => handleSave(m.recordId),
              style: { marginTop: "10px", padding: "6px 12px", border: "1px solid #0E4B43", borderRadius: "6px", background: "#0E4B43", color: "#fff", fontSize: "12px", cursor: "pointer" },
            }, "সেভ করুন"
          ),
          savedFlash === m.recordId && React.createElement("span", { style: { marginLeft: "8px", fontSize: "12px", color: "#0E4B43" } }, "✓ সংরক্ষিত")
        ),

        // Google Calendar auto-sync — app বন্ধ থাকলেও ফোনের Calendar reminder দেবে।
        React.createElement("div", { style: { marginTop: "8px" } },
          React.createElement(
            "button", {
              onClick: () => handleCalendarSync(m), disabled: calBusy === m.recordId,
              style: { padding: "6px 12px", border: "1px solid #4285F4", borderRadius: "6px", background: "#fff", color: "#4285F4", fontSize: "12px", cursor: "pointer", marginRight: "8px" },
            }, calBusy === m.recordId ? "..." : (m.calendarEventIds.length > 0 ? "📅 Calendar আপডেট করুন" : "📅 সেভ করে Google Calendar-এ যোগ করুন")
          ),
          m.calendarEventIds.length > 0 && React.createElement(
            "button", {
              onClick: () => handleCalendarRemove(m), disabled: calBusy === m.recordId,
              style: { padding: "6px 12px", border: "1px solid #C0392B", borderRadius: "6px", background: "#fff", color: "#C0392B", fontSize: "12px", cursor: "pointer" },
            }, "Calendar থেকে সরান"
          ),
          m.calendarEventIds.length > 0 && React.createElement("div", { style: { fontSize: "11px", color: "#0E4B43", marginTop: "4px" } }, "📅 Calendar-এ যুক্ত আছে — সময়/তারিখ বদলালে \"Calendar আপডেট করুন\" চাপুন।"),
          calMsg && calMsg.recordId === m.recordId && React.createElement("div", { style: { fontSize: "12px", marginTop: "4px", color: calMsg.ok ? "#0E4B43" : "#B3261E" } }, calMsg.text)
        )
      );
    })
  );
}
