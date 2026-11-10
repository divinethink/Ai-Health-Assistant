// src/health/nextstep/nextStepData.js
//
// ধাপ ১০ (গ২) — প্রস্তাবে "যোগ করুন" চাপলে কেবল তখনই লেখা হয়। নতুন schema/rules নেই: বিদ্যমান
// healthCalendarEvents-ই (নির্দিষ্ট doc-ID → idempotent; double-tap/retry-তে ডুপ্লিকেট নয়)।
// ফেরত: কতগুলো নতুন তৈরি হলো (আগেই থাকলে ০)।

import { createCalendarEventOnce } from "../calendar/calendarData.js";
import { followUpEventId, courseEndEventId, doctorVisitEventId } from "./nextStepCalc.js";
import { bnDate } from "../../shared/dates.js";

export async function addFollowUpEvent(familyId, callerMemberId, memberId, date, rawLine) {
  const made = await createCalendarEventOnce(familyId, callerMemberId, followUpEventId(memberId, date), {
    memberId, title: "ডাক্তার ফলো-আপ", eventType: "appointment", date,
    notes: rawLine ? "প্রেসক্রিপশনে লেখা: " + String(rawLine).slice(0, 120) : "প্রেসক্রিপশন থেকে",
  });
  return made ? 1 : 0;
}

// plan = courseEndPlan() ফল; একটা ব্যর্থ হলে বাকিগুলো চলে, ব্যর্থের সংখ্যা failed-এ
export async function addCourseEndEvents(familyId, callerMemberId, memberId, plan) {
  let created = 0, failed = 0;
  for (const p of plan) {
    try {
      const made = await createCalendarEventOnce(familyId, callerMemberId, courseEndEventId(memberId, p.name, p.endDate), {
        memberId, title: "ওষুধ শেষ হতে চলেছে: " + p.name, eventType: "other", date: p.remindDate,
        notes: "কোর্স শেষ: " + bnDate(p.endDate) + " — প্রয়োজনে ডাক্তার দেখান/ওষুধ কিনে রাখুন।",
      });
      if (made) created++;
    } catch (e) { failed++; }
  }
  return { created, failed };
}

export async function addDoctorVisitEvent(familyId, callerMemberId, memberId, date, names) {
  const made = await createCalendarEventOnce(familyId, callerMemberId, doctorVisitEventId(memberId, date), {
    memberId, title: "ডাক্তারকে রিপোর্ট দেখান", eventType: "appointment", date,
    notes: names && names.length ? "রিপোর্টে সীমার বাইরে: " + names.join(", ") : "রিপোর্ট দেখানোর জন্য",
  });
  return made ? 1 : 0;
}
