// অসুখ গাইড সম্পাদনা — শুধু অ্যাপ-ক্রিয়েটরের কাছে দেখায় (UI-গেট; আসল নিয়ন্ত্রণ firestore.rules)।
// প্রতি লাইনে একটা আইটেম। সংরক্ষণ = খসড়া; "সংরক্ষণ + ✔ যাচাইকৃত" = verified। সবাই সাথে সাথে নতুন লেখা পায়।

import { checkGuideText } from "./conditionGuideData.js";
import { saveGuideOverride, resetGuideOverride } from "./conditionGuideStore.js";

const { useState } = React;
const G = "var(--hs-primary, #0E4B43)", MUTED = "#5F716C", LINE = "#D3E0D9";
const FIELDS = [["causes", "সাধারণ কারণ"], ["habits", "যা মানবেন / ছাড়বেন"], ["food", "খাদ্যাভ্যাস"], ["caution", "সতর্কতা"]];
const area = { width: "100%", boxSizing: "border-box", minHeight: "84px", padding: "8px 10px", fontSize: "14px", lineHeight: 1.5, fontFamily: "inherit", border: "1.5px solid " + LINE, borderRadius: "10px", background: "#fff", color: "#1F2D2A" };
const btn = (color, solid) => ({ flex: 1, minHeight: "44px", borderRadius: "12px", border: "1.5px solid " + color, background: solid ? color : "#fff", color: solid ? "#fff" : color, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });

export function ConditionGuideEditor({ guide, hasOverride, onDone, onCancel }) {
  const [f, setF] = useState({ what: guide.what, causes: guide.causes.join("\n"), habits: guide.habits.join("\n"), food: guide.food.join("\n"), caution: guide.caution.join("\n") });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const warns = checkGuideText(f);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const run = async (fn) => {
    setBusy(true); setErr(null);
    try { await fn(); onDone && onDone(); }
    catch (e) { setErr(e.code === "permission-denied" ? "সম্পাদনার অনুমতি নেই (শুধু অ্যাপ-ক্রিয়েটর)।" : (e.message || String(e))); setBusy(false); }
  };

  return React.createElement("div", { style: { marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed " + LINE } },
    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: G } }, "✎ সম্পাদনা — প্রতি লাইনে একটা পয়েন্ট"),
    React.createElement("div", { style: { fontSize: "13px", color: MUTED, margin: "6px 0 2px" } }, "এটা কী"),
    React.createElement("textarea", { value: f.what, onChange: set("what"), style: area, "aria-label": "এটা কী" }),
    FIELDS.map(([k, label]) => React.createElement("div", { key: k },
      React.createElement("div", { style: { fontSize: "13px", color: MUTED, margin: "8px 0 2px" } }, label),
      React.createElement("textarea", { value: f[k], onChange: set(k), style: area, "aria-label": label }))),
    warns.length > 0 && React.createElement("div", { style: { marginTop: "8px", fontSize: "13px", color: "#7A5B00", background: "#FFF4D6", borderRadius: "10px", padding: "8px 10px", lineHeight: 1.5 } }, warns.map((w, i) => React.createElement("div", { key: i }, "⚠ " + w))),
    err && React.createElement("div", { style: { marginTop: "8px", fontSize: "13px", color: "#B3261E" } }, err),
    React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
      React.createElement("button", { type: "button", disabled: busy, onClick: () => run(() => saveGuideOverride(guide.id, f, false)), style: btn(G) }, "সংরক্ষণ (খসড়া)"),
      React.createElement("button", { type: "button", disabled: busy, onClick: () => run(() => saveGuideOverride(guide.id, f, true)), style: btn(G, true) }, "✔ সংরক্ষণ + যাচাইকৃত")),
    React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } },
      React.createElement("button", { type: "button", disabled: busy, onClick: onCancel, style: btn(MUTED) }, "বাতিল"),
      hasOverride && React.createElement("button", { type: "button", disabled: busy, onClick: () => { if (window.confirm("সংশোধন মুছে মূল লেখায় ফিরবেন? সবার জন্য বদলে যাবে।")) run(() => resetGuideOverride(guide.id)); }, style: btn("#B3261E") }, "মূল লেখায় ফেরান")));
}
