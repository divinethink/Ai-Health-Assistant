// Health Timeline UI। Checklist P2-এর শেষ আইটেম।
//
// member-selector unification (owner-request): নিজস্ব member-fetch/dropdown
// সরিয়ে parent (HealthRecordsPageSection)-এর `selectedMemberId` প্রপ ব্যবহার।
//
// আপডেট (owner-approved, ২০২৬-০৯-০৮ — টাইমলাইন পুনর্গঠন): মাস অনুযায়ী ভাগ,
// ফিল্টার-চিপ, এক-লাইন কমপ্যাক্ট সারি, একই-দিনের হুবহু এন্ট্রি "N বার" গ্রুপ
// (ট্যাপে প্রতিটা দেখা যায়), emergency-তে লাল ব্যাজ (বাকি ধূসর), প্রথমে ১০টা +
// "আরও দেখুন"। শুধু presentation-layer — কোনো নতুন query/schema/rules নেই।

import { ErrorBox } from "../../shared/ui.js";
import { bnDateFromMillis, bnMonthYear, bnTime, bnNum } from "../../shared/dates.js";
import { buildTimeline } from "./timelineData.js";
import { useMemberHealth } from "../records/useMemberHealth.js";

const { useState, useEffect, useMemo } = React;

const PAGE_SIZE = 10;

const FILTERS = [
  { id: "all", label: "সব" },
  { id: "symptom", label: "উপসর্গ" },
  { id: "medication", label: "ওষুধ" },
  { id: "illness", label: "অসুস্থতা" },
  { id: "measurement", label: "পরিমাপ" },
  { id: "vaccine", label: "টিকা" },
  { id: "calendar", label: "অ্যাপয়েন্টমেন্ট" },
  { id: "tracker", label: "ট্র্যাকার" },
];

const RISK_SHORT = {
  emergency: "জরুরি", urgent: "জরুরি-প্রায়", "needs-attention": "মনোযোগ", routine: "রুটিন", "self-care": "স্ব-যত্ন",
};

// একই দিন + একই label/description/risk হলে এক সারিতে গ্রুপ (sortMillis DESC ধরে নিয়ে)।
function dayKey(ms) {
  if (!ms) return "unknown";
  const d = new Date(ms);
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function buildRows(entries) {
  const rows = [];
  entries.forEach((e) => {
    const dk = dayKey(e.sortMillis);
    const sig = [dk, e.label, e.description, e.riskLevel || "", e.url || ""].join("|");
    const last = rows[rows.length - 1];
    if (last && last.sig === sig) last.items.push(e);
    else rows.push({ sig, dk, items: [e] });
  });
  return rows;
}

function Badge(text, danger) {
  return React.createElement("span", {
    style: {
      display: "inline-block", marginLeft: "6px", padding: "1px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
      background: danger ? "#FDECEA" : "#EEF1EF", color: danger ? "#B3261E" : "#4B5C57",
      border: "1px solid " + (danger ? "#E5A29A" : "#D3DAD6"),
    },
  }, text);
}

function TimelineRow({ row }) {
  const [open, setOpen] = useState(false);
  const e = row.items[0];
  const count = row.items.length;
  const danger = e.riskLevel === "emergency";
  return React.createElement(
    "div", { style: { marginBottom: "12px", position: "relative", background: "var(--hs-surface, #fff)", border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "16px", padding: "10px 12px", boxShadow: "0 1px 4px rgba(14,75,67,0.07)" } },
    React.createElement("div", {
      style: {
        position: "absolute", left: "-30px", top: "16px", width: "10px", height: "10px", borderRadius: "50%",
        background: danger ? "#B3261E" : "var(--hs-primary, #0E4B43)", border: "2px solid #F5F7F5",
      },
    }),
    React.createElement(
      "div", { style: { fontSize: "14px", lineHeight: 1.4 } },
      e.icon + " ", React.createElement("b", null, e.label),
      e.riskLevel && Badge(RISK_SHORT[e.riskLevel] || e.riskLevel, danger),
      e.source && Badge(e.source, false),
      count > 1 && React.createElement("button", {
        onClick: () => setOpen((v) => !v), "aria-expanded": open,
        style: { marginLeft: "6px", padding: "1px 8px", minHeight: "24px", borderRadius: "999px", border: "1px solid #C3D2CA", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
      }, bnNum(count) + " বার " + (open ? "▴" : "▾"))
    ),
    React.createElement("div", { style: { fontSize: "13px", color: "#1F2D2A", marginTop: "1px", wordBreak: "break-word" } }, e.description),
    e.sortMillis ? React.createElement("div", { style: { fontSize: "12px", color: "#5F716C" } }, bnDateFromMillis(e.sortMillis)) : null,
    e.url && React.createElement("a", {
      href: e.url, target: "_blank", rel: "noopener noreferrer", style: { fontSize: "13px", color: "var(--hs-primary, #0E4B43)" },
    }, "👁 দেখুন"),
    open && React.createElement(
      "div", { style: { marginTop: "4px", paddingLeft: "10px", borderLeft: "2px solid #E1E9E4", fontSize: "12px", color: "#4B5C57" } },
      row.items.map((it, i) => React.createElement("div", { key: it.id }, "#" + bnNum(i + 1) + (it.hasTime && it.sortMillis ? " — " + bnTime(it.sortMillis) : "")))
    )
  );
}

export function HealthTimeline({ familyId, selectedMemberId, vaccineSlot }) {
  const [entries, setEntries] = useState(null);
  const [entriesErr, setEntriesErr] = useState(null);
  const [filter, setFilter] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const targetMemberId = selectedMemberId;
  // শেয়ার্ড লোডার (ধাপ ১): রেকর্ড বদলালে/সেভের পর নিজে থেকে টাইমলাইন নতুন হয়
  const { records, error: recErr } = useMemberHealth(familyId, targetMemberId);

  useEffect(() => {
    if (!targetMemberId || !records) return undefined;
    let alive = true;
    setEntries(null);
    setEntriesErr(null);
    setVisible(PAGE_SIZE);
    buildTimeline(familyId, targetMemberId, { records })
      .then((r) => { if (alive) setEntries(r); })
      .catch((e) => {
        if (!alive) return;
        setEntriesErr(e.code === "permission-denied"
          ? "এই সদস্যের টাইমলাইন দেখার অনুমতি আপনার নেই (অ্যাডমিনের অনুমতি ছাড়া অন্য সদস্যের তথ্য দেখা যায় না)।"
          : (e.message || String(e)));
      });
    return () => { alive = false; };
  }, [familyId, targetMemberId, records]);

  const rows = useMemo(() => {
    if (!entries) return [];
    return buildRows(entries.filter((e) => filter === "all" || e.category === filter));
  }, [entries, filter]);

  if (!targetMemberId) {
    return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "সদস্য বেছে নিন।");
  }

  const shown = rows.slice(0, visible);

  // মাস-ভাগ: তারিখ-জানা সারি মাস অনুযায়ী, তারিখ-অজানা সবার নিচে আলাদা ভাগে (sort DESC হওয়ায় ০ শেষেই থাকে)
  const nodes = [];
  let lastMonth = null;
  shown.forEach((row) => {
    const ms = row.items[0].sortMillis;
    const monthLabel = ms ? bnMonthYear(ms) : "তারিখ অজানা";
    if (monthLabel !== lastMonth) {
      nodes.push(React.createElement("div", {
        key: "m-" + monthLabel + "-" + row.sig,
        style: { margin: "10px 0 10px -18px", fontSize: "14px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)" },
      }, monthLabel));
      lastMonth = monthLabel;
    }
    nodes.push(React.createElement(TimelineRow, { key: row.sig + "-" + row.items[0].id, row }));
  });

  return React.createElement(
    "div", null,
    React.createElement(
      "div", { className: "hs-noscroll", style: { display: "flex", gap: "8px", overflowX: "auto", padding: "4px 2px 10px" } },
      FILTERS.map((f) => React.createElement("button", {
        key: f.id, onClick: () => { setFilter(f.id); setVisible(PAGE_SIZE); },
        style: {
          flexShrink: 0, padding: "4px 16px", minHeight: "40px", borderRadius: "999px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          border: filter === f.id ? "1px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA",
          background: filter === f.id ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "#fff", boxShadow: filter === f.id ? "0 3px 8px rgba(14,75,67,0.22)" : "none", color: filter === f.id ? "#fff" : "#2B3A36",
        },
      }, f.label))
    ),

    filter === "vaccine" && vaccineSlot ? React.createElement("div", { style: { marginBottom: "14px" } }, vaccineSlot) : null,
    (entriesErr || recErr) && ErrorBox(entriesErr || (recErr.code === "permission-denied" ? "এই সদস্যের টাইমলাইন দেখার অনুমতি আপনার নেই।" : (recErr.message || String(recErr)))),
    !entriesErr && !recErr && !entries && React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে..."),
    !entriesErr && entries && rows.length === 0 &&
      React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, entries.length === 0 ? "এখনো কোনো রেকর্ড/নথি নেই।" : "এই ফিল্টারে কোনো এন্ট্রি নেই।"),

    !entriesErr && entries && rows.length > 0 && React.createElement(
      "div", { style: { marginTop: "14px", borderLeft: "2px solid #CFE0D6", paddingLeft: "18px", marginLeft: "4px" } }, nodes
    ),
    !entriesErr && rows.length > visible && React.createElement("button", {
      onClick: () => setVisible((v) => v + PAGE_SIZE),
      style: { marginTop: "6px", width: "100%", minHeight: "40px", borderRadius: "12px", border: "1px solid var(--hs-primary, #0E4B43)", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
    }, "আরও দেখুন (" + bnNum(rows.length - visible) + "টি বাকি)")
  );
}
