// Document upload form — Roadmap §7। shared/ui.js primitives + healthRecords-এর
// ফর্ম-প্যাটার্ন reuse (state/logic component-এই, presentational callback দিয়ে
// parent-কে জানায়, Process Rule ১১)।
//
// ধাপ ৪-ঙ — এক প্রবেশদ্বার: ফাইল একবার বাছলেই (১) লেখা পড়া (PDF text-layer, নইলে OCR — একবারই),
// (২) ধরন নিজে চেনা (প্রেসক্রিপশন/ল্যাব/ডাক্তারের কার্ড; অনিশ্চিত হলে "চেনা যায়নি"), (৩) ফল `preOcr` হিসেবে
// পরের প্যানেলে যায় — দুবার OCR নয়। ধরন হাতে বদলানো যায়। vault-এ আসল ফাইলই সংরক্ষিত হয়;
// আপলোড ব্যর্থ হলে বিশ্লেষণ শুরু হয় না, ফাইলও হারায় না। কিছুই নিজে সেভ হয় না — পরের প্যানেলের যাচাই-ধাপ বহাল।
// শুধু `onPrescription` দেওয়া থাকলে (ওষুধ-ট্যাবের "📷 প্রেসক্রিপশন থেকে") ফর্ম আগের মতো প্রেসক্রিপশন-লক।

import { SelectField, DateField, ErrorBox, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { localISO } from "../../shared/dates.js";
import { uploadDocument, DOC_TYPE_LABELS, validateFile } from "./documentsData.js";
import { classifyDocument } from "../doc-ai/docClassify.js";
import { readDocumentText } from "../doc-ai/readDocText.js";
import { AUTO, kindToVaultType, describeDetection, resolveKind } from "../doc-ai/autoType.js";

const { useState, useCallback, useRef, useEffect, useMemo } = React;
const h = React.createElement;

const G = "var(--hs-primary, #0E4B43)";
const CHIPS = [
  [AUTO, "🤖", "নিজে চিনে নিক"],
  ["prescription", "💊", "প্রেসক্রিপশন"],
  ["lab-report", "🔬", "ল্যাব রিপোর্ট"],
  ["visiting-card", "📇", "ডাক্তার-কার্ড"],
  ["other", "📄", "অন্যান্য"],
];
const OTHER_TYPES = ["imaging", "discharge-summary", "other"];
const CSS = "@keyframes hs-up-slide{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}.hs-up-bar{position:relative;overflow:hidden;height:6px;border-radius:999px;background:#DCEBE4}.hs-up-bar>i{position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:999px;background:linear-gradient(90deg,var(--hs-primary-2, #17705F),#5DB89F);animation:hs-up-slide 1.3s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.hs-up-bar>i{animation:none;width:100%}}";

const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const chipStyle = (on) => ({ minHeight: "44px", padding: "8px 14px", borderRadius: "999px", fontSize: "14px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: on ? "1.5px solid " + G : "1.5px solid #C9D9D1", background: on ? "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))" : "#fff", color: on ? "#fff" : "#1F2D2A", boxShadow: on ? "0 3px 8px rgba(14,75,67,0.22)" : "none" });

export function DocumentUploadForm({ familyId, targetMemberId, callerMemberId, onUploaded, onAnalyze, onManual, onPrescription, onCard }) {
  const rxLocked = !!onPrescription && !onAnalyze && !onCard; // ওষুধ-ট্যাবের পুরনো ব্যবহার: শুধু প্রেসক্রিপশন
  const [choice, setChoice] = useState(rxLocked ? "prescription" : AUTO);
  const [otherType, setOtherType] = useState("other");
  const [date, setDate] = useState(() => localISO());
  const [source, setSource] = useState("");
  const [file, setFile] = useState(null);
  const [pre, setPre] = useState(null);          // { text, ocr, method } — আপলোডে একবার পড়া
  const [detect, setDetect] = useState(null);    // describeDetection() ফল
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileInputRef = useRef(null);
  const readToken = useRef(0);

  const isImage = !!(file && file.type && file.type.startsWith("image/"));
  const previewUrl = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // ফাইল বাছা হলে (auto মোডে) একবারই পড়ে ধরন চিনি; ব্যর্থ হলে নীরবে "চেনা যায়নি" — হাতে বাছার পথ খোলা
  useEffect(() => {
    setPre(null); setDetect(null); setProgress(0);
    if (!file || choice !== AUTO) { setReading(false); return undefined; }
    const token = ++readToken.current;
    setReading(true);
    readDocumentText(file, { onProgress: (p) => { if (token === readToken.current) setProgress(p); } })
      .then((r) => { if (token !== readToken.current) return; setPre(r); setDetect(describeDetection(classifyDocument(r.text))); })
      .catch(() => { if (token === readToken.current) setDetect(describeDetection(null)); })
      .finally(() => { if (token === readToken.current) setReading(false); });
    return () => { readToken.current++; };
  }, [file, choice === AUTO]);

  const onFileChange = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    setErr(null);
    if (f) {
      const v = validateFile(f);
      if (v) { setErr(v); setFile(null); return; }
    }
    setFile(f || null);
  }, []);

  const kind = resolveKind(choice === "other" ? "other" : choice, detect);
  const vaultType = choice === "other" ? otherType : kindToVaultType(kind);
  const hasNext = (kind === "prescription" && !!onPrescription) || (kind === "lab-report" && !!onAnalyze) || (kind === "visiting-card" && !!onCard);
  const primaryLabel = !hasNext ? "💾 সংরক্ষণ করুন"
    : kind === "prescription" ? "💾 সংরক্ষণ + ওষুধ শনাক্ত"
    : kind === "lab-report" ? "💾 সংরক্ষণ + রিপোর্ট বিশ্লেষণ"
    : "💾 সংরক্ষণ + ডাক্তার-তালিকায় যোগ";

  const submit = useCallback(async (andNext) => {
    setErr(null);
    if (!file) { setErr("একটা ফাইল বেছে নিন।"); return; }
    setBusy(true);
    try {
      const up = await uploadDocument(familyId, targetMemberId, callerMemberId, file, { docType: vaultType, date, source });
      const f = file, p = pre;
      setFile(null); setSource("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded && onUploaded();
      if (andNext) {
        if (kind === "prescription" && onPrescription) onPrescription(f, p, up && up.id);
        else if (kind === "lab-report" && onAnalyze) onAnalyze(f, p);
        else if (kind === "visiting-card" && onCard) onCard(f, p);
      }
    } catch (e) {
      setErr(e.code === "permission-denied"
        ? "এই সদস্যের জন্য নথি আপলোড করার অনুমতি আপনার নেই।"
        : (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [familyId, targetMemberId, callerMemberId, file, vaultType, date, source, pre, kind, onUploaded, onAnalyze, onPrescription, onCard]);

  const dropzone = h("label", { style: { display: "block", position: "relative", marginTop: "10px", padding: file ? "12px" : "22px 14px", border: "2px dashed " + (file ? "#7FBBA6" : "#9CC5B4"), borderRadius: "18px", background: "linear-gradient(160deg, #F6FBF8 0%, #EAF4EF 100%)", textAlign: file ? "left" : "center", cursor: "pointer" } },
    h("input", { ref: fileInputRef, type: "file", accept: "image/*,application/pdf", onChange: onFileChange, style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: "16px" }, "aria-label": "ফাইল বাছুন" }),
    file
      ? h("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
          isImage
            ? h("img", { src: previewUrl, alt: "", style: { width: "56px", height: "56px", objectFit: "cover", borderRadius: "12px", border: "1px solid #C9D9D1", flexShrink: 0 } })
            : h("div", { style: { width: "56px", height: "56px", borderRadius: "12px", background: "#fff", border: "1px solid #C9D9D1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", flexShrink: 0 } }, "📄"),
          h("div", { style: { minWidth: 0, flex: 1 } },
            h("div", { style: { fontSize: "14px", fontWeight: 700, color: G, overflowWrap: "anywhere" } }, file.name),
            h("div", { style: { fontSize: "12px", color: "#5F716C", marginTop: "2px" } }, fmtSize(file.size) + " · অন্য ফাইল নিতে ট্যাপ করুন")))
      : h("div", null,
          h("div", { style: { fontSize: "34px", lineHeight: 1 } }, "📎"),
          h("div", { style: { fontSize: "15px", fontWeight: 700, color: G, marginTop: "8px" } }, "ছবি বা PDF বাছুন"),
          h("div", { style: { fontSize: "13px", color: "#5F716C", marginTop: "4px" } }, "প্রেসক্রিপশন, ল্যাব রিপোর্ট বা ডাক্তারের কার্ড — ধরন অ্যাপ নিজেই চিনে নেবে (সর্বোচ্চ 20MB)")));

  let statusBox = null;
  if (file && choice === AUTO) {
    if (reading) {
      statusBox = h("div", { role: "status", style: { marginTop: "10px", padding: "10px 12px", borderRadius: "14px", background: "#EEF6F2", color: G, fontSize: "14px" } },
        "🔎 লেখা পড়ে ধরন চেনা হচ্ছে… " + (progress > 0 ? Math.round(progress * 100) + "%" : ""),
        h("div", { className: "hs-up-bar", style: { marginTop: "8px" } }, h("i")));
    } else if (detect) {
      statusBox = h("div", { role: "status", style: { marginTop: "10px", padding: "10px 12px", borderRadius: "14px", fontSize: "14px", fontWeight: 600, lineHeight: 1.5, background: detect.sure ? "#E8F5EE" : "#FFF8E1", color: detect.sure ? "#14624F" : "#8A5A00", border: "1px solid " + (detect.sure ? "#BFE0CF" : "#F2D27A") } },
        detect.emoji + " " + detect.text);
    }
  }

  return h("div", { style: { marginTop: "12px", padding: "14px", border: "1px solid #D3E0D9", borderRadius: "18px", background: "#fff", boxShadow: "0 4px 14px rgba(14,75,67,0.08)" } },
    h("style", null, CSS),
    dropzone,
    statusBox,
    !rxLocked && h("div", { style: { marginTop: "12px" } },
      h("div", { style: { fontSize: "13px", fontWeight: 700, color: "#5F716C", marginBottom: "6px" } }, "ধরন"),
      h("div", { role: "radiogroup", "aria-label": "নথির ধরন", style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
        CHIPS.map(([k, emoji, label]) => h("button", { key: k, type: "button", role: "radio", "aria-checked": choice === k, onClick: () => setChoice(k), style: chipStyle(choice === k) }, emoji + " " + label))),
      choice === "other" && SelectField("কোন ধরনের নথি?", otherType, setOtherType, OTHER_TYPES.map((k) => [k, DOC_TYPE_LABELS[k]]))),
    h("details", { style: { marginTop: "12px" } },
      h("summary", { style: { minHeight: "44px", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 600, color: G, cursor: "pointer" } }, "📅 তারিখ ও উৎস (ঐচ্ছিক)"),
      DateField("তারিখ", date, setDate),
      h("div", { style: { marginTop: "8px" } },
        h("label", { style: { fontSize: "14px", color: "#1F2D2A", display: "block", marginBottom: "4px" } }, "উৎস (যেমন: ল্যাবের নাম)"),
        h("input", { type: "text", value: source, onChange: (e) => setSource(e.target.value), style: { width: "100%", boxSizing: "border-box", padding: "10px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px", minHeight: "44px" } }))),
    err && ErrorBox(err),
    !file && h("div", { style: { marginTop: "10px", fontSize: "13px", color: "#5F716C", textAlign: "center" } }, "আগে একটা ছবি বা PDF বাছুন।"),
    PrimaryButton(primaryLabel, () => submit(hasNext), busy || (reading && choice === AUTO), !file),
    hasNext && SecondaryButton("শুধু সংরক্ষণ", () => submit(false), busy || (reading && choice === AUTO) || !file),
    onManual && SecondaryButton("✍️ হাতে-লেখা রিপোর্ট? সরাসরি লিখুন", onManual, false));
}
