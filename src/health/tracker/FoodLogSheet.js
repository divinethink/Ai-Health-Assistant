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

const GREEN = "var(--hs-primary, #0E4B43)";
const MUTED = "#5F716C";
const chip = (on) => ({ ...BTN, fontWeight: 600, padding: "6px 12px", border: "1.5px solid " + (on ? GREEN : "#C3D2CA"), background: on ? GREEN : "#fff", color: on ? "#fff" : "#1F2D2A" });
const MACROS = [["প্রোটিন", "p", "#2FAE6B"], ["কার্ব", "c", "#E88A2D"], ["ফ্যাট", "f", "#7C69C9"], ["ফাইবার", "fib", "#3B8ED8"]];

// props: allergyTags, avoidCtx, activeMeds, count (আজ নিজে-যোগ-করা মোট), slotBudgets (ঐচ্ছিক, foodCalc.slotBudgets), recent (ঐচ্ছিক, foodCalc.recentFoodEntries), busy, err, onAdd(entry) → Promise<boolean>, onClose
export function FoodLogSheet({ dateText, slots, initialSlot, pickFirst, allergyTags, avoidCtx, activeMeds, count, slotBudgets, recent, busy, err, onAdd, onClose }) {
  const [slot, setSlot] = useState(initialSlot || slotForNow());
  const [stage, setStage] = useState(pickFirst ? "pick" : "food"); // "pick" = বেলার তালিকা (Healthify-র মতো), "food" = খাবার খোঁজা
  const [key, setKey] = useState(null);
  const [measureId, setMeasureId] = useState(null); // measure id | "g" (গ্রাম)
  const [qty, setQty] = useState(1);
  const [gramsText, setGramsText] = useState("");
  const [notice, setNotice] = useState(null);
  const [own, setOwn] = useState(null); // null = বন্ধ; অবজেক্ট = "নিজে যোগ করুন" ফর্ম
  const [ownErr, setOwnErr] = useState(null);
  const [showInfo, setShowInfo] = useState(false); // "হিসাবের তথ্য" ভাঁজ
  const slotList = slots || MEAL_SLOTS;
  const slotLabel = (slotList.find((s) => s.id === slot) || {}).label;
  const full = count >= MAX_LIST;
  const budget = slotBudgets && slotBudgets[slot];

  // pre (ঐচ্ছিক) = সাম্প্রতিক এন্ট্রি: আগের বারের মাপ/পরিমাণ/গ্রাম আগে থেকে বসে; অবৈধ হলে ডিফল্ট।
  const pick = (k, pre) => {
    const ms = measuresOf(k);
    const unit = !ms.length || hasFoodOverride(k);
    let mId = unit ? null : ms[0].id, q = 1, gt = ms.length ? String(ms[0].g) : "";
    if (pre) {
      const pq = Number(pre.qty);
      if (unit) { if (pq > 0) q = pq; }
      else if (pre.measure && ms.some((m) => m.id === pre.measure) && pq > 0) { mId = pre.measure; q = pq; }
      else if (Number(pre.grams) > 0) { mId = "g"; gt = String(pre.grams); }
    }
    setKey(k); setNotice(null); setQty(q); setMeasureId(mId); setGramsText(gt);
  };
  const back = () => { setKey(null); };

  // সাম্প্রতিক খাবার: ✕ (এড়ানো/এলার্জি) স্ট্যাটাসের খাবার এখানে আসে না — খুঁজে সতর্কতাসহ যোগ করতে হবে।
  // তালিকার খাবার ট্যাপে পরিমাণ-ধাপ খোলে (আগের মাপ বসানো, কয়টি/কত গ্রাম দেখে "যোগ করুন"); শুধু নিজে-যোগ-করা (key নেই) খাবার সরাসরি যোগ হয়।
  const quick = (Array.isArray(recent) ? recent : []).filter((e) => {
    const f0 = e.key && FOODS[e.key];
    return !f0 || foodStatus(e.key, f0, { allergyTags, ctx: avoidCtx }).level !== "red";
  });
  const openQuick = (e) => { if (e.key && FOODS[e.key]) pick(e.key, e); else quickAdd(e); };
  const quickAdd = async (e) => {
    if (busy || full) return;
    const ok = await onAdd({ ...e, slot });
    if (ok) setNotice("✓ " + e.name + (entryAmountText(e) ? " · " + entryAmountText(e) : "") + " · " + bnNum(e.kcal) + " কিলোক্যালরি — " + slotLabel + "-এ যোগ হয়েছে। ভুল হলে আজকের তালিকা থেকে ✕ দিয়ে মুছুন।");
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

  // ---------- বেলা বাছাই: "খাওয়া / বরাদ্দ" সহ তালিকা ----------
  if (stage === "pick" && !key) {
    return React.createElement(Sheet, { title: "কোন বেলার খাবার যোগ করবেন?", subtitle: (dateText ? dateText + " · " : "") + "বরাদ্দ = আজকের টার্গেটের ভাগ (বেশি হলেও বাধা নেই)", onClose },
      slotList.map((s) => {
        const b = slotBudgets && slotBudgets[s.id];
        const over = b && b.eaten > b.planned;
        return React.createElement("button", { key: s.id, type: "button", onClick: () => { setSlot(s.id); setStage("food"); }, "aria-label": s.label + "-এ খাবার যোগ করুন",
          style: { display: "flex", alignItems: "center", gap: "8px", width: "100%", minHeight: "56px", padding: "0 4px", border: "none", borderBottom: "1px solid #E3E0D2", background: "none", fontFamily: "inherit", cursor: "pointer", textAlign: "left" } },
          React.createElement("span", { style: { flex: 1, fontSize: "16px", fontWeight: 700, color: GREEN } }, s.label),
          b && React.createElement("span", { style: { fontSize: "14px", color: over ? "#B26A00" : MUTED, fontWeight: over ? 700 : 500 } }, bnNum(b.eaten) + " / " + bnNum(b.planned) + " কিলোক্যালরি"),
          React.createElement("span", { "aria-hidden": "true", style: { width: "30px", height: "30px", borderRadius: "50%", background: "#E3EFEA", color: GREEN, fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" } }, "＋"));
      }));
  }

  // সাম্প্রতিক: এক লাইনের অনুভূমিক স্ক্রল-সারি (সর্বোচ্চ ৬) — তালিকাকে ঠেলে নামায় না। চিপে আগের পরিমাণ+ক্যালরি; ট্যাপে পরিমাণ-ধাপ।
  const recentRow = quick.length > 0 && React.createElement("div", { style: { margin: "0 0 8px" } },
    React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1F2D2A", marginBottom: "6px" } }, "সাম্প্রতিক"),
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "6px" } },
      quick.slice(0, 8).map((e) => React.createElement("button", { key: e.name, onClick: () => openQuick(e), disabled: busy || (full && !(e.key && FOODS[e.key])), title: e.name, "aria-label": e.name + " " + (entryAmountText(e) || "") + " — পরিমাণ বেছে " + slotLabel + "-এ যোগ করুন",
        style: { ...chip(false), minHeight: "38px", padding: "4px 6px", fontSize: "13px", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: busy ? 0.5 : 1 } }, e.name))));

  // ---------- ধাপ ১: খোঁজা ----------
  if (!key) {
    return React.createElement(Sheet, { title: "খাবার যোগ করুন", subtitle: dateText || undefined, onClose },
      React.createElement("div", { className: "hs-fp-pills", style: { marginTop: "-8px" } }, TabPills(slotList.map((s) => [s.id, s.label]), slot, setSlot)),
      budget && React.createElement("div", { style: { margin: "-6px 0 10px" } },
        React.createElement("div", { role: "img", "aria-label": slotLabel + ": " + bnNum(budget.eaten) + " / " + bnNum(budget.planned) + " কিলোক্যালরি", style: { height: "6px", borderRadius: "6px", background: "#E4ECE7", marginTop: "5px", overflow: "hidden" } },
          React.createElement("div", { style: { height: "6px", borderRadius: "6px", width: Math.min(100, budget.planned > 0 ? (budget.eaten / budget.planned) * 100 : 0) + "%", background: GREEN } }))),
      notice && React.createElement("div", { role: "status", style: { padding: "8px 12px", borderRadius: "12px", background: "#E4F0E9", border: "1px solid #9CC5B4", color: GREEN, fontSize: "13px", fontWeight: 600, marginBottom: "8px" } }, notice),
      full && Msg("আজকের জন্য নিজে-যোগ-করা খাবারের সীমা (" + bnNum(MAX_LIST) + "টি) পূর্ণ। নতুন যোগ করতে আগের কোনোটি মুছুন।", "warn"),
      recentRow || null,
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

  // ---- পরিমাণ-ধাপের নতুন বিন্যাস: ফল (ক্যালরি+ম্যাক্রো) আগে → কতটুকু (মাপ-চিপ + বড় ± স্টেপার) → তথ্য ভাঁজে → স্থির বাটন ----
  const h = React.createElement;
  const circleBtn = (label, onClick, disabled, aria) => h("button", { type: "button", onClick, disabled, "aria-label": aria, style: { width: "52px", height: "52px", borderRadius: "50%", border: "none", background: "#E4ECE7", color: GREEN, fontSize: "26px", fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, flexShrink: 0 } }, label);
  const hasMacro = !!entry && entry.p !== undefined;

  return h(Sheet, { title: f.n, subtitle: foodEnglish(key, f) + " · " + slotLabel, onClose },
    h("div", { style: { position: "relative", display: "flex", alignItems: "center", minHeight: "44px", marginBottom: "4px" } },
      h("button", { onClick: back, style: { ...BTN, border: "none", background: "transparent", color: GREEN, padding: "0 4px", justifyContent: "flex-start", flex: "0 0 auto" } }, "← অন্য খাবার"),
      // "কতটুকু খাবেন?" — "অন্য খাবার"-এর একই লাইনে, মাঝ-বরাবর, বড় ফন্টে
      h("div", { style: { position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: "20px", fontWeight: 800, color: "#1F2D2A", pointerEvents: "none" } }, "কতটুকু খাবেন?")),
    // স্ট্যাটাস: সবুজ হলে কিছু দেখানো হয় না (শব্দ কমে); হলুদ/লাল হলে কারণসহ
    st.level !== "green" && h("div", { style: { padding: "8px 12px", borderRadius: "12px", border: "1px solid " + sc.border, background: sc.bg, color: sc.text, fontSize: "13px", marginBottom: "8px" } },
      h("b", null, st.icon + " " + st.label), st.reasons.length > 0 && " — " + st.reasons.join("; ")),
    notes.map((n, i) => h("div", { key: "n" + i, style: { padding: "8px 12px", borderRadius: "12px", background: "#FFF6DD", border: "1px solid #E8D08A", color: "#7A5B00", fontSize: "13px", lineHeight: 1.5, marginBottom: "8px" } }, "💊 " + n.text)),

    // ১) কতটুকু খাবেন — শিরোনাম উপরের "অন্য খাবার" লাইনে
    !unitMode && h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginBottom: "12px" } },
      ms.map((m) => h("button", { key: m.id, type: "button", onClick: () => { setMeasureId(m.id); setQty(1); }, "aria-pressed": measureId === m.id, style: { ...chip(measureId === m.id), flex: "0 0 auto", minHeight: "48px", lineHeight: 1.25, textAlign: "center" } },
        h("span", { style: { display: "block", fontSize: "15px" } }, m.label),
        h("span", { style: { display: "block", fontSize: "12px", fontWeight: 500, opacity: 0.85 } }, "≈ " + bnNum(m.g) + " গ্রাম"))),
      h("button", { type: "button", onClick: () => { setMeasureId("g"); if (entry && entry.grams) setGramsText(String(entry.grams)); }, "aria-pressed": gramMode, style: { ...chip(gramMode), flex: "0 0 auto", minHeight: "48px", fontSize: "15px" } }, "গ্রাম")),
    gramMode
      ? h("div", null,
        h("label", { style: { display: "block", fontSize: "13px", color: MUTED, margin: "2px 0 4px" } }, "গ্রাম (১–২০০০)"),
        h("input", { type: "number", inputMode: "decimal", min: 1, max: 2000, step: "any", value: gramsText, onChange: (e) => setGramsText(e.target.value), "aria-label": "গ্রাম", style: { ...INPUT, fontSize: "20px", fontWeight: 700, textAlign: "center" } }))
      : h("div", null,
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: "20px" } },
          circleBtn("−", () => step(-0.5), qty <= 0.5, "পরিমাণ কমান"),
          h("span", { style: { minWidth: "64px", textAlign: "center", fontSize: "28px", fontWeight: 800, color: "#1F2D2A" } }, bnNum(qty)),
          circleBtn("+", () => step(0.5), !incOk, "পরিমাণ বাড়ান")),
        h("div", { style: { textAlign: "center", fontSize: "14px", color: MUTED, marginTop: "6px" } },
          unitMode ? "ইউনিট: " + f.u : (entry && entry.grams ? "মোট ≈ " + bnNum(entry.grams) + " গ্রাম" : ""))),

    // ২) ফল — "কতটুকু"-র ঠিক নিচে; পরিমাণ ঠিক করলে সাথে সাথে ক্যালরি/ম্যাক্রো বদলায়
    h("div", { role: "status", "aria-live": "polite", style: { marginTop: "16px", padding: "12px 14px", borderRadius: "16px", background: "#F2F7F4", border: "1px solid #D5E0DA" } },
      entry
        ? h("div", null,
          h("div", { style: { display: "flex", alignItems: "baseline", gap: "6px" } },
            h("span", { style: { fontSize: "30px", fontWeight: 800, color: GREEN, lineHeight: 1.1 } }, bnNum(entry.kcal)),
            h("span", { style: { fontSize: "14px", color: GREEN, fontWeight: 600 } }, "কিলোক্যালরি · আনুমানিক")),
          hasMacro && h("div", { style: { display: "flex", gap: "10px", marginTop: "10px" } },
            MACROS.map(([label, k, color]) => h("div", { key: k, style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontSize: "12px", color: MUTED } }, label),
              h("div", { style: { fontSize: "16px", fontWeight: 800, color: "#1F2D2A", whiteSpace: "nowrap" } }, fmtMacro(entry[k])),
              h("div", { "aria-hidden": "true", style: { height: "4px", borderRadius: "4px", background: color, marginTop: "2px" } }))),
            ),
          hasMacro && h("div", { style: { fontSize: "12px", color: MUTED, marginTop: "4px" } }, "গ্রামে"),
          !hasMacro && unitMode && h("div", { style: { fontSize: "12px", color: MUTED, marginTop: "6px" } }, "এই খাবারের ম্যাক্রো দেখানো হচ্ছে না।"))
        : h("div", { style: { fontSize: "14px", color: "#7A1F14" } }, "পরিমাণ সঠিক নয় — গ্রাম ১–২০০০-এর মধ্যে দিন।")),

    // ৩) বাড়তি তথ্য ভাঁজে — ডিফল্টে বন্ধ
    showInfo && h("div", { style: { marginTop: "10px", fontSize: "12px", color: MUTED, lineHeight: 1.6 } },
        !unitMode && h("div", null, "বাটি/কাপের আকার ঘরে ঘরে আলাদা। গ্রামে সরাসরি লিখলে আরও নিখুঁত হবে।"),
        p100 && h("div", null, "প্রতি ১০০ গ্রামে: " + bnNum(p100.kcal) + " কিলোক্যালরি · প্রোটিন " + fmtMacro(p100.p) + " · কার্ব " + fmtMacro(p100.c) + " · ফ্যাট " + fmtMacro(p100.f) + " · ফাইবার " + fmtMacro(p100.fib) + " গ্রাম"),
        p100 && h("div", null, nut && nut.src === "recipe" ? "গড় রেসিপি অনুযায়ী (±১০–১৫% বা বেশি তফাত হতে পারে)" : "প্রকাশিত খাদ্য-তালিকার সাধারণ মান (আনুমানিক)"),
        unitMode && h("div", null, "১ " + f.u + " = " + bnNum(foodK(key)) + " কিলোক্যালরি" + (hasFoodOverride(key) ? " (আপনার নিজের দেওয়া মান)" : ""))),

    st.level === "red" && Msg("⚠ এই খাবার আপনার জন্য এড়ানোর কথা। ডাক্তারের পরামর্শ প্রাধান্য পায়; তবু খেলে যোগ করতে পারেন।", "warn"),
    full && Msg("আজকের জন্য নিজে-যোগ-করা খাবারের সীমা (" + bnNum(MAX_LIST) + "টি) পূর্ণ। আগের কোনোটি মুছুন।", "warn"),
    err && Msg(err, "err"),
    // যোগ-বাটন স্থির (sticky) — উপরে পাতলা রেখা, লেখা তার নিচে ঢুকে যায় না
    // "হিসাবের তথ্য" বামে, "যোগ করুন" একই লাইনে সর্ব ডানে
    h("div", { style: { position: "sticky", bottom: 0, marginTop: "14px", padding: "10px 0 env(safe-area-inset-bottom, 0px)", background: "#fff", borderTop: "1px solid #E3E0D2", display: "flex", alignItems: "center", gap: "10px" } },
      h("button", { type: "button", onClick: () => setShowInfo((v) => !v), "aria-expanded": showInfo, style: { minHeight: "48px", padding: "0 4px", border: "none", background: "transparent", color: GREEN, fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flex: "0 0 auto" } }, "ℹ️ হিসাবের তথ্য"),
      primaryBtn((st.level === "red" ? "তবু যোগ করুন" : "যোগ করুন") + " (" + slotLabel + ")", submit, busy, !entry || full)));
}
