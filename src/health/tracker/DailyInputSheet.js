// আজ ট্যাবের ছোট ইনপুট-শিট (ধাপ ৩): ওজন · স্টেপ · ঘুম। শুধু UI — যাচাই dailyInputCalc.js-এ, লেখা বাবা-কম্পোনেন্টের onSave-এ (saveDaily)।
// ব্যায়াম আলাদা: বিদ্যমান ExerciseLogSheet (PlanEditSheets.js)।
// props: kind ("weight"|"steps"|"sleep"), daily, latestWeight, stepsTarget, busy, err, onSave(fields), onClose

import { bnNum } from "../../shared/dates.js";
import { T } from "./trackerTheme.js";
import { Sheet, Msg, BTN, INPUT, primaryBtn } from "./PlanEditSheets.js";
import { stepWeight, shiftTime } from "./stepper.js";
import { checkWeightInput, checkStepsInput, checkSleepInput } from "./dailyInputCalc.js";

const { useState } = React;

const TITLES = { weight: "আজকের ওজন", steps: "আজকের স্টেপ", sleep: "গত রাতের ঘুম" };
const SUBS = {
  weight: "ওজন প্রোফাইলেও সংরক্ষিত হবে",
  steps: "ফোন/ঘড়ির স্টেপ-সংখ্যা লিখুন",
  sleep: "শোয়ার ও ওঠার সময় দিন",
};
const STEP_PRESETS = [2000, 5000, 8000, 10000];

const LAB = { fontSize: "13px", fontWeight: 600, color: "#1F2D2A", display: "block", margin: "10px 0 4px" };
const SM = { ...BTN, border: "1.5px solid " + T.green, background: "#fff", color: T.green, minHeight: "40px", fontSize: "13px" };

export function DailyInputSheet({ kind, daily, latestWeight, stepsTarget, busy, err, onSave, onClose }) {
  const d = daily || {};
  const [weight, setWeight] = useState(d.weightKg ? String(d.weightKg) : "");
  const [steps, setSteps] = useState(d.steps !== undefined ? String(d.steps) : "");
  const [bed, setBed] = useState(d.sleep && d.sleep.bed ? d.sleep.bed : "");
  const [wake, setWake] = useState(d.sleep && d.sleep.wake ? d.sleep.wake : "");
  const [quality, setQuality] = useState(d.sleep && d.sleep.quality ? d.sleep.quality : 0);
  const [localErr, setLocalErr] = useState(null);

  const submit = () => {
    setLocalErr(null);
    let r;
    if (kind === "weight") { r = checkWeightInput(weight); if (!r.error) return onSave({ weightKg: r.value }); }
    else if (kind === "steps") { r = checkStepsInput(steps); if (!r.error) return onSave({ steps: r.value }); }
    else { r = checkSleepInput(bed, wake, quality); if (!r.error) return onSave(r.value); }
    setLocalErr(r.error);
  };

  const timeField = (label, value, setter, fallback) => React.createElement("div", { style: { flex: 1, minWidth: 0 } },
    React.createElement("label", { style: LAB }, label),
    React.createElement("input", { type: "time", value, onChange: (e) => { setLocalErr(null); setter(e.target.value); }, style: INPUT, "aria-label": label }),
    React.createElement("div", { style: { display: "flex", gap: "6px", marginTop: "6px" } },
      React.createElement("button", { onClick: () => { setLocalErr(null); setter(shiftTime(value, -15, fallback)); }, "aria-label": label + " ১৫ মিনিট আগে", style: { ...SM, flex: 1 } }, "−১৫"),
      React.createElement("button", { onClick: () => { setLocalErr(null); setter(shiftTime(value, 15, fallback)); }, "aria-label": label + " ১৫ মিনিট পরে", style: { ...SM, flex: 1 } }, "+১৫")));

  return React.createElement(Sheet, { title: TITLES[kind], subtitle: SUBS[kind], onClose },
    kind === "weight" && React.createElement("div", null,
      React.createElement("label", { style: LAB }, "ওজন (কেজি)"),
      React.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
        React.createElement("button", { onClick: () => { setLocalErr(null); setWeight(stepWeight(weight, -0.1, latestWeight)); }, "aria-label": "ওজন ০.১ কমান", style: { ...BTN, border: "none", background: "#E4ECE7", color: T.green } }, "−"),
        React.createElement("input", { type: "number", inputMode: "decimal", step: "0.1", value: weight, onChange: (e) => { setLocalErr(null); setWeight(e.target.value); }, "aria-label": "ওজন (কেজি)", style: { ...INPUT, textAlign: "center", flex: 1 } }),
        React.createElement("button", { onClick: () => { setLocalErr(null); setWeight(stepWeight(weight, 0.1, latestWeight)); }, "aria-label": "ওজন ০.১ বাড়ান", style: { ...BTN, border: "none", background: "#E4ECE7", color: T.green } }, "+")),
      latestWeight && React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "6px" } }, "সর্বশেষ সংরক্ষিত: " + bnNum(latestWeight) + " কেজি")),

    kind === "steps" && React.createElement("div", null,
      React.createElement("label", { style: LAB }, "স্টেপ"),
      React.createElement("input", { type: "number", inputMode: "numeric", step: "1", value: steps, onChange: (e) => { setLocalErr(null); setSteps(e.target.value); }, "aria-label": "স্টেপ", style: INPUT }),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" } },
        STEP_PRESETS.map((n) => React.createElement("button", { key: n, onClick: () => { setLocalErr(null); setSteps(String(n)); }, style: SM }, bnNum(n)))),
      stepsTarget && React.createElement("div", { style: { fontSize: "12px", color: T.muted, marginTop: "6px" } }, "আজকের লক্ষ্য: " + bnNum(stepsTarget) + " স্টেপ")),

    kind === "sleep" && React.createElement("div", null,
      React.createElement("div", { style: { display: "flex", gap: "8px" } }, timeField("শোয়া", bed, setBed, "22:00"), timeField("ওঠা", wake, setWake, "06:00")),
      React.createElement("label", { style: LAB }, "ঘুমের মান (ঐচ্ছিক)"),
      React.createElement("div", { style: { display: "flex", gap: "8px" } },
        [1, 2, 3, 4, 5].map((n) => React.createElement("button", {
          key: n, onClick: () => setQuality(n === quality ? 0 : n), "aria-pressed": n === quality, "aria-label": "ঘুমের মান " + bnNum(n),
          style: { width: "44px", height: "44px", borderRadius: "999px", cursor: "pointer", fontSize: "14px", fontWeight: 700, fontFamily: "inherit", border: "1.5px solid " + T.green, background: n === quality ? T.green : "#fff", color: n === quality ? "#fff" : T.green },
        }, bnNum(n))))),

    (localErr || err) && Msg(localErr || err, "err"),
    React.createElement("div", { style: { display: "flex", marginTop: "14px" } }, primaryBtn("সংরক্ষণ করুন", submit, busy)));
}
