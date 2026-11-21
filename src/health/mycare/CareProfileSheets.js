// MyCare — Care Profile ফর্ম (সংরক্ষিত) ও "অন্যের জন্য" ফর্ম (শুধু মেমরি)। শুধু UI; SDK ছোঁয় না (data-layer: carePrefsData.js)।
import { L } from "../../shared/i18n.js";
import { Sheet, INPUT, Msg, primaryBtn } from "../tracker/PlanEditSheets.js";
import { ENUMS, LIMITS } from "./carePrefsSchema.js";
import { LABELS, AGE_BANDS } from "./careLabels.js";
import { splitIngredients } from "./careAdapter.js";

const { useState } = React;
const lbl = (group, id) => { const o = (LABELS[group] || {})[id]; return o ? L(o.bn, o.en) : id; };

// কমপ্যাক্ট চিপ (৩৮px; আগে ৪৪px) — নির্বাচিত হলে গাঢ় সবুজ। aria-pressed ও ✓ থাকায় শুধু রঙের উপর নির্ভর নয়।
const chipStyle = (on) => ({ minHeight: "38px", padding: "4px 12px", borderRadius: "999px", fontSize: "13.5px", fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "background .15s, box-shadow .15s",
  border: on ? "1px solid #0E4B43" : "1px solid #D5E0DA", background: on ? "linear-gradient(135deg, #0E4B43, #1F7A5C)" : "#fff", color: on ? "#fff" : "#2B3A36", boxShadow: on ? "0 2px 6px rgba(14,75,67,0.22)" : "none" });

// গ্রুপ-কার্ড: সম্পর্কিত প্রশ্ন এক কার্ডে, বাঁ-পাশে রঙিন দাগ
function Section({ title, color, children }) {
  return React.createElement("section", { style: { marginTop: "12px", padding: "2px 12px 12px", borderRadius: "16px", background: "#FBFDFC", border: "1px solid #E3ECE7", borderLeft: "4px solid " + color } },
    React.createElement("div", { style: { fontSize: "12.5px", fontWeight: 800, color, paddingTop: "10px" } }, title),
    children);
}

function ChipRow({ title, noneChip, options, group, value, multi, onChange, max }) {
  const sel = multi ? (value || []) : (value ? [value] : []);
  const toggle = (id) => {
    if (multi) {
      if (sel.includes(id)) onChange(sel.filter((x) => x !== id));
      else if (!max || sel.length < max) onChange([...sel, id]);
    } else onChange(sel[0] === id ? null : id);
  };
  return React.createElement("div", { style: { marginTop: "10px" } },
    React.createElement("div", { style: { fontSize: "13.5px", fontWeight: 700, color: "#1F2D2A", marginBottom: "6px" } }, title),
    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
      // "স্বাভাবিক" = সমস্যা নেই: শুধু দেখার চিপ, আলাদা কিছু সংরক্ষিত হয় না (তালিকা ফাঁকা = নেই)। schema/rules অপরিবর্তিত।
      noneChip && React.createElement("button", { key: "__none", type: "button", "aria-pressed": sel.length === 0, onClick: () => onChange([]), style: chipStyle(sel.length === 0) },
        (sel.length === 0 ? "✓ " : "") + L("স্বাভাবিক", "Normal")),
      options.map((id) => {
        const on = sel.includes(id);
        return React.createElement("button", { key: id, type: "button", onClick: () => toggle(id), "aria-pressed": on, style: chipStyle(on) },
          (on ? "✓ " : "") + (group ? lbl(group, id) : id));
      })));
}

// হ্যাঁ/না — আবার চাপলে অজানা (null)
function YesNoRow({ title, value, onChange }) {
  const opts = [[true, L("হ্যাঁ", "Yes")], [false, L("না", "No")]];
  return React.createElement("div", { style: { marginTop: "10px" } },
    React.createElement("div", { style: { fontSize: "13.5px", fontWeight: 700, color: "#1F2D2A", marginBottom: "6px" } }, title),
    React.createElement("div", { style: { display: "flex", gap: "6px" } },
      opts.map(([v, label]) => {
        const on = value === v;
        return React.createElement("button", { key: String(v), type: "button", "aria-pressed": on, onClick: () => onChange(on ? null : v),
          style: { ...chipStyle(on), flex: 1, borderRadius: "12px" } }, label);
      })));
}

const Note = (txt, tone) => React.createElement("div", { style: { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", fontSize: "13px", lineHeight: 1.5, background: tone === "warn" ? "#FFF6DD" : "#EEF3F0", border: "1px solid " + (tone === "warn" ? "#E8D08A" : "#D3DFD8"), color: tone === "warn" ? "#7A5B00" : "#2B3A36" } }, txt);

// ---- সংরক্ষিত যত্ন-প্রোফাইল ----
export function CareProfileSheet({ prefs, sex, onSave, onClose }) {
  const base = prefs || {};
  const [f, setF] = useState({
    skinType: base.skinType || null, hairType: base.hairType || null,
    skinConcerns: base.skinConcerns || [], hairConcerns: base.hairConcerns || [], oralConcerns: base.oralConcerns || [],
    breastfeeding: base.breastfeeding === true ? true : base.breastfeeding === false ? false : null,
    avoidText: (base.avoidIngredients || []).join(", "), preferences: base.preferences || [],
    region: base.region || null,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (busy) return; // double-tap রোধ
    setBusy(true); setErr("");
    try {
      await onSave({ ...f, avoidIngredients: splitIngredients(f.avoidText) });
      onClose();
    } catch (e) {
      setErr(L("সংরক্ষণ হয়নি। আবার চেষ্টা করুন।", "Could not save. Please try again."));
      setBusy(false);
    }
  };
  return React.createElement(Sheet, { title: "My Care Profile", subtitle: L("ঐচ্ছিক — বয়স, অ্যালার্জি, রোগ অ্যাপ থেকেই নেওয়া হয়", "Optional — age, allergies and conditions are read from the app automatically"), onClose, soft: true },
    React.createElement(Section, { title: L("ত্বক", "SKIN"), color: "#1F7A5C" },
    React.createElement(ChipRow, { title: L("ত্বকের ধরন", "Skin type"), options: ENUMS.skinType, group: "skinType", value: f.skinType, onChange: set("skinType") }),
    React.createElement(ChipRow, { title: L("ত্বকের সমস্যা", "Skin concerns"), noneChip: true, options: ENUMS.skinConcerns, group: "skinConcerns", value: f.skinConcerns, multi: true, max: LIMITS.concerns, onChange: set("skinConcerns") }),
    ),
    React.createElement(Section, { title: L("চুল", "HAIR"), color: "#3B7FC4" },
    React.createElement(ChipRow, { title: L("চুল/স্কাল্পের ধরন", "Hair/scalp type"), options: ENUMS.hairType, group: "hairType", value: f.hairType, onChange: set("hairType") }),
    React.createElement(ChipRow, { title: L("চুলের সমস্যা", "Hair concerns"), noneChip: true, options: ENUMS.hairConcerns, group: "hairConcerns", value: f.hairConcerns, multi: true, max: LIMITS.concerns, onChange: set("hairConcerns") }),
    ),
    React.createElement(Section, { title: L("দাঁত ও মুখ", "ORAL"), color: "#C9811F" },
    React.createElement(ChipRow, { title: L("দাঁত-মুখের সমস্যা", "Oral concerns"), noneChip: true, options: ENUMS.oralConcerns, group: "oralConcerns", value: f.oralConcerns, multi: true, max: LIMITS.concerns, onChange: set("oralConcerns") }),
    ),
    React.createElement(Section, { title: L("অন্যান্য", "MORE"), color: "#7A5BC4" },
    sex === "female" && React.createElement(YesNoRow, { title: L("বুকের দুধ খাওয়াচ্ছেন?", "Breastfeeding?"), value: f.breastfeeding, onChange: set("breastfeeding") }),
    React.createElement("div", { style: { marginTop: "10px" } },
      React.createElement("label", { htmlFor: "mc-avoid", style: { display: "block", fontSize: "13.5px", fontWeight: 700, color: "#1F2D2A", marginBottom: "6px" } }, L("এড়াতে চাওয়া উপাদান (কমা দিয়ে)", "Ingredients to avoid (comma separated)")),
      React.createElement("input", { id: "mc-avoid", type: "text", value: f.avoidText, onChange: (e) => set("avoidText")(e.target.value), maxLength: 400, style: INPUT, placeholder: L("যেমন: ল্যানোলিন, সুগন্ধি", "e.g. lanolin, fragrance") }),
      React.createElement("div", { style: { fontSize: "12.5px", color: "#5F716C", marginTop: "4px" } }, L("অ্যালার্জি আলাদা লাগবে না — তা অ্যাপের স্বাস্থ্য-রেকর্ড থেকেই নেওয়া হয়।", "No need to repeat allergies — they are read from health records."))),
    React.createElement(ChipRow, { title: L("পছন্দ", "Preference"), options: ENUMS.preferences, group: "preferences", value: f.preferences, multi: true, max: LIMITS.preferences, onChange: set("preferences") }),
    ),
    Note(L("পছন্দ শুধু ক্রমে সামান্য প্রভাব ফেলে; নিরাপত্তা বা প্রমাণ-স্তর বদলায় না।", "Preferences only nudge the order; they never override safety or evidence level.")),
    err && Msg(err, "err"),
    React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "16px" } }, primaryBtn(L("সংরক্ষণ করুন", "Save"), save, busy)));
}

// ---- "অন্যের জন্য দেখুন" — React state-এ মাত্র; Firestore/localStorage/log/AI-তে কিছু যায় না ----
export function OtherSheet({ initial, onApply, onClose }) {
  const [f, setF] = useState(initial || { sex: null, ageBand: null, skinType: null, hairType: null, allergyText: "", noAllergy: false, pregnantOrNursing: null });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const ready = !!f.ageBand;
  return React.createElement(Sheet, { title: L("অন্যের জন্য দেখুন", "View for someone else"), subtitle: L("অস্থায়ী — সংরক্ষিত হয় না", "Temporary — not saved"), onClose, soft: true },
    Note(L("অস্থায়ী — সংরক্ষিত হয় না। এই তথ্য ফোনের মেমরিতেই থাকে; পেজ ছাড়লে মুছে যায়।", "Temporary — not saved. Kept in memory only and cleared when you leave."), "warn"),
    React.createElement(ChipRow, { title: L("লিঙ্গ", "Sex"), options: ["male", "female"], group: "sex", value: f.sex, onChange: (v) => setF((s) => ({ ...s, sex: v, pregnantOrNursing: null })) }),
    React.createElement("div", { style: { marginTop: "14px" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: "#1F2D2A", marginBottom: "6px" } }, L("বয়স-পরিসর (বাধ্যতামূলক)", "Age range (required)")),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
        AGE_BANDS.map(([id, bn, en]) => {
          const on = f.ageBand === id;
          return React.createElement("button", { key: id, type: "button", "aria-pressed": on, onClick: () => set("ageBand")(id),
            style: chipStyle(on) }, (on ? "✓ " : "") + L(bn, en));
        }))),
    React.createElement(ChipRow, { title: L("ত্বকের ধরন", "Skin type"), options: ENUMS.skinType, group: "skinType", value: f.skinType, onChange: set("skinType") }),
    React.createElement(ChipRow, { title: L("চুলের ধরন", "Hair type"), options: ENUMS.hairType, group: "hairType", value: f.hairType, onChange: set("hairType") }),
    React.createElement("div", { style: { marginTop: "14px" } },
      React.createElement("label", { htmlFor: "mc-oth-allergy", style: { display: "block", fontSize: "14px", fontWeight: 700, color: "#1F2D2A", marginBottom: "6px" } }, L("অ্যালার্জি (নিজে লিখুন, কমা দিয়ে)", "Allergies (type, comma separated)")),
      React.createElement("input", { id: "mc-oth-allergy", type: "text", value: f.allergyText, maxLength: 400, onChange: (e) => set("allergyText")(e.target.value), style: INPUT, placeholder: L("যেমন: ল্যানোলিন, নারকেল তেল", "e.g. lanolin, coconut oil") }),
      React.createElement("button", { type: "button", "aria-pressed": f.noAllergy, onClick: () => set("noAllergy")(!f.noAllergy),
        style: { marginTop: "8px", minHeight: "44px", padding: "6px 14px", borderRadius: "12px", fontSize: "14px", fontWeight: f.noAllergy ? 800 : 600, cursor: "pointer", fontFamily: "inherit", border: f.noAllergy ? "1.5px solid var(--hs-primary, #0E4B43)" : "1px solid #C3D2CA", background: f.noAllergy ? "var(--hs-chip-bg, #E4F0E9)" : "#fff", color: "#2B3A36" } },
        (f.noAllergy ? "✓ " : "") + L("কোনো অ্যালার্জি নেই (নিশ্চিত)", "No allergies (confirmed)"))),
    f.sex === "female" && React.createElement(YesNoRow, { title: L("গর্ভবতী বা বুকের দুধ খাওয়াচ্ছেন?", "Pregnant or breastfeeding?"), value: f.pregnantOrNursing, onChange: set("pregnantOrNursing") }),
    Note(L("অ্যালার্জি না লিখলে বা নিশ্চিত না করলে শুধু সবচেয়ে নিরাপদ সাধারণ পরামর্শ দেখানো হয়।", "If allergies are not entered or confirmed, only the safest basic advice is shown.")),
    React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "16px" } }, primaryBtn(L("দেখুন", "Show"), () => { onApply(f); onClose(); }, false, !ready)));
}
