// AI মডেল সেটিং (শুধু App Creator): provider + model বেছে সেভ করলে পরের AI-চ্যাট থেকেই কার্যকর।
// API key এখানে নয় — key বদলাতে GitHub → Secrets (WORKER_*_API_KEY) বদলে deploy-worker চালান।
import { AI_PROVIDERS, DEFAULT_AI_CONFIG, isValidModelName, loadAiConfig, saveAiConfig } from "../legacy/aiConfig.js";
import { getLastAiInfo } from "../ai/aiClient.js";

const { useState, useEffect } = React;

const box = { borderRadius: "16px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", padding: "14px", marginBottom: "12px" };
const label = { display: "block", fontSize: "13px", fontWeight: 700, color: "var(--hs-muted, #5F716C)", margin: "0 0 6px" };
const field = { width: "100%", boxSizing: "border-box", minHeight: "46px", borderRadius: "12px", border: "1px solid var(--hs-input-border, #C3D2CA)", background: "var(--hs-bg, #F1F6F2)", color: "var(--hs-text, #1F2D2A)", padding: "0 12px", fontSize: "15px", fontFamily: "inherit" };
const btn = (primary, disabled) => ({ width: "100%", minHeight: "46px", borderRadius: "12px", border: primary ? "none" : "1px solid var(--hs-border, #D9E5DE)", background: primary ? "var(--hs-primary, #0E4B43)" : "var(--hs-chip-bg, #E4F0E9)", color: primary ? "#fff" : "var(--hs-primary, #0E4B43)", fontSize: "15px", fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "inherit", marginTop: "8px" });

export function AiModelSettings({ uid, isCreator }) {
  const [saved, setSaved] = useState(undefined); // undefined = লোড হচ্ছে, null = ডিফল্ট
  const [provider, setProvider] = useState(DEFAULT_AI_CONFIG.provider);
  const [model, setModel] = useState(DEFAULT_AI_CONFIG.model);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);
  const [info, setInfo] = useState(getLastAiInfo());

  useEffect(() => {
    let alive = true;
    loadAiConfig().then((c) => {
      if (!alive) return;
      setSaved(c);
      if (c) { setProvider(c.provider); setModel(c.model); }
    });
    return () => { alive = false; };
  }, []);

  if (!isCreator) return null; // UI-গোপন সুবিধার জন্য; আসল নিয়ন্ত্রণ rules-এ

  const cur = AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[0];
  const valid = isValidModelName(model.trim());
  const unchanged = saved ? saved.provider === provider && saved.model === model.trim() : false;

  async function save(p, m) {
    if (busy) return;
    setBusy(true); setMsg(""); setErr(false);
    try {
      await saveAiConfig(p, m);
      setSaved({ provider: p, model: m.trim() });
      setMsg("সেভ হয়েছে। এখন AI চ্যাটে একটি প্রশ্ন করে ফিরে এসে নিচে দেখুন কোন মডেল উত্তর দিল।");
    } catch (_e) { setErr(true); setMsg("সেভ হয়নি। মডেলের নাম ঠিক আছে কিনা দেখুন, তারপর আবার চেষ্টা করুন।"); } finally { setBusy(false); }
  }

  return React.createElement("div", null,
    React.createElement("p", { style: { fontSize: "13px", color: "var(--hs-muted, #5F716C)", margin: "0 0 12px", lineHeight: 1.6 } },
      "এখানে provider ও model বদলালে পরের AI-চ্যাট থেকেই কার্যকর হয়, deploy লাগে না। সব সদস্যের জন্য একই মডেল চলবে।"),
    React.createElement("div", { style: box },
      React.createElement("p", { style: { margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "var(--hs-muted, #5F716C)" } }, "এখন চালু"),
      React.createElement("p", { style: { margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--hs-primary, #0E4B43)", wordBreak: "break-all" } },
        saved === undefined ? "লোড হচ্ছে…" : saved ? (AI_PROVIDERS.find((p) => p.id === saved.provider).label + " · " + saved.model) : "ডিফল্ট (Groq · qwen/qwen3.8-27b)")),
    React.createElement("div", { style: box },
      React.createElement("label", { htmlFor: "ai-provider", style: label }, "Provider"),
      React.createElement("select", { id: "ai-provider", value: provider, onChange: (e) => { const id = e.target.value; setProvider(id); const p = AI_PROVIDERS.find((x) => x.id === id); if (p && p.examples[0]) setModel(p.examples[0]); setMsg(""); }, style: field },
        AI_PROVIDERS.map((p) => React.createElement("option", { key: p.id, value: p.id }, p.label))),
      React.createElement("label", { htmlFor: "ai-model", style: { ...label, marginTop: "12px" } }, "Model (নাম হুবহু লিখুন)"),
      React.createElement("input", { id: "ai-model", type: "text", value: model, list: "ai-model-examples", autoCapitalize: "none", autoCorrect: "off", spellCheck: false,
        onChange: (e) => { setModel(e.target.value); setMsg(""); }, style: field }),
      React.createElement("datalist", { id: "ai-model-examples" }, cur.examples.map((x) => React.createElement("option", { key: x, value: x }))),
      !valid && React.createElement("p", { role: "alert", style: { margin: "6px 0 0", fontSize: "13px", color: "#B3261E" } }, "নামে ফাঁকা জায়গা বা অদ্ভুত চিহ্ন চলবে না (অক্ষর, সংখ্যা, . _ : / - চলবে)।"),
      React.createElement("button", { type: "button", disabled: busy || !valid || unchanged, onClick: () => save(provider, model), style: btn(true, busy || !valid || unchanged) }, busy ? "সেভ হচ্ছে…" : "সেভ করুন"),
      React.createElement("button", { type: "button", disabled: busy, onClick: () => { setProvider(DEFAULT_AI_CONFIG.provider); setModel(DEFAULT_AI_CONFIG.model); save(DEFAULT_AI_CONFIG.provider, DEFAULT_AI_CONFIG.model); }, style: btn(false, busy) }, "ডিফল্টে ফিরুন (Groq · Qwen)"),
      msg && React.createElement("p", { role: err ? "alert" : "status", style: { margin: "10px 0 0", fontSize: "14px", lineHeight: 1.5, color: err ? "#B3261E" : "var(--hs-primary, #0E4B43)" } }, msg)),
    React.createElement("div", { style: box },
      React.createElement("p", { style: { margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "var(--hs-muted, #5F716C)" } }, "সর্বশেষ AI উত্তর দিয়েছে (এই সেশনে)"),
      React.createElement("p", { style: { margin: 0, fontSize: "15px", color: "var(--hs-text, #1F2D2A)", wordBreak: "break-all" } }, info && info.modelUsed ? info.modelUsed : "এখনো কোনো AI-চ্যাট হয়নি"),
      info && info.customFailed && React.createElement("p", { role: "alert", style: { margin: "6px 0 0", fontSize: "13px", color: "#B3261E", lineHeight: 1.5 } }, "বাছা মডেল চলেনি (" + info.customFailed + "), তাই ডিফল্ট মডেল উত্তর দিয়েছে। model-নাম বা API key দেখুন।"),
      React.createElement("button", { type: "button", onClick: () => setInfo(getLastAiInfo()), style: btn(false, false) }, "রিফ্রেশ")),
    React.createElement("p", { style: { fontSize: "12px", color: "var(--hs-muted, #5F716C)", lineHeight: 1.6, margin: "0 2px" } },
      "API key এখানে বদলানো যায় না (নিরাপত্তার জন্য)। key বদলাতে GitHub → Settings → Secrets-এ WORKER_GROQ/MISTRAL/OPENROUTER_API_KEY বদলে deploy-worker চালান।"));
}
