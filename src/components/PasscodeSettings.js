// মেনু ▸ অ্যাপ লক: PIN সেট/বদল/বন্ধ + ফিঙ্গারপ্রিন্ট চালু/বন্ধ। PIN শুধু এই ফোনে hash হয়ে থাকে; অন্য ফোনে আলাদা সেট করতে হয়।
import { PinPad } from "./PinPad.js";
import { useHasPasscode, tryPasscode, setPasscode, clearPasscode, lockNow, lockoutRemainingMs, biometricSupported, enableBiometric, disableBiometric, hasBiometric } from "../shared/appLock.js";
import { bnNum } from "../shared/dates.js";

const h = React.createElement;
const { useState, useEffect } = React;

const ROW = { width: "100%", display: "flex", alignItems: "center", gap: "12px", minHeight: "56px", padding: "8px 14px", border: "none", background: "none", fontFamily: "inherit", fontSize: "15px", fontWeight: 600, color: "var(--hs-text, #1F2D2A)", cursor: "pointer", textAlign: "left" };

export function PasscodeSettings() {
  const has = useHasPasscode();
  const [step, setStep] = useState({ k: "home" }); // home | verify{then} | new | confirm{first}
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioOn, setBioOn] = useState(() => hasBiometric());
  useEffect(() => { let alive = true; biometricSupported().then((ok) => alive && setBioSupported(ok)); return () => { alive = false; }; }, []);

  const go = (s) => { setError(null); setStep(s); };

  async function toggleBio() {
    if (busy) return;
    setNotice(null);
    if (bioOn) { disableBiometric(); setBioOn(false); return; }
    setBusy(true);
    try {
      const ok = await enableBiometric();
      setBioOn(ok);
      setNotice(ok ? "ফিঙ্গারপ্রিন্ট আনলক চালু হয়েছে। PIN এখনও বিকল্প হিসেবে কাজ করবে।" : "এই ফোনে ফিঙ্গারপ্রিন্ট চালু করা গেল না। PIN দিয়েই চালিয়ে যেতে পারেন।");
    } finally { setBusy(false); }
  }
  async function onVerify(pin, then) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await tryPasscode(pin);
      if (r === "ok") {
        if (then === "off") { clearPasscode(); setBioOn(false); setNotice("অ্যাপ লক বন্ধ করা হয়েছে।"); go({ k: "home" }); }
        else go({ k: "new" });
      } else if (r === "locked") setError("অনেকবার ভুল হয়েছে। " + bnNum(Math.ceil(lockoutRemainingMs() / 1000)) + " সেকেন্ড পরে চেষ্টা করুন।");
      else setError("PIN ভুল হয়েছে");
    } finally { setBusy(false); }
  }
  async function onConfirm(pin, first) {
    if (busy) return;
    if (pin !== first) { setError("দুটো PIN মেলেনি। আবার চেষ্টা করুন।"); setStep({ k: "new" }); return; }
    setBusy(true);
    try {
      await setPasscode(pin);
      setNotice("অ্যাপ লক চালু হয়েছে। অ্যাপ খুললে বা ৩০ সেকেন্ডের বেশি ব্যাকগ্রাউন্ডে থাকলে লক হবে।");
      go({ k: "home" });
    } catch (_e) { setError("এই ফোনে PIN সংরক্ষণ করা গেল না।"); setStep({ k: "new" }); }
    finally { setBusy(false); }
  }

  const cancel = h("button", { type: "button", onClick: () => go({ k: "home" }), style: { ...ROW, minHeight: "44px", color: "var(--hs-primary, #0E4B43)", fontWeight: 700, padding: "0" } }, "← বাতিল");
  if (step.k === "verify") return h("div", null, cancel, h(PinPad, { title: "বর্তমান PIN দিন", error, disabled: busy, onComplete: (p) => onVerify(p, step.then) }));
  if (step.k === "new") return h("div", null, cancel, h(PinPad, { title: "নতুন ৪-অঙ্কের PIN বাছুন", error, disabled: busy, onComplete: (p) => go({ k: "confirm", first: p }) }));
  if (step.k === "confirm") return h("div", null, cancel, h(PinPad, { title: "নিশ্চিত করতে আবার দিন", error, disabled: busy, onComplete: (p) => onConfirm(p, step.first) }));

  const sep = { borderTop: "1px solid var(--hs-border, #D9E5DE)" };
  const sw = (on) => h("span", { "aria-hidden": "true", style: { position: "relative", display: "inline-block", width: "42px", height: "24px", borderRadius: "999px", background: on ? "var(--hs-primary, #0E4B43)" : "#C3CFCA", flexShrink: 0 } },
    h("span", { style: { position: "absolute", top: "2px", left: on ? "20px" : "2px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .15s" } }));
  return h("div", null,
    notice && h("p", { role: "status", style: { margin: "0 0 12px", padding: "10px 12px", borderRadius: "12px", background: "#E4F0E9", color: "var(--hs-primary, #0E4B43)", fontSize: "14px", fontWeight: 600 } }, notice),
    h("p", { style: { fontSize: "14px", color: "var(--hs-muted, #5F716C)", margin: "0 0 12px", lineHeight: 1.5 } }, "৪-অঙ্কের PIN দিয়ে এই ফোনে অ্যাপ লক করুন, যাতে ফোন অন্যের হাতে গেলে স্বাস্থ্য-তথ্য দেখা না যায়। এটা স্ক্রিন-লক, ডেটা-এনক্রিপশন নয়; প্রতিটা ফোনের PIN আলাদা।"),
    h("div", { style: { borderRadius: "16px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", overflow: "hidden", boxShadow: "0 2px 8px rgba(14,75,67,0.07)" } },
      !has
        ? h("button", { type: "button", style: ROW, onClick: () => { setNotice(null); go({ k: "new" }); } }, h("span", { "aria-hidden": "true" }, "🔒"), h("span", { style: { flex: 1 } }, "PIN সেট করুন"))
        : [
          h("button", { key: "now", type: "button", style: ROW, onClick: () => lockNow() }, h("span", { "aria-hidden": "true" }, "🔐"), h("span", { style: { flex: 1 } }, "এখনই লক করুন")),
          h("button", { key: "bio", type: "button", role: "switch", "aria-checked": bioOn, disabled: busy || !bioSupported, style: { ...ROW, ...sep, opacity: !bioSupported ? 0.6 : 1 }, onClick: () => toggleBio() },
            h("span", { "aria-hidden": "true" }, "👆"),
            h("span", { style: { flex: 1 } }, "ফিঙ্গারপ্রিন্ট / ফেস আনলক", !bioSupported && h("span", { style: { display: "block", fontSize: "12px", fontWeight: 400, color: "var(--hs-muted, #5F716C)" } }, "এই ফোন বা ব্রাউজারে সমর্থিত নয়")),
            sw(bioOn)),
          h("button", { key: "chg", type: "button", style: { ...ROW, ...sep }, onClick: () => { setNotice(null); go({ k: "verify", then: "change" }); } }, h("span", { "aria-hidden": "true" }, "🔑"), h("span", { style: { flex: 1 } }, "PIN বদলান")),
          h("button", { key: "off", type: "button", style: { ...ROW, ...sep, color: "#C0392B" }, onClick: () => { setNotice(null); go({ k: "verify", then: "off" }); } }, h("span", { "aria-hidden": "true" }, "🚫"), h("span", { style: { flex: 1 } }, "অ্যাপ লক বন্ধ করুন")),
        ]),
    !has && h("p", { style: { marginTop: "10px", fontSize: "12px", color: "var(--hs-muted, #5F716C)" } }, "PIN সেট করার পর এখানে ফিঙ্গারপ্রিন্ট অপশন আসবে।"));
}
