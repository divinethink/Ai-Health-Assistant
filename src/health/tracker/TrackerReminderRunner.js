// ট্র্যাকার রিমাইন্ডার চালক (ধাপ ৩, ব্রাউজার-সংস্করণ) — চোখে-না-পড়া কম্পোনেন্ট, Dashboard-এ বসানো,
// তাই যেকোনো ট্যাবে থাকলেও চলে। শুধু লগ-ইন করা সদস্যের নিজের সেটিং।
// ধাপ ৩: ওষুধের রিমাইন্ডারও এখন এই একটাই চালক থেকে আসে (আগে শুধু "ওষুধ" স্ক্রিন খোলা থাকলে আসত) — সব ট্যাবে কাজ করে,
// যে ডোজ "খেয়েছি" চিহ্নিত তার নোটিফিকেশন আসে না। সীমা: ব্রাউজার Notification API — অ্যাপ/ট্যাব খোলা থাকলে তবেই আসে (ধাপ ০-র পর native হলে বন্ধ অবস্থায়ও)।

import { listHealthRecords } from "../records/healthRecordsData.js";
import { listCalendarEvents } from "../calendar/calendarData.js";
import { getGoal, getMedTaken } from "./trackerData.js";
import { subscribeMemberHealth } from "../records/memberHealthStore.js";
import { buildActiveMeds, dueMedDoses, endingSoonMeds } from "../records/medReminderCalc.js";
import { normalizeReminders, anyReminderOn, expandReminders, buildReminderContext, dueCalendarEvents } from "./reminderData.js";
import { bnNum, localISO } from "../../shared/dates.js";

const { useState, useEffect, useCallback, useRef } = React;

export const REMINDERS_CHANGED_EVENT = "hs-tracker-reminders";

function alreadyShown(id) {
  const today = new Date().toDateString();
  const k = "hs-trk-rem-" + id;
  try {
    if (localStorage.getItem(k) === today) return true;
    localStorage.setItem(k, today);
  } catch (e) { /* localStorage না থাকলে একই মিনিটে দুইবার আসার সামান্য ঝুঁকি */ }
  return false;
}

// কোর্স-শেষ সতর্কতা দিনে একবার (আগের ওষুধ-স্ক্রিনের একই localStorage key — আপগ্রেডে দ্বিগুণ আসে না)।
function endWarnShown(recordId, today) {
  const k = "hs-med-endwarn-" + recordId;
  try {
    if (localStorage.getItem(k) === today) return true;
    localStorage.setItem(k, today);
  } catch (e) { /* ignore */ }
  return false;
}

export function TrackerReminderRunner({ familyId, memberId, members }) {
  const [data, setData] = useState(null);
  const [medData, setMedData] = useState([]); // সব (পড়ার-অনুমতি-থাকা) সদস্যের সক্রিয় ওষুধ
  const memberKey = (members || []).map((m) => m.id).join(",");
  const membersRef = useRef(members);
  membersRef.current = members;

  const loadMeds = useCallback(async () => {
    const ms = membersRef.current;
    if (!familyId || !ms || !ms.length) { setMedData([]); return; }
    // কোনো সদস্যের রেকর্ড পড়ার অনুমতি না থাকলে শুধু তাঁকে বাদ — বাকিদের রিমাইন্ডার চলে।
    const per = await Promise.all(ms.map((m) => listHealthRecords(familyId, m.id).then((r) => buildActiveMeds(m, r)).catch(() => [])));
    setMedData(per.flat());
  }, [familyId, memberKey]);

  useEffect(() => {
    loadMeds();
    // রেকর্ড বদলালে (ওষুধ যোগ/মোছা/সময় বদল) তালিকা নতুন করে; লগআউটের সংকেত (familyId null) উপেক্ষা।
    return subscribeMemberHealth((e) => { if (e.familyId) loadMeds(); });
  }, [loadMeds]);

  const load = useCallback(async () => {
    if (!familyId || !memberId) return;
    try {
      const [goal, records, events] = await Promise.all([
        getGoal(familyId, memberId), listHealthRecords(familyId, memberId),
        listCalendarEvents(familyId).catch(() => []), // ইভেন্ট না পড়া গেলে শুধু ক্যালেন্ডার-নোটিফিকেশন বাদ
      ]);
      setData({ goal, records, events });
    } catch (e) { /* non-critical: রিমাইন্ডার না চললেও অ্যাপ চলবে */ }
  }, [familyId, memberId]);

  useEffect(() => {
    load();
    window.addEventListener(REMINDERS_CHANGED_EVENT, load);
    const poll = setInterval(load, 10 * 60 * 1000); // অ্যাপ খোলা থাকলে নতুন ইভেন্ট ১০ মিনিটে ধরা পড়ে
    return () => { window.removeEventListener(REMINDERS_CHANGED_EVENT, load); clearInterval(poll); };
  }, [load]);

  useEffect(() => {
    const settings = data ? normalizeReminders(data.goal && data.goal.reminders) : null;
    const trackerOn = !!(settings && anyReminderOn(settings));
    const medOn = !settings || settings.medicine.on; // সেটিং লোড হওয়ার আগে/না থাকলে ডিফল্ট চালু
    if (!trackerOn && !(medOn && medData.length)) return undefined;
    const member = (members || []).find((m) => m.id === memberId) || null;

    // ডোজের সময়ে সর্বশেষ "খেয়েছি" অবস্থা সার্ভার থেকে দেখে নেওয়া; পড়া না গেলে (অফলাইন) রিমাইন্ডার দেওয়াই নিরাপদ।
    const fireDose = async (d, today) => {
      let taken = false;
      try { taken = !!(await getMedTaken(familyId, d.memberId, today))[d.key]; } catch (e) { /* ignore */ }
      if (taken) return;
      try { new Notification(d.title, { body: d.body }); } catch (e) { /* ignore */ }
    };

    const check = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const nowD = new Date();
      const now = nowD.toTimeString().slice(0, 5);
      const today = localISO(nowD);
      if (trackerOn) {
        const ctx = buildReminderContext({ goal: data.goal, records: data.records, member });
        expandReminders(settings, ctx).filter((r) => r.time === now).forEach((r) => {
          if (alreadyShown(r.id)) return;
          try { new Notification(r.title, { body: r.body ? r.body.replace(/\d+/g, (n) => bnNum(n)) : "" }); } catch (e) { /* ignore */ }
        });
      }
      if (trackerOn && settings.calendar.on) {
        dueCalendarEvents(data.events, memberId, settings.calendar, today, now).forEach((c) => {
          if (alreadyShown(c.id)) return;
          try { new Notification(c.title, { body: c.body }); } catch (e) { /* ignore */ }
        });
      }
      if (!medOn) return;
      dueMedDoses(medData, now, today).forEach((d) => { if (!alreadyShown(d.id)) fireDose(d, today); });
      endingSoonMeds(medData, today).forEach((w) => {
        if (endWarnShown(w.recordId, today)) return;
        try { new Notification(w.title, { body: w.body }); } catch (e) { /* ignore */ }
      });
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [data, medData, members, memberId, familyId]);

  return null;
}
