// "জিমেইল বদলান"-এর দ্বিতীয় ধাপের পূর্ণ-পর্দা রিকভারি-গেট (DailyTask GoogleRelinkGate-এর পোর্ট)।
// দেখা যায় শুধু: সাইন-ইন করা + Google প্রোভাইডার ছাড়ানো + ফ্ল্যাগ আছে। App()-এর বাইরে বসে।
// লগআউট বোতাম ইচ্ছাকৃতভাবে নেই — Google-ছাড়া অবস্থায় লগআউট করলে এই পরিচয়ে আর ঢোকা যায় না।
import { auth } from "../legacy/firebaseConfig.js";
import { getRelinkFlag, hasGoogleProvider, linkGoogleAccountNow } from "../legacy/googleAuth.js";
import { oldEmailFromFlag, RELINK_FLAG } from "../legacy/googleAccountChange.js";
import { t } from "../shared/i18n.js";

const { useState, useEffect } = React;

export function GoogleRelinkGate() {
  const [pending, setPending] = useState(false);
  const [oldEmail, setOldEmail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // resolved=true শুধু onAuthStateChanged থেকে (সেশন-পুনরুদ্ধারের পরের সত্যিকারের অবস্থা)।
    // শুরুতে auth.currentUser সাময়িকভাবে null থাকে — তখন ফ্ল্যাগ মুছলে রিকভারি-গেট হারিয়ে যেত।
    function evaluate(u, resolved) {
      const flag = getRelinkFlag();
      // বাসি ফ্ল্যাগ (সত্যিই সাইন-আউট, বা জিমেইল আবার যুক্ত) পরিষ্কার।
      if (flag && ((u && hasGoogleProvider(u)) || (resolved && !u))) { try { localStorage.removeItem(RELINK_FLAG); } catch (e) { /* noop */ } }
      const on = !!(flag && u && !hasGoogleProvider(u));
      setPending(on);
      setOldEmail(on ? oldEmailFromFlag(flag) : null);
    }
    const onEvent = () => evaluate(auth ? auth.currentUser : null, false);
    onEvent();
    const unsub = auth ? auth.onAuthStateChanged((u) => evaluate(u, true)) : () => {};
    window.addEventListener("ha-relink-changed", onEvent);
    return () => { unsub(); window.removeEventListener("ha-relink-changed", onEvent); };
  }, []);

  if (!pending) return null;

  const onPick = () => {
    if (busy) return;
    setBusy(true); setErr(null);
    linkGoogleAccountNow().then((res) => {
      if (res && res.ok) { window.location.reload(); return; }
      setBusy(false);
      setErr((res && res.message) || null);
    });
  };
  const btn = { width: "100%", maxWidth: "320px", minHeight: "48px", padding: "0 16px", borderRadius: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 };
  const h = React.createElement;
  return h("div", { style: { position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", padding: "24px", textAlign: "center", background: "var(--hs-bg, #F4F7F1)", color: "var(--hs-text, #222)" } },
    h("h2", { style: { fontSize: "18px", fontWeight: 700, maxWidth: "320px", margin: 0 } }, t("relink.title")),
    h("p", { style: { fontSize: "14px", lineHeight: 1.6, maxWidth: "320px", margin: 0 } }, t("relink.lead")),
    oldEmail && h("p", { style: { fontSize: "13px", color: "var(--hs-muted, #667)", maxWidth: "320px", margin: 0, wordBreak: "break-all" } }, t("relink.oldMail") + " " + oldEmail),
    h("p", { style: { fontSize: "13px", lineHeight: 1.5, maxWidth: "320px", margin: 0, padding: "12px", borderRadius: "12px", background: "#FBF3E1", color: "#8A6D2F", fontWeight: 600 } }, t("relink.warn")),
    err && h("p", { style: { fontSize: "14px", color: "#C0392B", fontWeight: 600, maxWidth: "320px", margin: 0 } }, err),
    h("button", { type: "button", disabled: busy, onClick: onPick, style: { ...btn, border: "2px solid var(--hs-primary, #1D7A68)", color: "var(--hs-primary, #1D7A68)", background: "var(--hs-surface, #fff)" } }, busy ? t("relink.busy") : t("relink.pickNew")),
    h("button", { type: "button", disabled: busy, onClick: onPick, style: { ...btn, border: "2px solid transparent", color: "var(--hs-primary, #1D7A68)", background: "transparent" } }, t("relink.restore"))
  );
}
