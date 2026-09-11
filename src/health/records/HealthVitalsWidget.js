// Height/Weight/BMI Quick-Entry Widget (owner-request, ২০২৬-০৯-১২)।
//
// আগে থেকেই doctorExportData.js BMI calculate করত, কিন্তু শুধু generic
// Observation ফর্মে ভুল-বানানহীনভাবে ঠিক "height"/"weight" (বা
// "উচ্চতা"/"ওজন") টাইপ করলেই। এই widget সেই একই data-path (createHealthRecord
// resourceType="observation") reuse করে, কিন্তু dedicated numeric input +
// canonical type-string ("height"/"weight", ইংরেজি) নিশ্চিত করে — কোনো নতুন
// schema/rules লাগে না।

import { ErrorBox, PrimaryButton } from "../../shared/ui.js";
import { createHealthRecord, listHealthRecords } from "./healthRecordsData.js";

const { useState, useEffect, useCallback } = React;

function isHeightType(t) {
  const s = (t || "").trim().toLowerCase();
  return s === "height" || s === "উচ্চতা";
}
function isWeightType(t) {
  const s = (t || "").trim().toLowerCase();
  return s === "weight" || s === "ওজন";
}

export function HealthVitalsWidget({ familyId, targetMemberId, callerMemberId, refreshTick, onSaved }) {
  const [latest, setLatest] = useState(null); // { heightCm, weightKg, bmi }
  const [heightInput, setHeightInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    listHealthRecords(familyId, targetMemberId)
      .then((records) => {
        // listHealthRecords() createdAt DESC sorted রাখে — প্রথম match-ই সর্বশেষ।
        const heightObs = records.find((r) => r.resourceType === "observation" && isHeightType(r.type));
        const weightObs = records.find((r) => r.resourceType === "observation" && isWeightType(r.type));
        const heightCm = heightObs ? parseFloat(heightObs.value) : null;
        const weightKg = weightObs ? parseFloat(weightObs.value) : null;
        const bmi = heightCm && weightKg && heightCm > 0 ? weightKg / Math.pow(heightCm / 100, 2) : null;
        setLatest({ heightCm, weightKg, bmi: bmi ? Math.round(bmi * 10) / 10 : null });
      })
      .catch((e) => setErr(e.message || String(e)));
  }, [familyId, targetMemberId]);

  useEffect(() => { setErr(null); load(); }, [load, refreshTick]);

  const submit = useCallback(async () => {
    setErr(null);
    const h = parseFloat(heightInput);
    const w = parseFloat(weightInput);
    if (!heightInput.trim() && !weightInput.trim()) { setErr("উচ্চতা বা ওজন অন্তত একটা দিন।"); return; }
    if (heightInput.trim() && (isNaN(h) || h <= 0)) { setErr("উচ্চতা সঠিক সংখ্যা হতে হবে (cm)।"); return; }
    if (weightInput.trim() && (isNaN(w) || w <= 0)) { setErr("ওজন সঠিক সংখ্যা হতে হবে (kg)।"); return; }
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (heightInput.trim()) {
        await createHealthRecord(familyId, targetMemberId, callerMemberId, "observation", {
          type: "height", value: String(h), unit: "cm", date: today,
        });
      }
      if (weightInput.trim()) {
        await createHealthRecord(familyId, targetMemberId, callerMemberId, "observation", {
          type: "weight", value: String(w), unit: "kg", date: today,
        });
      }
      setHeightInput(""); setWeightInput("");
      load();
      onSaved && onSaved();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই সদস্যের ভাইটাল সংরক্ষণের অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, heightInput, weightInput, load, onSaved]);

  return React.createElement(
    "div", { style: { marginTop: "14px", padding: "12px", border: "1px solid #CBD5E1", borderRadius: "8px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "উচ্চতা, ওজন ও BMI"),
    latest && (latest.heightCm || latest.weightKg) && React.createElement(
      "div", { style: { fontSize: "13px", color: "#333", margin: "8px 0" } },
      "সর্বশেষ: " +
        (latest.heightCm ? latest.heightCm + " cm" : "উচ্চতা নেই") + " · " +
        (latest.weightKg ? latest.weightKg + " kg" : "ওজন নেই") +
        (latest.bmi ? " · BMI: " + latest.bmi : "")
    ),
    React.createElement(
      "div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" } },
      React.createElement(
        "div", null,
        React.createElement("label", { style: { fontSize: "12px", color: "#555" } }, "উচ্চতা (cm)"),
        React.createElement("input", {
          type: "number", value: heightInput, onChange: (e) => setHeightInput(e.target.value),
          style: { display: "block", padding: "6px", border: "1px solid #CBD5E1", borderRadius: "6px", width: "100px" },
        })
      ),
      React.createElement(
        "div", null,
        React.createElement("label", { style: { fontSize: "12px", color: "#555" } }, "ওজন (kg)"),
        React.createElement("input", {
          type: "number", value: weightInput, onChange: (e) => setWeightInput(e.target.value),
          style: { display: "block", padding: "6px", border: "1px solid #CBD5E1", borderRadius: "6px", width: "100px" },
        })
      ),
      PrimaryButton("সংরক্ষণ করুন", submit, busy)
    ),
    err && ErrorBox(err)
  );
}
