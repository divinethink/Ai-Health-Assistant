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
import { fetchMemberSex } from "./memberSex.js";
import { listDocuments } from "../documents/documentsData.js";
import { guideForCondition, mergeGuide, GUIDE_DISCLAIMER } from "./conditionGuideData.js";
import { listGuideOverrides } from "./conditionGuideStore.js";
import { ConditionGuideEditor } from "./ConditionGuideEditor.js";
import { auth } from "../../legacy/firebaseConfig.js";
import { isBlogAdminUid } from "../wellness-guide/wellnessGuideData.js";

const { useState, useEffect, useCallback } = React;

const G = "var(--hs-primary, #0E4B43)", RED = "#B3261E", MUTED = "#5F716C", LINE = "#D3E0D9";
const SOFT = "0 1px 2px rgba(14,75,67,0.06), 0 2px 8px rgba(14,75,67,0.04)";
const cardBase = { ...PREMIUM_CARD, borderRadius: "18px", boxShadow: SOFT, padding: "12px", textAlign: "left", width: "100%", boxSizing: "border-box", fontFamily: "inherit", color: "#1F2D2A", minHeight: "44px" };

const bn1 = (n) => Number(n).toLocaleString("bn-BD", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Spark({ items }) {
  const vals = items.slice(0, 8).reverse().map((r) => parseFloat(r.value)).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => (i * (100 / (vals.length - 1))).toFixed(1) + "," + (22 - ((v - min) / span) * 18).toFixed(1)).join(" ");
  return React.createElement("svg", { viewBox: "0 0 100 26", width: "100%", height: "20", "aria-hidden": true, preserveAspectRatio: "none", style: { marginTop: "8px", opacity: 0.55 } },
    React.createElement("polyline", { points: pts, fill: "none", stroke: "var(--hs-primary-2, #17705F)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round", vectorEffect: "non-scaling-stroke" }));
}

export function HealthRecordList({ familyId, targetMemberId, callerMemberId, refreshTick, onEdit, onDeleted }) {
  const [records, setRecords] = useState(null);
  const [err, setErr] = useState(null);
  const [openKey, setOpenKey] = useState(null);   // খোলা কার্ড (record id বা "obs:<key>")
  const [confirmId, setConfirmId] = useState(null); // ২-ধাপ delete-confirm
  const [busyId, setBusyId] = useState(null);
  const [guideOv, setGuideOv] = useState({});        // অসুখ গাইডের সংশোধন (না এলে ডিফল্ট লেখা)
  const [editGuide, setEditGuide] = useState(null);    // সম্পাদনায় থাকা গাইডের id (শুধু অ্যাপ-ক্রিয়েটর)
  const [dict, setDict] = useState([]);           // ধাপ ৫: রেঞ্জ-ডিকশনারি (না এলে সতর্কতা ছাড়াই চলে)
  const [sex, setSex] = useState(null);           // সদস্যের লিঙ্গ — পুরুষ/নারী আলাদা রেঞ্জ বাছতে
  const [docsById, setDocsById] = useState({});   // উৎস-রিপোর্টের লিংক (না এলে শুধু নাম)

  const loadGuides = useCallback(() => { listGuideOverrides().then(setGuideOv).catch(() => setGuideOv({})); }, []);
  useEffect(() => { loadGuides(); }, [loadGuides]);
  useEffect(() => { fetchTestNameDictionary().then(setDict).catch(() => setDict([])); }, []);
  useEffect(() => {
    let alive = true;
    fetchMemberSex(familyId, targetMemberId).then((x) => alive && setSex(x));
    listDocuments(familyId, targetMemberId).then((ds) => alive && setDocsById(Object.fromEntries(ds.map((d) => [d.id, d])))).catch(() => alive && setDocsById({}));
    return () => { alive = false; };
  }, [familyId, targetMemberId, refreshTick]);

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
  const btn = (color, bg) => ({ flex: 1, minHeight: "44px", borderRadius: "12px", border: "1px solid transparent", background: bg, color, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });

  // ✎ সম্পাদনা + 🗑 মুছুন (২-ধাপ)
  const actions = (r) => React.createElement(React.Fragment, null,
    React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
      React.createElement("button", { onClick: () => onEdit && onEdit(r), style: btn(G, "#E6F2EC") }, "✎ সম্পাদনা"),
      React.createElement("button", { onClick: () => setConfirmId(r.id), style: btn(RED, "#FDECEA") }, "🗑 মুছুন")),
    confirmId === r.id && React.createElement(ConfirmDialog, { title: "রেকর্ডটি মুছবেন?", message: "এই রেকর্ড স্থায়ীভাবে মুছে যাবে।", busy: busyId === r.id, onConfirm: () => doDelete(r), onCancel: () => setConfirmId(null) }));

  const line = (label, v) => v ? React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", marginTop: "3px" } }, label + ": " + v) : null;
  const title = (icon, text, n) => React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 2px 10px" } },
    React.createElement("h4", { style: { margin: 0, fontSize: "16px", fontWeight: 800, color: "#1F2D2A" } }, text),
    React.createElement("span", { style: { fontSize: "12.5px", fontWeight: 600, color: MUTED, background: "#E9F0EC", borderRadius: "999px", padding: "2px 10px" } }, n));
  const badge = (text, color, bg) => React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, color, background: bg, borderRadius: "999px", padding: "2px 10px", whiteSpace: "nowrap" } }, text);
  const shortDate = (iso) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00"); return Number.isNaN(d.getTime()) || d.getFullYear() !== new Date().getFullYear() ? bnDate(iso) : d.toLocaleDateString("bn-BD", { day: "numeric", month: "long" }); };
  const grid3 = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" };
  const grid2 = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" };

  const conditions = records.filter((r) => r.resourceType === "condition");
  const allergies = records.filter((r) => r.resourceType === "allergy");
  const obsGroups = groupObservations(records);

  // অসুখ গাইড (স্থির সাধারণ তথ্য, AI নেই) — কার্ড খুললে ভাঁজযোগ্য; না মিললে AI চ্যাটের ইঙ্গিত
  const guideBox = (r) => {
    const base = guideForCondition(r.name);
    const gd = base ? mergeGuide(base, guideOv[base.id]) : null;
    const isCreator = !!(auth && auth.currentUser && isBlogAdminUid(auth.currentUser.uid));
    if (!gd) return React.createElement("div", { style: { fontSize: "13px", color: MUTED, marginTop: "8px", lineHeight: 1.5 } }, "ℹ️ এই অসুখের গাইড এখনো নেই — মেনু → AI চ্যাট → ‘আধুনিক চিকিৎসা’-তে সাধারণ তথ্য জিজ্ঞেস করতে পারেন।");
    const sec = (head, items) => items && items.length ? React.createElement("div", { key: head, style: { marginTop: "8px" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: G } }, head),
      React.createElement("ul", { style: { margin: "2px 0 0", paddingLeft: "18px", fontSize: "14px", color: "#3E4E49", lineHeight: 1.55 } }, items.map((x, i) => React.createElement("li", { key: i }, x)))) : null;
    return React.createElement("details", { style: { marginTop: "8px", background: "#F3F8F5", border: "1px solid " + LINE, borderRadius: "12px", padding: "0 10px" } },
      React.createElement("summary", { style: { cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700, color: G } }, "ℹ️ অসুখ গাইড — " + gd.title + (gd.status === "verified" ? "  ✔ যাচাইকৃত" : "  (খসড়া)")),
      React.createElement("div", { style: { paddingBottom: "10px" } },
        React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", lineHeight: 1.55 } }, gd.what),
        sec("সাধারণ কারণ", gd.causes), sec("যা মানবেন / ছাড়বেন", gd.habits), sec("খাদ্যাভ্যাস", gd.food), sec("সতর্কতা", gd.caution),
        React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "10px", lineHeight: 1.5 } }, "সূত্র: " + gd.src.join(", ") + " · " + GUIDE_DISCLAIMER),
        isCreator && editGuide !== gd.id && React.createElement("button", { type: "button", onClick: () => setEditGuide(gd.id), style: { marginTop: "8px", minHeight: "44px", padding: "0 14px", borderRadius: "12px", border: "1.5px solid " + G, background: "#fff", color: G, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "✎ সম্পাদনা / যাচাই"),
        isCreator && editGuide === gd.id && React.createElement(ConditionGuideEditor, { key: gd.id + (gd.edited ? "e" : "d"), guide: gd, hasOverride: gd.edited, onCancel: () => setEditGuide(null), onDone: () => { setEditGuide(null); loadGuides(); } })));
  };

  // অসুস্থতা: একটাই কার্ডের ভেতর সারি-তালিকা (প্রতি সারিতে নাম + ডাক্তার/হাসপাতাল, ডানে স্ট্যাটাস-চিপ)
  const conditionRow = (r, i) => {
    const tp = r.treatingPhysician || {};
    const sub = [tp.name, tp.hospital, tp.chamberContact].filter(Boolean).join(" · ");
    const open = openKey === r.id;
    const active = r.status === "active" || r.status === "chronic";
    return React.createElement("div", { key: r.id, style: { borderTop: i ? "1px solid #EAF0EC" : "none" } },
      React.createElement("button", { onClick: () => toggle(r.id), "aria-expanded": open, style: { all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "13px 14px", cursor: "pointer", minHeight: "56px" } },
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
          React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: "#1F2D2A", overflowWrap: "anywhere" } }, r.name),
          sub && React.createElement("div", { style: { fontSize: "13.5px", color: MUTED, marginTop: "2px", overflowWrap: "anywhere" } }, sub)),
        badge(t("st." + (r.status || "active")), active ? G : MUTED, active ? "#E6F2EC" : "#EEF2F0"),
        React.createElement("span", { "aria-hidden": true, style: { color: MUTED, fontSize: "18px", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" } }, "›")),
      open && React.createElement("div", { style: { padding: "0 14px 14px" } },
        line("ক্যাটাগরি", r.category), r.chronicManagement && line("ধরন", "দীর্ঘমেয়াদি (Chronic)"),
        line("শুরু", r.onsetDate ? bnDate(r.onsetDate) : null), line("নোট", r.notes),
        guideBox(r),
        actions(r)));
  };

  // অ্যালার্জি: হালকা লাল-আভা ছোট কার্ড (লাল শুধু এলার্জি/বিপদে সংরক্ষিত)
  const allergyCard = (r) => {
    const open = openKey === r.id;
    return React.createElement("div", { key: r.id, style: { ...cardBase, padding: 0, background: "#FFF8F7", border: "1px solid #F0CCC7", boxShadow: "none", gridColumn: open ? "1 / -1" : undefined } },
      React.createElement("button", { onClick: () => toggle(r.id), "aria-expanded": open, style: { all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "12px 14px", cursor: "pointer", minHeight: "48px" } },
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: RED, overflowWrap: "anywhere" } }, r.substance),
        r.reaction && React.createElement("div", { style: { fontSize: "13.5px", color: "#5B4A47", marginTop: "2px" } }, r.reaction)),
      open && React.createElement("div", { style: { padding: "0 14px 14px" } },
        line("তীব্রতা", r.severity ? t("sev." + r.severity) : null), actions(r)));
  };

  // পরিমাপ: ২ কলাম কার্ড — নাম (২ লাইন পর্যন্ত), বড় মান, ছোট ট্রেন্ড-চিপ, নিচে তারিখ
  const obsCard = (g) => {
    const k = "obs:" + g.key, open = openKey === k;
    const latest = g.items[0], tr = obsTrend(g.items), al = alertForGroup(g.items, dict, sex);
    return React.createElement("div", { key: k, style: { ...cardBase, padding: 0, gridColumn: open ? "1 / -1" : undefined, border: "1px solid " + (al ? "#F0CCC7" : "rgba(127,150,140,0.16)") } },
      React.createElement("button", { onClick: () => toggle(k), "aria-expanded": open, style: { all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "12px 14px", cursor: "pointer", minHeight: "44px" } },
        React.createElement("div", { style: { fontSize: "13.5px", color: MUTED, lineHeight: 1.3, minHeight: open ? undefined : "35px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: open ? "unset" : 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" } }, g.label),
        React.createElement("div", { style: { marginTop: "4px", display: "flex", alignItems: "baseline", gap: "4px", flexWrap: "wrap" } },
          React.createElement("span", { style: { fontSize: "24px", fontWeight: 800, color: al ? RED : "#1F2D2A", lineHeight: 1.15 } }, latest.value),
          latest.unit && React.createElement("span", { style: { fontSize: "13.5px", color: MUTED } }, unitLabelBn(latest.unit))),
        (tr || al) && React.createElement("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" } },
          al && badge(al.level === "positive" ? "🔴 " + al.value : "🔴 " + LEVEL_WORD[al.level], RED, "#FDE7E4"),
          tr && badge((tr.dir === "up" ? "↑ " : "↓ ") + bn1(tr.diff), al ? RED : G, al ? "#FDE7E4" : "#E6F2EC")),
        React.createElement(Spark, { items: g.items }),
        latest.date && React.createElement("div", { style: { fontSize: "12.5px", color: MUTED, marginTop: "6px" } }, shortDate(latest.date))),
      open && React.createElement("div", { style: { padding: "0 14px 14px", borderTop: "1px solid #EAF0EC" } },
        React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: G, margin: "10px 0 2px" } }, "ইতিহাস (" + g.items.length + ")"),
        g.items.map((r) => React.createElement("div", { key: r.id, style: { padding: "8px 0", borderBottom: "1px solid #EEF1EF" } },
          React.createElement("div", { style: { fontSize: "14px" } }, React.createElement("b", null, r.value + (r.unit ? " " + unitLabelBn(r.unit) : "")), "  ·  ", r.date ? bnDate(r.date) : "তারিখ নেই"),
          (r.refLow != null && r.refHigh != null) && React.createElement("div", { style: { fontSize: "13px", color: MUTED } }, "রেঞ্জ: " + r.refLow + "–" + r.refHigh),
          (r.sourceDocId || r.sourceDocName) && React.createElement("div", { style: { fontSize: "13px", color: MUTED, overflowWrap: "anywhere" } },
            docsById[r.sourceDocId] && docsById[r.sourceDocId].cloudinaryUrl
              ? React.createElement("a", { href: docsById[r.sourceDocId].cloudinaryUrl, target: "_blank", rel: "noopener noreferrer", style: { color: G, fontWeight: 600 } }, "📄 " + docsById[r.sourceDocId].fileName + " — দেখুন")
              : "📄 " + (r.sourceDocName || "রিপোর্ট")),
          actions(r)))));
  };

  // সংরক্ষিত সর্বশেষ মান থেকে হিসাব (নতুন ডেটা নয়) — প্রতি টেস্টের সর্বশেষ মানই
  const labAlerts = buildLabAlerts(obsGroups.map((g) => g.items[0]), dict, sex);

  return React.createElement("div", { style: { marginTop: "4px" } },
    React.createElement(LabAlertBox, { alerts: labAlerts, docsById, onEdit: (id) => { const r = records.find((x) => x.id === id); if (r && onEdit) onEdit(r); } }),
    conditions.length > 0 && React.createElement(React.Fragment, null, title("🩺", "অসুস্থতা", conditions.length + "টি"), React.createElement("div", { style: { ...cardBase, padding: 0, overflow: "hidden" } }, conditions.map(conditionRow))),
    allergies.length > 0 && React.createElement(React.Fragment, null, title("⚠️", "অ্যালার্জি", allergies.length + "টি"), React.createElement("div", { style: grid2 }, allergies.map(allergyCard))),
    obsGroups.length > 0 && React.createElement(React.Fragment, null, title("📈", "পরিমাপ", obsGroups.length + "টি"), React.createElement("div", { style: grid3 }, obsGroups.map(obsCard))));
}
