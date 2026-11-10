// আজ ট্যাব — খাবার-লগ শিট (ধাপ ২)। শুধু UI; হিসাব foodCalc.js (pure), সংরক্ষণ বাবা (TodayTab) করে।
// ধাপ: ১) বেলা বাছাই + খাবার খোঁজা (বিদ্যমান FoodPicker: ✓/!/✕ স্ট্যাটাস, এলার্জি-সতর্কতা) ২) পরিমাণ (মাপ বা গ্রাম) + লাইভ ক্যালরি/ম্যাক্রো → যোগ।
// ✕ (এড়ানো/এলার্জি) হলে ব্লক নয় — সতর্কতা দেখিয়ে "তবু যোগ করুন"। ওষুধ-নোট বিদ্যমান medFoodNotes থেকে।

import { TabPills } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { foodEnglish } from "../../shared/searchAliases.js";
import { FOODS, MEAL_SLOTS, hasFoodOverride, foodK } from "./mealPlanData.js";
import { medFoodNotes } from "./medFoodNotes.js";
import { foodStatus, STATUS_COLORS } from "./foodStatus.js";
import { MAX_QTY, MAX_LIST } from "./planPrefs.js";
import { nutritionOf } from "./foodNutrition.js";
import { per100Of, measuresOf, buildFoodEntry, buildOwnFoodEntry, slotForNow, fmtMacro, entryAmountText, MAX_MEASURE_QTY } from "./foodCalc.js";
import { Sheet, FoodPicker, Msg, BTN, INPUT, primaryBtn } from "./PlanEditSheets.js";

const { useState } = React;

const GREEN = "#0E4B43";
const MUTED = "#5F716C";
const chip = (on) => ({ ...BTN, fontWeight: 600, padding: "6px 12px", border: "1.5px solid " + (on ? GREEN : "#C3D2CA"), background: on ? GREEN : "#fff", color: on ? "#fff" : "#1F2D2A" });
const MACROS = [["প্রোটিন", "p", "#2FAE6B"], ["কার্ব", "c", "#E88A2D"], ["ফ্যাট", "f", "#7C69C9"], ["ফাইবার", "fib", "#3B8ED8"]];

// props: allergyTags, avoidCtx, activeMeds, count (আজ নিজে-যোগ-করা মোট), slotBudgets (ঐচ্ছিক, foodCalc.slotBudgets), recent (ঐচ্ছিক, foodCalc.recentFoodEntries), busy, err, onAdd(entry) → Promise<boolean>, onClose
export function FoodLogSheet({ initialSlot, allergyTags, avoidCtx, activeMeds, count, slotBudgets, recent, busy, err, onAdd, onClose }) {
  const [slot, setSlot] = useState(initialSlot || slotForNow());
  const [key, setKey] = useState(null);
  const [measureId, setMeasureId] = useState(null); // measure id | "g" (গ্রাম)
  const [qty, setQty] = useState(1);
  const [gramsText, setGramsText] = useState("");
  const [notice, setNotice] = useState(null);
  const [own, setOwn] = useState(null); // null = বন্ধ; অবজেক্ট = "নিজে যোগ করুন" ফর্ম
  const [ownErr, setOwnErr] = useState(null);
  const slotLabel = (MEAL_SLOTS.find((s) => s.id === slot) || {}).label;
  const full = count >= MAX_LIST;
  const budget = slotBudgets && slotBudgets[slot];

  const pick = (k) => {
    const ms = measuresOf(k);
    setKey(k); setNotice(null); setQty(1);
    setMeasureId(ms.length && !hasFoodOverride(k) ? ms[0].id : null);
    setGramsText(ms.length ? String(ms[0].g) : "");
  };
  const back = () => { setKey(null); };

  // সাম্প্রতিক খাবার: ✕ (এড়ানো/এলার্জি) স্ট্যাটাসের খাবার ১-ট্যাপে দেওয়া হয় না — খুঁজে সতর্কতাসহ যোগ করতে হবে।
  const quick = (Array.isArray(recent) ? recent : []).filter((e) => {
    const f0 = e.key && FOODS[e.key];
    return !f0 || foodStatus(e.key, f0, { allergyTags, ctx: avoidCtx }).level !== "red";
  });
  const quickAdd = async (e) => {
    if (busy || full) return;
    const ok = await onAdd({ ...e, slot });
    if (ok) setNotice("✓ " + e.name + " যোগ হয়েছে (" + slotLabel + ")");
  };

  // ---------- নিজে যোগ করুন (খাবার ডেটায় না পেলে) ----------
  if (!key && own) {
    const setF = (k) => (e) => setOwn({ ...own, [k]: e.target.value });
    const field = (label, k, ph, mode) => React.createElement("div", { style: { flex: 1, minWidth: "40%" } },
      React.createElement("label", { style: { display: "block", fontSize: "13px", color: MUTED, margin: "8px 0 4px" } }, label),
      React.createElement("input", { type: mode === "text" ? "text" : "number", inputMode: mode === "text" ? "text" : "decimal", min: 0, step: "any", value: own[k], onChange: setF(k), placeholder: ph, "aria-label": label, style: INPUT }));
    const saveOwn = async () => {
      const r = buildOwnFoodEntry(slot, own, count);
      if (r.error) { setOwnErr(r.error); return; }
      setOwnErr(null);
      const ok = await onAdd(r.entry);
      if (ok) { setNotice("✓ " + r.entry.name + " যোগ হয়েছে (" + slotLabel + ") — পরে ‘সাম্প্রতিক’-এ ১ ট্যাপে পাবেন"); setOwn(null); }
    };
    return React.createElement(Sheet, { title: "নিজে যোগ করুন", subtitle: slotLabel + " · আপনার দেওয়া আনুমানিক মান", onClose },
      React.createElement("button", { onClick: () => { setOwn(null); setOwnErr(null); }, style: { ...BTN, border: "none", background: "#EEF3F0", color: GREEN, marginBottom: "6px" } }, "← খাবার খুঁজুন"),
      field("খাবারের নাম (যেমন: মায়ের হাতের খিচুড়ি)", "name", "নাম", "text"),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
        field("কিলোক্যালরি (বাধ্যতামূলক)", "kcal", "০–৩০০০"), field("গ্রাম (ঐচ্ছিক)", "grams", "যেমন ২৫০")),
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1F2D2A", marginTop: "12px" } }, "ম্যাক্রো, গ্রামে (ঐচ্ছিক)"),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" } },
        field("প্রোটিন", "p", "০"), field("কার্ব", "c", "০"), field("ফ্যাট", "f", "০"), field("ফাইবার", "fib", "০")),
      React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "8px", lineHeight: 1.5 } }, "ম্যাক্রোর কোনো একটি দিলে ফাঁকা ঘর ০ ধরা হবে। না জানলে খালি রাখুন — শুধু কিলোক্যালরি ধরা হবে।"),
      (ownErr || err) && Msg(ownErr || err, "err"),
      full && Msg("আজকের জন্য নিজে-যোগ-করা খাবারের সীমা (" + bnNum(MAX_LIST) + "টি) পূর্ণ। আগের কোনোটি মুছুন।", "warn"),
      React.createElement("div", { style: { position: "sticky", bottom: 0, display: "flex", gap: "8px", marginTop: "14px", padding: "10px 0 env(safe-area-inset-bottom, 0px)", background: "#fff" } },
        primaryBtn("যোগ করুন (" + slotLabel + ")", saveOwn, busy, full)));
  }

  // ---------- ধাপ ১: খোঁজা ----------
  if (!key) {
    return React.createElement(Sheet, { title: "খাবার যোগ করুন", subtitle: "কোন বেলায়? · আনুমানিক, গড় রেসিপি অনুযায়ী", onClose },
      TabPills(MEAL_SLOTS.map((s) => [s.id, s.label]), slot, setSlot),
      budget && React.createElement("div", { style: { fontSize: "13px", color: MUTED, margin: "-6px 0 10px" } }, slotLabel + ": " + bnNum(budget.eaten) + " / " + bnNum(budget.planned) + " কিলোক্যালরি (প্ল্যানের তথ্য; বেশি হলেও বাধা নেই)"),
      notice && React.createElement("div", { role: "status", style: { padding: "8px 12px", borderRadius: "12px", background: "#E4F0E9", border: "1px solid #9CC5B4", color: GREEN, fontSize: "13px", fontWeight: 600, marginBottom: "8px" } }, notice),
      full && Msg("আজকের জন্য নিজে-যোগ-করা খাবারের সীমা (" + bnNum(MAX_LIST) + "টি) পূর্ণ। নতুন যোগ করতে আগের কোনোটি মুছুন।", "warn"),
      quick.length > 0 && React.createElement("div", { style: { marginBottom: "10px" } },
        React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1F2D2A", marginBottom: "6px" } }, "সাম্প্রতিক · ১ ট্যাপে " + slotLabel + "-এ যোগ"),
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
          quick.map((e) => React.createElement("button", { key: e.name, onClick: () => quickAdd(e), disabled: busy || full, "aria-label": e.name + " " + slotLabel + "-এ যোগ করুন", style: { ...chip(false), opacity: busy || full ? 0.5 : 1 } },
            "＋ " + e.name + (entryAmountText(e) ? " (" + entryAmountText(e) + ")" : "") + " · " + bnNum(e.kcal))))),
      React.createElement(FoodPicker, { allergyTags, avoidCtx, onPick: pick, layout: "list" }),
      React.createElement("button", { onClick: () => { setNotice(null); setOwn({ name: "", kcal: "", grams: "", p: "", c: "", f: "", fib: "" }); }, disabled: full,
        style: { ...BTN, width: "100%", marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px", border: "none", background: "#E4F0E9", color: GREEN, opacity: full ? 0.5 : 1 } },
        React.createElement("span", { style: { fontWeight: 500, color: MUTED } }, "খুঁজে পাচ্ছেন না?"), React.createElement("span", null, "নিজে যোগ করুন →")),
      React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "14px" } },
        React.createElement("button", { onClick: onClose, style: { ...BTN, flex: 1, border: "1.5px solid " + GREEN, background: "#fff", color: GREEN } }, "শেষ করুন")));
  }

  // ---------- ধাপ ২: পরিমাণ ----------
  const f = FOODS[key];
  const nut = nutritionOf(key);
  const unitMode = !nut || hasFoodOverride(key);
  const ms = measuresOf(key);
  const entry = buildFoodEntry(key, slot, unitMode ? { qty } : { measureId, qty, grams: gramsText });
  const st = foodStatus(key, f, { allergyTags, ctx: avoidCtx });
  const sc = STATUS_COLORS[st.level];
  const notes = medFoodNotes(activeMeds, key);
  const p100 = per100Of(key);
  const gramMode = measureId === "g";
  const maxQty = unitMode ? MAX_QTY : MAX_MEASURE_QTY;
  const step = (d) => setQty((q) => Math.max(0.5, Math.round((q + d) * 2) / 2));
  const incOk = !gramMode && qty + 0.5 <= maxQty && (unitMode || buildFoodEntry(key, slot, { measureId, qty: qty + 0.5 }));

  const submit = async () => {
    if (!entry || busy || full) return;
    const ok = await onAdd(entry);
    if (ok) { setNotice("✓ " + f.n + " যোগ হয়েছে (" + slotLabel + ")"); setKey(null); }
  };

  return React.createElement(Sheet, { title: f.n, subtitle: foodEnglish(key, f) + " · " + slotLabel, onClose },
    React.createElement("button", { onClick: back, style: { ...BTN, border: "none", background: "#EEF3F0", color: GREEN, marginBottom: "10px" } }, "← অন্য খাবার"),
    React.createElement("div", { style: { padding: "8px 12px", borderRadius: "12px", border: "1px solid " + sc.border, background: sc.bg, color: st.level === "green" ? "#1F2D2A" : sc.text, fontSize: "13px", marginBottom: "10px" } },
      React.createElement("b", null, st.icon + " " + st.label), st.reasons.length > 0 && " — " + st.reasons.join("; ")),
    notes.map((n, i) => React.createElement("div", { key: "n" + i, style: { padding: "8px 12px", borderRadius: "12px", background: "#FFF6DD", border: "1px solid #E8D08A", color: "#7A5B00", fontSize: "13px", lineHeight: 1.5, marginBottom: "8px" } }, "💊 " + n.text)),

    React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: "#1F2D2A", margin: "6px 0" } }, "পরিমাণ ও মাপ"),
    !unitMode && React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" } },
      ms.map((m) => React.createElement("button", { key: m.id, onClick: () => { setMeasureId(m.id); setQty(1); }, style: chip(measureId === m.id) }, "১ " + m.label + " ≈ " + bnNum(m.g) + " গ্রাম")),
      React.createElement("button", { onClick: () => { setMeasureId("g"); if (entry && entry.grams) setGramsText(String(entry.grams)); }, style: chip(gramMode) }, "গ্রাম")),
    gramMode
      ? React.createElement("div", null,
        React.createElement("label", { style: { display: "block", fontSize: "13px", color: MUTED, margin: "2px 0 4px" } }, "গ্রাম (১–২০০০)"),
        React.createElement("input", { type: "number", inputMode: "decimal", min: 1, max: 2000, step: "any", value: gramsText, onChange: (e) => setGramsText(e.target.value), "aria-label": "গ্রাম", style: INPUT }))
      : React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
        React.createElement("button", { onClick: () => step(-0.5), disabled: qty <= 0.5, "aria-label": "পরিমাণ কমান", style: { ...BTN, border: "none", background: "#E4ECE7", color: GREEN, opacity: qty <= 0.5 ? 0.4 : 1 } }, "−"),
        React.createElement("span", { style: { minWidth: "56px", textAlign: "center", fontSize: "18px", fontWeight: 700, color: "#1F2D2A" } }, bnNum(qty)),
        React.createElement("button", { onClick: () => step(0.5), disabled: !incOk, "aria-label": "পরিমাণ বাড়ান", style: { ...BTN, border: "none", background: "#E4ECE7", color: GREEN, opacity: !incOk ? 0.4 : 1 } }, "+"),
        React.createElement("span", { style: { marginLeft: "auto", textAlign: "right", fontSize: "13px", color: MUTED } }, unitMode ? "ইউনিট: " + f.u : entry && entry.grams ? "নিট ওজন " : "", !unitMode && entry && entry.grams && React.createElement("b", { style: { display: "block", fontSize: "15px", color: "#1F2D2A" } }, bnNum(entry.grams) + " গ্রাম"))),
    !unitMode && !gramMode && React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "6px" } }, "বাটি/কাপের আকার ঘরে ঘরে আলাদা। গ্রামে সরাসরি লিখলে আরও নিখুঁত হবে।"),

    React.createElement("div", { style: { marginTop: "12px", padding: "12px", borderRadius: "14px", border: "1px solid #D5E0DA", background: "#F7FAF8" } },
      entry
        ? React.createElement("div", null,
          React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "6px" } },
            React.createElement("span", { style: { fontSize: "28px", fontWeight: 800, color: GREEN } }, bnNum(entry.kcal)),
            React.createElement("span", { style: { fontSize: "14px", color: GREEN, fontWeight: 600 } }, "কিলোক্যালরি (আনুমানিক)")),
          entry.p !== undefined && MACROS.map(([label, k, color]) => React.createElement("div", { key: k, style: { display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "14px" } },
            React.createElement("span", { style: { width: "64px", color: "#1F2D2A" } }, label),
            React.createElement("div", { style: { flex: 1, height: "8px", borderRadius: "6px", background: "#E3EBE6", overflow: "hidden" }, "aria-hidden": "true" },
              React.createElement("div", { style: { width: (entry[k] / Math.max(entry.p, entry.c, entry.f, entry.fib, 1)) * 100 + "%", height: "100%", background: color } })),
            React.createElement("b", { style: { minWidth: "70px", textAlign: "right", color: "#1F2D2A" } }, fmtMacro(entry[k]) + " গ্রাম"))),
          p100 && React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "10px", lineHeight: 1.5 } },
            "প্রতি ১০০ গ্রামে: " + bnNum(p100.kcal) + " কিলোক্যালরি · প্রোটিন " + fmtMacro(p100.p) + " · কার্ব " + fmtMacro(p100.c) + " · ফ্যাট " + fmtMacro(p100.f) + " · ফাইবার " + fmtMacro(p100.fib) + " গ্রাম",
            React.createElement("br"),
            nut && nut.src === "recipe" ? "গড় রেসিপি অনুযায়ী (±১০–১৫% বা বেশি তফাত হতে পারে)" : "প্রকাশিত খাদ্য-তালিকার সাধারণ মান (আনুমানিক)"),
          unitMode && React.createElement("div", { style: { fontSize: "12px", color: MUTED, marginTop: "8px" } }, "১ " + f.u + " = " + bnNum(foodK(key)) + " কিলোক্যালরি" + (hasFoodOverride(key) ? " (আপনার নিজের দেওয়া মান)" : "") + " — ম্যাক্রো দেখানো হচ্ছে না।"))
        : React.createElement("div", { style: { fontSize: "13px", color: "#7A1F14" } }, "পরিমাণ সঠিক নয় — গ্রাম ১–২০০০-এর মধ্যে দিন।")),

    st.level === "red" && Msg("⚠ এই খাবার আপনার জন্য এড়ানোর কথা। ডাক্তারের পরামর্শ প্রাধান্য পায়; তবু খেলে যোগ করতে পারেন।", "warn"),
    full && Msg("আজকের জন্য নিজে-যোগ-করা খাবারের সীমা (" + bnNum(MAX_LIST) + "টি) পূর্ণ। আগের কোনোটি মুছুন।", "warn"),
    err && Msg(err, "err"),
    // যোগ-বাটন স্থির (sticky) — লম্বা স্ক্রিনেও সবসময় নিচে দেখা যায়
    React.createElement("div", { style: { position: "sticky", bottom: 0, display: "flex", gap: "8px", marginTop: "14px", padding: "10px 0 env(safe-area-inset-bottom, 0px)", background: "#fff" } },
      primaryBtn((st.level === "red" ? "তবু যোগ করুন" : "যোগ করুন") + " (" + slotLabel + ")", submit, busy, !entry || full)));
}
