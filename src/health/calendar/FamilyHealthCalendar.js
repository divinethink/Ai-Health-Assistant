import { t } from "../../shared/i18n.js";
// Family Health Calendar (owner-request, ২০২৬-০৯-১২, item ৫) — shared
// healthCalendarEvents collection (family-wide open-read, firestore.rules দ্রষ্টব্য),
// vaccination entry (item ৪) থেকেও autopopulate হয় (eventType filter দিয়ে merged view)।

import { ErrorBox } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { listCalendarEvents, createCalendarEvent, updateCalendarEventStatus, deleteCalendarEvent } from "./calendarData.js";
import { createAllDayCalendarEvent } from "../../legacy/googleCalendar.js";
import { bnDate } from "../../shared/dates.js";

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

// আপডেট (owner-approved, ২০২৬-০৯-০৮ — ক্যালেন্ডার পুনর্গঠন): গ্রিড minmax(0,1fr) (ডানে
// কাটা পড়া ঠিক), "আগামী ৭ দিন" তালিকা, "➕" চাপলে লেবেলসহ ফর্ম, কার্ডে একটাই মূল বাটন
// ("✔ সম্পন্ন") + বাকি সব "⋯" মেনুতে। শুধু presentation — data/rules অপরিবর্তিত।

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #D3E0D9", borderRadius: "10px", fontSize: "14px", minHeight: "42px", background: "#fff" };
const labelStyle = { display: "block", fontSize: "13px", fontWeight: 600, color: "#1F2D2A", margin: "10px 0 4px" };
const menuBtn = { padding: "8px 10px", minHeight: "40px", border: "1px solid #D3E0D9", borderRadius: "10px", background: "#fff", color: "#1F2D2A", fontSize: "13px", cursor: "pointer", textAlign: "left", textDecoration: "none", display: "block", width: "100%", boxSizing: "border-box" };

export function FamilyHealthCalendar({ familyId, callerMemberId }) {
  const h = React.createElement;
  const [members, setMembers] = useState(null);
  const [events, setEvents] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [form, setForm] = useState({ title: "", eventType: "appointment", date: "", memberId: "" });
  const [showForm, setShowForm] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // event id
  const [saving, setSaving] = useState(false);
  const [calBusy, setCalBusy] = useState(null); // event id
  const [calMsg, setCalMsg] = useState(null); // { id, ok, text }
  const today0 = new Date();
  const todayStr = toDateStr(today0.getFullYear(), today0.getMonth(), today0.getDate()); // local (UTC-bug নেই)
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

  // per-device dedupe (এই event এই ডিভাইস থেকে আগে Google Calendar-এ গেছে কিনা) —
  // event-doc-এ লেখা যায় না (rules: শুধু creator/Admin update পারে), তাই localStorage।
  function syncedKey(id) { return "gcalSynced:" + id; }
  function isSynced(id) { try { return localStorage.getItem(syncedKey(id)) === "1"; } catch (e) { return false; } }

  async function handleAutoAdd(e) {
    setCalMsg(null);
    setCalBusy(e.id);
    try {
      await createAllDayCalendarEvent({
        title: e.title + (e.memberId ? " (" + memberName(e.memberId) + ")" : ""),
        date: e.date,
        description: (TYPE_LABELS[e.eventType] || e.eventType || "") + " — Health Assistant অ্যাপ থেকে যোগ হয়েছে",
      });
      try { localStorage.setItem(syncedKey(e.id), "1"); } catch (err) { /* storage বন্ধ থাকলে শুধু dedupe হবে না */ }
      setCalMsg({ id: e.id, ok: true, text: "✓ Google Calendar-এ যুক্ত হয়েছে (আগের দিন সকাল ৯টায় রিমাইন্ডার)" });
    } catch (err) {
      setCalMsg({ id: e.id, ok: false, text: err.message || String(err) });
    } finally {
      setCalBusy(null);
    }
  }

  async function handleAdd() {
    if (saving || !form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      await createCalendarEvent(familyId, callerMemberId, {
        memberId: form.memberId || null, title: form.title.trim(), eventType: form.eventType, date: form.date,
      });
      setForm({ title: "", eventType: "appointment", date: "", memberId: "" });
      setShowForm(false);
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
    if (!window.confirm("এই ইভেন্টটি মুছে ফেলবেন?")) return;
    try {
      await deleteCalendarEvent(familyId, eventId);
      setMenuFor(null);
      load();
    } catch (e) { setLoadErr(e.message || String(e)); }
  }

  if (loadErr) return h("div", { style: { marginTop: "14px" } }, ErrorBox(loadErr));
  if (!members || !events) return null;

  const memberName = (id) => (members.find((m) => m.id === id) || {}).name || "";

  function navMonth(delta) {
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  }

  const navBtn = { border: "none", background: "none", color: "#0E4B43", fontSize: "20px", cursor: "pointer", padding: "4px 12px", minHeight: "40px" };

  // দেখানো তালিকা: তারিখ বাছলে সেই দিনের সব, নাহলে আগামী ৭ দিন (সম্পন্ন বাদে)
  const end = new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() + 6);
  const endStr = toDateStr(end.getFullYear(), end.getMonth(), end.getDate());
  const shown = selectedDate
    ? events.filter((e) => e.date === selectedDate)
    : events.filter((e) => e.status !== "done" && e.date >= todayStr && e.date <= endStr).sort((a, b) => (a.date < b.date ? -1 : 1));
  const listTitle = selectedDate ? bnDate(selectedDate) + "-এর ইভেন্ট" : "আগামী ৭ দিন";

  function renderCard(e) {
    const done = e.status === "done";
    return h(
      "div", {
        key: e.id,
        style: { marginTop: "8px", padding: "10px", borderRadius: "14px", background: done ? "#EAF6F0" : "#F7FAF9", border: "1px solid #D3E0D9" },
      },
      h("div", { style: { fontSize: "14px", fontWeight: 600, color: "#1F2D2A", wordBreak: "break-word" } },
        e.title + (e.memberId ? " (" + memberName(e.memberId) + ")" : "")),
      h("div", { style: { fontSize: "13px", color: "#4B5C57" } },
        (TYPE_LABELS[e.eventType] || e.eventType) + " — " + bnDate(e.date) + (done ? " — ✓ সম্পন্ন" : "")),
      h(
        "div", { style: { display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" } },
        !done && h("button", {
          onClick: () => handleDone(e.id),
          style: { padding: "6px 14px", minHeight: "40px", border: "none", borderRadius: "10px", background: "#0E4B43", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
        }, "✔ সম্পন্ন"),
        h("button", {
          onClick: () => setMenuFor((m) => (m === e.id ? null : e.id)), "aria-label": "আরও অপশন", "aria-expanded": menuFor === e.id,
          style: { padding: "6px 12px", minHeight: "40px", minWidth: "44px", border: "1px solid #C3D2CA", borderRadius: "10px", background: "#fff", color: "#2B3A36", fontSize: "16px", cursor: "pointer" },
        }, "⋯")
      ),
      menuFor === e.id && h(
        "div", { style: { marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" } },
        h("a", { href: googleCalendarLink(e), target: "_blank", rel: "noopener noreferrer", style: menuBtn }, "📅 Google Calendar-এ যোগ (নিজে নিশ্চিত করবেন)"),
        !done && h("button", {
          onClick: () => handleAutoAdd(e), disabled: calBusy === e.id || isSynced(e.id),
          style: { ...menuBtn, opacity: isSynced(e.id) ? 0.6 : 1 },
        }, calBusy === e.id ? "..." : (isSynced(e.id) ? "📅 Calendar-এ যুক্ত ✓" : "📅 সরাসরি Calendar-এ যুক্ত করুন (আগের দিন ৯টায় রিমাইন্ডার)")),
        h("button", { onClick: () => handleDelete(e.id), style: { ...menuBtn, color: "#C0392B", border: "1px solid #E5A29A" } }, "🗑 মুছুন")
      ),
      calMsg && calMsg.id === e.id && h("div", { style: { fontSize: "13px", marginTop: "6px", color: calMsg.ok ? "#0E4B43" : "#B3261E" } }, calMsg.text)
    );
  }

  return h(
    "div", { style: { background: "#fff", padding: "12px", borderRadius: "10px", border: "1px solid #D3E0D9", boxSizing: "border-box", maxWidth: "100%" } },
    h("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 4px" } }, t("h.calendar")),
    h("div", { style: { fontSize: "13px", color: "#4B5C57", marginBottom: "8px" } }, "সবাই দেখতে পারবেন; শুধু নিজের তৈরি ইভেন্ট (বা Admin) পরিবর্তন/মুছতে পারবেন।"),

    // ---- month-grid ----
    h(
      "div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" } },
      h("button", { onClick: () => navMonth(-1), "aria-label": "আগের মাস", style: navBtn }, "‹"),
      h("div", { style: { fontSize: "14px", fontWeight: 600, color: "#0E4B43" } }, new Date(viewYear, viewMonth, 1).toLocaleDateString("bn-BD", { month: "long", year: "numeric" })),
      h("button", { onClick: () => navMonth(1), "aria-label": "পরের মাস", style: navBtn }, "›")
    ),
    h(
      "div", { style: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "3px", fontSize: "13px", color: "#5F716C", textAlign: "center", marginBottom: "2px" } },
      ["র", "সো", "ম", "বু", "বৃ", "শু", "শ"].map((d, i) => h("div", { key: i }, d))
    ),
    h(
      "div", { style: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "3px" } },
      buildMonthGrid(viewYear, viewMonth).map((d, i) => {
        if (d === null) return h("div", { key: i });
        const dateStr = toDateStr(viewYear, viewMonth, d);
        const hasEvent = events.some((e) => e.date === dateStr);
        const isToday = dateStr === todayStr;
        const isSelected = selectedDate === dateStr;
        return h(
          "button", {
            key: i, "aria-pressed": isSelected,
            onClick: () => setSelectedDate((prev) => (prev === dateStr ? null : dateStr)),
            style: {
              width: "100%", minWidth: 0, padding: 0, aspectRatio: "1", boxSizing: "border-box",
              border: isSelected ? "2px solid #0E4B43" : isToday ? "1px solid #0E4B43" : "1px solid #D3E0D9",
              borderRadius: "10px", background: isSelected ? "#0E4B43" : hasEvent ? "#EAF6F0" : "#fff",
              color: isSelected ? "#fff" : "#1F2D2A", fontSize: "14px", cursor: "pointer", position: "relative",
            },
          },
          d,
          hasEvent && h("span", { style: { position: "absolute", bottom: "3px", left: "50%", transform: "translateX(-50%)", width: "5px", height: "5px", borderRadius: "50%", background: isSelected ? "#fff" : "#0E4B43" } })
        );
      })
    ),

    // ---- তালিকা ----
    h(
      "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" } },
      h("div", { style: { fontSize: "14px", fontWeight: 700, color: "#0E4B43" } }, listTitle),
      selectedDate && h("button", {
        onClick: () => setSelectedDate(null),
        style: { fontSize: "13px", border: "none", background: "none", color: "#0E4B43", cursor: "pointer", minHeight: "32px" },
      }, "✕ আগামী ৭ দিন দেখুন")
    ),
    shown.length === 0 && h("p", { style: { color: "#5F716C", fontSize: "14px", margin: "6px 0" } }, selectedDate ? "এই তারিখে কোনো ইভেন্ট নেই।" : "আগামী ৭ দিনে কোনো ইভেন্ট নেই।"),
    shown.map(renderCard),

    // ---- নতুন ইভেন্ট ----
    !showForm && h("button", {
      onClick: () => { setForm((f) => ({ ...f, date: selectedDate || f.date })); setShowForm(true); },
      style: { marginTop: "12px", width: "100%", minHeight: "44px", border: "1px dashed #0E4B43", borderRadius: "12px", background: "#F7FAF9", color: "#0E4B43", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
    }, "➕ নতুন ইভেন্ট"),
    showForm && h(
      "div", { style: { marginTop: "12px", padding: "10px", borderRadius: "12px", border: "1px solid #D3E0D9", background: "#F7FAF9" } },
      h("label", { htmlFor: "cal-title", style: { ...labelStyle, marginTop: 0 } }, "শিরোনাম"),
      h("input", { id: "cal-title", type: "text", value: form.title, placeholder: "যেমন: দাঁতের ডাক্তার দেখানো", onChange: (e) => setForm((f) => ({ ...f, title: e.target.value })), style: inputStyle }),
      h("label", { htmlFor: "cal-type", style: labelStyle }, "ধরন"),
      h("select", { id: "cal-type", value: form.eventType, onChange: (e) => setForm((f) => ({ ...f, eventType: e.target.value })), style: inputStyle },
        h("option", { value: "appointment" }, "অ্যাপয়েন্টমেন্ট"),
        h("option", { value: "checkup" }, "চেকআপ"),
        h("option", { value: "other" }, "অন্যান্য")),
      h("label", { htmlFor: "cal-member", style: labelStyle }, "কার জন্য"),
      h("select", { id: "cal-member", value: form.memberId, onChange: (e) => setForm((f) => ({ ...f, memberId: e.target.value })), style: inputStyle },
        h("option", { value: "" }, "পারিবারিক (নির্দিষ্ট সদস্য নয়)"),
        members.map((m) => h("option", { key: m.id, value: m.id }, m.name))),
      h("label", { htmlFor: "cal-date", style: labelStyle }, "তারিখ"),
      h("input", { id: "cal-date", type: "date", value: form.date, onChange: (e) => setForm((f) => ({ ...f, date: e.target.value })), style: inputStyle }),
      h(
        "div", { style: { display: "flex", gap: "8px", marginTop: "12px" } },
        h("button", {
          onClick: handleAdd, disabled: saving || !form.title.trim() || !form.date,
          style: { flex: 1, minHeight: "44px", border: "none", borderRadius: "10px", background: (saving || !form.title.trim() || !form.date) ? "#8FAFA9" : "#0E4B43", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
        }, saving ? "..." : "যোগ করুন"),
        h("button", {
          onClick: () => setShowForm(false),
          style: { minHeight: "44px", padding: "0 16px", border: "1px solid #C3D2CA", borderRadius: "10px", background: "#fff", color: "#2B3A36", fontSize: "14px", cursor: "pointer" },
        }, "বাতিল")
      )
    )
  );
}
