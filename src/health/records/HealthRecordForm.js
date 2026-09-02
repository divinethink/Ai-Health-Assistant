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
  const [obsType, setObsType] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [tier, setTier] = useState("otc-self-care");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [date, setDate] = useState("");
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
    setObsType(r.type || "");
    setValue(r.value || "");
    setUnit(r.unit || "");
    setTier(r.tier || "otc-self-care");
    setReaction(r.reaction || "");
    setSeverity(r.severity || "mild");
    setDate(r.onsetDate || r.date || r.startDate || "");
    setErr(null);
  }, [editingRecord]);

  const resetFields = useCallback(() => {
    setName(""); setObsType(""); setValue(""); setUnit(""); setReaction(""); setDate("");
  }, []);

  const changeResourceType = useCallback((v) => {
    setResourceType(v); resetFields(); setErr(null);
  }, [resetFields]);

  const submit = useCallback(async () => {
    setErr(null);
    if (resourceType === "condition" && !name.trim()) { setErr("Condition-এর নাম লিখুন।"); return; }
    if (resourceType === "observation" && (!obsType.trim() || !value.trim())) { setErr("Observation-এর ধরন ও মান লিখুন।"); return; }
    if (resourceType === "medicationStatement" && !name.trim()) { setErr("ওষুধের নাম লিখুন।"); return; }
    if (resourceType === "allergy" && !name.trim()) { setErr("Allergy-র substance লিখুন।"); return; }
    setBusy(true);
    try {
      const fields = { name, category, status, type: obsType, value, unit, tier, reaction, severity, date };
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
        ? "এই সদস্যের জন্য Health Record " + (isEdit ? "আপডেট" : "যোগ") + " করার অনুমতি আপনার নেই।"
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, resourceType, name, category, status, obsType, value, unit, tier, reaction, severity, date, onAdded, resetFields, isEdit, editingRecord, onCancelEdit]);

  const typeFields = [];
  if (resourceType === "condition") {
    typeFields.push(TextField("নাম", name, setName, "যেমন: জ্বর"));
    typeFields.push(SelectField("Category", category, setCategory, [["A", "A"], ["B", "B"], ["C", "C"]]));
    typeFields.push(SelectField("Status", status, setStatus, [["active", "active"], ["resolved", "resolved"], ["chronic", "chronic"]]));
    typeFields.push(DateField("Onset তারিখ (ঐচ্ছিক)", date, setDate));
  } else if (resourceType === "observation") {
    typeFields.push(TextField("ধরন", obsType, setObsType, "যেমন: Blood Sugar"));
    typeFields.push(TextField("মান", value, setValue, "যেমন: 110"));
    typeFields.push(TextField("একক", unit, setUnit, "যেমন: mg/dL"));
    typeFields.push(DateField("তারিখ (ঐচ্ছিক)", date, setDate));
  } else if (resourceType === "medicationStatement") {
    typeFields.push(TextField("ওষুধের নাম", name, setName, "যেমন: Paracetamol"));
    typeFields.push(SelectField("Tier", tier, setTier, [["otc-self-care", "otc-self-care"], ["requires-consult", "requires-consult"]]));
    typeFields.push(SelectField("Status", status, setStatus, [["active", "active"], ["stopped", "stopped"]]));
    typeFields.push(DateField("শুরুর তারিখ (ঐচ্ছিক)", date, setDate));
  } else if (resourceType === "allergy") {
    typeFields.push(TextField("Substance", name, setName, "যেমন: Penicillin"));
    typeFields.push(TextField("Reaction", reaction, setReaction, "যেমন: র‍্যাশ"));
    typeFields.push(SelectField("Severity", severity, setSeverity, [["mild", "mild"], ["moderate", "moderate"], ["severe", "severe"]]));
  }

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #CBD5E1", borderRadius: "8px", background: isEdit ? "#FFFBEB" : undefined } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, isEdit ? "Health Record এডিট করুন" : "নতুন Health Record যোগ করুন"),
    isEdit
      ? React.createElement("div", { style: { fontSize: "12px", color: "#888", margin: "4px 0" } }, "ধরন: " + resourceType + " (edit-এ বদলানো যায় না)")
      : SelectField("ধরন", resourceType, changeResourceType, [
          ["condition", "Condition"], ["observation", "Observation"],
          ["medicationStatement", "Medication"], ["allergy", "Allergy"],
        ]),
    ...typeFields,
    err && ErrorBox(err),
    PrimaryButton(isEdit ? "Update করুন" : "Save করুন", submit, busy),
    isEdit && SecondaryButton("বাতিল", onCancelEdit, busy)
  );
}
