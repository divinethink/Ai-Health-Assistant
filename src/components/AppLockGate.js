// PIN সেট থাকলে অ্যাপ খোলা/ফেরার সময় লক-স্ক্রিন। নিচের কনটেন্ট mount থাকে (অসেভড ফর্ম হারায় না) কিন্তু inert (ফোকাস/ট্যাপের বাইরে)।
import { auth } from "../legacy/firebaseConfig.js";
import { clearMemberHealthCache } from "../health/records/memberHealthStore.js";
import { PinPad } from "./PinPad.js";
import { useAppLocked, useAutoLock, clearPasscode, lockoutRemainingMs, unlock, unlockWithBiometric, hasBiometric } from "../shared/appLock.js";
import { bnNum } from "../shared/dates.js";

const h = React.createElement;
const { useState, useEffect, useRef } = React;

function LockScreen() {
  const [error, setError] = useState(null);
  const [wait, setWait] = useState(() => Math.ceil(lockoutRemainingMs() / 1000));
  const [confirmOut, setConfirmOut] = useState(false);
  const bio = hasBiometric();

  // ফিঙ্গারপ্রিন্ট সেট থাকলে লক-স্ক্রিন দেখানোর সাথে একবার নিজে থেকে প্রম্পট; বাতিল হলে PIN-প্যাড থাকে
  useEffect(() => { if (bio) unlockWithBiometric(); }, [bio]);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setInterval(() => setWait(Math.ceil(lockoutRemainingMs() / 1000)), 1000);
    return () => clearInterval(id);
  }, [wait]);

  async function submit(pin) {
    const r = await unlock(pin);
    if (r === "wrong") setError("PIN ভুল হয়েছে");
    if (r === "locked" || r === "wrong") setWait(Math.ceil(lockoutRemainingMs() / 1000));
    if (r === "locked") setError(null);
  }
  const linkBtn = { minHeight: "44px", border: "none", background: "none", fontFamily: "inherit", fontSize: "14px", cursor: "pointer" };
  return h("div", { role: "dialog", "aria-modal": "true", "aria-label": "অ্যাপ লক করা আছে",
    style: { position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", background: "var(--hs-bg, #F1F6F2)", color: "var(--hs-text, #1F2D2A)", fontFamily: "'Hind Siliguri', sans-serif", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" } },
    h("div", { "aria-hidden": "true", style: { fontSize: "40px", marginBottom: "6px" } }, "🔒"),
    h(PinPad, { title: "PIN দিন", subtitle: wait > 0 ? "অনেকবার ভুল হয়েছে। " + bnNum(wait) + " সেকেন্ড পরে আবার চেষ্টা করুন।" : undefined, error, disabled: wait > 0, onComplete: (pin) => submit(pin) }),
    bio && h("button", { type: "button", onClick: () => unlockWithBiometric(), style: { ...linkBtn, marginTop: "16px", padding: "0 18px", borderRadius: "999px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", color: "var(--hs-primary, #0E4B43)", fontWeight: 700 } }, "👆 ফিঙ্গারপ্রিন্ট দিয়ে খুলুন"),
    !confirmOut
      ? h("button", { type: "button", onClick: () => setConfirmOut(true), style: { ...linkBtn, marginTop: "18px", color: "var(--hs-muted, #5F716C)", textDecoration: "underline" } }, "PIN ভুলে গেছেন?")
      : h("div", { style: { marginTop: "18px", maxWidth: "300px", textAlign: "center", fontSize: "14px", color: "var(--hs-muted, #5F716C)" } },
          h("p", { style: { margin: 0 } }, "সাইন-আউট করলে এই ফোন থেকে PIN মুছে যাবে। আপনার ডেটা অ্যাকাউন্টে নিরাপদ থাকবে।"),
          h("div", { style: { display: "flex", justifyContent: "center", gap: "12px", marginTop: "8px" } },
            h("button", { type: "button", onClick: () => setConfirmOut(false), style: { ...linkBtn, padding: "0 12px", color: "var(--hs-text, #1F2D2A)" } }, "বাতিল"),
            h("button", { type: "button", onClick: () => { clearPasscode(); clearMemberHealthCache(); auth.signOut(); }, style: { ...linkBtn, padding: "0 12px", color: "#C0392B", fontWeight: 700 } }, "সাইন-আউট"))));
}

export function AppLockGate({ children }) {
  const locked = useAppLocked();
  useAutoLock();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.toggleAttribute("inert", locked); }, [locked]);
  return h(React.Fragment, null,
    h("div", { ref, "aria-hidden": locked || undefined }, children),
    locked && h(LockScreen));
}
