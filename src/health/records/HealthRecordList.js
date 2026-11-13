// একজন সদস্যের Health Record — কার্ড-ভিত্তিক তালিকা (ধাপ ২)।
// অসুস্থতা: ১ কলাম কার্ড, ডাক্তার · হাসপাতাল · চেম্বার এক লাইনে। এলার্জি: ২ কলাম।
// ঔষধ এখানে নেই — "ঔষধ ও রিমাইন্ডার" সাব-পিলে (ধাপ ৩)।
// পরিমাপ (Observation): ধরন অনুযায়ী একটা কার্ড — সর্বশেষ মান, তারিখ, ↑↓ তীর; ট্যাপে পুরনো ইতিহাস।
// Edit/Delete সারিতে নেই — কার্ড ট্যাপ করলে খোলে; মোছার আগে আগের মতোই ২-ধাপ confirm
// (deleteHealthRecord নিজেই Admin-override হলে owner-কে notification পাঠায়)।
// শুধু presentation — কোনো schema/rules বদল নেই।

import { PREMIUM_CARD } from "../../shared/cardStyle.js";
import { t } from "../../shared/i18n.js";
import { ErrorBox, Skeleton, ConfirmDialog } from "../../shared/ui.js";
import { bnDate } from "../../shared/dates.js";
import { listHealthRecords, deleteHealthRecord } from "./healthRecordsData.js";
import { groupObservations, obsTrend, unitLabelBn } from "./recordGrouping.js";
import { fetchTestNameDictionary } from "../reports/testDictionaryData.js";
import { alertForGroup, buildLabAlerts, LEVEL_WORD } from "../reports/labAlerts.js";
import { LabAlertBox } from "../reports/LabAlertBox.js";
import { guideForCondition, GUIDE_DISCLAIMER } from "./conditionGuideData.js";

const { useState, useEffect, useCallback } = React;

const G = "var(--hs-primary, #0E4B43)", RED = "#B3261E", MUTED = "#5F716C", LINE = "#D3E0D9";
const cardBase = { ...PREMIUM_CARD, padding: "12px", textAlign: "left", width: "100%", boxSizing: "border-box", fontFamily: "inherit", color: "#1F2D2A", minHeight: "44px" };

const bn1 = (n) => Number(n).toLocaleString("bn-BD", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Spark({ items }) {
  const vals = items.slice(0, 8).reverse().map((r) => parseFloat(r.value)).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => (i * (100 / (vals.length - 1))).toFixed(1) + "," + (22 - ((v - min) / span) * 18).toFixed(1)).join(" ");
  return React.createElement("svg", { viewBox: "0 0 100 26", width: "100%", height: "26", "aria-hidden": true, preserveAspectRatio: "none", style: { marginTop: "6px" } },
    React.createElement("polyline", { points: pts, fill: "none", stroke: "var(--hs-primary-2, #17705F)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round", vectorEffect: "non-scaling-stroke" }));
}

export function HealthRecordList({ familyId, targetMemberId, callerMemberId, refreshTick, onEdit, onDeleted }) {
  const [records, setRecords] = useState(null);
  const [err, setErr] = useState(null);
  const [openKey, setOpenKey] = useState(null);   // খোলা কার্ড (record id বা "obs:<key>")
  const [confirmId, setConfirmId] = useState(null); // ২-ধাপ delete-confirm
  const [busyId, setBusyId] = useState(null);
  const [dict, setDict] = useState([]);           // ধাপ ৫: রেঞ্জ-ডিকশনারি (না এলে সতর্কতা ছাড়াই চলে)

  useEffect(() => { fetchTestNameDictionary().then(setDict).catch(() => setDict([])); }, []);

  useEffect(() => {
    setRecords(null);
    setErr(null);
    setOpenKey(null);
    setConfirmId(null);
    listHealthRecords(familyId, targetMemberId)
      .then(setRecords)
      .catch((e) => setErr(e.code === "permission-denied"
        ? "এই সদস্যের স্বাস্থ্য রেকর্ড দেখার অনুমতি আপনার নেই (অ্যাডমিনের অনুমতি ছাড়া অন্য সদস্যের তথ্য দেখা যায় না)।"
        : (e.message || String(e))));
  }, [familyId, targetMemberId, refreshTick]);

  const doDelete = useCallback(async (r) => {
    setBusyId(r.id);
    try {
      await deleteHealthRecord(familyId, r.id, targetMemberId, callerMemberId);
      setConfirmId(null);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই রেকর্ড মোছার অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally {
      setBusyId(null);
    }
  }, [familyId, targetMemberId, callerMemberId, onDeleted]);

  if (err) return ErrorBox(err);
  if (!records) return Skeleton(3, 64);
  if (records.filter((r) => r.resourceType !== "medicationStatement").length === 0) return React.createElement("p", { style: { color: MUTED, fontSize: "14px" } }, "কোনো record নেই।");

  const toggle = (k) => { setOpenKey((cur) => (cur === k ? null : k)); setConfirmId(null); };
  const btn = (color, bg) => ({ flex: 1, minHeight: "44px", borderRadius: "12px", border: "1px solid " + color, background: bg || "#fff", color, fontSize: "14px", fontWeight: 600, cursor: "pointer" });

  // ✎ সম্পাদনা + 🗑 মুছুন (২-ধাপ)
  const actions = (r) => React.createElement(React.Fragment, null,
    React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
      React.createElement("button", { onClick: () => onEdit && onEdit(r), style: btn(G) }, "✎ সম্পাদনা"),
      React.createElement("button", { onClick: () => setConfirmId(r.id), style: btn(RED) }, "🗑 মুছুন")),
    confirmId === r.id && React.createElement(ConfirmDialog, { title: "রেকর্ডটি মুছবেন?", message: "এই রেকর্ড স্থায়ীভাবে মুছে যাবে।", busy: busyId === r.id, onConfirm: () => doDelete(r), onCancel: () => setConfirmId(null) }));

  const line = (label, v) => v ? React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", marginTop: "3px" } }, label + ": " + v) : null;
  const title = (icon, text, n) => React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 8px" } },
    React.createElement("h4", { style: { margin: 0, fontSize: "15px", color: G } }, icon + " " + text),
    React.createElement("span", { style: { fontSize: "14px", color: MUTED } }, n));
  const badge = (text, color, bg) => React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, color, background: bg, borderRadius: "999px", padding: "2px 10px", whiteSpace: "nowrap" } }, text);
  const shortDate = (iso) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00"); return Number.isNaN(d.getTime()) || d.getFullYear() !== new Date().getFullYear() ? bnDate(iso) : d.toLocaleDateString("bn-BD", { day: "numeric", month: "long" }); };
  const grid3 = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" };
  const grid2 = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" };

  const conditions = records.filter((r) => r.resourceType === "condition");
  const allergies = records.filter((r) => r.resourceType === "allergy");
  const obsGroups = groupObservations(records);

  // অসুখ গাইড (স্থির সাধারণ তথ্য, AI নেই) — কার্ড খুললে ভাঁজযোগ্য; না মিললে AI চ্যাটের ইঙ্গিত
  const guideBox = (r) => {
    const gd = guideForCondition(r.name);
    if (!gd) return React.createElement("div", { style: { fontSize: "13px", color: MUTED, marginTop: "8px", lineHeight: 1.5 } }, "ℹ️ এই অসুখের গাইড এখনো নেই — মেনু → AI চ্যাট → ‘আধুনিক চিকিৎসা’-তে সাধারণ তথ্য জিজ্ঞেস করতে পারেন।");
    const sec = (head, items) => items && items.length ? React.createElement("div", { key: head, style: { marginTop: "8px" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: G } }, head),
      React.createElement("ul", { style: { margin: "2px 0 0", paddingLeft: "18px", fontSize: "14px", color: "#3E4E49", lineHeight: 1.55 } }, items.map((x, i) => React.createElement("li", { key: i }, x)))) : null;
    return React.createElement("details", { style: { marginTop: "8px", background: "#F3F8F5", border: "1px solid " + LINE, borderRadius: "12px", padding: "0 10px" } },
      React.createElement("summary", { style: { cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700, color: G } }, "ℹ️ অসুখ গাইড — " + gd.title),
      React.createElement("div", { style: { paddingBottom: "10px" } },
        React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", lineHeight: 1.55 } }, gd.what),
        sec("সাধারণ কারণ", gd.causes), sec("যা মানবেন / ছাড়বেন", gd.habits), sec("খাদ্যাভ্যাস", gd.food), sec("সতর্কতা", gd.caution),
        React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "10px", lineHeight: 1.5 } }, "সূত্র: " + gd.src.join(", ") + " · " + GUIDE_DISCLAIMER)));
  };

  const conditionCard = (r) => {
    const tp = r.treatingPhysician || {};
    const sub = [tp.name && "👨‍⚕️ " + tp.name, tp.hospital && "🏥 " + tp.hospital, tp.chamberContact && "📞 " + tp.chamberContact].filter(Boolean).join(" · ");
    const open = openKey === r.id;
    const active = r.status === "active" || r.status === "chronic";
    return React.createElement("div", { key: r.id, style: { ...cardBase, flex: (open || sub) ? "1 1 100%" : "1 1 auto", maxWidth: "100%", boxSizing: "border-box", padding: 0 } },
      React.createElement("button", { onClick: () => toggle(r.id), "aria-expanded": open, style: { all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "12px", cursor: "pointer", minHeight: "44px" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" } },
          React.createElement("span", { style: { fontSize: "16px", overflowWrap: "anywhere" } }, React.createElement("b", null, r.name), React.createElement("span", { style: { fontSize: "14px", color: active ? G : MUTED } }, " (" + t("st." + (r.status || "active")) + ")"))),
        sub && React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", marginTop: "4px" } }, sub)),
      open && React.createElement("div", { style: { padding: "0 12px 12px", borderTop: "1px solid " + LINE } },
        line("Category", r.category), r.chronicManagement && line("ধরন", "দীর্ঘমেয়াদি (Chronic)"),
        line("শুরু", r.onsetDate ? bnDate(r.onsetDate) : null), line("নোট", r.notes),
        guideBox(r),
        actions(r)));
  };

  const allergyCard = (r) => {
    const open = openKey === r.id;
    return React.createElement("div", { key: r.id, style: { ...cardBase, padding: 0, background: "#FFF7F6", border: "1px solid #E8B4AE", gridColumn: open ? "1 / -1" : undefined } },
      React.createElement("button", { onClick: () => toggle(r.id), "aria-expanded": open, style: { all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "12px", cursor: "pointer", minHeight: "44px" } },
        React.createElement("b", { style: { fontSize: "16px", color: RED, overflowWrap: "anywhere" } }, r.substance),
        r.reaction && React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", marginTop: "2px" } }, r.reaction)),
      open && React.createElement("div", { style: { padding: "0 12px 12px", borderTop: "1px solid #E8B4AE" } },
        line("তীব্রতা", r.severity ? t("sev." + r.severity) : null), actions(r)));
  };

  const obsCard = (g) => {
    const k = "obs:" + g.key, open = openKey === k;
    const latest = g.items[0], tr = obsTrend(g.items), al = alertForGroup(g.items, dict);
    return React.createElement("div", { key: k, style: { ...cardBase, padding: 0, gridColumn: open ? "1 / -1" : undefined, border: "1px solid " + (al ? "#E8B4AE" : LINE) } },
      React.createElement("button", { onClick: () => toggle(k), "aria-expanded": open, style: { all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "10px 8px", cursor: "pointer", minHeight: "44px" } },
        React.createElement("div", { style: { fontSize: "13px", color: MUTED, overflowWrap: "anywhere" } }, g.label,
          al && badge(al.level === "positive" ? "🔴 " + al.value : "🔴 " + LEVEL_WORD[al.level], RED, "#FDE7E4")),
        React.createElement("div", { style: { marginTop: "2px" } },
          React.createElement("span", { style: { fontSize: "19px", fontWeight: 700, color: al ? RED : G } }, latest.value),
          latest.unit && React.createElement("span", { style: { fontSize: "14px", color: MUTED } }, " " + unitLabelBn(latest.unit)),
          tr && React.createElement("div", { style: { fontSize: "13px", color: al ? RED : MUTED } }, (tr.dir === "up" ? "↑ " : "↓ ") + bn1(tr.diff))),
        React.createElement(Spark, { items: g.items }),
        latest.date && React.createElement("div", { style: { fontSize: "13px", color: MUTED, marginTop: "4px", overflowWrap: "anywhere" } }, shortDate(latest.date))),
      open && React.createElement("div", { style: { padding: "0 12px 12px", borderTop: "1px solid " + LINE } },
        React.createElement("div", { style: { fontSize: "14px", fontWeight: 600, color: G, margin: "8px 0 2px" } }, "ইতিহাস (" + g.items.length + ")"),
        g.items.map((r) => React.createElement("div", { key: r.id, style: { padding: "6px 0", borderBottom: "1px solid #EEF1EF" } },
          React.createElement("div", { style: { fontSize: "14px" } }, React.createElement("b", null, r.value + (r.unit ? " " + unitLabelBn(r.unit) : "")), "  ·  ", r.date ? bnDate(r.date) : "তারিখ নেই"),
          actions(r)))));
  };

  // সংরক্ষিত সর্বশেষ মান থেকে হিসাব (নতুন ডেটা নয়) — প্রতি টেস্টের সর্বশেষ মানই
  const labAlerts = buildLabAlerts(obsGroups.map((g) => g.items[0]), dict);

  return React.createElement("div", { style: { marginTop: "4px" } },
    React.createElement(LabAlertBox, { alerts: labAlerts }),
    conditions.length > 0 && React.createElement(React.Fragment, null, title("🩺", "অসুস্থতা", conditions.length + "টি"), React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" } }, conditions.map(conditionCard))),
    allergies.length > 0 && React.createElement(React.Fragment, null, title("⚠️", "অ্যালার্জি", allergies.length + "টি"), React.createElement("div", { style: grid2 }, allergies.map(allergyCard))),
    obsGroups.length > 0 && React.createElement(React.Fragment, null, title("📈", "পরিমাপ", "ট্যাপে ইতিহাস"), React.createElement("div", { style: grid3 }, obsGroups.map(obsCard))));
}
