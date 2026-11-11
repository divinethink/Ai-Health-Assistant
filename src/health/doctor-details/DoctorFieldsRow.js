// ৩ সারির compact ডাক্তার-ফিল্ড (Doctor Details ও Health Record — দুই জায়গায় একই)।
// সারি ১: নাম | 📇 কার্ড; সারি ২: বিশেষত্ব | এলাকা; সারি ৩: প্রতিষ্ঠান | ফোন।
// "আরও (ঠিকানা/সময়)" ভাঁজে chamberAddress — ডেটা হারায় না (value.chamberAddress সংরক্ষিত)।
// Controlled: value, onChange(patch), suggestions (pure doctorSuggest থেকে), onPick(candidate)।

import { DOCTOR_CATEGORIES } from "./doctorDetailsData.js";
import { parseVisitingCard } from "./cardParsing.js";
import { assessOcr, QUALITY_MESSAGES } from "../reports/ocrQuality.js";
import { AiAssistBar, AiBadge } from "../doc-ai/AiAssistBar.js";
import { shouldTryAi, cardAiPatch } from "../doc-ai/aiAdapters.js";

const { useState, useRef, useCallback, useEffect } = React;

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px", minHeight: "44px" };
const rowStyle = { display: "flex", gap: "8px", marginTop: "10px", alignItems: "stretch" };
const cell = { flex: 1, minWidth: 0 };

export function DoctorFieldsRow({ value, onChange, suggestions, onPick, onCardClick, cardLabel, showCategory = true, showAddress = true, allowEmptyCategory = false, file = null, familyId = null, preOcr = null, autoScan = false }) {
  const [open, setOpen] = useState(false);
  const v = value || {};
  const [filled, setFilled] = useState([]); // OCR থেকে ভরা ফিল্ড (ব্যবহারকারী বদলালে তালিকা থেকে বাদ)
  const [scan, setScan] = useState({ busy: false, progress: 0, note: "" });
  const [aiJob, setAiJob] = useState(null); // ধাপ ৪-ঘ: { text } — কার্ডে কম ঘর/কম ভরসা হলে AI-সহায়তা (familyId থাকলেই)
  const [aiFilled, setAiFilled] = useState([]);
  const [aiNote, setAiNote] = useState("");
  const vRef = useRef(v); vRef.current = v;
  const change = (patch) => { setFilled((f) => f.filter((k) => !(k in patch))); onChange(patch); };
  const set = (k) => (e) => change({ [k]: e.target.value });
  const mark = (k) => (filled.includes(k) ? { background: "#FFFBEB", borderColor: "#E0A800" } : null);

  // কার্ড স্ক্যান: Tesseract/pdf.js lazy import() — অ্যাপ-বুট হালকা থাকে। শুধু খালি ঘরে ভরে।
  const runScan = async () => {
    if (!file || scan.busy) return;
    setScan({ busy: true, progress: 0, note: "" }); setAiJob(null); setAiNote(""); setAiFilled([]);
    try {
      const { ocrImageFile, ocrPdfPages } = await import("../reports/ocrExtraction.js");
      const onProgress = (p) => setScan((s) => ({ ...s, progress: p }));
      const ocr = preOcr || (file.type === "application/pdf" ? await ocrPdfPages(file, onProgress) : await ocrImageFile(file, onProgress)); // ধাপ ৪-ঙ: preOcr থাকলে দুবার OCR নয়
      const parsed = parseVisitingCard(ocr.text);
      const defaultCat = !allowEmptyCategory ? DOCTOR_CATEGORIES[0][0] : "";
      const isEmpty = (k) => !String(v[k] || "").trim() || (k === "specialtyCategory" && v[k] === defaultCat);
      const patch = {};
      for (const k of ["name", "specialtyCategory", "phone", "area", "hospital", "chamberAddress"]) {
        if (parsed[k] && isEmpty(k) && (k !== "chamberAddress" || showAddress)) patch[k] = parsed[k];
      }
      if (Object.keys(patch).length) onChange(patch);
      setFilled(Object.keys(patch));
      const reasons = (ocr.quality && ocr.quality.reasons || []).map((r) => QUALITY_MESSAGES[r]).filter(Boolean);
      const a = assessOcr({ confidence: ocr.confidence, matchedCount: parsed.found.length, textLength: (ocr.text || "").length });
      let note = Object.keys(patch).length ? "" : "কার্ড থেকে নতুন কিছু পাওয়া যায়নি — হাতে পূরণ করুন।";
      if (reasons.length || a.lowConfidence) note += (note ? " " : "") + (reasons.join(", ") || "লেখা পরিষ্কার পড়া যায়নি") + " — ফলাফল ভুল হতে পারে, ভালো আলোয় আবার তুলতে পারেন।";
      setScan({ busy: false, progress: 1, note });
      if (familyId && shouldTryAi("visiting-card", { text: ocr.text, found: parsed.found.length, lowConfidence: a.lowConfidence })) setAiJob({ text: ocr.text });
    } catch (e) {
      setScan({ busy: false, progress: 0, note: "কার্ড পড়া যায়নি — হাতে পূরণ করুন।" });
    }
  };
  useEffect(() => { if (autoScan && preOcr && file) runScan(); }, []); // শুধু mount-এ একবার
  const onAiSettled = useCallback(({ result, message }) => {
    setAiJob(null);
    if (!(result && !result.empty)) { setAiNote(message ? "ℹ️ " + message : ""); return; } // "এখন নয়" বাছলে নীরব }
    const cur = vRef.current || {};
    const defaultCat = !allowEmptyCategory ? DOCTOR_CATEGORIES[0][0] : "";
    const isEmptyKey = (k) => !String(cur[k] || "").trim() || (k === "specialtyCategory" && cur[k] === defaultCat);
    const keys = ["name", "specialtyCategory", "phone", "area", "hospital", "chamberAddress"].filter((k) => k !== "chamberAddress" || showAddress);
    const patch = cardAiPatch(result.fields, isEmptyKey, DOCTOR_CATEGORIES, keys);
    const pk = Object.keys(patch);
    if (pk.length) { onChange(patch); setFilled((f) => Array.from(new Set([...f, ...pk]))); setAiFilled(pk); setAiNote(""); }
    else setAiNote("🤖 AI নতুন কিছু যোগ করেনি — খালি ঘরগুলো হাতে পূরণ করুন।");
  }, [onChange, allowEmptyCategory, showAddress]);
  const list = suggestions || [];

  return React.createElement(
    "div", null,
    // সারি ১
    React.createElement("div", { style: { ...rowStyle, position: "relative" } },
      React.createElement("div", { style: cell },
        React.createElement("input", { type: "text", value: v.name || "", placeholder: "ডাক্তারের নাম (যেমন: ডা. রহিম)", "aria-label": "ডাক্তারের নাম", onChange: (e) => { change({ name: e.target.value }); setOpen(true); }, onFocus: () => setOpen(true), onBlur: () => setTimeout(() => setOpen(false), 150), style: { ...inputStyle, ...mark("name") } }),
        open && list.length > 0 && React.createElement("div", { role: "listbox", style: { position: "absolute", zIndex: 5, left: 0, right: 0, top: "100%", background: "#fff", border: "1px solid #C3D2CA", borderRadius: "12px", boxShadow: "0 4px 12px rgba(14,75,67,0.15)", maxHeight: "220px", overflowY: "auto" } },
          list.map((c, i) => React.createElement("div", { key: (c.id || "r") + i, role: "option", onMouseDown: (e) => { e.preventDefault(); onPick(c); setOpen(false); }, style: { padding: "10px 12px", fontSize: "14px", borderBottom: "1px solid #EEF3F0", cursor: "pointer" } },
            React.createElement("div", { style: { fontWeight: 600, color: "#1F2D2A" } }, c.name),
            React.createElement("div", { style: { fontSize: "12px", color: "#5F716C" } }, [c.hospital, c.phone].filter(Boolean).join(" · ") || (c.source === "record" ? "আগের রেকর্ড থেকে" : "")))))),
      onCardClick && React.createElement("button", { type: "button", onClick: onCardClick, "aria-label": "ভিজিটিং কার্ড", style: { minWidth: "48px", minHeight: "44px", border: "1.5px solid #C3D2CA", borderRadius: "12px", background: "#F9FBFA", fontSize: "18px", cursor: "pointer" } }, cardLabel || "📇")),
    // কার্ড স্ক্যান (ফাইল বাছা থাকলে)
    file && React.createElement("div", { style: { marginTop: "8px" } },
      React.createElement("button", { type: "button", onClick: runScan, disabled: scan.busy, style: { width: "100%", minHeight: "44px", border: "1px dashed #9CC5B4", borderRadius: "12px", background: "#F6FAF7", color: "#0E4B43", fontSize: "14px", fontWeight: 600, cursor: scan.busy ? "default" : "pointer", fontFamily: "inherit" } },
        scan.busy ? "কার্ড পড়া হচ্ছে… " + Math.round(scan.progress * 100) + "%" : "🔍 কার্ড থেকে পূরণ করুন"),
      filled.length > 0 && React.createElement("div", { style: { fontSize: "13px", color: "#8A6D00", marginTop: "6px" } }, "OCR থেকে — যাচাই করুন (হলুদ ঘরগুলো)। সংরক্ষণ করার আগে ঠিক আছে কিনা দেখুন।"),
      scan.note && React.createElement("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "6px" } }, scan.note),
      aiJob && React.createElement(AiAssistBar, { familyId, docType: "visiting-card", ocrText: aiJob.text, onSettled: onAiSettled, label: "কার্ডের লেখা ঠিকমতো পড়া যায়নি — AI-র সাহায্য নেবেন?" }),
      aiFilled.length > 0 && React.createElement("div", { style: { marginTop: "8px" } }, AiBadge("AI বসিয়েছে (" + aiFilled.length + "টি ঘর) — যাচাই করুন")),
      aiNote && React.createElement("div", { role: "status", style: { fontSize: "13px", color: "#4B5C57", marginTop: "6px" } }, aiNote)),
    // সারি ২
    React.createElement("div", { style: rowStyle },
      showCategory && React.createElement("select", { value: v.specialtyCategory || (allowEmptyCategory ? "" : DOCTOR_CATEGORIES[0][0]), onChange: set("specialtyCategory"), "aria-label": "বিশেষত্ব", style: { ...inputStyle, ...cell, ...mark("specialtyCategory") } },
        allowEmptyCategory && React.createElement("option", { key: "", value: "" }, "বিশেষত্ব (ঐচ্ছিক)"),
        DOCTOR_CATEGORIES.map(([k, l]) => React.createElement("option", { key: k, value: k }, l))),
      React.createElement("input", { type: "text", value: v.area || "", placeholder: "এলাকা", "aria-label": "এলাকা", onChange: set("area"), style: { ...inputStyle, ...cell, ...mark("area") } })),
    // সারি ৩
    React.createElement("div", { style: rowStyle },
      React.createElement("input", { type: "text", value: v.hospital || "", placeholder: "প্রতিষ্ঠান/চেম্বার", "aria-label": "প্রতিষ্ঠান", onChange: set("hospital"), style: { ...inputStyle, ...cell, ...mark("hospital") } }),
      React.createElement("input", { type: "tel", value: v.phone || "", placeholder: "ফোন", "aria-label": "ফোন", onChange: set("phone"), style: { ...inputStyle, ...cell, ...mark("phone") } })),
    // ভাঁজ
    showAddress && React.createElement("details", { style: { marginTop: "10px" }, open: !!v.chamberAddress || filled.includes("chamberAddress") },
      React.createElement("summary", { style: { fontSize: "14px", color: "#0E4B43", cursor: "pointer", minHeight: "32px" } }, "আরও (ঠিকানা/সময়)"),
      React.createElement("input", { type: "text", value: v.chamberAddress || "", placeholder: "চেম্বারের ঠিকানা/সময়সূচি", "aria-label": "চেম্বার-ঠিকানা", onChange: set("chamberAddress"), style: { ...inputStyle, marginTop: "6px", ...mark("chamberAddress") } }))
  );
}
