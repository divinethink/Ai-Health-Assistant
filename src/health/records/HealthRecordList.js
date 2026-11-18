// একজন সদস্যের Health Record — কার্ড-ভিত্তিক তালিকা (ধাপ ২)।
// অসুস্থতা: ১ কলাম কার্ড, ডাক্তার · হাসপাতাল · চেম্বার এক লাইনে। এলার্জি: ২ কলাম।
// ঔষধ এখানে নেই — "ঔষধ ও রিমাইন্ডার" সাব-পিলে (ধাপ ৩)।
// পরিমাপ (Observation): ধরন অনুযায়ী একটা কার্ড — সর্বশেষ মান, তারিখ, ↑↓ তীর; ট্যাপে পুরনো ইতিহাস।
// Edit/Delete সারিতে নেই — কার্ড ট্যাপ করলে খোলে; মোছার আগে আগের মতোই ২-ধাপ confirm
// (deleteHealthRecord নিজেই Admin-override হলে owner-কে notification পাঠায়)।
// শুধু presentation — কোনো schema/rules বদল নেই।

import { PREMIUM_CARD } from "../../shared/cardStyle.js";
import { t, L, digits } from "../../shared/i18n.js";
import { Icon } from "../../shared/icons.js";
import { ErrorBox, Skeleton, ConfirmDialog } from "../../shared/ui.js";
import { BottomSheet } from "../../shared/BottomSheet.js";
import { bnDate } from "../../shared/dates.js";
import { listHealthRecords, deleteHealthRecord, ackLabAlert } from "./healthRecordsData.js";
import { groupObservations, obsTrend, unitLabelBn, orderObsCards } from "./recordGrouping.js";
import { fetchTestNameDictionary } from "../reports/testDictionaryData.js";
import { alertForGroup, buildLabAlerts, alertSig, LEVEL_WORD } from "../reports/labAlerts.js";
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

// layout "page" (স্বাস্থ্য প্রোফাইল): অসুস্থতা+অ্যালার্জি সবসময় খোলা → middleSlot (ওষুধ) → ভাঁজ-করা "রেকর্ড" (ল্যাব-সতর্কতা + পরিমাপ + trendSlot)।
// layout "list" (ডিফল্ট): আগের মতোই একটানা তালিকা।
export function HealthRecordList({ familyId, targetMemberId, callerMemberId, refreshTick, onEdit, onDeleted, layout, middleSlot, trendSlot, recOpen, onToggleRec }) {
  const [records, setRecords] = useState(null);
  const [err, setErr] = useState(null);
  const [openKey, setOpenKey] = useState(null);   // খোলা কার্ড (record id বা "obs:<key>")
  const [confirmId, setConfirmId] = useState(null); // ২-ধাপ delete-confirm
  const [busyId, setBusyId] = useState(null);
  const [ackBusy, setAckBusy] = useState(null);   // "সতর্কতা সরান" চলমান recordId
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
      setOpenKey(null);
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই রেকর্ড মোছার অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally {
      setBusyId(null);
    }
  }, [familyId, targetMemberId, callerMemberId, onDeleted]);

  const isPage = layout === "page";
  if (err) return React.createElement(React.Fragment, null, ErrorBox(err), isPage ? middleSlot : null);
  if (!records) return isPage ? React.createElement(React.Fragment, null, Skeleton(2, 64), middleSlot) : Skeleton(3, 64);
  const noRecords = records.filter((r) => r.resourceType !== "medicationStatement").length === 0;
  if (noRecords && !isPage) return React.createElement("p", { style: { color: MUTED, fontSize: "14px" } }, "কোনো রেকর্ড নেই।");

  const toggle = (k) => { setOpenKey((cur) => (cur === k ? null : k)); setConfirmId(null); };
  const btn = (color, bg) => ({ flex: 1, minHeight: "44px", borderRadius: "12px", border: "1px solid transparent", background: bg, color, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });

  // ✎ সম্পাদনা + 🗑 মুছুন (২-ধাপ)
  const actions = (r) => React.createElement(React.Fragment, null,
    React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
      React.createElement("button", { onClick: () => { setOpenKey(null); onEdit && onEdit(r); }, style: btn(G, "#E6F2EC") }, "✎ সম্পাদনা"),
      React.createElement("button", { onClick: () => setConfirmId(r.id), style: btn(RED, "#FDECEA") }, "🗑 মুছুন")),
    confirmId === r.id && React.createElement(ConfirmDialog, { title: "রেকর্ডটি মুছবেন?", message: "এই রেকর্ড স্থায়ীভাবে মুছে যাবে।", busy: busyId === r.id, onConfirm: () => doDelete(r), onCancel: () => setConfirmId(null) }));

  const line = (label, v) => v ? React.createElement("div", { style: { fontSize: "14px", color: "#3E4E49", marginTop: "3px" } }, label + ": " + v) : null;
  const title = (icon, text, n) => React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 2px 10px" } },
    React.createElement("h4", { style: { margin: 0, fontSize: "15px", fontWeight: 800, color: "#1F2D2A" } }, text),
    React.createElement("span", { style: { fontSize: "11.5px", fontWeight: 600, color: MUTED, background: "#E9F0EC", borderRadius: "999px", padding: "2px 10px" } }, n));
  // স্বাস্থ্য প্রোফাইল পাতার কার্ড: অসুস্থতা/অ্যালার্জি একেকটি কার্ডে (শিরোনাম + চিপ), ওষুধ-কার্ডের সাথে মেলানো; কার্ডের মাঝে সমান ১০px ফাঁক
  const pageCard = (children, compact) => React.createElement("div", { style: { background: "#F3FAF6", border: "1px solid #D9E5DE", borderRadius: "16px", padding: compact ? "7px 10px 8px" : "10px 12px 12px", marginBottom: "10px", boxShadow: "0 1px 3px rgba(14,75,67,0.05)" } }, children);
  const cardTitle = (text, n) => React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 8px" } },
    React.createElement("h4", { style: { margin: 0, fontSize: "15px", fontWeight: 800, color: "#1F2D2A" } }, text),
    React.createElement("span", { style: { fontSize: "11.5px", fontWeight: 600, color: MUTED, background: "#E4EEE8", borderRadius: "999px", padding: "2px 10px" } }, n));
  const badge = (text, color, bg) => React.createElement("span", { style: { fontSize: "13px", fontWeight: 600, color, background: bg, borderRadius: "999px", padding: "2px 10px", whiteSpace: "nowrap" } }, text);
  const shortDate = (iso) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00"); return Number.isNaN(d.getTime()) || d.getFullYear() !== new Date().getFullYear() ? bnDate(iso) : d.toLocaleDateString("bn-BD", { day: "numeric", month: "long" }); };
  const grid3 = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px", alignItems: "stretch" };
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

  const hist = { background: "#fff", borderRadius: "12px", padding: "8px 12px", marginTop: "8px", border: "1px solid #E3ECE6" };
  const statusChip = (r) => { const active = r.status === "active" || r.status === "chronic"; return badge(t("st." + (r.status || "active")), active ? G : MUTED, active ? "#E6F2EC" : "#EEF2F0"); };

  // ---- তালিকার কার্ড: ছোট ও স্থির — ট্যাপে নিচ থেকে শিট ওঠে (কার্ড নিজে বড় হয় না, লিস্ট নড়ে না) ----
  const conditionRow = (r, i) => {
    const tp = r.treatingPhysician || {};
    const sub = [tp.name, tp.hospital, tp.chamberContact].filter(Boolean).join(" · ");
    return React.createElement("button", { key: r.id, onClick: () => toggle(r.id), "aria-haspopup": "dialog", style: { all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "13px 14px", cursor: "pointer", minHeight: "56px", borderTop: i ? "1px solid #EAF0EC" : "none" } },
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: "#1F2D2A", overflowWrap: "anywhere" } }, r.name),
        sub && React.createElement("div", { style: { fontSize: "13.5px", color: MUTED, marginTop: "2px", overflowWrap: "anywhere" } }, sub)),
      statusChip(r),
      React.createElement("span", { "aria-hidden": true, style: { color: MUTED, fontSize: "18px" } }, "›"));
  };
  const allergyCard = (r) => React.createElement("button", { key: r.id, onClick: () => toggle(r.id), "aria-haspopup": "dialog", style: { all: "unset", ...cardBase, boxSizing: "border-box", display: "block", padding: "12px 14px", cursor: "pointer", minHeight: "48px", background: "#FFF8F7", border: "1px solid #F0CCC7", boxShadow: "none", borderRadius: "18px" } },
    React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: RED, overflowWrap: "anywhere" } }, r.substance),
    r.reaction && React.createElement("div", { style: { fontSize: "13.5px", color: "#5B4A47", marginTop: "2px" } }, r.reaction));
  const obsCard = (g) => {
    const k = "obs:" + g.key, latest = g.items[0], tr = obsTrend(g.items), al = alertForGroup(g.items, dict, sex);
    return React.createElement("button", { key: k, onClick: () => toggle(k), "aria-haspopup": "dialog", style: { all: "unset", ...cardBase, boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "10px 9px", minHeight: "112px", cursor: "pointer", background: "#fff", borderRadius: "18px", boxShadow: SOFT, border: "1px solid " + (al ? "#F0CCC7" : "rgba(127,150,140,0.16)") } },
      React.createElement("div", { title: g.label, style: { fontSize: "12.5px", color: MUTED, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" } }, g.label),
      React.createElement("div", { style: { marginTop: "3px", display: "flex", alignItems: "baseline", gap: "5px", flexWrap: "wrap" } },
        React.createElement("span", { style: { fontSize: "21px", fontWeight: 800, color: al ? RED : "#1F2D2A", lineHeight: 1.15, overflowWrap: "anywhere" } }, latest.value),
        latest.unit && React.createElement("span", { style: { fontSize: "12px", color: MUTED } }, unitLabelBn(latest.unit))),
      (tr || al) && React.createElement("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "5px" } },
        al && badge(al.level === "positive" ? "🔴 " + al.value : "🔴 " + LEVEL_WORD[al.level], RED, "#FDE7E4"),
        tr && badge((tr.dir === "up" ? "↑ " : "↓ ") + bn1(tr.diff), al ? RED : G, al ? "#FDE7E4" : "#E6F2EC")),
      latest.date && React.createElement("div", { style: { fontSize: "12.5px", color: MUTED, marginTop: "auto", paddingTop: "5px" } }, shortDate(latest.date)));
  };

  // ---- বিস্তারিত শিট (নিচ থেকে ওঠে) ----
  const closeSheet = () => { setOpenKey(null); setConfirmId(null); };
  const detailSheet = () => {
    if (!openKey) return null;
    if (openKey.startsWith("obs:")) {
      const g = obsGroups.find((x) => "obs:" + x.key === openKey);
      if (!g) return null;
      const latest = g.items[0], tr = obsTrend(g.items), al = alertForGroup(g.items, dict, sex);
      return React.createElement(BottomSheet, { title: g.label, onClose: closeSheet },
        React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" } },
          React.createElement("span", { style: { fontSize: "32px", fontWeight: 800, color: al ? RED : "#1F2D2A" } }, latest.value),
          latest.unit && React.createElement("span", { style: { fontSize: "15px", color: MUTED } }, unitLabelBn(latest.unit))),
        (tr || al) && React.createElement("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" } },
          al && badge(al.level === "positive" ? "🔴 " + al.value : "🔴 " + LEVEL_WORD[al.level], RED, "#FDE7E4"),
          tr && badge((tr.dir === "up" ? "↑ " : "↓ ") + bn1(tr.diff), al ? RED : G, al ? "#FDE7E4" : "#E6F2EC")),
        React.createElement(Spark, { items: g.items }),
        React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: G, margin: "14px 0 0" } }, "ইতিহাস (" + g.items.length + ")"),
        g.items.map((r) => React.createElement("div", { key: r.id, style: hist },
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" } },
            React.createElement("b", { style: { fontSize: "16px" } }, r.value + (r.unit ? " " + unitLabelBn(r.unit) : "")),
            React.createElement("span", { style: { fontSize: "13px", color: MUTED } }, r.date ? bnDate(r.date) : "তারিখ নেই")),
          (r.refLow != null && r.refHigh != null) && React.createElement("div", { style: { fontSize: "13px", color: MUTED, marginTop: "2px" } }, "স্বাভাবিক রেঞ্জ: " + r.refLow + "–" + r.refHigh),
          (r.sourceDocId || r.sourceDocName) && React.createElement("div", { style: { fontSize: "13px", color: MUTED, marginTop: "4px", overflowWrap: "anywhere" } },
            docsById[r.sourceDocId] && docsById[r.sourceDocId].cloudinaryUrl
              ? React.createElement("a", { href: docsById[r.sourceDocId].cloudinaryUrl, target: "_blank", rel: "noopener noreferrer", style: { color: G, fontWeight: 600 } }, "📄 " + docsById[r.sourceDocId].fileName + " — দেখুন")
              : "📄 " + (r.sourceDocName || "রিপোর্ট")),
          actions(r))));
    }
    const r = records.find((x) => x.id === openKey);
    if (!r) return null;
    if (r.resourceType === "allergy") {
      return React.createElement(BottomSheet, { title: r.substance, onClose: closeSheet },
        line("তীব্রতা", r.severity ? t("sev." + r.severity) : null), line("প্রতিক্রিয়া", r.reaction), actions(r));
    }
    return React.createElement(BottomSheet, { title: r.name, onClose: closeSheet },
      React.createElement("div", { style: { marginBottom: "6px" } }, statusChip(r)),
      line("ক্যাটাগরি", r.category), r.chronicManagement && line("ধরন", "দীর্ঘমেয়াদি (Chronic)"),
      line("শুরু", r.onsetDate ? bnDate(r.onsetDate) : null), line("নোট", r.notes),
      (() => { const tp = r.treatingPhysician || {}; return line("ডাক্তার", [tp.name, tp.hospital, tp.chamberContact].filter(Boolean).join(" · ")); })(),
      guideBox(r),
      actions(r));
  };

  // "সতর্কতা সরান": রেকর্ডে স্বাক্ষর সেভ → এখানে সাথে সাথে সরে (লোকাল আপডেট), হিরো cache-সংকেতে নিজে রিফ্রেশ করে
  const doAck = async (id) => {
    const r = records.find((x) => x.id === id);
    if (!r || ackBusy) return;
    setAckBusy(id);
    try {
      await ackLabAlert(familyId, r, targetMemberId, callerMemberId);
      setRecords((rs) => rs.map((x) => (x.id === id ? { ...x, alertAck: alertSig(x) } : x)));
    } catch (e) {
      setErr(e.code === "permission-denied" ? "সতর্কতা সরানোর অনুমতি আপনার নেই।" : "সতর্কতা সরানো যায়নি — নেটওয়ার্ক দেখে আবার চেষ্টা করুন।");
    } finally { setAckBusy(null); }
  };

  // সংরক্ষিত সর্বশেষ মান থেকে হিসাব (নতুন ডেটা নয়) — প্রতি টেস্টের সর্বশেষ মানই
  const labAlerts = buildLabAlerts(obsGroups.map((g) => g.items[0]), dict, sex);

  if (isPage) {
    const cnt = obsGroups.length;
    // অসুখ = ছোট চিপ (নাম + স্ট্যাটাস-ডট); লম্বা-ছোট নাম অনুযায়ী এক লাইনে ২–৩টি, ট্যাপে আগের বিস্তারিত-শিট (ডাক্তার/নোট/গাইড/✎/🗑)।
    const condChip = (r) => { const on = r.status === "active" || r.status === "chronic"; return React.createElement("button", { key: r.id, type: "button", onClick: () => toggle(r.id), "aria-haspopup": "dialog", "aria-label": r.name + " — " + t("st." + (r.status || "active")),
      style: { display: "inline-flex", alignItems: "center", gap: "6px", minHeight: "40px", maxWidth: "100%", padding: "4px 12px", borderRadius: "999px", border: "1px solid " + LINE, background: "#fff", color: "#1F2D2A", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left" } },
      React.createElement("span", { "aria-hidden": "true", style: { width: "8px", height: "8px", flexShrink: 0, borderRadius: "50%", background: on ? "#2FAE6B" : "#B7C3BD" } }),
      React.createElement("span", { style: { overflowWrap: "anywhere", lineHeight: 1.2 } }, r.name)); };
    return React.createElement("div", { style: { marginTop: "2px" } },
      conditions.length > 0 && pageCard([cardTitle(L("অসুস্থতা", "Conditions"), digits(conditions.length) + L("টি", "")), React.createElement("div", { key: "c", style: { display: "flex", flexWrap: "wrap", gap: "6px" } }, conditions.map(condChip))], true),
      allergies.length > 0 && pageCard([cardTitle(L("অ্যালার্জি", "Allergies"), digits(allergies.length) + L("টি", "")), React.createElement("div", { key: "a", style: grid2 }, allergies.map(allergyCard))]),
      middleSlot || null, // অসুস্থতা-চিপ ও ওষুধ-কার্ডের মাঝে স্ট্যান্ডার্ড ফাঁক (owner-request ২০২৬-১১-১৭)
      React.createElement("div", { style: { marginTop: "14px" } },
        React.createElement("button", { type: "button", onClick: onToggleRec, "aria-expanded": !!recOpen,
          style: { width: "100%", minHeight: "48px", padding: "10px 14px", borderRadius: "14px", border: "1px solid #D3E0D9", background: "#fff", color: G, fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between" } },
          React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "6px" } }, Icon("activity", { size: 17 }), L("রেকর্ড", "Records") + (cnt ? " (" + digits(cnt) + L("টি পরিমাপ)", " measurements)") : "")),
          React.createElement("span", { "aria-hidden": "true", style: { display: "flex" } }, Icon(recOpen ? "up" : "down", { size: 18 }))),
        recOpen && React.createElement("div", null,
          React.createElement(LabAlertBox, { alerts: labAlerts, docsById, onAck: doAck, ackBusy, onEdit: (id) => { const r = records.find((x) => x.id === id); if (r && onEdit) onEdit(r); } }),
          cnt > 0
            ? React.createElement(React.Fragment, null, title("📈", L("পরিমাপ", "Measurements"), digits(cnt) + L("টি", "")), React.createElement("div", { style: grid3 }, orderObsCards(obsGroups, (g) => !!alertForGroup(g.items, dict, sex)).map(obsCard)))
            : React.createElement("p", { style: { color: MUTED, fontSize: "14px", margin: "12px 2px 0" } }, L("এখনো কোনো পরিমাপ নেই — ＋ চেপে প্রেসার, সুগার বা অন্য পরিমাপ যোগ করুন।", "No measurements yet — tap ＋ to add blood pressure, sugar or other readings.")),
          trendSlot || null)),
      detailSheet());
  }

  return React.createElement("div", { style: { marginTop: "4px" } },
    React.createElement(LabAlertBox, { alerts: labAlerts, docsById, onAck: doAck, ackBusy, onEdit: (id) => { const r = records.find((x) => x.id === id); if (r && onEdit) onEdit(r); } }),
    conditions.length > 0 && React.createElement(React.Fragment, null, title("🩺", "অসুস্থতা", conditions.length + "টি"), React.createElement("div", { style: { ...cardBase, padding: 0, overflow: "hidden" } }, conditions.map(conditionRow))),
    allergies.length > 0 && React.createElement(React.Fragment, null, title("⚠️", "অ্যালার্জি", allergies.length + "টি"), React.createElement("div", { style: grid2 }, allergies.map(allergyCard))),
    obsGroups.length > 0 && React.createElement(React.Fragment, null, title("📈", "পরিমাপ", obsGroups.length + "টি"), React.createElement("div", { style: grid3 }, orderObsCards(obsGroups, (g) => !!alertForGroup(g.items, dict, sex)).map(obsCard))),
    detailSheet());
}
