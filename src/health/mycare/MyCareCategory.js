// MyCare — বিভাগ-পেজ (সাব-পিল → সুপারিশ-কার্ড → ডিটেইল শিট)। পরামর্শ আসে শুধু careEngine থেকে; এখানে বানানো কিছু নেই।
import { L } from "../../shared/i18n.js";
import { SubPills } from "../../shared/SubPills.js";
import { CollapsibleSection } from "../../shared/ui.js";
import { Sheet } from "../tracker/PlanEditSheets.js";
import { EvidenceBadge } from "../treatment-modes/EvidenceBadge.js";
import { recommend } from "./careEngine.js";
import { RED_FLAGS } from "./careRedFlags.js";
import { ALL_ITEMS } from "./data/index.js";
import { CAT_META, LABELS, CONCERN_KEY, TYPE_KEY } from "./careLabels.js";
import { askAI } from "../../ai/aiClient.js";
import { renderRichText } from "../../shared/richText.js";
import { explainWith } from "./careAiGuard.js";

const { useState } = React;
const AI_ON = !!import.meta.env.VITE_MEDIA_WORKER_URL; // AI বন্ধ থাকলে বাটন লুকানো; পেজ অপরিবর্তিত
const T = (o) => (o ? L(o.bn, o.en) : "");
const warnBox = { padding: "10px 12px", borderRadius: "12px", background: "#FFF6DD", border: "1px solid #E8D08A", color: "#7A5B00", fontSize: "13.5px", lineHeight: 1.5, marginBottom: "10px" };
const cardBox = { width: "100%", textAlign: "left", boxSizing: "border-box", padding: "14px", marginBottom: "10px", borderRadius: "16px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", boxShadow: "0 2px 8px rgba(14,75,67,0.07)", fontFamily: "inherit", color: "var(--hs-text, #1B2430)", cursor: "pointer", display: "block" };

// "সহজ করে বলুন" — শুধু আইটেমের লেখা AI-কে যায়; উত্তর careAiGuard-এ যাচাই হয়। ব্যর্থ হলে বাকি শিট অক্ষত।
function ExplainBlock({ entry, familyId }) {
  const lang = L("bn", "en");
  const [st, setSt] = useState({ phase: "idle", text: "", fallback: null });
  const run = async () => {
    setSt({ phase: "loading", text: "", fallback: null });
    const r = await explainWith(askAI, familyId, entry, lang, { maxRetries: 1 });
    if (r.ok) setSt({ phase: "done", text: r.text, fallback: null });
    else if (r.reason === "unavailable") setSt({ phase: "error", text: "", fallback: null });
    else setSt({ phase: "blocked", text: "", fallback: r.fallback });
  };
  return React.createElement("div", { style: { marginTop: "14px" } },
    React.createElement("button", { type: "button", onClick: run, disabled: st.phase === "loading", style: { width: "100%", minHeight: "48px", borderRadius: "14px", border: "none", background: "var(--hs-primary, #0E4B43)", color: "#fff", fontSize: "15px", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", opacity: st.phase === "loading" ? 0.7 : 1 } },
      st.phase === "loading" ? L("একটু অপেক্ষা করুন…", "Please wait…") : L("সহজ করে বলুন", "Explain simply")),
    st.phase === "done" && React.createElement("div", { style: { marginTop: "10px", padding: "12px", borderRadius: "14px", background: "#EAF6F0", border: "1px solid #A9D8C4", fontSize: "14.5px", lineHeight: 1.6, color: "#1F2D2A", whiteSpace: "pre-wrap" } },
      React.createElement("div", { style: { fontSize: "12.5px", fontWeight: 800, color: "#7A5B00", marginBottom: "4px" } }, L("AI ব্যাখ্যা — উপরের তথ্যেরই সহজ রূপ", "AI explanation — a simpler version of the details above")),
      renderRichText(st.text)),
    st.phase === "blocked" && React.createElement("div", { role: "status", style: { ...warnBox, marginTop: "10px", marginBottom: 0 } }, T(st.fallback)),
    st.phase === "error" && React.createElement("div", { role: "status", style: { ...warnBox, marginTop: "10px", marginBottom: 0 } }, L("ব্যাখ্যা এখন পাওয়া যাচ্ছে না। পরে আবার চেষ্টা করুন।", "The explanation isn't available right now. Please try again later.")),
    React.createElement("details", { style: { marginTop: "8px", fontSize: "12.5px", color: "#5F716C", lineHeight: 1.5 } },
      React.createElement("summary", { style: { cursor: "pointer", minHeight: "32px" } }, L("🔒 AI-তে কী যায়?", "🔒 What is sent to AI?")),
      L("শুধু এই আইটেমের নাম, কারণ, নিয়ম ও সতর্কতা পাঠানো হয় (ক্লাউড AI, Zero Data Retention)। আপনার নাম, জন্মতারিখ, স্বাস্থ্য-রেকর্ড বা প্রোফাইল কখনো যায় না। AI নতুন তথ্য বা পরিমাণ যোগ করতে পারে না; তেমন কিছু এলে উত্তর দেখানো হয় না।", "Only this item's name, reason, how-to and warnings are sent (cloud AI, Zero Data Retention). Your name, date of birth, health records or profile are never sent. If the AI adds new facts or amounts, the answer is not shown.")));
}

function DetailSheet({ entry, safetyLine, familyId, explainOn, onClose }) {
  const it = entry.item;
  const sec = (title, body) => body && React.createElement("div", { style: { marginTop: "14px" } },
    React.createElement("div", { style: { fontSize: "13px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)" } }, title),
    React.createElement("div", { style: { fontSize: "14.5px", lineHeight: 1.6, marginTop: "2px", color: "#1F2D2A" } }, body));
  const notFor = (it.avoidIf || []).map((k) => T((LABELS.avoidIf || {})[k])).filter(Boolean);
  const notForText = [].concat(notFor.length ? [notFor.join(", ")] : [], (it.ingredientAliases || []).length ? [L("এই উপাদানে অ্যালার্জি/অস্বস্তি থাকলে (স্বয়ংক্রিয়ভাবে লুকানো হয়)", "Allergy or intolerance to listed ingredients (hidden automatically)")] : []).join(" · ");
  const warns = [...(it.warnings || []).map((w) => (typeof w === "string" ? w : T(w))), ...entry.notes.map(T), it.redFlagNote ? (typeof it.redFlagNote === "string" ? it.redFlagNote : T(it.redFlagNote)) : ""].filter(Boolean);
  const src = (it.sources || []).map((s) => s.org + (s.ref ? " " + s.ref : "")).join(" · ");
  return React.createElement(Sheet, { title: T(it.name), onClose, soft: true },
    React.createElement(EvidenceBadge, { evidenceTier: it.evidenceLevel, compact: true }),
    sec(L("কেন", "Why"), T(it.why)),
    sec(L("কীভাবে", "How"), T(it.how)),
    sec(L("কারা নয়", "Not for"), notForText),
    warns.length > 0 && React.createElement("div", { style: { ...warnBox, marginTop: "14px", marginBottom: 0 } }, warns.map((w, i) => React.createElement("div", { key: i }, w))),
    React.createElement("div", { style: { ...warnBox, marginTop: "10px", marginBottom: 0 } }, T(safetyLine)),
    explainOn && React.createElement(ExplainBlock, { entry, familyId }),
    src && React.createElement("div", { style: { fontSize: "12.5px", color: "#5F716C", marginTop: "12px" } }, L("উৎস: ", "Source: ") + src),
    React.createElement("div", { style: { fontSize: "12.5px", color: "#5F716C", marginTop: "8px" } }, L("এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।", "This is a general guide, not medical advice.")));
}

export function MyCareCategory({ catId, profile, season, familyId, canExplain, onBack, onEditProfile }) {
  const meta = CAT_META.find((c) => c[0] === catId) || [catId, catId, catId, "#1F7A5C"];
  const concernKey = CONCERN_KEY[catId];
  const concerns = concernKey ? (LABELS[concernKey] ? Object.keys(LABELS[concernKey]) : []) : [];
  const [concern, setConcern] = useState("all");
  const [symptoms, setSymptoms] = useState([]);
  const [open, setOpen] = useState(null);

  const res = recommend(profile, ALL_ITEMS, { category: catId, season, symptoms, concern: concern === "all" ? null : concern });
  const typeKey = TYPE_KEY[catId];
  const typeMissing = !!typeKey && !profile[typeKey];
  const flagOpts = RED_FLAGS.filter((f) => f.cats === "*" || f.cats.includes(catId));
  const toggleSym = (id) => setSymptoms((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const hasAny = ALL_ITEMS.some((i) => i.category === catId && i.status === "verified");

  const pills = concerns.length
    ? React.createElement("div", { style: { overflowX: "auto" } }, React.createElement("div", { style: { minWidth: (concerns.length + 1) * 84 + "px" } },
      SubPills([["all", L("সব", "All")], ...concerns.map((c) => [c, T(LABELS[concernKey][c])])], concern, setConcern, "mycare-" + catId, meta[2])))
    : null;

  return React.createElement("div", null,
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", margin: "4px 0 8px" } },
      React.createElement("button", { type: "button", onClick: onBack, "aria-label": L("পেছনে", "Back"), style: { minWidth: "44px", minHeight: "44px", border: "none", background: "none", fontSize: "22px", cursor: "pointer", color: "var(--hs-primary, #0E4B43)", fontFamily: "inherit" } }, "←"),
      React.createElement("h2", { style: { fontSize: "21px", margin: 0, color: "var(--hs-primary, #0E4B43)" } }, L(meta[1], meta[2]))),
    pills,
    flagOpts.length > 0 && React.createElement(CollapsibleSection, { title: L("কোনো সতর্ক লক্ষণ আছে?", "Any warning signs?") },
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } }, flagOpts.map((f) => {
        const on = symptoms.includes(f.id);
        return React.createElement("button", { key: f.id, type: "button", "aria-pressed": on, onClick: () => toggleSym(f.id),
          style: { textAlign: "left", minHeight: "44px", padding: "8px 12px", borderRadius: "12px", fontSize: "14px", fontFamily: "inherit", cursor: "pointer", fontWeight: on ? 800 : 500,
            border: on ? "1.5px solid #B3261E" : "1px solid #C3D2CA", background: on ? "#FDECEA" : "#fff", color: "#1F2D2A" } }, (on ? "✓ " : "") + T(f));
      }))),
    res.redFlags.map((f) => React.createElement("div", { key: f.id, role: "alert", style: { padding: "12px 14px", marginBottom: "10px", borderRadius: "14px", fontSize: "14.5px", lineHeight: 1.5, fontWeight: 700,
      background: f.level === "emergency" ? "#FDECEA" : "#FFF6DD", border: "1px solid " + (f.level === "emergency" ? "#E5A29A" : "#E8D08A"), color: f.level === "emergency" ? "#7A1F14" : "#7A5B00" } }, (f.level === "emergency" ? "🚨 " : "⚠ ") + T(f))),
    res.notices.map((n) => React.createElement("div", { key: n.id, style: warnBox }, "⚠ " + T(n))),
    typeMissing && res.mode !== "referral" && React.createElement("button", { type: "button", onClick: onEditProfile, style: { ...warnBox, width: "100%", textAlign: "left", minHeight: "44px", cursor: "pointer", fontFamily: "inherit" } },
      L("সবচেয়ে নিরাপদ সাধারণ সেট দেখানো হচ্ছে — ধরন দেওয়া নেই। ধরন বাছুন ›", "Safe core set shown — type not set. Choose type ›")),
    res.mode !== "referral" && res.items.length === 0 && React.createElement("div", { role: "status", style: { padding: "18px 12px", textAlign: "center", color: "var(--hs-muted, #5F716C)", fontSize: "14px", lineHeight: 1.6 } },
      hasAny ? L("আপনার তথ্যের সাথে মেলে এমন পরামর্শ এখন নেই। ধরন/সমস্যা বদলে দেখুন।", "No advice matches these details. Try changing type or concern.")
        : L("এই বিভাগের যাচাইকৃত পরামর্শ শীঘ্রই আসছে।", "Verified advice for this section is coming soon.")),
    res.mode !== "referral" && res.items.map((entry) => React.createElement("button", { key: entry.item.id, type: "button", onClick: () => setOpen(entry), style: cardBox },
      React.createElement("div", { style: { fontSize: "16px", fontWeight: 800 } }, T(entry.item.name)),
      React.createElement("div", { style: { margin: "6px 0" } }, React.createElement(EvidenceBadge, { evidenceTier: entry.item.evidenceLevel, compact: true })),
      React.createElement("div", { style: { fontSize: "13.5px", color: "var(--hs-muted, #5F716C)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, T(entry.item.how)),
      entry.notes.length > 0 && React.createElement("div", { style: { fontSize: "13px", color: "#7A5B00", marginTop: "6px" } }, T(entry.notes[0])))),
    React.createElement("p", { style: { fontSize: "12.5px", color: "var(--hs-muted, #5F716C)", lineHeight: 1.5, margin: "8px 0 0" } }, L("এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।", "This is a general guide, not medical advice.")),
    open && React.createElement(DetailSheet, { entry: open, safetyLine: res.safetyLine, familyId, explainOn: AI_ON && !!canExplain && !!familyId, onClose: () => setOpen(null) }));
}
