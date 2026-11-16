// "সাধারণ চিকিৎসা" পিল: সবার জন্য স্থির শুরুর তালিকা + সদস্যের নিজের তালিকা (যোগ/সম্পাদনা/মোছা)।
// ডোজ শুধু সদস্যের নিজের লেখা; অ্যাপ বানায় না, AI/dose-engine-এর সাথে যোগ নেই।
import { TextField, PrimaryButton, SheetFrame, ConfirmDialog, ErrorBox, Skeleton } from "../../shared/ui.js";
import { MED_ALIAS } from "../../shared/searchAliases.js";
import { COMMON_CARE_DEFAULTS } from "./commonCareList.js";
import { addCareBatch, newCareDocId, editCare, removeCare, groupByDisease, useMemberHealth } from "./commonCareData.js";
import { emptyMed, filledMeds, validateCareMeds, medSummary, diseaseNames, toBn, MAX_MEDS, CARE_MODES, MODE_NOUN, MODE_FIELDS } from "./careMeds.js";
import { SubPills } from "../../shared/SubPills.js";

const { useState, useRef } = React;
// নেটওয়ার্ক বন্ধ থাকলে অনির্দিষ্ট অপেক্ষা নয়; পুনঃচেষ্টা নিরাপদ (রেকর্ড-আইডি স্থির)
const withTimeout = (p, ms = 15000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px", fontFamily: "inherit" };
const card = { background: "#fff", border: "1px solid #D9E5DE", borderRadius: "16px", padding: "12px", marginBottom: "8px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" };
const iconBtn = { minWidth: "44px", minHeight: "44px", border: "none", background: "none", fontSize: "18px", cursor: "pointer" };
const h = (txt) => React.createElement("div", { style: { fontSize: "15px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", margin: "14px 0 8px" } }, txt);

// ব্র্যান্ড লিখলে জেনেরিক নিজে বসে (বিদ্যমান MED_ALIAS থেকে; নতুন ডেটা-উৎস নেই)
function genericFromBrand(brand) {
  const q = (brand || "").trim().toLowerCase();
  if (!q) return "";
  for (const [generic, aliases] of Object.entries(MED_ALIAS)) {
    if (aliases.some((a) => a.toLowerCase() === q)) return generic;
  }
  return "";
}

// পটেন্সি: লেবেলের পাশে ⓘ; চাপলে সহজ ব্যাখ্যা খোলে/বন্ধ হয় (শুধু তথ্য, কিছু সংরক্ষণ হয় না)
function PotencyField(label, value, onChange, ph, open, toggle) {
  const line = { marginTop: "4px" };
  return React.createElement("div", { style: { marginTop: "14px" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", marginBottom: "6px" } },
      React.createElement("label", { htmlFor: "cc-potency", style: { fontSize: "14px", fontWeight: 600, color: "#1F2D2A" } }, label),
      React.createElement("button", { type: "button", onClick: toggle, "aria-label": "পটেন্সি কী, জানুন", "aria-expanded": open, style: { minWidth: "44px", minHeight: "44px", margin: "-12px 0 -12px 0", border: "none", background: "none", color: "var(--hs-primary, #0E4B43)", fontSize: "18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "ⓘ")),
    open && React.createElement("div", { style: { background: "#F2F7F4", border: "1px solid #D9E5DE", borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", fontSize: "13.5px", lineHeight: 1.55, color: "#2B3A36" } },
      React.createElement("div", null, "পটেন্সি হলো হোমিওপ্যাথি ওষুধের শক্তিমাত্রা, অর্থাৎ ওষুধ কতবার তরল (dilute) করা হয়েছে তার হিসাব। বোতলের গায়ে ওষুধের নামের পাশে লেখা থাকে, যেমন 6X, 30C, 200C।"),
      React.createElement("div", { style: line }, "• X মানে প্রতি ধাপে ১ ভাগ ওষুধ ও ৯ ভাগ তরল।"),
      React.createElement("div", null, "• C মানে প্রতি ধাপে ১ ভাগ ওষুধ ও ৯৯ ভাগ তরল।"),
      React.createElement("div", null, "• সংখ্যা যত বড়, তত বেশি ধাপে তরল করা হয়েছে।"),
      React.createElement("div", { style: line }, "চিকিৎসক যেটা লিখে দিয়েছেন, বোতল দেখে সেটাই লিখুন। না জানলে ঘরটি ফাঁকা রাখতে পারেন।")),
    React.createElement("input", { id: "cc-potency", type: "text", value, placeholder: ph, onChange: (e) => onChange(e.target.value), style: inputStyle }));
}

export function CommonCareSection({ familyId, callerMemberId, selectedMemberId }) {
  const { records, loading, error } = useMemberHealth(familyId, selectedMemberId);
  const [form, setForm] = useState(null); // null | { id|null, disease, meds[], openKey }
  const idsRef = useRef({}); // ওষুধ-কার্ড key → রেকর্ড-আইডি (retry-তে duplicate রোধ)
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [openDef, setOpenDef] = useState(false);
  const [mode, setMode] = useState("allopathy"); // allopathy | homeopathy | herbal
  const [potencyInfo, setPotencyInfo] = useState(false); // পটেন্সির ⓘ ব্যাখ্যা
  const noun = MODE_NOUN[mode];

  const openNew = (disease, med) => { const m = med || emptyMed(); setErr(null); setForm({ id: null, disease: disease || "", meds: [m], openKey: m.key }); };
  const setDisease = (v) => setForm((s) => ({ ...s, disease: v }));
  const setMed = (key, k) => (v) => setForm((s) => ({ ...s, meds: s.meds.map((m) => {
    if (m.key !== key) return m;
    const n = { ...m, [k]: v };
    if (mode === "allopathy" && k === "brand" && !m.generic.trim()) { const g = genericFromBrand(v); if (g) n.generic = g; }
    return n;
  }) }));
  const addMed = () => setForm((s) => {
    if (s.meds.length >= MAX_MEDS) return s;
    const m = emptyMed();
    return { ...s, meds: [...s.meds, m], openKey: m.key };
  });
  const removeMed = (key) => setForm((s) => {
    const meds = s.meds.filter((m) => m.key !== key);
    return { ...s, meds, openKey: s.openKey === key ? meds[meds.length - 1].key : s.openKey };
  });
  const save = async () => {
    const v = validateCareMeds(form.disease, form.meds, mode);
    if (v) { setErr(v.msg); if (v.key) setForm((s) => ({ ...s, openKey: v.key })); return; }
    const disease = form.disease.trim();
    const fieldsOf = (m) => ({ disease, brand: m.brand, generic: m.generic, dose: m.dose, frequency: m.frequency, note: m.note, mode, potency: m.potency, prep: m.prep });
    setBusy(true); setErr(null);
    try {
      if (form.id) await withTimeout(editCare(familyId, form.id, callerMemberId, fieldsOf(filledMeds(form.meds)[0])));
      else {
        const items = filledMeds(form.meds).map((m) => ({ docId: idsRef.current[m.key] || (idsRef.current[m.key] = newCareDocId(familyId)), fields: fieldsOf(m) }));
        await withTimeout(addCareBatch(familyId, selectedMemberId, callerMemberId, items));
      }
      setForm(null);
    } catch (e) {
      setErr(e && e.message === "timeout" ? "নেটওয়ার্ক ধীর বা বন্ধ — সংরক্ষণ নিশ্চিত হয়নি। ইন্টারনেট দেখে আবার চাপুন (দুবার সেভ হবে না)।" : "সংরক্ষণ করা যায়নি — অনুমতি/নেটওয়ার্ক দেখুন।");
    } finally { setBusy(false); }
  };
  const doDelete = async () => {
    setBusy(true);
    try { await removeCare(familyId, del.id, selectedMemberId, callerMemberId); setDel(null); }
    catch (e) { setErr("মোছা যায়নি।"); setDel(null); } finally { setBusy(false); }
  };

  const groups = records ? groupByDisease(records, mode) : [];
  const names = diseaseNames(groups);
  const line = (r) => [r.dose, r.frequency].filter(Boolean).join(" · ");

  return React.createElement(React.Fragment, null,
    SubPills(CARE_MODES, mode, setMode, "care", "চিকিৎসার ধারা"),
    err && !form && ErrorBox(err),
    error && ErrorBox("তালিকা পড়া যায়নি।"),
    React.createElement("button", { type: "button", onClick: () => openNew(""), style: { marginTop: "10px", width: "100%", minHeight: "48px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))", color: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "＋ নতুন যোগ করুন"),

    h("আমার তালিকা"),
    loading && !records ? Skeleton(2, 64)
      : groups.length === 0 ? React.createElement("div", { style: { ...card, color: "#5B6B66", fontSize: "14px", textAlign: "center" } }, (mode === "allopathy" ? "এখনো কিছু নেই — নিচের সাধারণ তালিকা থেকে নিন, বা নতুন যোগ করুন।" : "এখনো কিছু নেই — নতুন যোগ করুন।"))
      : groups.map(([disease, rows]) => React.createElement("div", { key: disease, style: card },
          React.createElement("div", { style: { fontSize: "14px", fontWeight: 800, color: "#1F2D2A", marginBottom: "4px" } }, disease),
          rows.map((r) => React.createElement("div", { key: r.id, style: { display: "flex", alignItems: "center", gap: "4px", borderTop: "1px solid #EEF3F0", padding: "6px 0" } },
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, overflowWrap: "anywhere" } }, [r.brand, r.generic && (r.brand ? "(" + r.generic + ")" : r.generic)].filter(Boolean).join(" ")),
              line(r) && React.createElement("div", { style: { fontSize: "13px", color: "#2B3A36" } }, line(r)),
              r.note && React.createElement("div", { style: { fontSize: "12.5px", color: "#5B6B66" } }, r.note)),
            React.createElement("button", { type: "button", "aria-label": "সম্পাদনা", title: "সম্পাদনা", style: iconBtn, onClick: () => { const m = { ...emptyMed(), brand: r.brand || "", generic: r.generic || "", dose: r.dose || "", frequency: r.frequency || "", note: r.note || "", potency: r.potency || "", prep: r.prep || "" }; setErr(null); setForm({ id: r.id, disease: r.disease || "", meds: [m], openKey: m.key }); } }, "✎"),
            React.createElement("button", { type: "button", "aria-label": "মুছুন", title: "মুছুন", style: iconBtn, onClick: () => setDel(r) }, "🗑"))),
          React.createElement("button", { type: "button", onClick: () => openNew(disease === "অন্যান্য" ? "" : disease), style: { marginTop: "4px", minHeight: "44px", padding: "6px 14px", borderRadius: "999px", border: "1.5px dashed var(--hs-primary, #0E4B43)", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "13.5px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "＋ এই অসুখে আরেকটি " + noun))),

    mode === "allopathy" && React.createElement("button", { type: "button", onClick: () => setOpenDef((v) => !v), "aria-expanded": openDef, style: { width: "100%", minHeight: "44px", textAlign: "left", border: "none", background: "none", padding: 0, margin: "14px 0 8px", fontSize: "15px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", cursor: "pointer", fontFamily: "inherit" } }, (openDef ? "▾ " : "▸ ") + "সাধারণ তালিকা (সবার জন্য)"),
    mode === "allopathy" && openDef && COMMON_CARE_DEFAULTS.map((d) => React.createElement("div", { key: d.key, style: card },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 800 } }, d.disease),
      React.createElement("div", { style: { fontSize: "13.5px", marginTop: "2px" } }, d.generic + " — " + d.brands.join(", ")),
      React.createElement("div", { style: { fontSize: "12.5px", color: "#5B6B66", marginTop: "2px" } }, d.note),
      React.createElement("button", { type: "button", onClick: () => openNew(d.disease, { ...emptyMed(), generic: d.generic, brand: d.brands[0] }), style: { marginTop: "6px", minHeight: "44px", padding: "6px 14px", borderRadius: "999px", border: "1px solid var(--hs-primary, #0E4B43)", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "13.5px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "＋ আমার তালিকায় নিন"))),
    mode === "allopathy" && openDef && React.createElement("div", { style: { fontSize: "12px", color: "#5B6B66" } }, "সাধারণ তথ্য মাত্র; ডোজ নেই। ফার্মাসিস্ট রিভিউ হয়নি।"),

    form && React.createElement(SheetFrame, { title: form.id ? "সম্পাদনা" : "নতুন যোগ", onClose: () => setForm(null), accent: "medicationStatement",
      footer: PrimaryButton(!form.id && filledMeds(form.meds).length > 1 ? "সংরক্ষণ (" + toBn(filledMeds(form.meds).length) + "টি " + noun + ")" : "সংরক্ষণ", save, busy) },
      err && ErrorBox(err),
      React.createElement("div", { style: { marginTop: "14px" } },
        React.createElement("label", { htmlFor: "cc-disease", style: { fontSize: "14px", fontWeight: 600, color: "#1F2D2A", display: "block", marginBottom: "6px" } }, "অসুখের নাম"),
        React.createElement("input", { id: "cc-disease", type: "text", list: "cc-diseases", value: form.disease, placeholder: "যেমন: সাধারণ জ্বর", onChange: (e) => setDisease(e.target.value), style: inputStyle }),
        React.createElement("datalist", { id: "cc-diseases" }, names.map((n) => React.createElement("option", { key: n, value: n })))),
      form.meds.map((m, i) => {
        const open = form.openKey === m.key;
        const canRemove = !form.id && form.meds.length > 1;
        return React.createElement("div", { key: m.key, style: { marginTop: "12px", background: "#fff", border: "1.5px solid " + (open ? "var(--hs-primary, #6A4BB0)" : "#D9E5DE"), borderRadius: "16px", overflow: "hidden", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" } },
          React.createElement("div", { style: { display: "flex", alignItems: "center" } },
            React.createElement("button", { type: "button", "aria-expanded": open, onClick: () => setForm((s) => ({ ...s, openKey: open ? null : m.key })), style: { flex: 1, minWidth: 0, minHeight: "52px", display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit" } },
              React.createElement("span", { style: { flexShrink: 0, width: "26px", height: "26px", borderRadius: "50%", background: "var(--hs-primary, #6A4BB0)", color: "#fff", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" } }, toBn(i + 1)),
              React.createElement("span", { style: { flex: 1, minWidth: 0, fontSize: "14px", fontWeight: 700, color: "#1F2D2A", overflowWrap: "anywhere" } }, open ? (noun + " " + toBn(i + 1)) : (medSummary(m) || noun + " " + toBn(i + 1) + " (নতুন)")),
              React.createElement("span", { "aria-hidden": "true", style: { color: "var(--hs-primary, #6A4BB0)", fontSize: "13px" } }, open ? "▲" : "▼")),
            canRemove && React.createElement("button", { type: "button", "aria-label": "এই " + noun + " বাদ দিন", title: "বাদ দিন", style: { ...iconBtn, color: "#B3261E" }, onClick: () => removeMed(m.key) }, "✕")),
          open && React.createElement("div", { style: { padding: "0 12px 14px" } },
            MODE_FIELDS[mode].map(([k, label, ph]) => React.createElement(React.Fragment, { key: k }, k === "potency" ? PotencyField(label, m[k], setMed(m.key, k), ph, potencyInfo, () => setPotencyInfo((v) => !v)) : TextField(label, m[k], setMed(m.key, k), ph)))));
      }),
      !form.id && (form.meds.length < MAX_MEDS
        ? React.createElement("button", { type: "button", onClick: addMed, style: { marginTop: "12px", width: "100%", minHeight: "50px", borderRadius: "14px", border: "1.5px dashed var(--hs-primary, #6A4BB0)", background: "#fff", color: "var(--hs-primary, #6A4BB0)", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "＋ আরেকটি " + noun + " যোগ করুন")
        : React.createElement("div", { style: { marginTop: "12px", fontSize: "12.5px", color: "#5B6B66", textAlign: "center" } }, "একবারে সর্বোচ্চ " + toBn(MAX_MEDS) + "টি " + noun + "।"))),
    del && React.createElement(ConfirmDialog, { title: "মুছে ফেলবেন?", message: (del.brand || del.generic || "") + " — " + (del.disease || ""), confirmLabel: "মুছুন", cancelLabel: "বাতিল", busy, onConfirm: doDelete, onCancel: () => setDel(null) })
  );
}
