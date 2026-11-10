// ওষুধ-রিমাইন্ডারের pure হিসাব (React/Firestore/Notification নেই — unit-testable)।
// আগে এই হিসাব শুধু "ওষুধ" স্ক্রিন খোলা থাকলে চলত; এখন Dashboard-এর একটাই রিমাইন্ডার চালক (TrackerReminderRunner) এটা ব্যবহার করে,
// তাই যেকোনো ট্যাবে থাকলেও ওষুধের রিমাইন্ডার আসে। আচরণ আগের মতোই (সময় মিললে, কোর্স শেষ না হলে), শুধু নতুন: যে ডোজ
// ইতিমধ্যে "খেয়েছি" চিহ্নিত — তার নোটিফিকেশন বাদ (চালক সেটা Firestore থেকে যাচাই করে)।

import { doseKey } from "./medTaken.js";

export const MEAL_LABELS = { before: "খাবারের আগে", after: "খাবারের পরে", any: "যেকোনো সময়" };
const bn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);

// একজন সদস্যের রেকর্ড থেকে সক্রিয় ওষুধ [{recordId, memberId, memberName, genericName, startDate, endDate, mealTiming, reminderTimes}]।
export function buildActiveMeds(member, records) {
  return (records || [])
    .filter((r) => r.resourceType === "medicationStatement" && r.status === "active" && r.genericName)
    .map((r) => ({
      recordId: r.id, memberId: member.id, memberName: member.name || "", genericName: r.genericName,
      startDate: r.startDate || null, endDate: r.endDate || null, mealTiming: r.mealTiming || null,
      reminderTimes: Array.isArray(r.reminderTimes) ? r.reminderTimes : [],
    }));
}

// আজ (YYYY-MM-DD) থেকে endDate পর্যন্ত দিন; endDate না থাকলে null।
export function daysLeft(endDate, today) {
  if (!endDate) return null;
  return Math.round((new Date(endDate + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
}

// এই মিনিটে (nowHHMM) যে ডোজগুলোর সময়: [{ id, key, memberId, recordId, title, body }]
export function dueMedDoses(meds, nowHHMM, today) {
  const out = [];
  (meds || []).forEach((m) => {
    if (!m.reminderTimes || !m.reminderTimes.includes(nowHHMM)) return;
    if (m.endDate && today > m.endDate) return;
    if (m.startDate && m.startDate > today) return;
    const key = doseKey(m.recordId, nowHHMM);
    out.push({
      id: "med_" + key, key, memberId: m.memberId, recordId: m.recordId, title: "ওষুধ সেবনের সময়",
      body: m.memberName + " — " + m.genericName + (m.mealTiming && m.mealTiming !== "any" && MEAL_LABELS[m.mealTiming] ? " (" + MEAL_LABELS[m.mealTiming] + ")" : ""),
    });
  });
  return out;
}

// কোর্স শেষ হতে চলেছে (আজ বা আর ২ দিনের মধ্যে): [{ recordId, title, body }]
export function endingSoonMeds(meds, today) {
  const out = [];
  (meds || []).forEach((m) => {
    const left = daysLeft(m.endDate, today);
    if (left === null || left < 0 || left > 2) return;
    out.push({
      recordId: m.recordId, title: "ওষুধ শেষ হতে চলেছে",
      body: m.memberName + " — " + m.genericName + (left === 0 ? " আজ শেষ দিন" : " আর " + bn(left) + " দিন বাকি") + "। প্রয়োজনে ডাক্তার দেখান/ওষুধ কিনে রাখুন।",
    });
  });
  return out;
}
