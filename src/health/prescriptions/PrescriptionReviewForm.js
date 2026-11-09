// src/health/prescriptions/PrescriptionReviewForm.js
//
// ধাপ ৬ — প্রেসক্রিপশন থেকে পাওয়া প্রতিটা ওষুধ আলাদা কার্ডে: টিক + সম্পাদনযোগ্য + পাশে মূল লাইন।
// "অনুমোদন করে যোগ করুন" চাপলেই কেবল সেভ (বাধ্যতামূলক user-verification, skip অযোগ্য)।
// এলার্জির সাথে নাম মিললে সতর্কতা + ডিফল্টে টিক নেই; আগে থেকে চলমান থাকলেও টিক নেই।
// ডোজ অ্যাপ বানায় না — প্রেসক্রিপশনে যা লেখা শুধু সেটাই (ব্যবহারকারী চাইলে সম্পাদনা করেন)।

import { ErrorBox, PrimaryButton } from "../../shared/ui.js";
import { localISO } from "../../shared/dates.js";
import { matchAllergy, findDuplicateMed, parsePatternInput, FLAG_LABELS_BN } from "./prescriptionParsing.js";
import { saveApprovedMedications } from "./prescriptionData.js";

const { useState, useCallback } = React;
const h = React.createElement;
const G = "#0E4B43", RED = "#B3261E", AMBER = "#8A5A00", MUTED = "#5F716C", LINE = "#D3E0D9";
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);
const MEALS = [["before", "খাবারের আগে"], ["after", "খাবারের পরে"], ["", "উল্লেখ নেই"]];

function rowFrom(it, allergies, records, today) {
  const allergy = matchAllergy(it.name, allergies);
  const duplicate = findDuplicateMed(it.name, records, today);
  return { it, include: !allergy && !duplicate, allergy, duplicate, name: it.name, pattern: it.patternRaw || "", days: it.days ? String(it.days) : "", meal: it.meal || "" };
}

const inputStyle = { width: "100%", boxSizing: "border-box", minHeight: "44px", padding: "8px 10px", border: "1.5px solid " + LINE, borderRadius: "12px", fontSize: "15px", fontFamily: "inherit" };
const lbl = (t) => h("div", { style: { fontSize: "13px", color: MUTED, margin: "8px 0 4px" } }, t);

// ফর্ম-ইনপুট → সেভের জন্য চূড়ান্ত আইটেম (ঠিক না হলে { error })
function finalize(r) {
  const name = r.name.trim();
  if (!name) return { error: "ওষুধের নাম ফাঁকা" };
  let freq = { pattern: null, patternRaw: null, perDay: null, prn: false };
  if (r.pattern.trim()) {
    const p = parsePatternInput(r.pattern);
    if (!p) return { error: name + ": কয় বেলা ঠিক ফরম্যাটে লিখুন (যেমন ১+০+১)" };
    freq = p;
  }
  let days = null;
  if (r.days.trim()) {
    days = parseInt(r.days, 10);
    if (!(days > 0 && days <= 365)) return { error: name + ": দিনের সংখ্যা ১–৩৬৫ হতে হবে" };
  }
  return { name, days, meal: r.meal || null, ...freq };
}

function card(r, idx, update) {
  const it = r.it;
  const warn = r.allergy || r.duplicate;
  return h("div", { key: idx, style: { marginBottom: "12px", padding: "12px", borderRadius: "16px", border: "1px solid " + (r.allergy ? "#E8B4AE" : it.clear ? LINE : "#E0A72E"), background: r.allergy ? "#FFF7F6" : it.clear ? "#fff" : "#FFFBF2" } },
    h("label", { style: { display: "flex", alignItems: "center", gap: "10px", minHeight: "44px", cursor: "pointer" } },
      h("input", { type: "checkbox", checked: r.include, onChange: (e) => update(idx, { include: e.target.checked }), style: { width: "24px", height: "24px", flexShrink: 0 } }),
      h("b", { style: { fontSize: "16px", color: G, overflowWrap: "anywhere" } }, (it.form && !r.it.name.startsWith(it.form) ? it.form + ". " : "") + r.name)),
    h("div", { style: { margin: "8px 0", padding: "8px 10px", border: "1px dashed #C3C9C5", borderRadius: "10px", background: "#F7F6F1", fontFamily: "ui-monospace, Menlo, monospace", fontSize: "13px", color: "#3E4E49", overflowWrap: "anywhere" } }, it.raw),
    it.confusions.length > 0 && h("div", { style: { fontSize: "14px", color: RED, margin: "4px 0" } },
      "⚠️ অক্ষর-ডিজিট গোলমাল হতে পারে (অ্যাপ বদলায়নি): ",
      it.confusions.map((c, i) => h("span", { key: i }, h("mark", { style: { background: "#FFE08A", padding: "0 4px", borderRadius: "4px" } }, c.raw), " → \"" + c.suggestion + "\"  "))),
    r.allergy && h("div", { style: { margin: "6px 0", padding: "8px 10px", borderRadius: "10px", background: "#FDE7E4", color: RED, fontSize: "14px" } }, "⚠️ এলার্জি রেকর্ডে ", h("b", null, r.allergy), " আছে। ডাক্তারকে জানান; টিক না দিলে যোগ হবে না।"),
    r.duplicate && h("div", { style: { margin: "6px 0", padding: "8px 10px", borderRadius: "10px", background: "#EEF1EF", color: "#3E4E49", fontSize: "14px" } }, "ℹ️ এই ওষুধ আগে থেকেই চলমান তালিকায় আছে — টিক দিলেও ডুপ্লিকেট যোগ হবে না।"),
    !warn && it.flags.filter((f) => f !== "ocr-confusable").length > 0 && h("div", { style: { fontSize: "14px", color: AMBER, margin: "4px 0" } }, it.flags.filter((f) => f !== "ocr-confusable").map((f) => "⚠ " + FLAG_LABELS_BN[f]).join(" · ")),
    it.clear && !warn && h("div", { style: { fontSize: "13px", color: G, margin: "4px 0" } }, "✓ স্পষ্ট"),
    lbl("নাম"), h("input", { type: "text", value: r.name, onChange: (e) => update(idx, { name: e.target.value }), style: inputStyle }),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" } },
      h("div", null, lbl("কয় বেলা (যেমন ১+০+১)"), h("input", { type: "text", value: r.pattern, onChange: (e) => update(idx, { pattern: e.target.value }), style: inputStyle })),
      h("div", null, lbl("কতদিন"), h("input", { type: "number", inputMode: "numeric", min: 1, max: 365, value: r.days, onChange: (e) => update(idx, { days: e.target.value }), style: inputStyle }))),
    lbl("খাবারের সাথে"),
    h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
      MEALS.map(([v, l]) => h("button", { key: v, type: "button", onClick: () => update(idx, { meal: v }), "aria-pressed": r.meal === v,
        style: { minHeight: "44px", padding: "6px 12px", borderRadius: "999px", fontSize: "14px", fontWeight: 600, cursor: "pointer", border: r.meal === v ? "1px solid " + G : "1px solid #C3D2CA", background: r.meal === v ? G : "#fff", color: r.meal === v ? "#fff" : "#2B3A36" } }, l))));
}

/**
 * @param {object} props
 * @param {Array<object>} props.items - parsePrescriptionText() ফল
 * @param {Array<object>} props.allergies - এই সদস্যের allergy রেকর্ড
 * @param {Array<object>} props.records - এই সদস্যের সব রেকর্ড (ডুপ্লিকেট-চেকের জন্য)
 * @param {number|null} [props.ocrPercent]
 */
export function PrescriptionReviewForm({ familyId, targetMemberId, callerMemberId, items, allergies, records, ocrPercent, onDone }) {
  const [rows, setRows] = useState(() => items.map((it) => rowFrom(it, allergies, records, localISO())));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

  const update = useCallback((idx, patch) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))), []);
  const selected = rows.filter((r) => r.include);

  const approve = useCallback(async () => {
    if (busy || result) return; // double-submit রোধ
    setErr(null);
    if (selected.length === 0) { setErr("অন্তত একটা ওষুধে টিক দিন।"); return; }
    const finals = selected.map(finalize);
    const bad = finals.find((f) => f.error);
    if (bad) { setErr(bad.error); return; }
    setBusy(true);
    try {
      const res = await saveApprovedMedications(familyId, targetMemberId, callerMemberId, finals);
      setResult(res);
      onDone && onDone(res);
    } catch (e) {
      setErr(e.code === "permission-denied" ? "এই সদস্যের ওষুধ যোগ করার অনুমতি আপনার নেই।" : (e.message || String(e)));
    } finally { setBusy(false); }
  }, [busy, result, selected, familyId, targetMemberId, callerMemberId, onDone]);

  return h("div", { style: { marginTop: "10px" } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h("h4", { style: { margin: 0, fontSize: "16px", color: G } }, "💊 প্রেসক্রিপশন থেকে শনাক্ত"),
      ocrPercent != null && h("span", { style: { fontSize: "13px", fontWeight: 600, color: G, background: "#E4F0E9", borderRadius: "999px", padding: "2px 10px" } }, "OCR " + bn(ocrPercent) + "%")),
    h("div", { style: { margin: "8px 0 12px", padding: "10px 12px", borderRadius: "12px", background: "#FFF6E5", color: AMBER, fontSize: "14px", lineHeight: 1.5 } },
      bn(items.length) + "টি ওষুধ পাওয়া গেছে। যাচাই করে টিক দিন; ", h("b", null, "আপনি অনুমোদন না দিলে কিছুই সেভ হবে না।"), " কাটা (strike) ওষুধ থাকলে টিক তুলে দিন।"),
    rows.map((r, i) => card(r, i, update)),
    err && ErrorBox(err),
    result
      ? h("div", { role: "status", style: { marginTop: "12px", padding: "12px", borderRadius: "12px", background: "#E4F0E9", color: G, fontSize: "14px", lineHeight: 1.6 } },
          result.saved.length > 0 && h("div", null, "✓ " + bn(result.saved.length) + "টি ওষুধ যোগ হয়েছে: " + result.saved.join(", ") + " — রিমাইন্ডার দেখতে স্বাস্থ্য তথ্য → প্রেসক্রিপশন/রিপোর্ট।"),
          result.skipped.length > 0 && h("div", null, "ℹ️ আগে থেকেই ছিল, বাদ: " + result.skipped.join(", ")),
          result.failed.length > 0 && h("div", { style: { color: RED } }, "❌ যোগ হয়নি: " + result.failed.map((f) => f.name + " (" + f.message + ")").join(", ")))
      : PrimaryButton("অনুমোদন করে " + bn(selected.length) + "টি ঔষধ যোগ করুন", approve, busy),
    h("div", { style: { fontSize: "13px", color: MUTED, margin: "8px 2px", lineHeight: 1.5 } },
      "প্রেসক্রিপশনে যা লেখা শুধু সেটাই নেওয়া হয়; অ্যাপ নিজে ডোজ বানায় না। শুরুর তারিখ আজ ধরা হবে। এলার্জি-মিল শুধু নামে ধরা পড়ে — ব্র্যান্ড-নামে নাও পড়তে পারে।"));
}
