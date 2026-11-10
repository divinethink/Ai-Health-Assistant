// Height/Weight/BMI Quick-Entry Widget (owner-request, ২০২৬-০৯-১২)।
//
// আগে থেকেই doctorExportData.js BMI calculate করত, কিন্তু শুধু generic
// Observation ফর্মে ভুল-বানানহীনভাবে ঠিক "height"/"weight" (বা
// "উচ্চতা"/"ওজন") টাইপ করলেই। এই widget সেই একই data-path (createHealthRecord
// resourceType="observation") reuse করে, কিন্তু dedicated numeric input +
// canonical type-string ("height"/"weight", ইংরেজি) নিশ্চিত করে — কোনো নতুন
// schema/rules লাগে না।

import { ErrorBox, PrimaryButton } from "../../shared/ui.js";
import { localISO } from "../../shared/dates.js";
import { listHealthRecords } from "./healthRecordsData.js";
import { saveVitals } from "./vitalsData.js";
import { VitalsLinkNote } from "./VitalsLinkNote.js";
import { checkHeightInput, checkWeightInput, cmFromFtIn } from "../tracker/dailyInputCalc.js";

const { useState, useEffect, useCallback } = React;

function isHeightType(t) {
  const s = (t || "").trim().toLowerCase();
  return s === "height" || s === "উচ্চতা";
}
function isWeightType(t) {
  const s = (t || "").trim().toLowerCase();
  return s === "weight" || s === "ওজন";
}

export function HealthVitalsWidget({ familyId, targetMemberId, callerMemberId, refreshTick, onSaved, embedded }) {
  const [latest, setLatest] = useState(null); // { heightCm, weightKg, bmi }
  const [heightInput, setHeightInput] = useState("");
  const [feetInput, setFeetInput] = useState("");
  const [inchInput, setInchInput] = useState("");
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
    const hasH = !!(heightInput.trim() || feetInput.trim() || inchInput.trim());
    const hasW = !!weightInput.trim();
    if (!hasH && !hasW) { setErr("উচ্চতা বা ওজন অন্তত একটা দিন।"); return; }
    // ft/in দিলে cm-এ রূপান্তর; সংরক্ষণ সবসময় ক্যানোনিকাল "height"/cm (owner-request: স্টোরেজ-unit অপরিবর্তিত)
    let heightCm = null, weightKg = null;
    if (hasH) {
      const hr = checkHeightInput(heightInput.trim() ? heightInput : cmFromFtIn(feetInput, inchInput));
      if (hr.error) { setErr(hr.error); return; }
      heightCm = hr.value;
    }
    if (hasW) {
      const wr = checkWeightInput(weightInput);
      if (wr.error) { setErr(wr.error); return; }
      weightKg = wr.value;
    }
    setBusy(true);
    try {
      // একটাই লেখার পথ (vitalsData.js): একই দিনে আবার সেভ করলে বদলায়, ডুপ্লিকেট হয় না
      await saveVitals(familyId, targetMemberId, callerMemberId, { heightCm, weightKg }, localISO());
      setHeightInput(""); setFeetInput(""); setInchInput(""); setWeightInput("");
      load();
      onSaved && onSaved();
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই সদস্যের ভাইটাল সংরক্ষণের অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, heightInput, feetInput, inchInput, weightInput, load, onSaved]);

  return React.createElement(
    "div", { style: { marginTop: embedded ? "0" : "14px", marginBottom: embedded ? "10px" : 0, padding: "12px", border: "1px solid #D3E0D9", borderRadius: "14px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: 0 } }, "উচ্চতা, ওজন ও BMI"),
    latest && (latest.heightCm || latest.weightKg) && React.createElement(
      "div", { style: { fontSize: "14px", color: "#1F2D2A", margin: "8px 0" } },
      "সর্বশেষ: " +
        (latest.heightCm ? latest.heightCm + " cm" : "উচ্চতা নেই") + " · " +
        (latest.weightKg ? latest.weightKg + " kg" : "ওজন নেই") +
        (latest.bmi ? " · BMI: " + latest.bmi : "")
    ),
    React.createElement(VitalsLinkNote, { title: "এই একটা ইনপুট যেখানে যাবে (ট্র্যাকারেও ওজন দেওয়া যায়)" }),
    React.createElement(
      "div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" } },
      React.createElement(
        "div", null,
        React.createElement("label", { style: { fontSize: "14px", color: "#3E4E49" } }, "উচ্চতা (cm)"),
        React.createElement("input", {
          type: "number", value: heightInput, onChange: (e) => setHeightInput(e.target.value),
          disabled: !!(feetInput.trim() || inchInput.trim()),
          style: { display: "block", padding: "6px", border: "1px solid #D3E0D9", borderRadius: "10px", width: "100px" },
        })
      ),
      React.createElement("div", { style: { fontSize: "14px", color: "#6B7B76", alignSelf: "center" } }, "অথবা"),
      React.createElement(
        "div", null,
        React.createElement("label", { style: { fontSize: "14px", color: "#3E4E49" } }, "ফুট"),
        React.createElement("input", {
          type: "number", value: feetInput, onChange: (e) => setFeetInput(e.target.value),
          disabled: !!heightInput.trim(),
          style: { display: "block", padding: "6px", border: "1px solid #D3E0D9", borderRadius: "10px", width: "70px" },
        })
      ),
      React.createElement(
        "div", null,
        React.createElement("label", { style: { fontSize: "14px", color: "#3E4E49" } }, "ইঞ্চি"),
        React.createElement("input", {
          type: "number", value: inchInput, onChange: (e) => setInchInput(e.target.value),
          disabled: !!heightInput.trim(),
          style: { display: "block", padding: "6px", border: "1px solid #D3E0D9", borderRadius: "10px", width: "70px" },
        })
      ),
      React.createElement(
        "div", null,
        React.createElement("label", { style: { fontSize: "14px", color: "#3E4E49" } }, "ওজন (kg)"),
        React.createElement("input", {
          type: "number", value: weightInput, onChange: (e) => setWeightInput(e.target.value),
          style: { display: "block", padding: "6px", border: "1px solid #D3E0D9", borderRadius: "10px", width: "100px" },
        })
      ),
      PrimaryButton("সংরক্ষণ করুন", submit, busy)
    ),
    err && ErrorBox(err)
  );
}
