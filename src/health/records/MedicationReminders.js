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

import { ErrorBox, SheetFrame } from "../../shared/ui.js";
import { suggestMedicines } from "../../shared/searchAliases.js";
import { DocumentUploadForm } from "../documents/DocumentUploadForm.js";
import { takeQuickIntent } from "../../shared/quickIntent.js";
import { PrescriptionPanel } from "../prescriptions/PrescriptionPanel.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { listHealthRecords, createHealthRecord, deleteHealthRecord, setMedicationReminderTimes, setMedicationCalendarEvents } from "./healthRecordsData.js";
import { getMedTaken, setMedDoseTaken } from "../tracker/trackerData.js";
import { doseKey, legacyTakenToKeys, recordIdOfDoseKey } from "./medTaken.js";
import { authorizeGoogleCalendar, createMedicationCalendarEvents, deleteCalendarEventsByIds } from "../../legacy/googleCalendar.js";

// UI পুনর্গঠন (owner-request, ২০২৬-০৯-১৭): কমপ্যাক্ট তালিকা (ট্যাপে খোলে), এই ট্যাবেই নতুন
// ওষুধ যোগ (নাম-সাজেশনসহ), "আজকের ওষুধ" + খেয়েছি-চিহ্ন (শুধু এই ডিভাইসের localStorage —
// কোনো নতুন schema/rules নেই), মেয়াদের হিসাব। ডেটা-ফাংশন/Calendar-sync অপরিবর্তিত।

const { useState, useEffect } = React;
const h = React.createElement;

const GREEN = "var(--hs-primary, #0E4B43)";
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

// পুরনো ব্যবস্থা (শুধু এই ডিভাইস): আজকের চিহ্ন একবার Firestore-এ তুলে আনার জন্য পড়া হয়; আর কোথাও লেখা হয় না।
// তোলা সফল হলে MIGRATED_KEY-তে আজকের তারিখ রাখা হয় (পুরনো ডেটা মোছা হয় না)।
const MIGRATED_KEY = "hs-med-taken-migrated";
function loadLegacyTaken() {
  try {
    if (localStorage.getItem(MIGRATED_KEY) === todayStr()) return {};
    const v = JSON.parse(localStorage.getItem(TAKEN_KEY) || "null");
    if (v && v.date === todayStr() && v.taken) return v.taken;
  } catch (e) { /* ignore */ }
  return {};
}
function markLegacyMigrated() {
  try { localStorage.setItem(MIGRATED_KEY, todayStr()); } catch (e) { /* ignore */ }
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
  const [pastCourses, setPastCourses] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [openId, setOpenId] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null); // ২-ধাপ মোছা
  const [delBusy, setDelBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [savedFlash, setSavedFlash] = useState(null);
  const [calBusy, setCalBusy] = useState(null);
  const [calMsg, setCalMsg] = useState(null);
  const [permission, setPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const [taken, setTaken] = useState({});
  const [takenErr, setTakenErr] = useState(null);
  const [tick, setTick] = useState(0);
  const [todayOpen, setTodayOpen] = useState(true);

  // নতুন ওষুধ যোগের ফর্ম
  const [startIntent] = useState(() => takeQuickIntent(["rx", "medmanual"])); // "যোগ করুন" প্যানেল থেকে সরাসরি আসা
  const [addOpen, setAddOpen] = useState(startIntent === "medmanual");
  const [rxOpen, setRxOpen] = useState(startIntent === "rx"); // "📄 প্রেসক্রিপশন আপলোড" (ধাপ ৬)
  const [rxFile, setRxFile] = useState(null);
  const [rxDocId, setRxDocId] = useState(null);
  const [rxStage, setRxStage] = useState("");
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
      const flat = []; const names = []; const pastMap = {};
      const todayS = todayStr();
      perMember.forEach(({ member, records }) => {
        records.filter((r) => r.resourceType === "medicationStatement").forEach((r) => {
          if (r.genericName) names.push(r.genericName);
          const expiredNow = r.status === "active" && (r.endDate || fallbackEndDate(r.startDate, r.durationDays)) && todayS > (r.endDate || fallbackEndDate(r.startDate, r.durationDays));
          if ((r.status !== "active" || expiredNow) && r.genericName) {
            const k = member.id + "|" + r.genericName.trim().toLowerCase();
            if (!pastMap[k]) pastMap[k] = { key: k, memberId: member.id, memberName: member.name, name: r.genericName, times: Array.isArray(r.reminderTimes) ? r.reminderTimes : [], meal: r.mealTiming || "after", days: r.durationDays ? Number(r.durationDays) : 0 };
          }
          if (r.status !== "active") return;
          flat.push({ recordId: r.id, memberId: member.id, memberName: member.name, genericName: r.genericName, frequency: r.frequency || null, durationDays: r.durationDays || null, startDate: r.startDate || null, endDate: r.endDate || null, mealTiming: r.mealTiming || null, calendarEventIds: (r.calendarEventIds && Array.isArray(r.calendarEventIds[callerMemberId])) ? r.calendarEventIds[callerMemberId] : [], reminderTimes: Array.isArray(r.reminderTimes) ? r.reminderTimes : [], fromRx: !!r.prescriptionDocId, createdMs: r.createdAt && r.createdAt.toMillis ? r.createdAt.toMillis() : 0 });
        });
      });
      setMeds(flat);
      const activeKeys = new Set(flat.filter((m) => !(m.endDate && todayS > m.endDate)).map((m) => m.memberId + "|" + m.genericName.trim().toLowerCase()));
      setPastCourses(Object.values(pastMap).filter((p) => !activeKeys.has(p.key)));
      setKnownNames([...new Set(names)]);
      const ev = {};
      flat.forEach((m) => { ev[m.recordId] = { slots: [...m.reminderTimes], endDate: m.endDate || fallbackEndDate(m.startDate, m.durationDays), mealTiming: m.mealTiming || "any" }; });
      setEditValues(ev);
      await loadTakenState(flat);
    } catch (e) { setLoadErr(e.message || String(e)); }
  }

  // আজকের "খেয়েছি" চিহ্ন Firestore থেকে (সব ডিভাইসে একই); না পড়া গেলে ওই সদস্যের চিহ্ন খালি দেখায় (ওষুধ তালিকা অক্ষত)।
  async function loadTakenState(flat) {
    const date = todayStr();
    const next = {};
    const ids = [...new Set(flat.map((m) => m.memberId))];
    await Promise.all(ids.map(async (id) => { try { Object.assign(next, await getMedTaken(familyId, id, date)); } catch (e) { /* ignore */ } }));
    const legacy = legacyTakenToKeys(loadLegacyTaken());
    if (legacy.length) {
      const byRecord = new Map(flat.map((m) => [m.recordId, m]));
      let allOk = true;
      for (const k of legacy) {
        if (next[k]) continue;
        const m = byRecord.get(recordIdOfDoseKey(k));
        if (!m) continue;
        try { await setMedDoseTaken(familyId, m.memberId, callerMemberId, date, k, true); next[k] = true; } catch (e) { allOk = false; }
      }
      if (allOk) markLegacyMigrated();
    }
    setTaken(next);
  }
  useEffect(() => { loadMeds(); }, [familyId]);
  useEffect(() => { if (selectedMemberId) setAMember(selectedMemberId); }, [selectedMemberId]);

  // প্রতি ৬০ সেকেন্ডে UI refresh (দেরি-হওয়া ডোজ চিহ্নিত রাখতে)। নোটিফিকেশন এখানে নেই — একটাই চালক
  // (Dashboard-এর TrackerReminderRunner) সব ট্যাবে ওষুধের রিমাইন্ডার ও কোর্স-শেষ সতর্কতা দেয়।
  useEffect(() => {
    if (!meds) return undefined;
    const interval = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(interval);
  }, [meds]);

  // গ) আগের কোর্সের ওষুধ আবার — ফর্ম আগে থেকে ভরে দেয়, সেভ চাপলেই নতুন কোর্স শুরু।
  function reuseCourse(p) {
    const n = Math.min(4, Math.max(1, p.times.length || 3));
    setAName(p.name); setAMember(p.memberId); setACount(n);
    setASlots(p.times.length >= 1 && p.times.length <= 4 ? [...p.times].sort() : SLOT_DEFAULTS[n]);
    setAMeal(["before", "after", "any"].includes(p.meal) ? p.meal : "after");
    setADays(p.days && DAY_OPTIONS.includes(p.days) ? p.days : (p.days ? p.days : 0));
    setAErr(null); setAddOpen(true); setSuggOpen(false);
  }

  function requestPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => setPermission(p));
  }
  // ওষুধ মোছা (রেকর্ড-তালিকা থেকে ওষুধ সরায় এখানে এসেছে) — ২-ধাপ confirm; অন্যের রেকর্ড হলে deleteHealthRecord owner-কে notification পাঠায়।
  async function handleDelete(m) {
    setDelBusy(true);
    try { await deleteHealthRecord(familyId, m.recordId, m.memberId, callerMemberId); setDelConfirm(null); setOpenId(null); await loadMeds(); }
    catch (e) { setCalMsg({ recordId: m.recordId, ok: false, text: e.code === "permission-denied" ? "এই ওষুধ মোছার অনুমতি আপনার নেই।" : (e.message || String(e)) }); }
    finally { setDelBusy(false); }
  }
  function setEdit(recordId, patch) { setEditValues((prev) => ({ ...prev, [recordId]: { ...prev[recordId], ...patch } })); }
  async function toggleTaken(key, memberId) {
    const want = !taken[key];
    const apply = (on) => setTaken((prev) => { const n = { ...prev }; if (on) n[key] = true; else delete n[key]; return n; });
    apply(want); setTakenErr(null);
    try { await setMedDoseTaken(familyId, memberId, callerMemberId, todayStr(), key, want); }
    catch (e) {
      apply(!want);
      setTakenErr(e && e.code === "permission-denied" ? "এই সদস্যের ওষুধে চিহ্ন দেওয়ার অনুমতি আপনার নেই।" : "চিহ্ন সংরক্ষণ হয়নি — ইন্টারনেট ঠিক আছে কিনা দেখে আবার চেষ্টা করুন।");
    }
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
      setCalMsg({ recordId: m.recordId, ok: true, text: "✓ Google ক্যালেন্ডারে যুক্ত হয়েছে (" + bn(ids.length) + "টি বেলা, প্রতিদিন)" });
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
    if (!aMember) { setAErr("সদস্য বেছে নিন।"); return; }
    if (meds.some((m) => m.memberId === aMember && !(m.endDate && todayStr() > m.endDate) && m.genericName.trim().toLowerCase() === name.toLowerCase())) { setAErr("এই ওষুধ এই সদস্যের তালিকায় আগেই আছে।"); return; }
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
  const isNew = (m) => !!m.createdMs && Date.now() - m.createdMs < 600000; // শেষ ১০ মিনিটে যোগ = সবার উপরে (🆕)
  const shown = meds.filter((m) => filter === "all" || m.memberId === filter)
    .sort((a, b) => (isNew(b) ? 1 : 0) - (isNew(a) ? 1 : 0) || (isExpired(a) ? 1 : 0) - (isExpired(b) ? 1 : 0) || ((a.reminderTimes[0] || "99") < (b.reminderTimes[0] || "99") ? -1 : 1));

  // আজকের ডোজ-তালিকা
  const doses = [];
  shown.forEach((m) => {
    if (isExpired(m) || (m.startDate && m.startDate > today)) return;
    m.reminderTimes.forEach((t) => doses.push({ key: doseKey(m.recordId, t), time: t, m }));
  });
  doses.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const takenCount = doses.filter((d) => taken[d.key]).length;

  const endingSoon = shown.filter((m) => { const l = daysLeft(m.endDate); return l !== null && l >= 0 && l <= 2; });
  const pastShown = pastCourses.filter((p) => filter === "all" || p.memberId === filter).slice(0, 8);

  // নাম-সাজেশন
  const q = aName.trim().toLowerCase();
  const pool = [...knownNames, ...COMMON_MEDS].filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);
  const suggestions = q
    ? suggestMedicines(pool, q, 6)
    : knownNames.filter((n) => n.toLowerCase() !== q).slice(0, 6).map((n) => ({ label: n, value: n }));

  const card = { background: "#fff", border: "1px solid #D3E0D9", borderRadius: "14px", padding: "12px", marginBottom: "10px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" };

  return h("div", null,
    h("details", { style: { background: "#FFF6DD", border: "1px solid #E8D08A", borderRadius: "12px", padding: "0 12px", marginBottom: "10px", color: "#7A5B00" } },
      h("summary", { style: { minHeight: "44px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 700 } }, h("span", { "aria-hidden": "true" }, "ⓘ"), "ওষুধের ঘণ্টা বাজাতে অ্যাপ খুলে রাখুন"),
      h("div", { style: { fontSize: "13px", lineHeight: 1.5, padding: "0 0 10px" } }, "অ্যাপ খোলা থাকলে ওষুধের সময়ে রিমাইন্ডার আসবে। অ্যাপ বন্ধ থাকলেও পেতে চাইলে ওষুধের কার্ডে \"📅 Calendar\" চাপুন।")),
    permission !== "granted" && permission !== "unsupported" && h("button", { onClick: requestPermission, style: { marginBottom: "10px", padding: "8px 12px", border: "1px solid " + GREEN, borderRadius: "10px", background: "#fff", color: GREEN, fontSize: F, cursor: "pointer" } }, "🔔 নোটিফিকেশন চালু করুন"),
    permission === "unsupported" && h("div", { style: { fontSize: F, color: "#C0392B", marginBottom: "8px" } }, "এই ব্রাউজারে Notification সাপোর্ট নেই।"),

    members.length > 1 && h("div", { style: { display: "flex", gap: "6px", overflowX: "auto", marginBottom: "10px", paddingBottom: "2px" } },
      [chip(filter === "all", "সবাই", () => setFilter("all"), "all"), ...members.map((mm) => chip(filter === mm.id, mm.name, () => setFilter(mm.id), mm.id))]),

    // ঘ) শেষ হতে চলেছে
    endingSoon.length > 0 && h("div", { style: { ...card, background: "#FFF6E5", border: "1px solid #F0D9A8" } },
      h("div", { style: { fontSize: "15px", fontWeight: 700, color: "#8A5A00", marginBottom: "6px" } }, "⚠️ ওষুধ শেষ হতে চলেছে"),
      endingSoon.map((m) => h("div", { key: m.recordId, style: { fontSize: F, color: "#5B3B00", marginBottom: "3px" } }, "• " + m.genericName + (members.length > 1 ? " (" + m.memberName + ")" : "") + " — " + (daysLeft(m.endDate) === 0 ? "আজ শেষ দিন" : "আর " + bn(daysLeft(m.endDate)) + " দিন"))),
      h("div", { style: { fontSize: "12px", color: "#8A5A00", marginTop: "4px" } }, "চালিয়ে যেতে হলে ডাক্তারের পরামর্শ নিন ও ওষুধ কিনে রাখুন।")),

    // আজকের ওষুধ
    doses.length > 0 && h("div", { style: { ...card, background: "#F3FAF6" } },
      h("button", { onClick: () => setTodayOpen((o) => !o), style: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0, fontSize: "15px", fontWeight: 700, color: GREEN, cursor: "pointer" } },
        h("span", null, "📋 আজকের ওষুধ — " + bn(takenCount) + "/" + bn(doses.length) + " খাওয়া হয়েছে"), h("span", null, todayOpen ? "▲" : "▼")),
      takenErr && h("div", { style: { marginTop: "8px", padding: "8px 10px", borderRadius: "10px", background: "#FBE3E1", color: "#B3261E", fontSize: "13px" } }, takenErr),
      todayOpen && h("div", { style: { marginTop: "8px" } }, doses.map((d) => {
        const done = !!taken[d.key];
        const late = !done && d.time < nowHHMM;
        return h("div", { key: d.key, style: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 8px", marginBottom: "5px", borderRadius: "10px", background: done ? "#E2F3E9" : late ? "#FFF3DC" : "#fff", border: "1px solid " + (late ? "#F0D9A8" : "#D3E0D9") } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontSize: F, fontWeight: 600, color: "#1F2D2A", textDecoration: done ? "line-through" : "none" } }, d.m.genericName),
            h("div", { style: { fontSize: "12px", color: "#5F716C" } }, bnTime(d.time) + (members.length > 1 ? " · " + d.m.memberName : "") + (d.m.mealTiming && d.m.mealTiming !== "any" ? " · " + MEAL_LABELS[d.m.mealTiming] : "") + (late ? " · ⏰ সময় পার" : ""))),
          h("button", { onClick: () => toggleTaken(d.key, d.m.memberId), style: { padding: "7px 12px", minHeight: "36px", borderRadius: "10px", fontSize: F, fontWeight: 600, cursor: "pointer", border: "1px solid " + GREEN, background: done ? GREEN : "#fff", color: done ? "#fff" : GREEN, flexShrink: 0 } }, done ? "✔ খেয়েছি" : "খেয়েছি?"));
      })),
      null),

    // নতুন ওষুধ যোগ
    !addOpen && pastShown.length > 0 && h("div", { style: { marginBottom: "10px" } },
      h("div", { style: { fontSize: F, fontWeight: 600, color: "#3E4E49", marginBottom: "6px" } }, "🔁 আগের ওষুধ আবার শুরু করুন"),
      h("div", { style: { display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" } },
        pastShown.map((p) => h("button", { key: p.key, onClick: () => reuseCourse(p), style: { flexShrink: 0, padding: "7px 14px", minHeight: "36px", borderRadius: "999px", fontSize: F, fontWeight: 600, cursor: "pointer", border: "1px solid #C3D2CA", background: "#fff", color: GREEN } }, p.name + (members.length > 1 ? " · " + p.memberName : ""))))),
    rxOpen && h(SheetFrame, { title: "💊 প্রেসক্রিপশন থেকে ওষুধ", onClose: () => { setRxOpen(false); setRxFile(null); }, scrollKey: (rxFile ? "p" : "u") + rxStage },
      !rxFile && h(DocumentUploadForm, { familyId, targetMemberId: selectedMemberId || aMember, callerMemberId, onPrescription: (f, _p, id) => { setRxDocId(id || null); setRxFile(f); } }),
      rxFile && h(PrescriptionPanel, { key: rxFile.name + rxFile.size, familyId, targetMemberId: selectedMemberId || aMember, callerMemberId, file: rxFile, docId: rxDocId, onDone: () => loadMeds(), onClose: () => { setRxOpen(false); setRxFile(null); }, closeLabel: "ওষুধের তালিকায় যান", onStageChange: setRxStage })),
    addOpen && h(SheetFrame, { title: "➕ নতুন ওষুধ (ডাক্তারের দেওয়া)", onClose: () => { setAddOpen(false); setAErr(null); setSuggOpen(false); }, footer: h("div", { style: { display: "flex", gap: "8px" } },
        h("button", { onClick: handleAdd, disabled: aBusy, style: { flex: 1, minHeight: "48px", padding: "11px", borderRadius: "12px", border: "none", background: aBusy ? "#8FAFA9" : GREEN, color: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer" } }, aBusy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"),
        h("button", { onClick: () => { setAddOpen(false); setAErr(null); }, style: { minHeight: "48px", padding: "11px 16px", borderRadius: "12px", border: "1px solid #C3D2CA", background: "#fff", color: "#2B3A36", fontSize: F, cursor: "pointer" } }, "বাতিল")) },
      members.length > 1 && h(React.Fragment, null, lblEl("কার জন্য"), h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, members.map((mm) => chip(aMember === mm.id, mm.name, () => setAMember(mm.id), mm.id)))),
      lblEl("ওষুধের নাম"),
      h("div", { style: { position: "relative" } },
        h("input", { type: "text", value: aName, placeholder: "বাংলা/English/ব্র্যান্ড (নাপা, Napa)", autoComplete: "off",
          onChange: (e) => { setAName(e.target.value); setSuggOpen(true); }, onFocus: () => setSuggOpen(true), onBlur: () => setTimeout(() => setSuggOpen(false), 150),
          style: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #C3D2CA", borderRadius: "10px", fontSize: F } }),
        suggOpen && suggestions.length > 0 && h("div", { style: { position: "absolute", left: 0, right: 0, top: "100%", zIndex: 5, marginTop: "2px", background: "#fff", border: "1px solid #C3D2CA", borderRadius: "10px", boxShadow: "0 6px 16px rgba(0,0,0,0.12)", overflow: "hidden" } },
          suggestions.map(({ label, value: n }) => h("div", { key: n, onMouseDown: (e) => { e.preventDefault(); setAName(n); setSuggOpen(false); }, onTouchStart: () => { setAName(n); setSuggOpen(false); },
            style: { padding: "10px 12px", fontSize: F, borderBottom: "1px solid #EEF3F0", cursor: "pointer", color: "#1F2D2A" } }, (knownNames.includes(n) ? "🕘 " : "") + label)))),
      lblEl("কয় বেলা"),
      h("div", { style: { display: "flex", gap: "6px" } }, [1, 2, 3, 4].map((n) => chip(aCount === n, bn(n) + " বেলা", () => pickCount(n), "c" + n))),
      lblEl("সময়"), timeInputs(aSlots, setASlots),
      lblEl("খাবারের"),
      h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, ["before", "after", "any"].map((k) => chip(aMeal === k, MEAL_LABELS[k], () => setAMeal(k), k))),
      lblEl("কতদিন খাবেন"),
      h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, [...DAY_OPTIONS.map((d) => chip(aDays === d, bn(d) + " দিন", () => setADays(d), "d" + d)), chip(aDays === 0, "চলবে (নিয়মিত)", () => setADays(0), "d0")]),
      aErr && h("div", { style: { fontSize: F, color: "#B3261E", marginTop: "10px" } }, aErr)),

    // ওষুধের তালিকা
    shown.length === 0 && h("p", { style: { color: "#5F716C", fontSize: F } }, "এখনো কোনো ওষুধ নেই — উপরের ＋ যোগ করুন চাপুন।"),
    shown.map((m) => {
      const ev = editValues[m.recordId] || { slots: [], endDate: "", mealTiming: "any" };
      const expired = isExpired(m);
      const left = daysLeft(m.endDate);
      const open = openId === m.recordId;
      const badge = expired ? ["মেয়াদ শেষ", "#6B7B76", "#ECEFEE"] : left === 0 ? ["আজ শেষ দিন", "#8A5A00", "#FFF3DC"] : left !== null && left <= 3 ? ["আর " + bn(left) + " দিন", "#8A5A00", "#FFF3DC"] : left !== null ? ["আর " + bn(left) + " দিন", GREEN, "#EAF6F0"] : ["নিয়মিত", GREEN, "#EAF6F0"];
      return h("div", { key: m.recordId, style: { ...card, padding: 0, overflow: "hidden", opacity: expired ? 0.7 : 1 } },
        h("div", { onClick: () => setOpenId(open ? null : m.recordId), style: { padding: "11px 12px", cursor: "pointer", display: "flex", gap: "8px", alignItems: "flex-start" } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontSize: "15px", fontWeight: 700, color: "#1F2D2A" } }, "💊 " + m.genericName, m.fromRx && h("span", { style: { fontWeight: 400, color: "#5F716C", fontSize: "13px" } }, " · 📄 প্রেসক্রিপশন থেকে"), members.length > 1 && h("span", { style: { fontWeight: 400, color: "#5F716C", fontSize: "13px" } }, " · " + m.memberName)),
            h("div", { style: { fontSize: "13px", color: "#4B5C57", marginTop: "3px", lineHeight: 1.5 } },
              m.reminderTimes.length > 0 ? "⏰ " + m.reminderTimes.map(bnTime).join(", ") : "⏰ সময় সেট করা হয়নি",
              m.mealTiming && m.mealTiming !== "any" ? " · " + MEAL_LABELS[m.mealTiming] : "",
              m.calendarEventIds.length > 0 ? " · 📅" : "")),
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 } },
            h("span", { style: { fontSize: "12px", fontWeight: 600, padding: "3px 9px", borderRadius: "999px", color: badge[1], background: badge[2] } }, badge[0]),
            isNew(m) && h("span", { style: { fontSize: "12px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", color: "#fff", background: GREEN, marginLeft: "6px" } }, "🆕 এইমাত্র"),
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
            h("button", { onClick: () => saveSchedule(m.recordId), style: { padding: "10px 18px", borderRadius: "12px", border: "none", background: GREEN, color: "#fff", fontSize: F, fontWeight: 700, cursor: "pointer" } }, "সংরক্ষণ করুন"),
            h("button", { onClick: () => handleCalendarSync(m), disabled: calBusy === m.recordId, style: { padding: "10px 14px", borderRadius: "12px", border: "1px solid #4285F4", background: "#fff", color: "#4285F4", fontSize: F, cursor: "pointer" } }, calBusy === m.recordId ? "..." : (m.calendarEventIds.length > 0 ? "📅 Calendar আপডেট" : "📅 সংরক্ষণ করে ক্যালেন্ডারে যোগ করুন")),
            m.calendarEventIds.length > 0 && h("button", { onClick: () => handleCalendarRemove(m), disabled: calBusy === m.recordId, style: { padding: "10px 14px", borderRadius: "12px", border: "1px solid #C0392B", background: "#fff", color: "#C0392B", fontSize: F, cursor: "pointer" } }, "Calendar থেকে সরান"),
            savedFlash === m.recordId && h("span", { style: { fontSize: F, color: GREEN } }, "✓ সংরক্ষিত")),
          delConfirm === m.recordId
            ? h("div", { style: { marginTop: "12px" } },
                h("div", { style: { fontSize: F, color: "#B3261E", marginBottom: "6px" } }, "নিশ্চিত মুছবেন? রিমাইন্ডারও বন্ধ হবে।"),
                h("div", { style: { display: "flex", gap: "8px" } },
                  h("button", { onClick: () => handleDelete(m), disabled: delBusy, style: { flex: 1, minHeight: "44px", borderRadius: "12px", border: "1px solid #B3261E", background: "#FDF0EE", color: "#B3261E", fontSize: F, fontWeight: 600, cursor: "pointer" } }, delBusy ? "মুছছে..." : "হ্যাঁ, মুছুন"),
                  h("button", { onClick: () => setDelConfirm(null), style: { flex: 1, minHeight: "44px", borderRadius: "12px", border: "1px solid #C3D2CA", background: "#fff", color: "#5F716C", fontSize: F, cursor: "pointer" } }, "না")))
            : h("button", { onClick: () => setDelConfirm(m.recordId), style: { marginTop: "12px", width: "100%", minHeight: "44px", borderRadius: "12px", border: "1px solid #B3261E", background: "#fff", color: "#B3261E", fontSize: F, fontWeight: 600, cursor: "pointer" } }, "🗑 ওষুধ মুছুন"),
          calMsg && calMsg.recordId === m.recordId && h("div", { style: { fontSize: F, marginTop: "8px", color: calMsg.ok ? GREEN : "#B3261E" } }, calMsg.text)));
    })
  );
}
