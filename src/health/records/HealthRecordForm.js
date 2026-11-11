import { t } from "../../shared/i18n.js";
// resourceType অনুযায়ী form-field বদলায়, কিন্তু state/submit-logic একটাই
// component-এ (§11-এর presentational-pattern-এর সাথে সংগতিপূর্ণ ছোট scope —
// আলাদা state/logic module এখনো দরকার নেই, Walking Skeleton পর্যায়ে single
// component-ই যথেষ্ট)। app.js থেকে split (Component-Split — অংশ A), কোনো
// functional পরিবর্তন নেই।

import { TextField, SelectField, DateField, ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { createHealthRecord, updateHealthRecord, listHealthRecords, ensureDoctorInDirectory } from "./healthRecordsData.js";
import { listDoctors } from "../doctor-details/doctorDetailsData.js";
import { DoctorFieldsRow } from "../doctor-details/DoctorFieldsRow.js";
import { buildCandidates, suggestDoctors, pickPatch, isDuplicate } from "../doctor-details/doctorSuggest.js";

import { OBS_PRESETS } from "../quickadd/quickAddTargets.js";
const { useState, useCallback, useEffect, useMemo, useRef } = React;

// ধাপ ৫: টাইল (resourceType, আইকন, নাম) — ওষুধও একই createHealthRecord পথে; রিমাইন্ডার-সময় পরে "ওষুধ" তালিকা থেকে
const ADD_TILES = [["condition", "🩺", "অসুখ"], ["allergy", "🤧", "অ্যালার্জি"], ["medicationStatement", "💊", "ওষুধ/প্রেসক্রিপশন"], ["observation", "📏", "পরিমাপ"]];
const tileStyle = { minHeight: "88px", borderRadius: "16px", border: "1.5px solid #9CC5B4", background: "#F6FAF7", color: "var(--hs-primary, #0E4B43)", fontFamily: "inherit", fontSize: "16px", fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" };
const EMPTY_PHYS = { name: "", specialtyCategory: "", area: "", hospital: "", phone: "", doctorId: "" };

// editingRecord দিলে edit-mode (fields prefill, submit করলে update; resourceType লক)।
// না দিলে (undefined/null) স্বাভাবিক create-mode — আগের behavior অপরিবর্তিত।
export function HealthRecordForm({ familyId, targetMemberId, callerMemberId, onAdded, editingRecord, onCancelEdit, presetObs, onUpload, onMedChoice }) {
  const isEdit = !!editingRecord;
  const preset = !isEdit && presetObs ? OBS_PRESETS[presetObs] : null; // "+ দ্রুত যোগ": প্রেসার/সুগার — শুধু ধরন+একক আগে-থেকে-ভরা
  const [resourceType, setResourceType] = useState(editingRecord ? editingRecord.resourceType : preset ? "observation" : "condition");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("A");
  const [status, setStatus] = useState("active");
  const [chronicManagement, setChronicManagement] = useState(false);
  const [obsType, setObsType] = useState(preset ? preset.type : "");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(preset ? preset.unit : "");
  const [tier, setTier] = useState("otc-self-care");
  const [frequency, setFrequency] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [date, setDate] = useState("");
  // Treating Physician Contact — শুধু condition-এর জন্য (roadmap §12.5)
  const [phys, setPhys] = useState(EMPTY_PHYS);
  const [keepInDirectory, setKeepInDirectory] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [pastRecords, setPastRecords] = useState([]);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [picked, setPicked] = useState(isEdit || !!preset); // ধাপ ৫: আগে ৪টা টাইল ("কী যোগ করবেন?"), বাছার পর ২–৩ ঘরের ফর্ম
  const [medMenu, setMedMenu] = useState(false); // "ওষুধ/প্রেসক্রিপশন" টাইল → দুই বড় অপশন (আপলোড | হাতে লিখুন)
  const [more, setMore] = useState(!!editingRecord); // "আরও যোগ করুন" ভাঁজ — নতুন রেকর্ডে বন্ধ, edit-এ খোলা

  // edit-mode শুরু হলে (বা edit-target বদলালে) existing record-এর ভ্যালু দিয়ে fields prefill
  useEffect(() => {
    if (!editingRecord) {
      // edit বাতিল/সম্পন্ন হয়ে create-mode-এ ফিরলে আগের edit-value থেকে যাওয়া ঠেকাতে reset
      setResourceType(preset ? "observation" : "condition"); resetFields(); setErr(null); setMore(false);
      if (preset) { setObsType(preset.type); setUnit(preset.unit); } // "+ দ্রুত যোগ": ধরন+একক আগে-থেকে-ভরা থাকে
      setPicked(!!preset);
      return;
    }
    const r = editingRecord;
    setPicked(true);
    setMore(true);
    setResourceType(r.resourceType);
    setName(r.name || r.genericName || r.substance || "");
    setCategory(r.category || "A");
    setStatus(r.status || "active");
    setChronicManagement(r.chronicManagement === true);
    setConditionNotes(r.notes || "");
    setObsType(r.type || "");
    setValue(r.value || "");
    setUnit(r.unit || "");
    setTier(r.tier || "otc-self-care");
    setFrequency(r.frequency || "");
    setDurationDays(r.durationDays != null ? String(r.durationDays) : "");
    setReaction(r.reaction || "");
    setSeverity(r.severity || "mild");
    setDate(r.onsetDate || r.date || r.startDate || "");
    const tp = r.treatingPhysician || {};
    setPhys({ name: tp.name || "", specialtyCategory: tp.specialtyCategory || "", area: tp.area || "", hospital: tp.hospital || "", phone: tp.chamberContact || "", doctorId: tp.doctorId || "" });
    setKeepInDirectory(false);
    setErr(null);
  }, [editingRecord]);

  const resetFields = useCallback(() => {
    setName(""); setObsType(""); setValue(""); setUnit(""); setReaction(""); setDate("");
    setPhys(EMPTY_PHYS); setKeepInDirectory(false); setChronicManagement(false);
    setFrequency(""); setDurationDays(""); setConditionNotes("");
  }, []);

  const changeResourceType = useCallback((v) => {
    setResourceType(v); resetFields(); setErr(null); setMore(false);
  }, [resetFields]);
  const pickType = (v) => { changeResourceType(v); setPicked(true); };

  const submit = useCallback(async () => {
    setErr(null);
    if (submitting.current) return; // double-tap রোধ
    if (resourceType === "condition" && !name.trim()) { setErr(t("err.condition")); return; }
    if (resourceType === "observation" && (!obsType.trim() || !value.trim())) { setErr(t("err.observation")); return; }
    if (resourceType === "medicationStatement" && !name.trim()) { setErr(t("err.medicine")); return; }
    if (resourceType === "allergy" && !name.trim()) { setErr(t("err.allergy")); return; }
    submitting.current = true;
    setBusy(true);
    try {
      let doctorId = phys.doctorId;
      // ডিরেক্টরি আগে: ব্যর্থ হলে রেকর্ড সেভ হয় না (আংশিক অবস্থা নেই), ফর্মের লেখা থাকে।
      if (resourceType === "condition" && keepInDirectory && phys.name.trim() && !doctorId) {
        doctorId = await ensureDoctorInDirectory(familyId, callerMemberId, phys);
      }
      const fields = { name, category, status, chronicManagement, conditionNotes, type: obsType, value, unit, tier, frequency, durationDays, reaction, severity, date, physicianName: phys.name, physicianContact: phys.phone, physicianHospital: phys.hospital, physicianArea: phys.area, physicianCategory: phys.specialtyCategory, physicianDoctorId: doctorId };
      if (isEdit) {
        await updateHealthRecord(familyId, editingRecord.id, resourceType, callerMemberId, fields);
        onAdded();
        onCancelEdit && onCancelEdit();
      } else {
        await createHealthRecord(familyId, targetMemberId, callerMemberId, resourceType, fields);
        resetFields(); setMore(false);
        onAdded();
      }
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? t("err.denied")
        : (e.message || String(e)));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, resourceType, name, category, status, chronicManagement, conditionNotes, obsType, value, unit, tier, frequency, durationDays, reaction, severity, date, phys, keepInDirectory, onAdded, resetFields, isEdit, editingRecord, onCancelEdit]);

  // সাজেশন-উৎস: ডিরেক্টরি + এই সদস্যের আগের রেকর্ড (ব্যর্থ হলে সাজেশন ছাড়াই চলে)।
  useEffect(() => {
    if (resourceType !== "condition") return undefined;
    let alive = true;
    listDoctors(familyId).then((d) => alive && setDirectory(d)).catch(() => {});
    listHealthRecords(familyId, targetMemberId).then((r) => alive && setPastRecords(r)).catch(() => {});
    return () => { alive = false; };
  }, [familyId, targetMemberId, resourceType]);
  const candidates = useMemo(() => buildCandidates(directory, pastRecords), [directory, pastRecords]);
  const suggestions = useMemo(() => suggestDoctors(candidates, { query: phys.name, category: phys.specialtyCategory }), [candidates, phys.name, phys.specialtyCategory]);
  const canKeep = !!phys.name.trim() && !phys.doctorId && !directory.some((d) => isDuplicate(d, { name: phys.name, phone: phys.phone }));

  // typeFields = সবসময় দৃশ্যমান (ধরন + নাম/প্রয়োজনীয়); moreFields = "আরও যোগ করুন"-এর ভেতরে
  const typeFields = [];
  const moreFields = [];
  if (resourceType === "condition") {
    const row = (cols) => ({ display: "grid", gridTemplateColumns: cols, gap: "8px" });
    const card = { border: "1px solid #D3E0D9", borderRadius: "12px", background: "#F6FAF7", padding: "0 10px 10px", minWidth: 0 };
    typeFields.push(TextField("অসুখের নাম", name, setName, "যেমন: জ্বর"));
    moreFields.push(DateField(t("f.onset"), date, setDate));
    moreFields.push(React.createElement("div", { style: { ...row("minmax(0, 1fr) minmax(0, 1fr)"), marginTop: "4px" } },
      React.createElement("div", { style: card }, SelectField(t("f.category"), category, setCategory, [["A", "A"], ["B", "B"], ["C", "C"]])),
      React.createElement("div", { style: card }, SelectField(t("f.status"), status, setStatus, [["active", t("st.active")], ["resolved", t("st.resolved")], ["chronic", t("st.chronic")]]))));
    moreFields.push(TextField(t("f.notes"), conditionNotes, setConditionNotes, "যেমন: নিয়ন্ত্রণে আছে, নিয়মিত মেডিসিন চলছে"));
    // roadmap §12.4 Category B bright-line rule (dose-suggestion না) actual data-এর
    // উপর নির্ভর করার জন্য এই checkbox দরকার — আগে RiskBasedTreatmentModes.js-এ
    // hardcode false ছিল (checklist §৭ known-gap), এখন এই field সেই gap পূরণ করে।
    moreFields.push(React.createElement(
      "label", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", margin: "6px 0", cursor: "pointer" } },
      React.createElement("input", {
        type: "checkbox", checked: chronicManagement,
        onChange: (e) => setChronicManagement(e.target.checked),
      }),
      t("f.chronic")
    ));
    moreFields.push(React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", margin: "8px 0 2px" } }, t("f.physician")));
    moreFields.push(React.createElement(DoctorFieldsRow, {
      key: "phys", value: phys, suggestions, allowEmptyCategory: true, showAddress: false,
      onChange: (patch) => setPhys((p) => ({ ...p, ...patch, ...(patch.name !== undefined ? { doctorId: "" } : {}) })),
      onPick: (c) => setPhys((p) => ({ ...p, ...pickPatch(c) })),
    }));
    if (canKeep) {
      moreFields.push(React.createElement("label", { key: "keep", style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", margin: "8px 0", cursor: "pointer", minHeight: "44px" } },
        React.createElement("input", { type: "checkbox", checked: keepInDirectory, onChange: (e) => setKeepInDirectory(e.target.checked) }),
        "ডিরেক্টরিতে রাখুন (পরিবারের সবাই দেখবে)"));
    }
  } else if (resourceType === "observation") {
    typeFields.push(TextField(t("f.obsType"), obsType, setObsType, "যেমন: Blood Sugar"));
    typeFields.push(TextField(t("f.value"), value, setValue, "যেমন: 110"));
    moreFields.push(TextField(t("f.unit"), unit, setUnit, "যেমন: mg/dL"));
    moreFields.push(DateField(t("f.date"), date, setDate));
  } else if (resourceType === "medicationStatement") {
    typeFields.push(TextField(t("f.medName"), name, setName, "যেমন: Paracetamol"));
    moreFields.push(TextField(t("f.freq"), frequency, setFrequency, "যেমন: দিনে ৩ বার, খাবারের পর"));
    moreFields.push(TextField(t("f.days"), durationDays, setDurationDays, "যেমন: 5"));
    moreFields.push(SelectField(t("f.tier"), tier, setTier, [["otc-self-care", t("tier.otc-self-care")], ["requires-consult", t("tier.requires-consult")]]));
    moreFields.push(SelectField(t("f.status"), status, setStatus, [["active", t("st.active")], ["stopped", t("st.stopped")]]));
    moreFields.push(DateField(t("f.startDate"), date, setDate));
  } else if (resourceType === "allergy") {
    typeFields.push(TextField(t("f.substance"), name, setName, "যেমন: Penicillin"));
    moreFields.push(TextField(t("f.reaction"), reaction, setReaction, "যেমন: র‍্যাশ"));
    moreFields.push(SelectField(t("f.severity"), severity, setSeverity, [["mild", t("sev.mild")], ["moderate", t("sev.moderate")], ["severe", t("sev.severe")]]));
  }
  const moreToggle = moreFields.length ? React.createElement("button", {
    key: "more", onClick: () => setMore((m) => !m), "aria-expanded": more,
    style: { width: "100%", minHeight: "44px", margin: "8px 0 4px", borderRadius: "12px", border: "1px dashed #9CC5B4", background: "#F6FAF7", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  }, (more ? "কম দেখান ▲" : "আরও যোগ করুন ▼")) : null;

  const closeBtn = React.createElement("button", { onClick: onCancelEdit, disabled: busy, "aria-label": "বন্ধ করুন",
    style: { width: "44px", height: "44px", flexShrink: 0, borderRadius: "50%", border: "1px solid #C3D2CA", background: "#F1F6F2", color: "var(--hs-primary, #0E4B43)", fontSize: "18px", cursor: "pointer" } }, "✕");
  const wrap = { marginTop: "14px", padding: "12px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" };
  const bigBtn = (primary) => ({ minHeight: "64px", borderRadius: "16px", border: "1.5px solid " + (primary ? "var(--hs-primary, #0E4B43)" : "#9CC5B4"), background: primary ? "#E6F3EC" : "#F6FAF7", color: "var(--hs-primary, #0E4B43)", fontFamily: "inherit", fontSize: "16px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%" });
  if (!isEdit && !picked && medMenu && onMedChoice) {
    return React.createElement("div", { style: wrap },
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "10px" } },
        React.createElement("h4", { style: { fontSize: "18px", color: "var(--hs-primary, #0E4B43)", margin: 0 } }, "💊 ওষুধ/প্রেসক্রিপশন"), closeBtn),
      React.createElement("div", { style: { display: "grid", gap: "10px" } },
        React.createElement("button", { onClick: () => onMedChoice("rx"), style: bigBtn(true) }, "📷 প্রেসক্রিপশন আপলোড (ওষুধ অটো-ফিল)"),
        React.createElement("button", { onClick: () => onMedChoice("manual"), style: bigBtn(false) }, "✍️ হাতে লিখুন"),
        React.createElement("button", { onClick: () => setMedMenu(false), style: { minHeight: "44px", border: "none", background: "none", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } }, "‹ বদলান")));
  }
  if (!isEdit && !picked) {
    return React.createElement("div", { style: wrap },
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "10px" } },
        React.createElement("h4", { style: { fontSize: "18px", color: "var(--hs-primary, #0E4B43)", margin: 0 } }, "কী যোগ করবেন?"), closeBtn),
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
        ADD_TILES.map(([type, icon, label]) => React.createElement("button", { key: type, onClick: () => (type === "medicationStatement" && onMedChoice ? setMedMenu(true) : pickType(type)),
          style: tileStyle },
          React.createElement("span", { "aria-hidden": "true", style: { fontSize: "28px" } }, icon), label)),
        // ল্যাব রিপোর্ট — ল্যাব রিপোর্ট-পিলে গিয়ে আপলোড-প্যানেল খোলে
        onUpload && React.createElement("button", { key: "lab", onClick: onUpload, style: tileStyle },
          React.createElement("span", { "aria-hidden": "true", style: { fontSize: "28px" } }, "🧪"), "ল্যাব রিপোর্ট")));
  }

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)", background: isEdit ? "#FFFBEB" : undefined } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } },
      React.createElement("h4", { style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)", margin: 0 } }, isEdit ? t("f.edit") : t("f.new")),
      closeBtn),
    isEdit
      ? React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", margin: "4px 0" } }, t("f.type") + ": " + t("type." + resourceType) + " " + t("f.typeFixed"))
      : React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", margin: "8px 0 0" } },
          React.createElement("span", { style: { fontSize: "16px", fontWeight: 700, color: "var(--hs-primary, #0E4B43)" } }, (ADD_TILES.find((x) => x[0] === resourceType) || [])[1] + " " + (ADD_TILES.find((x) => x[0] === resourceType) || [])[2]),
          React.createElement("button", { onClick: () => { resetFields(); setErr(null); setMore(false); setPicked(false); }, disabled: busy, style: { minHeight: "44px", padding: "0 12px", border: "none", background: "none", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } }, "‹ বদলান")),
    ...typeFields,
    moreToggle,
    ...(more ? moreFields : []),
    err && ErrorBox(err),
    PrimaryButton(isEdit ? t("btn.update") : t("btn.save"), submit, busy),
    isEdit && SecondaryButton(t("btn.cancel"), onCancelEdit, busy)
  );
}
