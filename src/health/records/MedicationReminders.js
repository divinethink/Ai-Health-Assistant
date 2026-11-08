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
import { listHealthRecords, createHealthRecord, setMedicationReminderTimes, setMedicationCalendarEvents } from "./healthRecordsData.js";
import { authorizeGoogleCalendar, createMedicationCalendarEvents, deleteCalendarEventsByIds } from "../../legacy/googleCalendar.js";

// UI পুনর্গঠন (owner-request, ২০২৬-০৯-১৭): কমপ্যাক্ট তালিকা (ট্যাপে খোলে), এই ট্যাবেই নতুন
// ওষুধ যোগ (নাম-সাজেশনসহ), "আজকের ওষুধ" + খেয়েছি-চিহ্ন (শুধু এই ডিভাইসের localStorage —
// কোনো নতুন schema/rules নেই), মেয়াদের হিসাব। ডেটা-ফাংশন/Calendar-sync অপরিবর্তিত।

const { useState, useEffect, useRef } = React;
const h = React.createElement;

const GREEN = "#0E4B43";
const F = "14px";
const TAKEN_KEY = "hs-med-taken";

function bn(n) { return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]); }
function dateStr(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function todayStr() { return dateStr(new Date()); }
function addDays(ymd, n) { const d = new Date(ymd + "T00:00:00"); d.setDate(d.getDate() + n); return dateStr(d); }
function daysLeft(endDate) {
  if (!endDate) return null;
  const a = new Date(todayStr() + "T00:00:00"), b = new Date(endDate + "T00:00:00");
  return Math.round((b - a) / 86400000);
}
// "08:00" → "সকাল ৮:০০" (বয়স্কদের জন্য বাংলায় পড়া সহজ)
function bnTime(hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  const per = hh < 4 ? "রাত" : hh < 12 ? "সকাল" : hh < 16 ? "দুপুর" : hh < 18 ? "বিকাল" : hh < 20 ? "সন্ধ্যা" : "রাত";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return per + " " + bn(h12) + ":" + bn(String(mm).padStart(2, "0"));
}
const MEAL_LABELS = { before: "খাবারের আগে", after: "খাবারের পরে", any: "যেকোনো সময়" };
const SLOT_DEFAULTS = { 1: ["08:00"], 2: ["08:00", "20:00"], 3: ["08:00", "14:00", "20:00"], 4: ["08:00", "13:00", "18:00", "22:00"] };
const DAY_OPTIONS = [3, 5, 7, 10, 14, 30];

// endDate না থাকলে শুরুর তারিখ + কতদিন থেকে হিসাব।
function fallbackEndDate(startDate, durationDays) {
  if (!startDate || !durationDays) return "";
  return addDays(startDate, Number(durationDays) - 1);
}

// সাধারণ ওষুধের নাম (শুধু নামের সাজেশন, কোনো ডোজ/তথ্য নয়)।
const COMMON_MEDS = ["Paracetamol", "Ibuprofen", "Naproxen", "Diclofenac", "Mefenamic Acid", "Aspirin", "Esomeprazole", "Omeprazole", "Pantoprazole", "Rabeprazole", "Domperidone", "Ondansetron", "Metoclopramide", "Antacid", "Cetirizine", "Levocetirizine", "Fexofenadine", "Bilastine", "Loratadine", "Chlorpheniramine", "Montelukast", "Salbutamol", "Ambroxol", "Azithromycin", "Amoxicillin", "Amoxicillin + Clavulanic Acid", "Cefixime", "Cefuroxime", "Cephalexin", "Ciprofloxacin", "Levofloxacin", "Metronidazole", "Doxycycline", "Fluconazole", "Prednisolone", "Vitamin D3", "Calcium", "Iron + Folic Acid", "Vitamin B Complex", "Vitamin C", "Zinc Sulfate", "ORS", "Metformin", "Gliclazide", "Glimepiride", "Insulin", "Amlodipine", "Losartan", "Telmisartan", "Atenolol", "Bisoprolol", "Atorvastatin", "Rosuvastatin", "Clopidogrel", "Levothyroxine", "Thyrox", "Clonazepam", "Lactulose", "Bisacodyl", "Isabgol (Psyllium Husk)", "Loperamide", "Itopride"];

function loadTaken() {
  try {
    const v = JSON.parse(localStorage.getItem(TAKEN_KEY) || "null");
    if (v && v.date === todayStr() && v.taken) return v.taken;
  } catch (e) { /* ignore */ }
  return {};
}
function saveTaken(taken) {
  try { localStorage.setItem(TAKEN_KEY, JSON.stringify({ date: todayStr(), taken })); } catch (e) { /* ignore */ }
}

function chip(active, label, onClick, key) {
  return h("button", {
    key: key || label, type: "button", onClick,
    style: { padding: "7px 14px", minHeight: "36px", borderRadius: "999px", fontSize: F, fontWeight: 600, cursor: "pointer", border: active ? "1px solid " + GREEN : "1px solid #C3D2CA", background: active ? GREEN : "#fff", color: active ? "#fff" : "#2B3A36" },
  }, label);
}
function lblEl(text) { return h("div", { style: { fontSize: F, color: "#3E4E49", fontWeight: 600, margin: "12px 0 6px" } }, text); }
function timeInputs(slots, onChange) {
  return h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
    slots.map((slot, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: "8px" } },
      h("span", { style: { fontSize: F, color: "#3E4E49", minWidth: "72px" } }, bnTime(slot).split(" ")[0]),
      h("input", { type: "time", value: slot, onChange: (e) => e.target.value && onChange(slots.map((x, j) => (j === i ? e.target.value : x))),
        style: { padding: "8px 10px", border: "1px solid #D3E0D9", borderRadius: "10px", fontSize: F, background: "#fff" } }),
      h("span", { style: { fontSize: F, color: GREEN } }, bnTime(slot)))));
}

export function MedicationReminders({ familyId, callerMemberId, selectedMemberId }) {
  const [meds, setMeds] = useState(null);
  const [members, setMembers] = useState([]);
  const [knownNames, setKnownNames] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [savedFlash, setSavedFlash] = useState(null);
  const [calBusy, setCalBusy] = useState(null);
  const [calMsg, setCalMsg] = useState(null);
  const [permission, setPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const [taken, setTaken] = useState(loadTaken);
  const [tick, setTick] = useState(0);
  const [todayOpen, setTodayOpen] = useState(true);
  const notifiedRef = useRef({});

  // নতুন ওষুধ যোগের ফর্ম
  const [addOpen, setAddOpen] = useState(false);
  const [aName, setAName] = useState("");
  const [aMember, setAMember] = useState(selectedMemberId || callerMemberId);
  const [aCount, setACount] = useState(3);
  const [aSlots, setASlots] = useState(SLOT_DEFAULTS[3]);
  const [aMeal, setAMeal] = useState("after");
  const [aDays, setADays] = useState(7);
  const [aBusy, setABusy] = useState(false);
  const [aErr, setAErr] = useState(null);
  const [suggOpen, setSuggOpen] = useState(false);

  async function loadMeds() {
    setLoadErr(null);
    try {
      const ms = await listMembers(familyId);
      setMembers(ms);
      const perMember = await Promise.all(ms.map((m) => listHealthRecords(familyId, m.id).then((records) => ({ member: m, records }))));
      const flat = []; const names = [];
      perMember.forEach(({ member, records }) => {
        records.filter((r) => r.resourceType === "medicationStatement").forEach((r) => {
          if (r.genericName) names.push(r.genericName);
          if (r.status !== "active") return;
          flat.push({ recordId: r.id, memberId: member.id, memberName: member.name, genericName: r.genericName, frequency: r.frequency || null, durationDays: r.durationDays || null, startDate: r.startDate || null, endDate: r.endDate || null, mealTiming: r.mealTiming || null, calendarEventIds: (r.calendarEventIds && Array.isArray(r.calendarEventIds[callerMemberId])) ? r.calendarEventIds[callerMemberId] : [], reminderTimes: Array.isArray(r.reminderTimes) ? r.reminderTimes : [] });
        });
      });
      setMeds(flat);
      setKnownNames([...new Set(names)]);
      const ev = {};
      flat.forEach((m) => { ev[m.recordId] = { slots: [...m.reminderTimes], endDate: m.endDate || fallbackEndDate(m.startDate, m.durationDays), mealTiming: m.mealTiming || "any" }; });
      setEditValues(ev);
    } catch (e) { setLoadErr(e.message || String(e)); }
  }
  useEffect(() => { loadMeds(); }, [familyId]);
  useEffect(() => { if (selectedMemberId) setAMember(selectedMemberId); }, [selectedMemberId]);

  // প্রতি ৬০ সেকেন্ডে: tick (UI refresh) + notification — app খোলা অবস্থায় (backend push নেই)।
  useEffect(() => {
    if (!meds) return;
    const interval = setInterval(() => {
      setTick((x) => x + 1);
      if (permission !== "granted") return;
      const nowHHMM = new Date().toTimeString().slice(0, 5);
      const today = todayStr();
      meds.forEach((m) => {
        if (!m.reminderTimes.includes(nowHHMM)) return;
        if (m.endDate && today > m.endDate) return;
        const key = m.recordId + "_" + nowHHMM;
        if (notifiedRef.current[key] === today) return;
        notifiedRef.current[key] = today;
        try { new Notification("ওষুধ সেবনের সময়", { body: m.memberName + " — " + m.genericName + (m.mealTiming && m.mealTiming !== "any" ? " (" + MEAL_LABELS[m.mealTiming] + ")" : "") }); } catch (e) { /* ignore */ }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [meds, permission]);

  function requestPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => setPermission(p));
  }
  function setEdit(recordId, patch) { setEditValues((prev) => ({ ...prev, [recordId]: { ...prev[recordId], ...patch } })); }
  function toggleTaken(key) {
    setTaken((prev) => { const n = { ...prev }; if (n[key]) delete n[key]; else n[key] = true; saveTaken(n); return n; });
  }

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
    } catch (e) { setLoadErr(e.message || String(e)); return null; }
  }

  async function handleCalendarSync(m) {
    setCalMsg(null); setCalBusy(m.recordId);
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
      setCalMsg({ recordId: m.recordId, ok: true, text: "✓ Google Calendar-এ যুক্ত হয়েছে (" + bn(ids.length) + "টি বেলা, প্রতিদিন)" });
    } catch (e) { setCalMsg({ recordId: m.recordId, ok: false, text: e.message || String(e) }); }
    finally { setCalBusy(null); }
  }
  async function handleCalendarRemove(m) {
    setCalMsg(null); setCalBusy(m.recordId);
    try {
      await authorizeGoogleCalendar();
      await deleteCalendarEventsByIds(m.calendarEventIds);
      await setMedicationCalendarEvents(familyId, m.recordId, callerMemberId, []);
      setMeds((prev) => prev.map((x) => (x.recordId === m.recordId ? { ...x, calendarEventIds: [] } : x)));
      setCalMsg({ recordId: m.recordId, ok: true, text: "✓ Google Calendar থেকে সরানো হয়েছে" });
    } catch (e) { setCalMsg({ recordId: m.recordId, ok: false, text: e.message || String(e) }); }
    finally { setCalBusy(null); }
  }

  function pickCount(n) { setACount(n); setASlots(SLOT_DEFAULTS[n]); }

  async function handleAdd() {
    setAErr(null);
    const name = aName.trim();
    if (!name) { setAErr("ওষুধের নাম লিখুন।"); return; }
    if (!aMember) { setAErr("সদস্য বাছুন।"); return; }
    if (meds.some((m) => m.memberId === aMember && m.genericName.trim().toLowerCase() === name.toLowerCase())) { setAErr("এই ওষুধ এই সদস্যের তালিকায় আগেই আছে।"); return; }
    const times = [...new Set(aSlots)].sort();
    const start = todayStr();
    const endDate = aDays ? addDays(start, aDays - 1) : null;
    const freq = "দিনে " + bn(times.length) + " বার" + (aMeal !== "any" ? ", " + MEAL_LABELS[aMeal] : "");
    setABusy(true);
    try {
      const id = await createHealthRecord(familyId, aMember, callerMemberId, "medicationStatement", { name, tier: "requires-consult", status: "active", date: start, frequency: freq, durationDays: aDays || "" });
      await setMedicationReminderTimes(familyId, id, callerMemberId, times, { endDate, mealTiming: aMeal });
      if (permission === "default") requestPermission();
      setAName(""); setAddOpen(false); setSuggOpen(false);
      await loadMeds();
    } catch (e) { setAErr(e.message || String(e)); }
    finally { setABusy(false); }
  }

  if (loadErr) return h("div", { style: { marginTop: "6px" } }, ErrorBox(loadErr));
  if (!meds) return h("p", { style: { color: "#5F716C", fontSize: F } }, "লোড হচ্ছে...");

  const today = todayStr();
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const isExpired = (m) => m.endDate && today > m.endDate;
  const shown = meds.filter((m) => filter === "all" || m.memberId === filter)
    .sort((a, b) => (isExpired(a) ? 1 : 0) - (isExpired(b) ? 1 : 0) || ((a.reminderTimes[0] || "99") < (b.reminderTimes[0] || "99") ? -1 : 1));

  // আজকের ডোজ-তালিকা
  const doses = [];
  shown.forEach((m) => {
    if (isExpired(m) || (m.startDate && m.startDate > today)) return;
    m.reminderTimes.forEach((t) => doses.push({ key: m.recordId + "_" + t, time: t, m }));
  });
  doses.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const takenCount = doses.filter((d) => taken[d.key]).length;

  // নাম-সাজেশন
  const q = aName.trim().toLowerCase();
  const pool = [...knownNames, ...COMMON_MEDS].filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);
  const suggestions = (q
    ? [...pool.filter((n) => n.toLowerCase().startsWith(q)), ...pool.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q))]
    : knownNames).filter((n) => n.toLowerCase() !== q).slice(0, 6);

  const card = { background: "#fff", border: "1px solid #D3E0D9", borderRadius: "14px", padding: "12px", marginBottom: "10px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" };

  return h("div", null,
    h("div", { style: { fontSize: "13px", color: "#5F716C", marginBottom: "8px", lineHeight: 1.5 } },
      "🔔 অ্যাপ খোলা থাকলে রিমাইন্ডার বাজবে। অ্যাপ বন্ধ থাকলেও পেতে ওষুধ খুলে \"📅 Calendar\" বাটন চাপুন।"),
    permission !== "granted" && permission !== "unsupported" && h("button", { onClick: requestPermission, style: { marginBottom: "10px", padding: "8px 12px", border: "1px solid " + GREEN, borderRadius: "10px", background: "#fff", color: GREEN, fontSize: F, cursor: "pointer" } }, "🔔 নোটিফিকেশন চালু করুন"),
    permission === "unsupported" && h("div", { style: { fontSize: F, color: "#C0392B", marginBottom: "8px" } }, "এই ব্রাউজারে Notification সাপোর্ট নেই।"),

    members.length > 1 && h("div", { style: { display: "flex", gap: "6px", overflowX: "auto", marginBottom: "10px", paddingBottom: "2px" } },
      [chip(filter === "all", "সবাই", () => setFilter("all"), "all"), ...members.map((mm) => chip(filter === mm.id, mm.name, () => setFilter(mm.id), mm.id))]),

    // আজকের ওষুধ
    doses.length > 0 && h("div", { style: { ...card, background: "#F3FAF6" } },
      h("button", { onClick: () => setTodayOpen((o) => !o), style: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0, fontSize: "15px", fontWeight: 700, color: GREEN, cursor: "pointer" } },
        h("span", null, "📋 আজকের ওষুধ — " + bn(takenCount) + "/" + bn(doses.length) + " খাওয়া হয়েছে"), h("span", null, todayOpen ? "▲" : "▼")),
      todayOpen && h("div", { style: { marginTop: "8px" } }, doses.map((d) => {
        const done = !!taken[d.key];
        const late = !done && d.time < nowHHMM;
        return h("div", { key: d.key, style: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 8px", marginBottom: "5px", borderRadius: "10px", background: done ? "#E2F3E9" : late ? "#FFF3DC" : "#fff", border: "1px solid " + (late ? "#F0D9A8" : "#D3E0D9") } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontSize: F, fontWeight: 600, color: "#1F2D2A", textDecoration: done ? "line-through" : "none" } }, d.m.genericName),
            h("div", { style: { fontSize: "12px", color: "#5F716C" } }, bnTime(d.time) + (members.length > 1 ? " · " + d.m.memberName : "") + (d.m.mealTiming && d.m.mealTiming !== "any" ? " · " + MEAL_LABELS[d.m.mealTiming] : "") + (late ? " · ⏰ সময় পার" : ""))),
          h("button", { onClick: () => toggleTaken(d.key), style: { padding: "7px 12px", minHeight: "36px", borderRadius: "10px", fontSize: F, fontWeight: 600, cursor: "pointer", border: "1px solid " + GREEN, background: done ? GREEN : "#fff", color: done ? "#fff" : GREEN, flexShrink: 0 } }, done ? "✔ খেয়েছি" : "খেয়েছি?"));
      })),
      todayOpen && h("div", { style: { fontSize: "12px", color: "#6B7B76", marginTop: "2px" } }, "(এই চিহ্ন শুধু এই ফোনে থাকে)")),

    // নতুন ওষুধ যোগ
    !addOpen && h("button", { onClick: () => setAddOpen(true), style: { width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "14px", border: "1px dashed " + GREEN, background: "#fff", color: GREEN, fontSize: "15px", fontWeight: 700, cursor: "pointer" } }, "➕ নতুন ওষুধ যোগ করুন"),
    addOpen && h("div", { style: card },
      h("div", { style: { fontSize: "15px", fontWeight: 700, color: GREEN } }, "➕ নতুন ওষুধ (ডাক্তারের দেওয়া)"),
      members.length > 1 && h(React.Fragment, null, lblEl("কার জন্য"), h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, members.map((mm) => chip(aMember === mm.id, mm.name, () => setAMember(mm.id), mm.id)))),
      lblEl("ওষুধের নাম"),
      h("div", { style: { position: "relative" } },
        h("input", { type: "text", value: aName, placeholder: "প্রথম অক্ষর লিখলেই নাম আসবে", autoComplete: "off",
          onChange: (e) => { setAName(e.target.value); setSuggOpen(true); }, onFocus: () => setSuggOpen(true), onBlur: () => setTimeout(() => setSuggOpen(false), 150),
          style: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #C3D2CA", borderRadius: "10px", fontSize: F } }),
        suggOpen && suggestions.length > 0 && h("div", { style: { position: "absolute", left: 0, right: 0, top: "100%", zIndex: 5, marginTop: "2px", background: "#fff", border: "1px solid #C3D2CA", borderRadius: "10px", boxShadow: "0 6px 16px rgba(0,0,0,0.12)", overflow: "hidden" } },
          suggestions.map((n) => h("div", { key: n, onMouseDown: (e) => { e.preventDefault(); setAName(n); setSuggOpen(false); }, onTouchStart: () => { setAName(n); setSuggOpen(false); },
            style: { padding: "10px 12px", fontSize: F, borderBottom: "1px solid #EEF3F0", cursor: "pointer", color: "#1F2D2A" } }, (knownNames.includes(n) ? "🕘 " : "") + n)))),
      lblEl("কয় বেলা"),
      h("div", { style: { display: "flex", gap: "6px" } }, [1, 2, 3, 4].map((n) => chip(aCount === n, bn(n) + " বেলা", () => pickCount(n), "c" + n))),
      lblEl("সময়"), timeInputs(aSlots, setASlots),
      lblEl("খাবারের"),
      h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, ["before", "after", "any"].map((k) => chip(aMeal === k, MEAL_LABELS[k], () => setAMeal(k), k))),
      lblEl("কতদিন খাবেন"),
      h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, [...DAY_OPTIONS.map((d) => chip(aDays === d, bn(d) + " দিন", () => setADays(d), "d" + d)), chip(aDays === 0, "চলবে (নিয়মিত)", () => setADays(0), "d0")]),
      aErr && h("div", { style: { fontSize: F, color: "#B3261E", marginTop: "10px" } }, aErr),
      h("div", { style: { display: "flex", gap: "8px", marginTop: "14px" } },
        h("button", { onClick: handleAdd, disabled: aBusy, style: { flex: 1, padding: "11px", borderRadius: "12px", border: "none", background: GREEN, color: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer" } }, aBusy ? "সেভ হচ্ছে..." : "সেভ করুন"),
        h("button", { onClick: () => { setAddOpen(false); setAErr(null); }, style: { padding: "11px 16px", borderRadius: "12px", border: "1px solid #C3D2CA", background: "#fff", color: "#2B3A36", fontSize: F, cursor: "pointer" } }, "বাতিল"))),

    // ওষুধের তালিকা
    shown.length === 0 && h("p", { style: { color: "#5F716C", fontSize: F } }, "কোনো সক্রিয় ওষুধ নেই। উপরের বাটনে চেপে যোগ করুন।"),
    shown.map((m) => {
      const ev = editValues[m.recordId] || { slots: [], endDate: "", mealTiming: "any" };
      const expired = isExpired(m);
      const left = daysLeft(m.endDate);
      const open = openId === m.recordId;
      const badge = expired ? ["মেয়াদ শেষ", "#6B7B76", "#ECEFEE"] : left === 0 ? ["আজ শেষ দিন", "#8A5A00", "#FFF3DC"] : left !== null && left <= 3 ? ["আর " + bn(left) + " দিন", "#8A5A00", "#FFF3DC"] : left !== null ? ["আর " + bn(left) + " দিন", GREEN, "#EAF6F0"] : ["নিয়মিত", GREEN, "#EAF6F0"];
      return h("div", { key: m.recordId, style: { ...card, padding: 0, overflow: "hidden", opacity: expired ? 0.7 : 1 } },
        h("div", { onClick: () => setOpenId(open ? null : m.recordId), style: { padding: "11px 12px", cursor: "pointer", display: "flex", gap: "8px", alignItems: "flex-start" } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, "💊 " + m.genericName, members.length > 1 && h("span", { style: { fontWeight: 400, color: "#5F716C", fontSize: "13px" } }, " · " + m.memberName)),
            h("div", { style: { fontSize: "13px", color: "#4B5C57", marginTop: "3px", lineHeight: 1.5 } },
              m.reminderTimes.length > 0 ? "⏰ " + m.reminderTimes.map(bnTime).join(", ") : "⏰ সময় সেট করা হয়নি",
              m.mealTiming && m.mealTiming !== "any" ? " · " + MEAL_LABELS[m.mealTiming] : "",
              m.calendarEventIds.length > 0 ? " · 📅" : "")),
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 } },
            h("span", { style: { fontSize: "12px", fontWeight: 600, padding: "3px 9px", borderRadius: "999px", color: badge[1], background: badge[2] } }, badge[0]),
            h("span", { style: { color: "#6B7B76", fontSize: "12px" } }, open ? "▲" : "▼"))),

        open && h("div", { style: { padding: "0 12px 14px", borderTop: "1px solid #EEF3F0", background: "#F7FAF9" } },
          lblEl("কয় বেলা"),
          h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
            [chip(ev.slots.length === 0, "রিমাইন্ডার নেই", () => setEdit(m.recordId, { slots: [] }), "n0"), ...[1, 2, 3, 4].map((n) => chip(ev.slots.length === n, bn(n) + " বেলা", () => setEdit(m.recordId, { slots: ev.slots.length === n ? ev.slots : SLOT_DEFAULTS[n] }), "n" + n))]),
          ev.slots.length > 0 && h(React.Fragment, null, lblEl("সময়"), timeInputs(ev.slots, (v) => setEdit(m.recordId, { slots: v }))),
          lblEl("খাবারের"),
          h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, ["before", "after", "any"].map((k) => chip((ev.mealTiming || "any") === k, MEAL_LABELS[k], () => setEdit(m.recordId, { mealTiming: k }), k))),
          lblEl("কত তারিখ পর্যন্ত খাবেন"),
          h("input", { type: "date", value: ev.endDate || "", onChange: (e) => setEdit(m.recordId, { endDate: e.target.value }), style: { padding: "9px 10px", border: "1px solid #D3E0D9", borderRadius: "10px", fontSize: F, background: "#fff" } }),
          h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px", alignItems: "center" } },
            h("button", { onClick: () => saveSchedule(m.recordId), style: { padding: "10px 18px", borderRadius: "12px", border: "none", background: GREEN, color: "#fff", fontSize: F, fontWeight: 700, cursor: "pointer" } }, "সেভ করুন"),
            h("button", { onClick: () => handleCalendarSync(m), disabled: calBusy === m.recordId, style: { padding: "10px 14px", borderRadius: "12px", border: "1px solid #4285F4", background: "#fff", color: "#4285F4", fontSize: F, cursor: "pointer" } }, calBusy === m.recordId ? "..." : (m.calendarEventIds.length > 0 ? "📅 Calendar আপডেট" : "📅 সেভ করে Calendar-এ যোগ")),
            m.calendarEventIds.length > 0 && h("button", { onClick: () => handleCalendarRemove(m), disabled: calBusy === m.recordId, style: { padding: "10px 14px", borderRadius: "12px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", fontSize: F, cursor: "pointer" } }, "Calendar থেকে সরান"),
            savedFlash === m.recordId && h("span", { style: { fontSize: F, color: GREEN } }, "✓ সংরক্ষিত")),
          calMsg && calMsg.recordId === m.recordId && h("div", { style: { fontSize: F, marginTop: "8px", color: calMsg.ok ? GREEN : "#B3261E" } }, calMsg.text)));
    })
  );
}
