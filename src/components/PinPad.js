// ৪-অঙ্কের PIN কীপ্যাড (নিজস্ব — ফোনের কীবোর্ড খোলে না)। ৪টা অঙ্ক হলে onComplete(pin) ডেকে নিজেই ফাঁকা হয়। শুধু presentational।
import { PIN_LENGTH } from "../shared/passcode.js";
import { bnNum } from "../shared/dates.js";

const h = React.createElement;
const { useState, useRef, useEffect, useCallback } = React;

export function PinPad({ title, subtitle, error, disabled, onComplete }) {
  const [digits, setDigits] = useState("");
  const ref = useRef("");
  const cb = useRef(onComplete);
  cb.current = onComplete;
  const set = (v) => { ref.current = v; setDigits(v); };
  const press = useCallback((d) => {
    if (disabled || ref.current.length >= PIN_LENGTH) return;
    const next = ref.current + d;
    set(next);
    if (next.length === PIN_LENGTH) setTimeout(() => { cb.current(next); set(""); }, 120);
  }, [disabled]);
  const back = useCallback(() => { if (ref.current.length < PIN_LENGTH) set(ref.current.slice(0, -1)); }, []);
  useEffect(() => {
    const onKey = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") back(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [press, back]);

  const keyStyle = { height: "64px", borderRadius: "18px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", color: "var(--hs-text, #1F2D2A)", fontSize: "26px", fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit", boxShadow: "0 2px 6px rgba(14,75,67,0.08)" };
  const key = (label, onClick, aria) => h("button", { key: label, type: "button", disabled, onClick, "aria-label": aria, style: keyStyle }, label);
  return h("div", { style: { width: "100%", maxWidth: "300px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" } },
    h("h2", { style: { fontSize: "19px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", margin: 0, textAlign: "center" } }, title),
    subtitle && h("p", { style: { fontSize: "14px", color: "var(--hs-muted, #5F716C)", margin: "6px 0 0", textAlign: "center" } }, subtitle),
    h("div", { role: "status", "aria-label": bnNum(digits.length) + "/" + bnNum(PIN_LENGTH) + " অঙ্ক দেওয়া হয়েছে", style: { display: "flex", gap: "16px", margin: "22px 0 14px" } },
      Array.from({ length: PIN_LENGTH }, (_, i) => h("span", { key: i, style: { width: "16px", height: "16px", borderRadius: "50%", border: "2px solid var(--hs-primary, #0E4B43)", background: i < digits.length ? "var(--hs-primary, #0E4B43)" : "transparent" } }))),
    h("p", { role: "alert", style: { minHeight: "20px", margin: "0 0 10px", fontSize: "14px", color: "#C0392B", textAlign: "center" } }, digits.length === 0 ? (error || "") : ""),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", width: "100%" } },
      ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => key(bnNum(Number(d)), () => press(d), d)),
      h("span", { key: "sp" }),
      key(bnNum(0), () => press("0"), "0"),
      key("⌫", back, "মুছুন")));
}
