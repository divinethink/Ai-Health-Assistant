// Vaccination Scheduler (owner-request, ২০২৬-০৯-১২, item ৪) — HealthTimeline/
// MedicationReminders-এর pattern reuse। static EPI_SCHEDULE (epiSchedule.js) +
// shared healthCalendarEvents collection (eventType: "vaccination")।

import { ErrorBox } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { computeVaccinationDueDates } from "./epiSchedule.js";
import { listCalendarEvents, createCalendarEvent } from "./calendarData.js";

const { useState, useEffect } = React;

export function VaccinationScheduler({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [doneDoseIds, setDoneDoseIds] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        setTargetMemberId((prev) => prev || (list[0] && list[0].id) || null);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    listCalendarEvents(familyId)
      .then((events) => setDoneDoseIds(events.filter((e) => e.eventType === "vaccination" && e.status === "done").map((e) => e.memberId + "_" + e.doseId)))
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId, targetMemberId]);

  async function markDone(doseId, name) {
    setBusy(doseId);
    try {
      await createCalendarEvent(familyId, callerMemberId, {
        memberId: targetMemberId, title: name, eventType: "vaccination",
        date: new Date().toISOString().slice(0, 10), status: "done", doseId,
      });
      setDoneDoseIds((prev) => [...prev, targetMemberId + "_" + doseId]);
    } catch (e) {
      setLoadErr(e.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  if (loadErr) return React.createElement("div", { style: { marginTop: "14px" } }, ErrorBox(loadErr));
  if (!members) return null;

  const targetMember = members.find((m) => m.id === targetMemberId);
  const schedule = targetMember ? computeVaccinationDueDates(targetMember.dob) : [];
  const today = new Date().toISOString().slice(0, 10);

  return React.createElement(
    "div", { style: { marginTop: "14px", background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #E0E4E2" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 8px" } }, "💉 Vaccination Scheduler (EPI)"),
    React.createElement("div", { style: { fontSize: "12px", color: "#666", marginBottom: "8px" } },
      "বাংলাদেশ সরকারের EPI স্ট্যান্ডার্ড শিডিউল অনুযায়ী — জন্ম-তারিখ থেকে হিসাব করা প্রত্যাশিত তারিখ, প্রকৃত টিকাদান-তথ্যের জন্য টিকা-কার্ড/স্বাস্থ্যকর্মীর সাথে মিলিয়ে নিন।"
    ),
    React.createElement(
      "select", {
        value: targetMemberId || "", onChange: (e) => setTargetMemberId(e.target.value),
        style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px", marginBottom: "10px" },
      },
      members.map((m) => React.createElement("option", { key: m.id, value: m.id }, m.name))
    ),

    !targetMember || !targetMember.dob
      ? React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "এই সদস্যের জন্ম-তারিখ profile-এ নেই — vaccination-schedule হিসাব করা সম্ভব না।")
      : schedule.map((d) => {
          const doneKey = targetMemberId + "_" + d.doseId;
          const isDone = doneDoseIds.includes(doneKey);
          const isOverdue = !isDone && d.dueDate < today;
          return React.createElement(
            "div", {
              key: d.doseId,
              style: { marginTop: "8px", padding: "10px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: isDone ? "#EAF6F0" : isOverdue ? "#FDECEA" : "#F7FAF9",
                border: "1px solid " + (isDone ? "#A9D8C4" : isOverdue ? "#F5C6C0" : "#E0E4E2") },
            },
            React.createElement(
              "div", null,
              React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#333" } }, d.name),
              React.createElement("div", { style: { fontSize: "11px", color: "#666" } }, "প্রত্যাশিত তারিখ: " + d.dueDate + (isDone ? " — ✓ সম্পন্ন" : isOverdue ? " — ⚠️ মেয়াদ পার" : ""))
            ),
            !isDone && React.createElement(
              "button", {
                onClick: () => markDone(d.doseId, d.name), disabled: busy === d.doseId,
                style: { padding: "6px 10px", border: "1px solid #0E4B43", borderRadius: "6px", background: "#0E4B43", color: "#fff", fontSize: "12px", cursor: "pointer" },
              }, busy === d.doseId ? "..." : "সম্পন্ন করুন"
            )
          );
        })
  );
}
