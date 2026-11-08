// ট্র্যাকার রিমাইন্ডার চালক (ধাপ ৩, ব্রাউজার-সংস্করণ) — চোখে-না-পড়া কম্পোনেন্ট, Dashboard-এ বসানো,
// তাই যেকোনো ট্যাবে থাকলেও চলে। শুধু লগ-ইন করা সদস্যের নিজের সেটিং।
// সীমা: ব্রাউজার Notification API — অ্যাপ/ট্যাব খোলা থাকলে তবেই আসে (ধাপ ০-র পর native হলে বন্ধ অবস্থায়ও)।

import { listHealthRecords } from "../records/healthRecordsData.js";
import { getGoal } from "./trackerData.js";
import { normalizeReminders, anyReminderOn, expandReminders, buildReminderContext } from "./reminderData.js";
import { bnNum } from "../../shared/dates.js";

const { useState, useEffect, useCallback } = React;

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

export function TrackerReminderRunner({ familyId, memberId, members }) {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!familyId || !memberId) return;
    try {
      const [goal, records] = await Promise.all([getGoal(familyId, memberId), listHealthRecords(familyId, memberId)]);
      setData({ goal, records });
    } catch (e) { /* non-critical: রিমাইন্ডার না চললেও অ্যাপ চলবে */ }
  }, [familyId, memberId]);

  useEffect(() => {
    load();
    window.addEventListener(REMINDERS_CHANGED_EVENT, load);
    return () => window.removeEventListener(REMINDERS_CHANGED_EVENT, load);
  }, [load]);

  useEffect(() => {
    if (!data) return undefined;
    const settings = normalizeReminders(data.goal && data.goal.reminders);
    if (!anyReminderOn(settings)) return undefined;
    const member = (members || []).find((m) => m.id === memberId) || null;
    const check = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const now = new Date().toTimeString().slice(0, 5);
      const ctx = buildReminderContext({ goal: data.goal, records: data.records, member });
      expandReminders(settings, ctx).filter((r) => r.time === now).forEach((r) => {
        if (alreadyShown(r.id)) return;
        try { new Notification(r.title, { body: r.body ? r.body.replace(/\d+/g, (n) => bnNum(n)) : "" }); } catch (e) { /* ignore */ }
      });
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [data, members, memberId]);

  return null;
}
