// Height/Weight/BMI Quick-Entry Widget (owner-request, ২০২৬-০৯-১২)।
//
// আগে থেকেই doctorExportData.js BMI calculate করত, কিন্তু শুধু generic
// Observation ফর্মে ভুল-বানানহীনভাবে ঠিক "height"/"weight" (বা
// "উচ্চতা"/"ওজন") টাইপ করলেই। এই widget সেই একই data-path (createHealthRecord
// resourceType="observation") reuse করে, কিন্তু dedicated numeric input +
// canonical type-string ("height"/"weight", ইংরেজি) নিশ্চিত করে — কোনো নতুন
// schema/rules লাগে না।

import { PREMIUM_CARD } from "../../shared/cardStyle.js";
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
  const [unit, setUnit] = useState("cm"); // "cm" | "ftin" — একসাথে দুই ঘর নয়
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
    const hasH = unit === "cm" ? !!heightInput.trim() : !!(feetInput.trim() || inchInput.trim());
    const hasW = !!weightInput.trim();
    if (!hasH && !hasW) { setErr("উচ্চতা বা ওজন অন্তত একটা দিন।"); return; }
    // ft/in দিলে cm-এ রূপান্তর; সংরক্ষণ সবসময় ক্যানোনিকাল "height"/cm (owner-request: স্টোরেজ-unit অপরিবর্তিত)
    let heightCm = null, weightKg = null;
    if (hasH) {
      const hr = checkHeightInput(unit === "cm" ? heightInput : cmFromFtIn(feetInput, inchInput));
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
  }, [familyId, targetMemberId, callerMemberId, unit, heightInput, feetInput, inchInput, weightInput, load, onSaved]);

  return React.createElement(
    "div", { style: { marginTop: embedded ? "0" : "14px", marginBottom: embedded ? "10px" : 0, ...PREMIUM_CARD, padding: "12px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)", margin: 0 } }, "উচ্চতা, ওজন ও বিএমআই"),
    latest && (latest.heightCm || latest.weightKg) && React.createElement(
      "div", { style: { fontSize: "14px", color: "#1F2D2A", margin: "8px 0" } },
      "সর্বশেষ: " +
        (latest.heightCm ? latest.heightCm + " সেমি" : "উচ্চতা নেই") + " · " +
        (latest.weightKg ? latest.weightKg + " কেজি" : "ওজন নেই") +
        (latest.bmi ? " · বিএমআই: " + latest.bmi : "")
    ),
    React.createElement(VitalsLinkNote),
    React.createElement(
      "div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" } },
      React.createElement("div", { role: "group", "aria-label": "উচ্চতার একক", style: { display: "flex", gap: "4px", padding: "3px", borderRadius: "999px", background: "#EEF3F0", width: "100%" } },
        React.createElement("button", { type: "button", onClick: () => setUnit("cm"), "aria-pressed": unit === "cm", style: { minHeight: "44px", padding: "0 14px", border: "none", borderRadius: "999px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: "pointer", background: unit === "cm" ? "var(--hs-primary, #0E4B43)" : "transparent", color: unit === "cm" ? "#fff" : "#3E4E49" } }, "সেমি"),
        React.createElement("button", { type: "button", onClick: () => setUnit("ftin"), "aria-pressed": unit === "ftin", style: { minHeight: "44px", padding: "0 14px", border: "none", borderRadius: "999px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: "pointer", background: unit === "ftin" ? "var(--hs-primary, #0E4B43)" : "transparent", color: unit === "ftin" ? "#fff" : "#3E4E49" } }, "ফুট-ইঞ্চি")),
      unit === "cm"
        ? React.createElement("div", null,
          React.createElement("label", { style: { fontSize: "14px", color: "#3E4E49" } }, "উচ্চতা (সেমি)"),
          React.createElement("input", { type: "number", inputMode: "decimal", value: heightInput, onChange: (e) => setHeightInput(e.target.value), style: { display: "block", padding: "8px", minHeight: "44px", boxSizing: "border-box", border: "1px solid #D3E0D9", borderRadius: "10px", width: "110px" } }))
        : React.createElement(React.Fragment, null,
          React.createElement("div", null,
            React.createElement("label", { style: { fontSize: "14px", color: "#3E4E49" } }, "ফুট"),
            React.createElement("input", { type: "number", inputMode: "numeric", value: feetInput, onChange: (e) => setFeetInput(e.target.value), style: { display: "block", padding: "8px", minHeight: "44px", boxSizing: "border-box", border: "1px solid #D3E0D9", borderRadius: "10px", width: "80px" } })),
          React.createElement("div", null,
            React.createElement("label", { style: { fontSize: "14px", color: "#3E4E49" } }, "ইঞ্চি"),
            React.createElement("input", { type: "number", inputMode: "decimal", value: inchInput, onChange: (e) => setInchInput(e.target.value), style: { display: "block", padding: "8px", minHeight: "44px", boxSizing: "border-box", border: "1px solid #D3E0D9", borderRadius: "10px", width: "80px" } }))),
      React.createElement(
        "div", null,
        React.createElement("label", { style: { fontSize: "14px", color: "#3E4E49" } }, "ওজন (কেজি)"),
        React.createElement("input", {
          type: "number", value: weightInput, onChange: (e) => setWeightInput(e.target.value),
          inputMode: "decimal", style: { display: "block", padding: "8px", minHeight: "44px", boxSizing: "border-box", border: "1px solid #D3E0D9", borderRadius: "10px", width: "110px" },
        })
      ),
      PrimaryButton("সংরক্ষণ করুন", submit, busy)
    ),
    err && ErrorBox(err)
  );
}
