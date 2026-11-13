// ব্যায়াম-টার্গেট বাছাই শিট (ধাপ B)। শুধু UI; নিয়ম homeWorkout.js-এ (pure)।
// দুই ধাপ: "বাছুন" → (নিজে-এডিট-করা দিন থাকলে ও টার্গেট বদলালে) "নিশ্চিত করুন": পুরনো এডিট রাখা (ডিফল্ট) বা নতুন প্ল্যান দিয়ে বদলানো।
// onSave(areas, replace) — replace=true হলে শুধু ব্যায়ামের "আমার প্ল্যান" মোছে (মিল-প্ল্যান অক্ষত); মোছার আগে এখানে স্পষ্ট নিশ্চিতকরণ।

import { bnNum } from "../../shared/dates.js";
import { Sheet, BTN, Msg, primaryBtn } from "./PlanEditSheets.js";
import { MAX_FOCUS, FOCUS_AREAS, focusOptions, sanitizeFocusAreas } from "./homeWorkout.js";

const { useState } = React;
const GREEN = "var(--hs-primary, #0E4B43)";

export function FocusSheet({ sex, current, customDays, busy, err, onSave, onClose }) {
  const cur = sanitizeFocusAreas(current, sex);
  const [sel, setSel] = useState(cur);
  const [step, setStep] = useState("pick");
  const changed = sel.length !== cur.length || sel.some((x) => !cur.includes(x));
  const full = sel.length >= MAX_FOCUS;
  const toggle = (id) => setSel((v) => (v.includes(id) ? v.filter((x) => x !== id) : v.length >= MAX_FOCUS ? v : [...v, id]));

  const ghost = (label, onClick, extra) => React.createElement("button", { type: "button", onClick, disabled: busy,
    style: { ...BTN, flex: 1, border: "1.5px solid " + GREEN, background: "#fff", color: GREEN, opacity: busy ? 0.5 : 1, ...(extra || {}) } }, label);

  if (step === "confirm") {
    return React.createElement(Sheet, { title: "আপনার এডিট-করা রুটিন", subtitle: bnNum(customDays) + " দিনের রুটিন আপনি নিজে বদলেছেন", onClose },
      React.createElement("div", { style: { fontSize: "14px", color: "#1F2D2A", lineHeight: 1.6 } }, "নতুন টার্গেটের প্ল্যান বানানো হবে। আপনার নিজে-বদলানো দিনগুলো কী করবো?"),
      err && Msg(err, "err"),
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" } },
        primaryBtn("আমার এডিট রাখুন (বাকি দিন নতুন প্ল্যান)", () => onSave(sel, false), busy),
        ghost("নতুন প্ল্যান দিয়ে সব বদলান (আমার এডিট মুছবে)", () => onSave(sel, true), { color: "#7A1F14", border: "1.5px solid #E5A29A" }),
        ghost("← ফিরে যান", () => setStep("pick"))));
  }

  const save = () => {
    if (!changed) { onClose(); return; }
    if (customDays > 0) { setStep("confirm"); return; }
    onSave(sel, false);
  };

  return React.createElement(Sheet, { title: "ব্যায়ামের টার্গেট", subtitle: "সর্বোচ্চ " + bnNum(MAX_FOCUS) + "টি বাছুন — সপ্তাহের ঘরোয়া প্ল্যান সেই অনুযায়ী হবে", onClose },
    React.createElement("div", { role: "group", "aria-label": "টার্গেট", style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
      focusOptions(sex).map((o) => {
        const on = sel.includes(o.id);
        const dis = !on && full;
        return React.createElement("button", { key: o.id, type: "button", onClick: () => toggle(o.id), disabled: dis, "aria-pressed": on,
          style: { ...BTN, fontWeight: 600, padding: "8px 14px", border: "1.5px solid " + (on ? GREEN : "#C3D2CA"), background: on ? GREEN : "#F1F6F2", color: on ? "#fff" : "#1F2D2A", opacity: dis ? 0.45 : 1 } }, (on ? "✓ " : "") + o.label);
      })),
    full && React.createElement("div", { style: { fontSize: "12px", color: "#5F716C", marginTop: "6px" } }, "সর্বোচ্চ " + bnNum(MAX_FOCUS) + "টি বাছা হয়েছে। নতুন বাছতে আগে একটি বাদ দিন।"),
    sel.includes("belly") && Msg("পেটের চর্বি আলাদা করে কমানো যায় না — তাই কার্ডিও + কোর + মিল-প্ল্যান একসাথে ধরা হবে।", "warn"),
    sel.length === 0 && React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "10px" } }, "কিছু না বাছলে সাধারণ প্ল্যান (আপনার ওজন/ফিট লক্ষ্য অনুযায়ী) থাকবে।"),
    React.createElement("div", { style: { fontSize: "12px", color: "#5F716C", marginTop: "10px", lineHeight: 1.5 } }, "ঘরে সরঞ্জাম ছাড়া করা যায় এমন ব্যায়াম; WHO/ACSM নির্দেশিকা-ভিত্তিক সাধারণ গাইড, চিকিৎসা পরামর্শ নয়। ব্যথা বা অসুবিধা হলে থামুন।"),
    err && Msg(err, "err"),
    React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "14px" } },
      ghost("বাতিল", onClose),
      primaryBtn(sel.length === 0 && cur.length > 0 ? "টার্গেট সরান" : "সংরক্ষণ করুন", save, busy)));
}

export const focusLabels = (areas) => areas.map((a) => FOCUS_AREAS[a].label);
