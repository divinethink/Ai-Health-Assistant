// ট্র্যাকার ধাপ B-২ — "বদলান" শিট (শুধু UI; সংরক্ষণের কাজ বাবা-কম্পোনেন্ট TrackerPageSection-এ)।
// তিনটি শিট: MealEditSheet (বেলা), ExerciseEditSheet (দিনের রুটিন), ExerciseLogSheet ("আজ আসলে")।
// দুই মোড: "প্রতিদিনের জন্য" = goal-ডকের planPrefs (স্থায়ী); "আজ শুধু" = daily-ডকের extraFoods (শুধু মিল)।
// খসড়া-হিসাব ও যাচাই planPrefs.js-এর pure ফাংশনে — এখানে শুধু দেখানো ও ট্যাপ।

import { TabPills } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { FOODS, itemText, qtyText } from "./mealPlanData.js";
import { medFoodNotes } from "./medFoodNotes.js";
import { FOOD_GROUPS, TAGS, POS_TAGS, searchFoods, tagsOf, posTagsOf } from "./foodCatalog.js";
import {
  EXERCISE_TYPES, MAX_QTY, MAX_EX_MIN, MIN_EX_MIN, MAX_KCAL, exerciseOptions, mealWarnings, exerciseWarnings,
  draftFromSlotItems, addDraftFood, changeDraftQty, removeDraftAt, draftKcal,
  draftFromDayItems, addDraftExercise, changeDraftMin, draftDayMinutes,
  checkExtraFood,
} from "./planPrefs.js";

const { useState, useEffect, useRef } = React;

export const EX_ICON = { walk: "🚶", run: "🏃", cycling: "🚴", gym: "🏋️", sports: "⚽", swim: "🏊", yoga: "🧘", other: "➕", stretch: "🧘" };

const GREEN = "#0E4B43";
const MUTED = "#5F716C";
const BTN = { minHeight: "44px", minWidth: "44px", borderRadius: "12px", cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 700 };
const TAG_CHIP = { marginLeft: "6px", padding: "1px 7px", borderRadius: "999px", background: "#FFF0D6", border: "1px solid #EBD9B4", color: "#7A5200", fontSize: "11px", fontWeight: 700 };
const POS_CHIP = { marginLeft: "6px", padding: "1px 7px", borderRadius: "999px", background: "#E4F0E9", border: "1px solid #9CC5B4", color: "#0E4B43", fontSize: "11px", fontWeight: 700 };
const INPUT = { width: "100%", boxSizing: "border-box", minHeight: "44px", padding: "10px 12px", border: "1.5px solid #C3D2CA", borderRadius: "12px", fontSize: "14px", fontFamily: "inherit" };

function Sheet({ title, subtitle, onClose, children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    if (ref.current) ref.current.focus();
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (prev && prev.focus) prev.focus(); };
  }, []);
  return React.createElement("div", {
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
    style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(20,28,26,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" },
  },
    React.createElement("div", {
      ref, role: "dialog", "aria-modal": "true", "aria-label": title, tabIndex: -1,
      style: { width: "100%", maxWidth: "520px", maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", background: "#fff", borderRadius: "20px 20px 0 0", padding: "16px 16px calc(20px + env(safe-area-inset-bottom, 0px))", outline: "none", fontFamily: "'Hind Siliguri', sans-serif" },
    },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "10px" } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontSize: "17px", fontWeight: 700, color: "#1F2D2A" } }, title),
          subtitle && React.createElement("div", { style: { fontSize: "13px", color: MUTED, marginTop: "2px" } }, subtitle)),
        React.createElement("button", { onClick: onClose, "aria-label": "বন্ধ করুন", style: { ...BTN, border: "none", background: "#EEF3F0", color: "#1F2D2A", fontSize: "18px" } }, "✕")),
      children));
}

const Msg = (txt, tone) => React.createElement("div", {
  role: tone === "err" ? "alert" : undefined,
  style: { marginTop: "10px", padding: "10px 12px", borderRadius: "12px", fontSize: "13px", lineHeight: 1.5,
    background: tone === "err" ? "#FDECEA" : "#FFF6DD", border: "1px solid " + (tone === "err" ? "#E5A29A" : "#E8D08A"), color: tone === "err" ? "#7A1F14" : "#7A5B00" },
}, txt);

function Stepper(text, onDec, onInc, decDisabled, incDisabled, what) {
  return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
    React.createElement("button", { onClick: onDec, disabled: decDisabled, "aria-label": what + " কমান", style: { ...BTN, border: "none", background: "#E4ECE7", color: GREEN, opacity: decDisabled ? 0.4 : 1 } }, "−"),
    React.createElement("span", { style: { minWidth: "52px", textAlign: "center", fontSize: "14px", fontWeight: 700, color: "#1F2D2A" } }, text),
    React.createElement("button", { onClick: onInc, disabled: incDisabled, "aria-label": what + " বাড়ান", style: { ...BTN, border: "none", background: "#E4ECE7", color: GREEN, opacity: incDisabled ? 0.4 : 1 } }, "+"));
}

const primaryBtn = (label, onClick, busy, disabled) => React.createElement("button", {
  onClick, disabled: busy || disabled,
  style: { ...BTN, flex: 1, border: "none", background: busy || disabled ? "#8FAFA9" : GREEN, color: "#fff", cursor: busy || disabled ? "default" : "pointer" },
}, busy ? "অপেক্ষা করুন..." : label);
const ghostBtn = (label, onClick, busy, disabled) => React.createElement("button", {
  onClick, disabled: busy || disabled,
  style: { ...BTN, flex: 1, border: "1.5px solid " + GREEN, background: "#fff", color: GREEN, opacity: busy || disabled ? 0.5 : 1 },
}, label);

// খাবার খোঁজা: নাম-সার্চ + গ্রুপ-পিল; এলার্জির খাবার তালিকায় আসে না। শুধু দেখানো ও ট্যাপ — হিসাব foodCatalog/planPrefs-এ।
// props: allergyTags, onPick(key), blockedNote (ঐচ্ছিক)
function FoodPicker({ allergyTags, onPick }) {
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState("");
  const found = searchFoods(FOODS, { query: q, group: grp, allergyTags, limit: 40 });
  return React.createElement("div", null,
    React.createElement("input", { type: "search", value: q, onChange: (e) => setQ(e.target.value), placeholder: "খাবার খুঁজুন (যেমন: ইলিশ, আম)", "aria-label": "খাবার খুঁজুন", style: INPUT }),
    React.createElement("div", { style: { margin: "8px 0" } }, TabPills([["", "সব"], ...FOOD_GROUPS], grp, setGrp)),
    found.length === 0 && React.createElement("div", { style: { fontSize: "13px", color: MUTED, padding: "6px 0" } }, "কিছু পাওয়া যায়নি। নিজের খাবার ‘আজ শুধু’-তে নাম ও কিলোক্যালরি দিয়ে যোগ করা যায়।"),
    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
      found.map(({ key, f }) => React.createElement("button", {
        key, onClick: () => onPick(key),
        style: { ...BTN, fontWeight: 600, padding: "6px 12px", border: "1px solid #C3D2CA", background: "#F1F6F2", color: "#1F2D2A" },
      }, "+ " + f.n + " · " + bnNum(f.k), posTagsOf(key).map((t) => React.createElement("span", { key: t, style: POS_CHIP }, POS_TAGS[t][0])), tagsOf(f).map((t) => React.createElement("span", { key: t, style: TAG_CHIP }, TAGS[t][0]))))),
    found.some(({ key }) => posTagsOf(key).length > 0) && React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "6px" } }, "সবুজ চিপ = প্রোটিন/আঁশের সাধারণ উৎস (শুধু তথ্য)।"),
    found.some(({ f }) => tagsOf(f).length > 0) && React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "6px" } }, "হলুদ চিপ = সাধারণ সতর্কতা (ব্লক নয়); ডাক্তার/ডায়েটিশিয়ানের নির্দেশ প্রাধান্য পায়।"),
    found.length >= 40 && React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "6px" } }, "আরও দেখতে নাম লিখে খুঁজুন বা গ্রুপ বাছুন।"),
    React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "6px" } }, "সংখ্যা = এক ইউনিটের আনুমানিক কিলোক্যালরি; রান্না ও পরিমাণে বদলায়।"));
}

const MODES = [["perm", "প্রতিদিনের জন্য"], ["today", "আজ শুধু"]];

// ---------- মিল: একটি বেলা ----------
// props: slot (কার্যকর প্ল্যানের বেলা), planTotal, target, sex, allergyTags, isCustom, extras [{name,kcal,idx}] (এই বেলার আজকের নিজের খাবার),
// extraCount (আজকের মোট নিজের-খাবার), recentFoods [{name,kcal,count}] (গত ৭ দিনের সেরা, ঐচ্ছিক), activeMeds [নাম] (সক্রিয় ওষুধ, ঐচ্ছিক), busy, err, onSavePerm(draft), onReset(), onAddExtra(name,kcal), onRemoveExtra(idx), onClose
export function MealEditSheet({ slot, planTotal, target, sex, allergyTags, isCustom, extras, extraCount, recentFoods, activeMeds, busy, err, onSavePerm, onReset, onAddExtra, onRemoveExtra, onClose }) {
  const [mode, setMode] = useState("perm");
  const [draft, setDraft] = useState(() => draftFromSlotItems(slot.items));
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [formErr, setFormErr] = useState(null);
  const [pickQty, setPickQty] = useState(1);
  const [pickedKey, setPickedKey] = useState(null); // "আজ শুধু"-তে তালিকা থেকে বাছা খাবার (ওষুধ-নোটের জন্য)
  const newSlot = draftKcal(draft);
  const newTotal = planTotal - slot.kcal + newSlot;
  const warnings = mealWarnings(newTotal, { sex, target });

  const submitExtra = () => {
    const e = checkExtraFood(name, kcal, extraCount);
    setFormErr(e);
    if (e) return;
    onAddExtra(name.replace(/\s+/g, " ").trim(), Number(kcal));
    setName(""); setKcal(""); setPickedKey(null);
  };

  const addRecent = (r) => {
    const e = checkExtraFood(r.name, r.kcal, extraCount);
    setFormErr(e);
    if (e) return;
    onAddExtra(r.name, r.kcal);
  };

  return React.createElement(Sheet, { title: slot.label + " বদলান", subtitle: "ক্যালরি আনুমানিক", onClose },
    TabPills(MODES, mode, setMode),
    mode === "perm" && React.createElement("div", null,
      draft.length === 0 && React.createElement("div", { style: { fontSize: "13px", color: MUTED, padding: "6px 0" } }, "এই বেলায় কোনো খাবার নেই (বেলা বাদ)। নিচ থেকে খাবার যোগ করুন।"),
      draft.map((r, i) => React.createElement("div", { key: r.food, style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #EEF3F0" } },
        React.createElement("div", { style: { flex: 1, fontSize: "14px", color: "#1F2D2A" } }, itemText(r.food, r.qty),
          React.createElement("div", { style: { fontSize: "12px", color: MUTED } }, bnNum(Math.round(FOODS[r.food].k * r.qty)) + " কিলোক্যালরি"),
          tagsOf(FOODS[r.food]).map((t) => React.createElement("div", { key: t, style: { fontSize: "12px", color: "#7A5200", marginTop: "2px" } }, "⚠ " + TAGS[t][1])),
          medFoodNotes(activeMeds, r.food).map((n) => React.createElement("div", { key: n.rule + n.med, style: { fontSize: "12px", color: "#7A5200", marginTop: "2px", fontWeight: 600 } }, "💊 " + n.text))),
        Stepper(qtyText(r.qty), () => setDraft(changeDraftQty(draft, i, -0.5)), () => setDraft(changeDraftQty(draft, i, 0.5)), r.qty <= 0.5, r.qty >= MAX_QTY, FOODS[r.food].n),
        React.createElement("button", { onClick: () => setDraft(removeDraftAt(draft, i)), "aria-label": FOODS[r.food].n + " বাদ দিন", style: { ...BTN, border: "none", background: "#FDECEA", color: "#7A1F14" } }, "✕"))),
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1F2D2A", margin: "12px 0 6px" } }, "খাবার যোগ করুন"),
      React.createElement(FoodPicker, { allergyTags, onPick: (key) => setDraft(addDraftFood(draft, key)) }),
      React.createElement("div", { style: { marginTop: "12px", padding: "10px 12px", borderRadius: "12px", background: "#E4F0E9", fontSize: "14px", color: GREEN, display: "flex", justifyContent: "space-between", gap: "8px" } },
        React.createElement("span", null, "নতুন মোট (" + slot.label + ")"),
        React.createElement("b", null, bnNum(slot.kcal) + " → " + bnNum(newSlot) + " কিলোক্যালরি")),
      React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "4px" } }, "সারাদিনের প্ল্যান: " + bnNum(newTotal) + (target ? " / টার্গেট " + bnNum(target) : "") + " কিলোক্যালরি"),
      warnings.map((w, i) => React.createElement("div", { key: i }, Msg(w, "warn"))),
      err && Msg(err, "err"),
      React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "14px" } },
        ghostBtn("ডিফল্টে ফিরুন", onReset, busy, !isCustom),
        primaryBtn("সংরক্ষণ করুন", () => onSavePerm(draft), busy)),
      React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "8px", textAlign: "center" } }, "এই বদল প্রতিদিনের প্ল্যানে থাকবে।")),
    mode === "today" && React.createElement("div", null,
      React.createElement("div", { style: { fontSize: "13px", color: MUTED, marginBottom: "8px", lineHeight: 1.5 } }, "প্ল্যানের বাইরে আজ যা খেয়েছেন তা যোগ করুন — শুধু আজকের হিসাবে যাবে, প্ল্যান বদলাবে না।"),
      extras.length === 0 && React.createElement("div", { style: { fontSize: "13px", color: MUTED, padding: "4px 0" } }, "এই বেলায় আজ নিজের কোনো খাবার যোগ করা হয়নি।"),
      extras.map((x) => React.createElement("div", { key: x.idx, style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #EEF3F0" } },
        React.createElement("div", { style: { flex: 1, fontSize: "14px", color: "#1F2D2A" } }, x.name + " · " + bnNum(x.kcal) + " কিলোক্যালরি"),
        React.createElement("button", { onClick: () => onRemoveExtra(x.idx), disabled: busy, "aria-label": x.name + " মুছুন", style: { ...BTN, border: "none", background: "#FDECEA", color: "#7A1F14" } }, "✕"))),
      Array.isArray(recentFoods) && recentFoods.length > 0 && React.createElement("div", null,
        React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1F2D2A", margin: "10px 0 6px" } }, "সাম্প্রতিক খাবার (গত ৭ দিন) — ট্যাপে যোগ"),
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
          recentFoods.map((r) => React.createElement("button", {
            key: r.name, onClick: () => addRecent(r), disabled: busy, "aria-label": r.name + " আজকের জন্য যোগ করুন",
            style: { ...BTN, fontWeight: 600, padding: "6px 12px", border: "1px solid #C3D2CA", background: "#F1F6F2", color: "#1F2D2A", opacity: busy ? 0.5 : 1 },
          }, "+ " + r.name + " · " + bnNum(r.kcal))))),
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1F2D2A", margin: "10px 0 6px" } }, "তালিকা থেকে বাছুন (ঐচ্ছিক)"),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
        React.createElement("span", { style: { fontSize: "13px", color: MUTED } }, "পরিমাণ"),
        Stepper(qtyText(pickQty), () => setPickQty(Math.max(0.5, pickQty - 0.5)), () => setPickQty(Math.min(MAX_QTY, pickQty + 0.5)), pickQty <= 0.5, pickQty >= MAX_QTY, "পরিমাণ")),
      React.createElement(FoodPicker, { allergyTags, onPick: (key) => { setName(itemText(key, pickQty)); setKcal(String(Math.round(FOODS[key].k * pickQty))); setFormErr(null); setPickedKey(key); } }),
      pickedKey && medFoodNotes(activeMeds, pickedKey).map((n) => React.createElement("div", { key: n.rule + n.med, style: { fontSize: "12px", color: "#7A5200", marginTop: "6px", fontWeight: 600 } }, "💊 " + n.text)),
      React.createElement("label", { style: { display: "block", fontSize: "13px", fontWeight: 600, color: "#1F2D2A", margin: "12px 0 4px" } }, "খাবারের নাম"),
      React.createElement("input", { type: "text", maxLength: 40, value: name, onChange: (e) => { setName(e.target.value); setPickedKey(null); }, style: INPUT }),
      React.createElement("label", { style: { display: "block", fontSize: "13px", fontWeight: 600, color: "#1F2D2A", margin: "10px 0 4px" } }, "কিলোক্যালরি (আনুমানিক, ০–" + bnNum(MAX_KCAL) + ")"),
      React.createElement("input", { type: "number", inputMode: "numeric", min: 0, max: MAX_KCAL, value: kcal, onChange: (e) => setKcal(e.target.value), style: INPUT }),
      formErr && Msg(formErr, "err"),
      err && Msg(err, "err"),
      React.createElement("div", { style: { display: "flex", marginTop: "14px" } }, primaryBtn("আজকের জন্য যোগ করুন", submitExtra, busy))));
}

// ---------- ব্যায়াম: একটি দিনের রুটিন ----------
// props: dayLabel, items (কার্যকর রুটিনের ওই দিনের আইটেম), isCustom, busy, err, onSave(draft), onReset(), onClose
export function ExerciseEditSheet({ dayLabel, items, isCustom, busy, err, onSave, onReset, onClose }) {
  const [draft, setDraft] = useState(() => draftFromDayItems(items));
  const warnings = exerciseWarnings({ routine: [draft], band: "x" }, 0);
  return React.createElement(Sheet, { title: dayLabel + " — ব্যায়াম বদলান", subtitle: "প্রতি সপ্তাহের এই দিনের রুটিন", onClose },
    draft.length === 0 && React.createElement("div", { style: { fontSize: "13px", color: MUTED, padding: "6px 0" } }, "এই দিন বিশ্রাম। নিচ থেকে ব্যায়াম যোগ করুন।"),
    draft.map((r, i) => React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #EEF3F0" } },
      React.createElement("div", { style: { flex: 1, fontSize: "14px", color: "#1F2D2A" } }, (EX_ICON[r.type] || "") + " " + EXERCISE_TYPES[r.type].label,
        !EXERCISE_TYPES[r.type].counted && React.createElement("div", { style: { fontSize: "12px", color: MUTED } }, "সাপ্তাহিক গণনায় নয়")),
      Stepper(bnNum(r.min) + " মি.", () => setDraft(changeDraftMin(draft, i, -5)), () => setDraft(changeDraftMin(draft, i, 5)), r.min <= MIN_EX_MIN, r.min >= MAX_EX_MIN, EXERCISE_TYPES[r.type].label + " মিনিট"),
      React.createElement("button", { onClick: () => setDraft(removeDraftAt(draft, i)), "aria-label": EXERCISE_TYPES[r.type].label + " বাদ দিন", style: { ...BTN, border: "none", background: "#FDECEA", color: "#7A1F14" } }, "✕"))),
    React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1F2D2A", margin: "12px 0 6px" } }, "ব্যায়াম যোগ করুন"),
    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
      exerciseOptions().map((o) => React.createElement("button", {
        key: o.type, onClick: () => setDraft(addDraftExercise(draft, o.type)),
        style: { ...BTN, fontWeight: 600, padding: "6px 12px", border: "1px solid #C3D2CA", background: "#F1F6F2", color: "#1F2D2A" },
      }, "+ " + (EX_ICON[o.type] || "") + " " + o.label))),
    React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "8px" } }, "এই দিনের মোট: " + bnNum(draftDayMinutes(draft)) + " মিনিট"),
    warnings.map((w, i) => React.createElement("div", { key: i }, Msg(w, "warn"))),
    err && Msg(err, "err"),
    React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "14px" } },
      ghostBtn("ডিফল্টে ফিরুন", onReset, busy, !isCustom),
      primaryBtn("সংরক্ষণ করুন", () => onSave(draft), busy)));
}

// ---------- ব্যায়াম: "আজ আসলে কী করলেন?" ----------
// props: initialType, entries (আজকের exerciseLog), busy, err, onAdd(type, min), onRemove(i), onClose
export function ExerciseLogSheet({ initialType, entries, busy, err, onAdd, onRemove, onClose }) {
  const [type, setType] = useState(initialType || "other");
  const [min, setMin] = useState(30);
  return React.createElement(Sheet, { title: "আজ আসলে কী করলেন?", subtitle: "শুধু আজকের হিসাবে যোগ হবে", onClose },
    entries.length > 0 && React.createElement("div", { style: { marginBottom: "8px" } },
      entries.map((x, i) => React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #EEF3F0" } },
        React.createElement("div", { style: { flex: 1, fontSize: "14px", color: "#1F2D2A" } }, (EX_ICON[x.type] || "") + " " + EXERCISE_TYPES[x.type].label + " · " + bnNum(x.min) + " মিনিট"),
        React.createElement("button", { onClick: () => onRemove(i), disabled: busy, "aria-label": EXERCISE_TYPES[x.type].label + " মুছুন", style: { ...BTN, border: "none", background: "#FDECEA", color: "#7A1F14" } }, "✕")))),
    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
      exerciseOptions().map((o) => React.createElement("button", {
        key: o.type, onClick: () => setType(o.type), "aria-pressed": type === o.type,
        style: { ...BTN, fontWeight: 600, padding: "6px 12px", border: "1.5px solid " + (type === o.type ? GREEN : "#C3D2CA"), background: type === o.type ? GREEN : "#F1F6F2", color: type === o.type ? "#fff" : "#1F2D2A" },
      }, (EX_ICON[o.type] || "") + " " + o.label))),
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" } },
      React.createElement("span", { style: { fontSize: "14px", fontWeight: 700, color: "#1F2D2A" } }, "কতক্ষণ"),
      Stepper(bnNum(min) + " মি.", () => setMin(Math.max(MIN_EX_MIN, min - 5)), () => setMin(Math.min(MAX_EX_MIN, min + 5)), min <= MIN_EX_MIN, min >= MAX_EX_MIN, "মিনিট")),
    err && Msg(err, "err"),
    React.createElement("div", { style: { display: "flex", marginTop: "14px" } }, primaryBtn("যোগ করুন", () => onAdd(type, min), busy)));
}
