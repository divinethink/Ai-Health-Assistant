// Family Health Calendar (owner-request, ২০২৬-০৯-১২, item ৫) — shared
// healthCalendarEvents collection (family-wide open-read, firestore.rules দ্রষ্টব্য),
// vaccination entry (item ৪) থেকেও autopopulate হয় (eventType filter দিয়ে merged view)।

import { ErrorBox } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { listCalendarEvents, createCalendarEvent, updateCalendarEventStatus, deleteCalendarEvent } from "./calendarData.js";

const { useState, useEffect } = React;

const TYPE_LABELS = { checkup: "চেকআপ", appointment: "অ্যাপয়েন্টমেন্ট", vaccination: "টিকা", other: "অন্যান্য" };

// owner-request (২০২৬-০৯-১৬): "সম্ভব হলে ক্যালেন্ডার যুক্ত করা হোক" — light month-grid
// view, কোনো নতুন library/dependency ছাড়াই (pure date-math)।
function pad2(n) { return String(n).padStart(2, "0"); }
function toDateStr(y, m, d) { return y + "-" + pad2(m + 1) + "-" + pad2(d); }

function buildMonthGrid(viewYear, viewMonth) {
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=রবি
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

// Google Calendar-এ "যোগ করুন" লিংক — কোনো OAuth/API-key/backend লাগে না,
// শুধু calendar.google.com-এর পাবলিক render-URL scheme (owner-request,
// সহজ ও নিরাপদ বিকল্প — সম্পূর্ণ two-way sync অনেক বেশি জটিল ও Firebase
// Spark-plan-এর বাইরে চলে যেতে পারে, তাই এই ধাপে করা হয়নি)।
function googleCalendarLink(e) {
  const start = (e.date || "").replace(/-/g, "");
  const nextDay = new Date(e.date + "T00:00:00");
  nextDay.setDate(nextDay.getDate() + 1);
  const end = nextDay.toISOString().slice(0, 10).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title || "",
    dates: start + "/" + end,
    details: (TYPE_LABELS[e.eventType] || e.eventType || "") + " — Health Assistant অ্যাপ থেকে যোগ হয়েছে",
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

export function FamilyHealthCalendar({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [events, setEvents] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [form, setForm] = useState({ title: "", eventType: "appointment", date: "", memberId: "" });
  const [saving, setSaving] = useState(false);
  const today0 = new Date();
  const [viewYear, setViewYear] = useState(today0.getFullYear());
  const [viewMonth, setViewMonth] = useState(today0.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState(null);

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

    // ---- month-grid view ----
    React.createElement(
      "div", { style: { marginBottom: "12px" } },
      React.createElement(
        "div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" } },
        React.createElement("button", {
          onClick: () => { const m = viewMonth - 1; if (m < 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth(m); },
          style: { border: "none", background: "none", color: "#0E4B43", fontSize: "16px", cursor: "pointer", padding: "2px 8px" },
        }, "‹"),
        React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#0E4B43" } }, viewYear + " - " + pad2(viewMonth + 1)),
        React.createElement("button", {
          onClick: () => { const m = viewMonth + 1; if (m > 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth(m); },
          style: { border: "none", background: "none", color: "#0E4B43", fontSize: "16px", cursor: "pointer", padding: "2px 8px" },
        }, "›")
      ),
      React.createElement(
        "div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", fontSize: "10px", color: "#888", textAlign: "center", marginBottom: "2px" } },
        ["র", "সো", "ম", "বু", "বৃ", "শু", "শ"].map((d, i) => React.createElement("div", { key: i }, d))
      ),
      React.createElement(
        "div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" } },
        buildMonthGrid(viewYear, viewMonth).map((d, i) => {
          if (d === null) return React.createElement("div", { key: i });
          const dateStr = toDateStr(viewYear, viewMonth, d);
          const hasEvent = events.some((e) => e.date === dateStr);
          const isToday = dateStr === today0.toISOString().slice(0, 10);
          const isSelected = selectedDate === dateStr;
          return React.createElement(
            "button", {
              key: i,
              onClick: () => setSelectedDate((prev) => (prev === dateStr ? null : dateStr)),
              style: {
                aspectRatio: "1", border: isSelected ? "2px solid #0E4B43" : isToday ? "1px solid #0E4B43" : "1px solid #E0E4E2",
                borderRadius: "6px", background: isSelected ? "#0E4B43" : hasEvent ? "#EAF6F0" : "#fff",
                color: isSelected ? "#fff" : "#333", fontSize: "11px", cursor: "pointer", position: "relative",
              },
            },
            d,
            hasEvent && !isSelected && React.createElement("span", { style: { position: "absolute", bottom: "2px", left: "50%", transform: "translateX(-50%)", width: "4px", height: "4px", borderRadius: "50%", background: "#0E4B43" } })
          );
        })
      ),
      selectedDate && React.createElement(
        "button", {
          onClick: () => setSelectedDate(null),
          style: { marginTop: "6px", fontSize: "11px", border: "none", background: "none", color: "#0E4B43", cursor: "pointer", padding: 0 },
        }, "✕ " + selectedDate + " ফিল্টার সরান, সব দেখুন"
      )
    ),

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

    // ---- event তালিকা (selectedDate দিলে filtered) ----
    (() => {
      const shown = selectedDate ? events.filter((e) => e.date === selectedDate) : events;
      return React.createElement(
        React.Fragment, null,
        shown.length === 0 && React.createElement("p", { style: { color: "#888", fontSize: "13px", marginTop: "12px" } }, selectedDate ? "এই তারিখে কোনো event নেই।" : "এখনো কোনো event নেই।"),
        shown.map((e) => React.createElement(
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
            "a", {
              href: googleCalendarLink(e), target: "_blank", rel: "noopener noreferrer",
              style: { marginTop: "4px", marginRight: "8px", padding: "4px 8px", border: "1px solid #4285F4", borderRadius: "6px", background: "#fff", color: "#4285F4", fontSize: "11px", cursor: "pointer", textDecoration: "none", display: "inline-block" },
            }, "📅 Google Calendar-এ যোগ করুন"
          ),
          React.createElement(
            "button", {
              onClick: () => handleDelete(e.id),
              style: { marginTop: "4px", padding: "4px 8px", border: "1px solid #C0392B", borderRadius: "6px", background: "#fff", color: "#C0392B", fontSize: "11px", cursor: "pointer" },
            }, "মুছুন"
          )
        ))
      );
    })()
  );
}
