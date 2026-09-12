// Family Health Calendar (owner-request, ২০২৬-০৯-১২, item ৫) — shared
// healthCalendarEvents collection (family-wide open-read, firestore.rules দ্রষ্টব্য),
// vaccination entry (item ৪) থেকেও autopopulate হয় (eventType filter দিয়ে merged view)।

import { ErrorBox } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { listCalendarEvents, createCalendarEvent, updateCalendarEventStatus, deleteCalendarEvent } from "./calendarData.js";

const { useState, useEffect } = React;

const TYPE_LABELS = { checkup: "চেকআপ", appointment: "অ্যাপয়েন্টমেন্ট", vaccination: "টিকা", other: "অন্যান্য" };

export function FamilyHealthCalendar({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [events, setEvents] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [form, setForm] = useState({ title: "", eventType: "appointment", date: "", memberId: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoadErr(null);
    Promise.all([listMembers(familyId), listCalendarEvents(familyId)])
      .then(([m, e]) => { setMembers(m); setEvents(e); })
      .catch((err) => setLoadErr(err.message || String(err)));
  }

  useEffect(() => { load(); }, [familyId]);

  async function handleAdd() {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      await createCalendarEvent(familyId, callerMemberId, {
        memberId: form.memberId || null, title: form.title.trim(), eventType: form.eventType, date: form.date,
      });
      setForm({ title: "", eventType: "appointment", date: "", memberId: "" });
      load();
    } catch (e) {
      setLoadErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDone(eventId) {
    try {
      await updateCalendarEventStatus(familyId, eventId, callerMemberId, "done");
      load();
    } catch (e) { setLoadErr(e.message || String(e)); }
  }

  async function handleDelete(eventId) {
    try {
      await deleteCalendarEvent(familyId, eventId);
      load();
    } catch (e) { setLoadErr(e.message || String(e)); }
  }

  if (loadErr) return React.createElement("div", { style: { marginTop: "14px" } }, ErrorBox(loadErr));
  if (!members || !events) return null;

  const memberName = (id) => (members.find((m) => m.id === id) || {}).name || "";

  return React.createElement(
    "div", { style: { marginTop: "14px", background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #E0E4E2" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 8px" } }, "📅 Family Health Calendar"),
    React.createElement("div", { style: { fontSize: "12px", color: "#666", marginBottom: "8px" } }, "পরিবারের সবাই এই ক্যালেন্ডার দেখতে পারবেন — শুধু নিজে তৈরি করা event বা Admin এডিট/ডিলিট করতে পারবেন।"),

    // ---- নতুন event add ফর্ম ----
    React.createElement("input", {
      type: "text", value: form.title, placeholder: "শিরোনাম (যেমন: দাঁতের ডাক্তার দেখানো)",
      onChange: (e) => setForm((f) => ({ ...f, title: e.target.value })),
      style: { width: "100%", boxSizing: "border-box", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", marginTop: "6px" },
    }),
    React.createElement(
      "select", {
        value: form.eventType, onChange: (e) => setForm((f) => ({ ...f, eventType: e.target.value })),
        style: { width: "100%", boxSizing: "border-box", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", marginTop: "6px" },
      },
      React.createElement("option", { value: "appointment" }, "অ্যাপয়েন্টমেন্ট"),
      React.createElement("option", { value: "checkup" }, "চেকআপ"),
      React.createElement("option", { value: "other" }, "অন্যান্য")
    ),
    React.createElement(
      "select", {
        value: form.memberId, onChange: (e) => setForm((f) => ({ ...f, memberId: e.target.value })),
        style: { width: "100%", boxSizing: "border-box", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", marginTop: "6px" },
      },
      React.createElement("option", { value: "" }, "(কোনো নির্দিষ্ট সদস্য না — পারিবারিক)"),
      members.map((m) => React.createElement("option", { key: m.id, value: m.id }, m.name))
    ),
    React.createElement("input", {
      type: "date", value: form.date, onChange: (e) => setForm((f) => ({ ...f, date: e.target.value })),
      style: { width: "100%", boxSizing: "border-box", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", marginTop: "6px" },
    }),
    React.createElement(
      "button", {
        onClick: handleAdd, disabled: saving,
        style: { marginTop: "8px", padding: "8px 14px", border: "none", borderRadius: "6px", background: "#0E4B43", color: "#fff", fontSize: "13px", cursor: "pointer" },
      }, saving ? "..." : "+ যোগ করুন"
    ),

    // ---- event তালিকা ----
    events.length === 0 && React.createElement("p", { style: { color: "#888", fontSize: "13px", marginTop: "12px" } }, "এখনো কোনো event নেই।"),
    events.map((e) => React.createElement(
      "div", {
        key: e.id,
        style: { marginTop: "10px", padding: "10px", borderRadius: "8px", background: e.status === "done" ? "#EAF6F0" : "#F7FAF9", border: "1px solid #E0E4E2" },
      },
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#333" } },
        e.title + (e.memberId ? " (" + memberName(e.memberId) + ")" : "")),
      React.createElement("div", { style: { fontSize: "11px", color: "#666" } },
        (TYPE_LABELS[e.eventType] || e.eventType) + " — " + e.date + (e.status === "done" ? " — ✓ সম্পন্ন" : "")),
      e.status !== "done" && React.createElement(
        "button", {
          onClick: () => handleDone(e.id),
          style: { marginTop: "4px", marginRight: "8px", padding: "4px 8px", border: "1px solid #0E4B43", borderRadius: "6px", background: "#fff", color: "#0E4B43", fontSize: "11px", cursor: "pointer" },
        }, "সম্পন্ন চিহ্নিত করুন"
      ),
      React.createElement(
        "button", {
          onClick: () => handleDelete(e.id),
          style: { marginTop: "4px", padding: "4px 8px", border: "1px solid #C0392B", borderRadius: "6px", background: "#fff", color: "#C0392B", fontSize: "11px", cursor: "pointer" },
        }, "মুছুন"
      )
    ))
  );
}
