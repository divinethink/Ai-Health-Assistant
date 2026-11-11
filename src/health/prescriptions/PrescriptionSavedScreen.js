// src/health/prescriptions/PrescriptionSavedScreen.js
//
// ধাপ ৬ (৩/৩) — সেভের পর নিশ্চয়তা-স্ক্রিন: কয়টা ওষুধ যোগ হলো + প্রতি ওষুধের রিমাইন্ডার টগল।
// টগল শুধু reminderTimes বদলায় (বিদ্যমান data-function); ডোজ অ্যাপ বানায় না।

import { PrimaryButton } from "../../shared/ui.js";
import { setReminderEnabled } from "./prescriptionData.js";

const { useState } = React;
const h = React.createElement;
const G = "var(--hs-primary, #0E4B43)", MUTED = "#5F716C", RED = "#B3261E";
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);
const TIME_BN = (t) => bn(t.replace(/^0/, ""));

function Toggle({ on, busy, label, onClick }) {
  return h("button", { type: "button", role: "switch", "aria-checked": on, "aria-label": label, disabled: busy, onClick,
    style: { width: "52px", height: "44px", border: "none", background: "none", padding: 0, cursor: busy ? "default" : "pointer", flexShrink: 0 } },
    h("span", { style: { display: "block", width: "48px", height: "28px", borderRadius: "14px", background: on ? G : "#C3C9C5", position: "relative" } },
      h("span", { style: { position: "absolute", top: "3px", left: on ? "23px" : "3px", width: "22px", height: "22px", borderRadius: "50%", background: "#fff", transition: "left .15s" } })));
}

export function PrescriptionSavedScreen({ familyId, callerMemberId, res, onClose, closeLabel }) {
  const rems = (res.details || []).filter((d) => d.times.length > 0);
  const [on, setOn] = useState(() => Object.fromEntries(rems.map((d) => [d.id, true])));
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState(null);

  const flip = async (d) => {
    if (busyId) return;
    const next = !on[d.id];
    setErr(null); setBusyId(d.id);
    try { await setReminderEnabled(familyId, d.id, callerMemberId, d.times, next); setOn((o) => ({ ...o, [d.id]: next })); }
    catch (e) { setErr(e.code === "permission-denied" ? "রিমাইন্ডার বদলানোর অনুমতি নেই।" : (e.message || String(e))); }
    finally { setBusyId(null); }
  };

  return h("div", { role: "status", style: { textAlign: "center", marginTop: "8px" } },
    h("div", { style: { width: "64px", height: "64px", borderRadius: "50%", background: "#E4F0E9", color: "#1E8A57", fontSize: "34px", lineHeight: "64px", margin: "0 auto" } }, "✓"),
    h("h4", { style: { margin: "10px 0 2px", fontSize: "18px", color: G } }, bn(res.saved.length) + "টি ওষুধ যোগ হয়েছে"),
    h("div", { style: { fontSize: "14px", color: MUTED } }, "প্রেসক্রিপশনে যা লেখা ছিল, শুধু সেটাই"),
    res.skipped.length > 0 && h("div", { style: { fontSize: "13px", color: MUTED, marginTop: "6px" } }, "ℹ️ আগে থেকেই ছিল, বাদ: " + res.skipped.join(", ")),
    res.failed.length > 0 && h("div", { style: { fontSize: "13px", color: RED, marginTop: "6px" } }, "❌ যোগ হয়নি: " + res.failed.map((f) => f.name + " (" + f.message + ")").join(", ")),
    rems.length > 0 && h("div", { style: { textAlign: "left", margin: "14px 0 0", padding: "12px", borderRadius: "16px", background: "#fff", border: "1px solid #D3E0D9" } },
      h("div", { style: { fontSize: "15px", fontWeight: 700, color: G, marginBottom: "4px" } }, "রিমাইন্ডার চালু করবেন?"),
      rems.map((d) => h("div", { key: d.id, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", minHeight: "44px" } },
        h("div", { style: { fontSize: "14px", overflowWrap: "anywhere" } }, h("b", null, d.name), " — " + d.times.map(TIME_BN).join(", ")),
        h(Toggle, { on: on[d.id], busy: busyId === d.id, label: d.name + " রিমাইন্ডার", onClick: () => flip(d) }))),
      err && h("div", { style: { fontSize: "13px", color: RED, marginTop: "4px" } }, err)),
    h("div", { style: { textAlign: "left", margin: "12px 0 0", padding: "10px 12px", borderRadius: "12px", background: "#FFF6E5", color: "#8A5A00", fontSize: "14px", lineHeight: 1.5 } },
      h("b", null, "মনে রাখুন: "), "অ্যাপ ডোজ ঠিক করে না। ডাক্তারের নির্দেশই চূড়ান্ত।"),
    onClose && PrimaryButton(closeLabel || "বন্ধ করুন", onClose, false));
}
