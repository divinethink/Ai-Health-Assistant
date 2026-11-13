// "সাধারণ চিকিৎসা" পিল: সবার জন্য স্থির শুরুর তালিকা + সদস্যের নিজের তালিকা (যোগ/সম্পাদনা/মোছা)।
// ডোজ শুধু সদস্যের নিজের লেখা; অ্যাপ বানায় না, AI/dose-engine-এর সাথে যোগ নেই।
import { TextField, PrimaryButton, SheetFrame, ConfirmDialog, ErrorBox, Skeleton } from "../../shared/ui.js";
import { MED_ALIAS } from "../../shared/searchAliases.js";
import { COMMON_CARE_DEFAULTS } from "./commonCareList.js";
import { emptyCareForm, validateCareForm, addCare, editCare, removeCare, groupByDisease, useMemberHealth } from "./commonCareData.js";

const { useState } = React;
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

export function CommonCareSection({ familyId, callerMemberId, selectedMemberId }) {
  const { records, loading, error } = useMemberHealth(familyId, selectedMemberId);
  const [form, setForm] = useState(null); // null | { id|null, f }
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [openDef, setOpenDef] = useState(false);

  const set = (k) => (v) => setForm((s) => {
    const f = { ...s.f, [k]: v };
    if (k === "brand" && !s.f.generic.trim()) { const g = genericFromBrand(v); if (g) f.generic = g; }
    return { ...s, f };
  });
  const save = async () => {
    const msg = validateCareForm(form.f);
    if (msg) { setErr(msg); return; }
    setBusy(true); setErr(null);
    try {
      if (form.id) await editCare(familyId, form.id, callerMemberId, form.f);
      else await addCare(familyId, selectedMemberId, callerMemberId, form.f);
      setForm(null);
    } catch (e) { setErr("সংরক্ষণ করা যায়নি — অনুমতি/নেটওয়ার্ক দেখুন।"); } finally { setBusy(false); }
  };
  const doDelete = async () => {
    setBusy(true);
    try { await removeCare(familyId, del.id, selectedMemberId, callerMemberId); setDel(null); }
    catch (e) { setErr("মোছা যায়নি।"); setDel(null); } finally { setBusy(false); }
  };

  const groups = records ? groupByDisease(records) : [];
  const line = (r) => [r.dose, r.frequency].filter(Boolean).join(" · ");

  return React.createElement(React.Fragment, null,
    React.createElement("div", { style: { fontSize: "12.5px", color: "var(--hs-muted, #5B6B66)", lineHeight: 1.5 } }, "ডাক্তারের পরামর্শ অনুযায়ী নিজের রেকর্ড। ডোজ ও মাত্রা আপনি নিজে লিখবেন — অ্যাপ ঠিক করে না।"),
    err && !form && ErrorBox(err),
    error && ErrorBox("তালিকা পড়া যায়নি।"),
    React.createElement("button", { type: "button", onClick: () => { setErr(null); setForm({ id: null, f: emptyCareForm() }); }, style: { marginTop: "10px", width: "100%", minHeight: "48px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))", color: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "＋ নতুন যোগ করুন"),

    h("আমার তালিকা"),
    loading && !records ? Skeleton(2, 64)
      : groups.length === 0 ? React.createElement("div", { style: { ...card, color: "#5B6B66", fontSize: "14px", textAlign: "center" } }, "এখনো কিছু নেই — নিচের সাধারণ তালিকা থেকে নিন, বা নতুন যোগ করুন।")
      : groups.map(([disease, rows]) => React.createElement("div", { key: disease, style: card },
          React.createElement("div", { style: { fontSize: "14px", fontWeight: 800, color: "#1F2D2A", marginBottom: "4px" } }, disease),
          rows.map((r) => React.createElement("div", { key: r.id, style: { display: "flex", alignItems: "center", gap: "4px", borderTop: "1px solid #EEF3F0", padding: "6px 0" } },
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, overflowWrap: "anywhere" } }, [r.brand, r.generic && (r.brand ? "(" + r.generic + ")" : r.generic)].filter(Boolean).join(" ")),
              line(r) && React.createElement("div", { style: { fontSize: "13px", color: "#2B3A36" } }, line(r)),
              r.note && React.createElement("div", { style: { fontSize: "12.5px", color: "#5B6B66" } }, r.note)),
            React.createElement("button", { type: "button", "aria-label": "সম্পাদনা", title: "সম্পাদনা", style: iconBtn, onClick: () => { setErr(null); setForm({ id: r.id, f: { disease: r.disease || "", brand: r.brand || "", generic: r.generic || "", dose: r.dose || "", frequency: r.frequency || "", note: r.note || "" } }); } }, "✎"),
            React.createElement("button", { type: "button", "aria-label": "মুছুন", title: "মুছুন", style: iconBtn, onClick: () => setDel(r) }, "🗑"))))),

    React.createElement("button", { type: "button", onClick: () => setOpenDef((v) => !v), "aria-expanded": openDef, style: { width: "100%", minHeight: "44px", textAlign: "left", border: "none", background: "none", padding: 0, margin: "14px 0 8px", fontSize: "15px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", cursor: "pointer", fontFamily: "inherit" } }, (openDef ? "▾ " : "▸ ") + "সাধারণ তালিকা (সবার জন্য)"),
    openDef && COMMON_CARE_DEFAULTS.map((d) => React.createElement("div", { key: d.key, style: card },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 800 } }, d.disease),
      React.createElement("div", { style: { fontSize: "13.5px", marginTop: "2px" } }, d.generic + " — " + d.brands.join(", ")),
      React.createElement("div", { style: { fontSize: "12.5px", color: "#5B6B66", marginTop: "2px" } }, d.note),
      React.createElement("button", { type: "button", onClick: () => { setErr(null); setForm({ id: null, f: { ...emptyCareForm(), disease: d.disease, generic: d.generic, brand: d.brands[0] } }); }, style: { marginTop: "6px", minHeight: "44px", padding: "6px 14px", borderRadius: "999px", border: "1px solid var(--hs-primary, #0E4B43)", background: "#fff", color: "var(--hs-primary, #0E4B43)", fontSize: "13.5px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "＋ আমার তালিকায় নিন"))),
    openDef && React.createElement("div", { style: { fontSize: "12px", color: "#5B6B66" } }, "সাধারণ তথ্য মাত্র; ডোজ নেই। ফার্মাসিস্ট রিভিউ হয়নি।"),

    form && React.createElement(SheetFrame, { title: form.id ? "সম্পাদনা" : "নতুন যোগ", onClose: () => setForm(null), accent: "medicationStatement",
      footer: PrimaryButton("সংরক্ষণ", save, busy) },
      err && ErrorBox(err),
      TextField("অসুখের নাম", form.f.disease, set("disease"), "যেমন: সাধারণ জ্বর"),
      TextField("ওষুধের ব্র্যান্ড নাম", form.f.brand, set("brand"), "যেমন: Napa"),
      TextField("জেনেরিক নাম", form.f.generic, set("generic"), "যেমন: Paracetamol"),
      TextField("ডোজ (ডাক্তারের লেখা)", form.f.dose, set("dose"), "যেমন: 500 mg"),
      TextField("সেবনের মাত্রা", form.f.frequency, set("frequency"), "যেমন: দিনে ৪ বার"),
      TextField("নোট (ঐচ্ছিক)", form.f.note, set("note"), "যেমন: শিশুর জন্য, ১০ কেজি")),
    del && React.createElement(ConfirmDialog, { title: "মুছে ফেলবেন?", message: (del.brand || del.generic || "") + " — " + (del.disease || ""), confirmLabel: "মুছুন", cancelLabel: "বাতিল", busy, onConfirm: doDelete, onCancel: () => setDel(null) })
  );
}
