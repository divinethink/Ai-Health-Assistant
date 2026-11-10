// হোম ▸ "আজ" সারাংশের pure হিসাব (React/Firestore নেই — unit-testable)। ধাপ ৪ (ক১)।
// নতুন ইনপুট/ডেটা নেই: শুধু বিদ্যমান ওষুধ-রেকর্ড, ট্র্যাকারের আজকের ডক ও ক্যালেন্ডার ইভেন্ট পড়ে সাজায়।
// "সম্পন্ন %" = (খাওয়া ডোজ + পানির গ্লাস, লক্ষ্য পর্যন্ত) ÷ (মোট ডোজ + পানির লক্ষ্য)। ক্যালরি/ওজন গণনায় নেই
// (বেশি খাওয়া "সম্পন্ন" নয়; ওজন করণীয় নয়)। কিছু প্রযোজ্য না হলে null।

import { buildActiveMeds, daysLeft, MEAL_LABELS } from "../records/medReminderCalc.js";
import { doseKey } from "../records/medTaken.js";

const bn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);

// "08:00" → "সকাল ৮:০০"
export function bnClock(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return "";
  const hh = Number(m[1]);
  const per = hh < 4 ? "রাত" : hh < 12 ? "সকাল" : hh < 16 ? "দুপুর" : hh < 18 ? "বিকাল" : hh < 20 ? "সন্ধ্যা" : "রাত";
  return per + " " + bn(hh % 12 === 0 ? 12 : hh % 12) + ":" + bn(m[2]);
}

// আজকের ডোজ-তালিকা (সময় অনুযায়ী)। taken = { doseKey: true }; nowHHMM = "14:05"।
// due = সময় হয়ে গেছে (এখনো খাওয়া হয়নি হলে "দেরি/এখনই")। সময়-সেট-না-থাকা ওষুধ আলাদা গোনা (noTimeCount)।
export function buildTodayDoses(member, records, today, nowHHMM, taken) {
  const meds = buildActiveMeds(member, records).filter((m) => !(m.endDate && today > m.endDate) && !(m.startDate && m.startDate > today));
  const doses = [];
  let noTimeCount = 0;
  meds.forEach((m) => {
    const times = [...new Set(m.reminderTimes.filter((x) => /^\d{1,2}:\d{2}$/.test(x)))];
    if (!times.length) { noTimeCount++; return; }
    times.forEach((tm) => {
      const hhmm = tm.padStart(5, "0");
      const key = doseKey(m.recordId, tm);
      doses.push({
        key, recordId: m.recordId, name: m.genericName, time: hhmm,
        meal: m.mealTiming && m.mealTiming !== "any" ? MEAL_LABELS[m.mealTiming] || "" : "",
        taken: !!(taken && taken[key]), due: hhmm <= nowHHMM,
      });
    });
  });
  doses.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.name.localeCompare(b.name)));
  return { doses, noTimeCount };
}

export function progressPct({ doses, water, waterTarget }) {
  const dTotal = (doses || []).length;
  const dDone = (doses || []).filter((d) => d.taken).length;
  const wT = waterTarget && waterTarget > 0 ? waterTarget : 0;
  const total = dTotal + wT;
  if (!total) return null;
  return Math.round(((dDone + (wT ? Math.min(Math.max(water || 0, 0), wT) : 0)) / total) * 100);
}

// হিরো-কার্ডের এক লাইন (রায়/রোগনির্ণয় নয়; শুধু বাকি কাজের কথা)
export function headlineOf({ doses, water, waterTarget }) {
  const pending = (doses || []).filter((d) => !d.taken);
  const overdue = pending.filter((d) => d.due).length;
  if (overdue) return bn(overdue) + "টি ওষুধের সময় হয়ে গেছে";
  if (pending.length) return "আজকের ওষুধ বাকি আছে";
  if (waterTarget && (water || 0) < waterTarget) return "পানি বাকি আছে";
  if ((doses || []).length || waterTarget) return "আজকের সব কাজ হয়েছে";
  return "আজ কিছু নির্ধারিত নেই";
}

// আসন্ন ইভেন্ট (টিকা/অ্যাপয়েন্টমেন্ট…): এই সদস্যের বা সবার (memberId==null), সম্পন্ন নয়, আজ থেকে withinDays-এর ভেতর।
export function upcomingEvents(events, memberId, today, { limit = 4, withinDays = 30 } = {}) {
  return (events || [])
    .filter((e) => e && e.date && e.status !== "done" && (!e.memberId || e.memberId === memberId))
    .map((e) => ({ ...e, left: daysLeft(e.date, today) }))
    .filter((e) => e.left !== null && e.left >= 0 && e.left <= withinDays)
    .sort((a, b) => (a.date === b.date ? (a.time || "").localeCompare(b.time || "") : a.date < b.date ? -1 : 1))
    .slice(0, limit);
}

export function whenLabel(e) {
  const base = e.left === 0 ? "আজ" : e.left === 1 ? "আগামীকাল" : bn(e.left) + " দিন পরে";
  return base + (e.time ? " · " + bnClock(e.time) : "");
}
