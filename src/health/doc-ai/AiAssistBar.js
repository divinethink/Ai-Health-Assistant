// src/health/doc-ai/AiAssistBar.js
//
// ধাপ ৪-ঘ — তিন প্যানেলে (প্রেসক্রিপশন/ল্যাব/ডাক্তার-কার্ড) একই AI-সহায়ক বার:
//  ১) প্রথমবার: এক-বারের সম্মতি-কার্ড (কী পাঠানো হয় তা সহজ ভাষায়) — localStorage-এ মনে রাখে;
//  ২) সম্মতি থাকলে নিজে চলে ("🤖 AI পড়ছে…" অ্যানিমেটেড বার);
//  ৩) শেষে onSettled({ result, message }) — ঠিক একবার। ব্যর্থ হলে নীরবে (নরম বার্তা সহ) হাতে-যাচাইয়ে ফেরে।
// কিছু সেভ করে না। প্যানেল ফল পেয়ে নিজের ফর্মে "শুধু খালি ঘর/নতুন ভুক্তি" হিসেবে মেশায়।
// export: AiAssistBar (কম্পোনেন্ট), AiBadge (হলুদ ট্যাগ), AI_COLORS।

import { extractDocWithAi } from "../../ai/docExtractClient.js";

const { useState, useEffect, useRef } = React;
const h = React.createElement;

export const AI_COLORS = { bg: "#FFF8E1", border: "#E0A72E", text: "#8A5A00", soft: "#FFFBEA", ring: "#F2D27A" };
const G = "var(--hs-primary, #0E4B43)";
const CONSENT_KEY = "hs_ai_doc_consent_v1";

export function hasAiConsent() { try { return window.localStorage.getItem(CONSENT_KEY) === "1"; } catch (_e) { return false; } }
function saveAiConsent() { try { window.localStorage.setItem(CONSENT_KEY, "1"); } catch (_e) { /* সংরক্ষণ না হলে পরের বারও জিজ্ঞেস করবে */ } }

const REASON_BN = {
  "daily-limit": "আজকের AI-সীমা শেষ — নিচে নিজে যাচাই করুন।",
  "not-configured": "AI এখন চালু নেই — নিচে নিজে যাচাই করুন।",
  "ai-not-configured": "AI এখন চালু নেই — নিচে নিজে যাচাই করুন।",
};
const failMessage = (reason) => REASON_BN[reason] || "AI এখন সাহায্য করতে পারেনি — নিচে নিজে যাচাই করুন।";

const ANIM_CSS = "@keyframes hs-ai-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}.hs-ai-bar{position:relative;overflow:hidden;height:6px;border-radius:999px;background:#F2E3B0}.hs-ai-bar>i{position:absolute;inset:0;width:40%;border-radius:999px;background:linear-gradient(90deg,#E0A72E,#F6C85F);animation:hs-ai-slide 1.3s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.hs-ai-bar>i{animation:none;width:100%}}";

/** হলুদ "AI বসিয়েছে" ট্যাগ — কার্ড/ঘরের পাশে */
export function AiBadge(text) {
  return h("span", { style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "999px", background: AI_COLORS.bg, border: "1px solid " + AI_COLORS.border, color: AI_COLORS.text, fontSize: "12px", fontWeight: 700, lineHeight: 1.4 } }, "🤖 " + (text || "AI বসিয়েছে — যাচাই করুন"));
}

const btn = (primary) => ({ flex: 1, minHeight: "48px", padding: "10px 14px", borderRadius: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: primary ? "none" : "1.5px solid " + AI_COLORS.border, background: primary ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "#fff", color: primary ? "#fff" : AI_COLORS.text, boxShadow: primary ? "0 4px 12px rgba(14,75,67,0.25)" : "none" });
const wrap = { marginTop: "12px", padding: "14px", borderRadius: "16px", background: "linear-gradient(160deg, #FFFBEA 0%, #FFF3CF 100%)", border: "1px solid " + AI_COLORS.ring, boxShadow: "0 2px 10px rgba(138,90,0,0.10)" };

/**
 * @param {{ familyId: string, docType: string, ocrText: string, onSettled: (r: { result: object|null, message: string }) => void, label?: string }} props
 */
export function AiAssistBar({ familyId, docType, ocrText, onSettled, label }) {
  const [phase, setPhase] = useState(hasAiConsent() ? "running" : "ask"); // ask | running | failed
  const [retry, setRetry] = useState(0);
  const [msg, setMsg] = useState("");
  const settledRef = useRef(false);
  const cbRef = useRef(onSettled);
  cbRef.current = onSettled;

  const settle = (payload) => { if (settledRef.current) return; settledRef.current = true; cbRef.current && cbRef.current(payload); };

  useEffect(() => {
    if (phase !== "running") return undefined;
    let alive = true;
    extractDocWithAi(familyId, docType, ocrText, { onRetry: (n, max) => alive && setRetry(n) }).then((res) => {
      if (!alive) return;
      if (res && res.ok) settle({ result: res, message: res.empty ? "AI-ও নতুন কিছু খুঁজে পায়নি — নিচে নিজে যাচাই করুন।" : "" });
      else { setMsg(failMessage(res && res.reason)); setPhase("failed"); settle({ result: null, message: failMessage(res && res.reason) }); }
    });
    return () => { alive = false; };
  }, [phase]);

  if (phase === "ask") {
    return h("div", { role: "group", "aria-label": "AI সহায়তার সম্মতি", style: wrap },
      h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        h("div", { "aria-hidden": "true", style: { width: "40px", height: "40px", flexShrink: 0, borderRadius: "12px", background: "#fff", border: "1px solid " + AI_COLORS.ring, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" } }, "🤖"),
        h("div", { style: { fontSize: "16px", fontWeight: 700, color: AI_COLORS.text, lineHeight: 1.35 } }, label || "লেখাটা ঠিকমতো পড়া যায়নি — AI-র সাহায্য নেবেন?")),
      h("ul", { style: { margin: "10px 0 0", paddingLeft: "20px", fontSize: "14px", color: "#5C4300", lineHeight: 1.6 } },
        h("li", null, "শুধু ", h("b", null, "লেখা"), " যায় — ছবি নয়; নাম, ফোন, ID মুছে পাঠানো হয়।"),
        h("li", null, "কিছু জমা থাকে না, লগ হয় না।"),
        h("li", null, "AI ভুল করতে পারে — ", h("b", null, "আপনি যাচাই করে অনুমোদন না দিলে কিছুই সংরক্ষণ হবে না।"))),
      h("div", { style: { display: "flex", gap: "8px", marginTop: "12px" } },
        h("button", { type: "button", style: btn(false), onClick: () => settle({ result: null, message: "" }) }, "এখন নয়"),
        h("button", { type: "button", style: btn(true), onClick: () => { saveAiConsent(); setPhase("running"); } }, "✓ সম্মতি, AI চালান")),
      h("div", { style: { fontSize: "12px", color: "#7A6320", marginTop: "8px" } }, "এই সম্মতি একবারই নেওয়া হবে।"));
  }

  if (phase === "running") {
    return h("div", { role: "status", "aria-live": "polite", style: wrap },
      h("style", null, ANIM_CSS),
      h("div", { style: { fontSize: "15px", fontWeight: 700, color: AI_COLORS.text, marginBottom: "10px" } }, "🤖 AI লেখাটা পড়ছে…" + (retry ? " (আবার চেষ্টা " + retry + ")" : "")),
      h("div", { className: "hs-ai-bar", "aria-hidden": "true" }, h("i")),
      h("div", { style: { fontSize: "13px", color: "#7A6320", marginTop: "8px" } }, "কয়েক সেকেন্ড লাগতে পারে। এর মধ্যেও আপনি পেছনে যেতে পারেন।"));
  }

  return h("div", { role: "status", style: { ...wrap, background: "#F7F6F1", border: "1px solid #D9D6C8", boxShadow: "none", color: "#4B5C57", fontSize: "14px", lineHeight: 1.5 } }, "ℹ️ " + msg);
}
