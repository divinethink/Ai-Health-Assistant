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
import { listHealthRecords, setMedicationReminderTimes } from "./healthRecordsData.js";

const { useState, useEffect, useRef } = React;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseTimesInput(str) {
  return (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(s));
}

export function MedicationReminders({ familyId, callerMemberId }) {
  const [meds, setMeds] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [savedFlash, setSavedFlash] = useState(null);
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
          .forEach((r) => flat.push({ recordId: r.id, memberId: member.id, memberName: member.name, genericName: r.genericName, reminderTimes: Array.isArray(r.reminderTimes) ? r.reminderTimes : [] }));
      });
      setMeds(flat);
      const ev = {};
      flat.forEach((m) => { ev[m.recordId] = m.reminderTimes.join(", "); });
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
        const key = m.recordId + "_" + nowHHMM;
        if (notifiedRef.current[key] === today) return;
        notifiedRef.current[key] = today;
        try {
          new Notification("ওষুধ সেবনের সময়", { body: m.memberName + " — " + m.genericName });
        } catch (e) { /* notification ব্যর্থ হলে চুপচাপ ignore, app আটকাবে না */ }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [meds, permission]);

  function requestPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => setPermission(p));
  }

  async function handleSave(recordId) {
    setSavedFlash(null);
    const times = parseTimesInput(editValues[recordId]);
    try {
      await setMedicationReminderTimes(familyId, recordId, callerMemberId, times);
      setMeds((prev) => prev.map((m) => (m.recordId === recordId ? { ...m, reminderTimes: times } : m)));
      setSavedFlash(recordId);
    } catch (e) {
      setLoadErr(e.message || String(e));
    }
  }

  if (loadErr) return React.createElement("div", { style: { marginTop: "14px" } }, ErrorBox(loadErr));
  if (!meds) return null;

  return React.createElement(
    "div", { style: { marginTop: "14px", background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #E0E4E2" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 8px" } }, "💊 ওষুধ সেবনের রিমাইন্ডার"),
    React.createElement("div", { style: { fontSize: "12px", color: "#666", marginBottom: "8px" } },
      "সময় লিখুন ২৪-ঘণ্টা ফরম্যাটে, একাধিক সময় কমা (,) দিয়ে আলাদা করুন — যেমন 08:00, 20:00। ⚠️ সীমাবদ্ধতা: app/ব্রাউজার সম্পূর্ণ বন্ধ থাকলে reminder আসবে না, শুধু app খোলা/ব্যাকগ্রাউন্ড ট্যাব অবস্থায় কাজ করবে (কোনো backend push-server নেই, Firebase Free-plan নীতি অনুযায়ী)।"
    ),
    permission !== "granted" && permission !== "unsupported" && React.createElement(
      "button", {
        onClick: requestPermission,
        style: { marginBottom: "10px", padding: "8px 12px", border: "1px solid #0E4B43", borderRadius: "6px", background: "#fff", color: "#0E4B43", fontSize: "13px", cursor: "pointer" },
      }, "🔔 নোটিফিকেশন অনুমতি দিন (রিমাইন্ডার সক্রিয় করতে প্রয়োজন)"
    ),
    permission === "unsupported" && React.createElement("div", { style: { fontSize: "12px", color: "#C0392B", marginBottom: "8px" } }, "এই ব্রাউজার/ডিভাইসে Notification সাপোর্ট নেই।"),

    meds.length === 0 && React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "কোনো active ওষুধ (medicationStatement) পাওয়া যায়নি।"),

    meds.map((m) => React.createElement(
      "div", { key: m.recordId, style: { marginTop: "10px", padding: "10px", background: "#F7FAF9", borderRadius: "8px", border: "1px solid #E0E4E2" } },
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#333" } }, m.memberName + " — " + m.genericName),
      React.createElement("input", {
        type: "text", value: editValues[m.recordId] || "", placeholder: "যেমন: 08:00, 20:00",
        onChange: (e) => setEditValues((prev) => ({ ...prev, [m.recordId]: e.target.value })),
        style: { width: "100%", boxSizing: "border-box", marginTop: "6px", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px" },
      }),
      React.createElement(
        "button", {
          onClick: () => handleSave(m.recordId),
          style: { marginTop: "6px", padding: "6px 12px", border: "1px solid #0E4B43", borderRadius: "6px", background: "#0E4B43", color: "#fff", fontSize: "12px", cursor: "pointer" },
        }, "সেভ করুন"
      ),
      savedFlash === m.recordId && React.createElement("span", { style: { marginLeft: "8px", fontSize: "12px", color: "#0E4B43" } }, "✓ সংরক্ষিত")
    ))
  );
}
