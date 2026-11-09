import { t } from "../../shared/i18n.js";
// resourceType অনুযায়ী form-field বদলায়, কিন্তু state/submit-logic একটাই
// component-এ (§11-এর presentational-pattern-এর সাথে সংগতিপূর্ণ ছোট scope —
// আলাদা state/logic module এখনো দরকার নেই, Walking Skeleton পর্যায়ে single
// component-ই যথেষ্ট)। app.js থেকে split (Component-Split — অংশ A), কোনো
// functional পরিবর্তন নেই।

import { TextField, SelectField, DateField, ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { createHealthRecord, updateHealthRecord } from "./healthRecordsData.js";

const { useState, useCallback, useEffect } = React;

// editingRecord দিলে edit-mode (fields prefill, submit করলে update; resourceType লক)।
// না দিলে (undefined/null) স্বাভাবিক create-mode — আগের behavior অপরিবর্তিত।
export function HealthRecordForm({ familyId, targetMemberId, callerMemberId, onAdded, editingRecord, onCancelEdit }) {
  const isEdit = !!editingRecord;
  const [resourceType, setResourceType] = useState(editingRecord ? editingRecord.resourceType : "condition");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("A");
  const [status, setStatus] = useState("active");
  const [chronicManagement, setChronicManagement] = useState(false);
  const [obsType, setObsType] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [tier, setTier] = useState("otc-self-care");
  const [frequency, setFrequency] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [date, setDate] = useState("");
  // Treating Physician Contact — শুধু condition-এর জন্য (roadmap §12.5)
  const [physicianName, setPhysicianName] = useState("");
  const [physicianContact, setPhysicianContact] = useState("");
  const [physicianHospital, setPhysicianHospital] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // edit-mode শুরু হলে (বা edit-target বদলালে) existing record-এর ভ্যালু দিয়ে fields prefill
  useEffect(() => {
    if (!editingRecord) {
      // edit বাতিল/সম্পন্ন হয়ে create-mode-এ ফিরলে আগের edit-value থেকে যাওয়া ঠেকাতে reset
      setResourceType("condition"); resetFields(); setErr(null);
      return;
    }
    const r = editingRecord;
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
    setPhysicianName(tp.name || "");
    setPhysicianContact(tp.chamberContact || "");
    setPhysicianHospital(tp.hospital || "");
    setErr(null);
  }, [editingRecord]);

  const resetFields = useCallback(() => {
    setName(""); setObsType(""); setValue(""); setUnit(""); setReaction(""); setDate("");
    setPhysicianName(""); setPhysicianContact(""); setPhysicianHospital(""); setChronicManagement(false);
    setFrequency(""); setDurationDays(""); setConditionNotes("");
  }, []);

  const changeResourceType = useCallback((v) => {
    setResourceType(v); resetFields(); setErr(null);
  }, [resetFields]);

  const submit = useCallback(async () => {
    setErr(null);
    if (resourceType === "condition" && !name.trim()) { setErr(t("err.condition")); return; }
    if (resourceType === "observation" && (!obsType.trim() || !value.trim())) { setErr(t("err.observation")); return; }
    if (resourceType === "medicationStatement" && !name.trim()) { setErr(t("err.medicine")); return; }
    if (resourceType === "allergy" && !name.trim()) { setErr(t("err.allergy")); return; }
    setBusy(true);
    try {
      const fields = { name, category, status, chronicManagement, conditionNotes, type: obsType, value, unit, tier, frequency, durationDays, reaction, severity, date, physicianName, physicianContact, physicianHospital };
      if (isEdit) {
        await updateHealthRecord(familyId, editingRecord.id, resourceType, callerMemberId, fields);
        onAdded();
        onCancelEdit && onCancelEdit();
      } else {
        await createHealthRecord(familyId, targetMemberId, callerMemberId, resourceType, fields);
        resetFields();
        onAdded();
      }
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? t("err.denied")
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, resourceType, name, category, status, chronicManagement, conditionNotes, obsType, value, unit, tier, frequency, durationDays, reaction, severity, date, physicianName, physicianContact, physicianHospital, onAdded, resetFields, isEdit, editingRecord, onCancelEdit]);

  const typeFields = [];
  if (resourceType === "condition") {
    typeFields.push(TextField(t("f.name"), name, setName, "যেমন: জ্বর"));
    typeFields.push(SelectField(t("f.category"), category, setCategory, [["A", "A"], ["B", "B"], ["C", "C"]]));
    typeFields.push(SelectField(t("f.status"), status, setStatus, [["active", t("st.active")], ["resolved", t("st.resolved")], ["chronic", t("st.chronic")]]));
    typeFields.push(DateField(t("f.onset"), date, setDate));
    typeFields.push(TextField(t("f.notes"), conditionNotes, setConditionNotes, "যেমন: নিয়ন্ত্রণে আছে, নিয়মিত মেডিসিন চলছে"));
    // roadmap §12.4 Category B bright-line rule (dose-suggestion না) actual data-এর
    // উপর নির্ভর করার জন্য এই checkbox দরকার — আগে RiskBasedTreatmentModes.js-এ
    // hardcode false ছিল (checklist §৭ known-gap), এখন এই field সেই gap পূরণ করে।
    typeFields.push(React.createElement(
      "label", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", margin: "6px 0", cursor: "pointer" } },
      React.createElement("input", {
        type: "checkbox", checked: chronicManagement,
        onChange: (e) => setChronicManagement(e.target.checked),
      }),
      t("f.chronic")
    ));
    typeFields.push(React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", margin: "8px 0 2px" } }, t("f.physician")));
    typeFields.push(TextField("ডাক্তারের নাম", physicianName, setPhysicianName, "যেমন: ডা. রহিম"));
    typeFields.push(TextField("চেম্বার যোগাযোগ", physicianContact, setPhysicianContact, "যেমন: ফোন/চেম্বার নম্বর"));
    typeFields.push(TextField("হাসপাতাল/চেম্বার", physicianHospital, setPhysicianHospital, "যেমন: হাসপাতালের নাম"));
  } else if (resourceType === "observation") {
    typeFields.push(TextField(t("f.obsType"), obsType, setObsType, "যেমন: Blood Sugar"));
    typeFields.push(TextField(t("f.value"), value, setValue, "যেমন: 110"));
    typeFields.push(TextField(t("f.unit"), unit, setUnit, "যেমন: mg/dL"));
    typeFields.push(DateField(t("f.date"), date, setDate));
  } else if (resourceType === "medicationStatement") {
    typeFields.push(TextField(t("f.medName"), name, setName, "যেমন: Paracetamol"));
    typeFields.push(TextField(t("f.freq"), frequency, setFrequency, "যেমন: দিনে ৩ বার, খাবারের পর"));
    typeFields.push(TextField(t("f.days"), durationDays, setDurationDays, "যেমন: 5"));
    typeFields.push(SelectField(t("f.tier"), tier, setTier, [["otc-self-care", t("tier.otc-self-care")], ["requires-consult", t("tier.requires-consult")]]));
    typeFields.push(SelectField(t("f.status"), status, setStatus, [["active", t("st.active")], ["stopped", t("st.stopped")]]));
    typeFields.push(DateField(t("f.startDate"), date, setDate));
  } else if (resourceType === "allergy") {
    typeFields.push(TextField(t("f.substance"), name, setName, "যেমন: Penicillin"));
    typeFields.push(TextField(t("f.reaction"), reaction, setReaction, "যেমন: র‍্যাশ"));
    typeFields.push(SelectField(t("f.severity"), severity, setSeverity, [["mild", t("sev.mild")], ["moderate", t("sev.moderate")], ["severe", t("sev.severe")]]));
  }

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)", background: isEdit ? "#FFFBEB" : undefined } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, isEdit ? t("f.edit") : t("f.new")),
    isEdit
      ? React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", margin: "4px 0" } }, t("f.type") + ": " + t("type." + resourceType) + " " + t("f.typeFixed"))
      : SelectField(t("f.type"), resourceType, changeResourceType, [
          ["condition", t("type.condition")], ["observation", t("type.observation")],
          ["allergy", t("type.allergy")], // ঔষধ যোগ হয় "ঔষধ ও রিমাইন্ডার" সাব-পিল থেকে (ধাপ ৩)
        ]),
    ...typeFields,
    err && ErrorBox(err),
    PrimaryButton(isEdit ? t("btn.update") : t("btn.save"), submit, busy),
    isEdit && SecondaryButton(t("btn.cancel"), onCancelEdit, busy)
  );
}
