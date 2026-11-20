// MyCare — "আজকের যত্ন" কার্ড (MyCare পেজ ও হোম)। বাছাই careToday.js-এ; এখানে শুধু দেখানো।
import { L, digits } from "../../shared/i18n.js";
import { seasonOf } from "./careSeason.js";
import { pickTodayCare, isEmptyCare } from "./careToday.js";
import { ALL_ITEMS } from "./data/index.js";
import { CAT_META, SEASON_LABEL } from "./careLabels.js";
import { IconBox, CareIcon } from "./careIcons.js";
import { useCareProfile } from "./useCareProfile.js";
import { useCareLog } from "./useCareLog.js";
import { plannedKeys, tickKey, isoOf, isDayComplete, streakOf, weekCells, taskKeysFor, TASK_WATER, TASK_GUT } from "./careLogCore.js";

const { useState } = React;

const T = (o) => (o ? L(o.bn, o.en) : "");
const GROUPS = [["morning", "সকাল", "Morning", "#C98A12", "sun"], ["night", "রাত", "Night", "#5B4B9A", "moon"], ["anytime", "দিনের মধ্যে", "During the day", "#1F7A5C", "leaf"]];
const colorOf = (cat) => (CAT_META.find((c) => c[0] === cat) || [0, 0, 0, "#1F7A5C"])[3];

const streakText = (n) => L("ধারাবাহিক " + digits(n) + " দিন", n + "-day streak");

// log = { days, toggle } হলে চেকলিস্ট (টিক ও streak); null হলে আগের মতো শুধু তালিকা ("অন্যের জন্য" মোডে সবসময় null)
const tint = (c, pct) => "color-mix(in srgb, " + c + " " + pct + "%, var(--hs-surface, #fff))";
export function TodayCareView({ profile, onOpen, compact, log, collapsible, showGut }) {
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false); // collapsible হলে শুরুতে বন্ধ
  const season = seasonOf(new Date());
  const care = pickTodayCare(profile, ALL_ITEMS, { season, date: new Date() });
  const tasks = log ? taskKeysFor(!!showGut) : [];
  if (care.mode === "referral" || (isEmptyCare(care) && !tasks.length)) return null;
  const todayISO = isoOf(new Date());
  const planned = plannedKeys(care, tasks);
  const today = log ? (log.days[todayISO] || []) : [];
  const doneN = planned.filter((k) => today.includes(k)).length;
  const streak = log ? streakOf(log.days, todayISO) : 0;
  const pct = planned.length ? Math.round((doneN / planned.length) * 100) : 0;
  const onTick = async (key) => { setMsg(""); const r = await log.toggle(key, planned); if (r) setMsg(L("সংরক্ষণ হয়নি। আবার চেষ্টা করুন।", "Could not save. Please try again.")); };
  const circle = (on, size) => React.createElement("span", { "aria-hidden": "true", style: { width: size + "px", height: size + "px", borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", border: "2px solid " + (on ? "#1F7A5C" : "var(--hs-border, #B9CFC5)"), background: on ? "linear-gradient(135deg, #2A9A74, #0E4B43)" : "var(--hs-surface, #fff)", boxShadow: on ? "0 2px 6px rgba(14,75,67,0.35)" : "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" } }, on && React.createElement(CareIcon, { id: "check", color: "#fff", size: Math.round(size * 0.6) }));
  const box = (e, slot) => {
    const key = tickKey(e.item.id, slot), on = today.includes(key);
    return React.createElement("button", { type: "button", role: "checkbox", "aria-checked": on, "aria-label": T(e.item.name), onClick: () => onTick(key), style: { width: "40px", height: "44px", margin: "0 -6px 0 -8px", padding: 0, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" } }, circle(on, 24));
  };
  const row = (e, key, slot, accent) => {
    const on = log && slot && today.includes(tickKey(e.item.id, slot));
    return React.createElement("div", { key, style: { display: "flex", alignItems: "center", gap: "4px", minWidth: 0 } },
      log && slot ? box(e, slot) : React.createElement("span", { "aria-hidden": "true", style: { width: "8px", height: "8px", borderRadius: "50%", background: accent || colorOf(e.item.category), flexShrink: 0, margin: "0 6px 0 4px" } }),
      React.createElement("button", { type: "button", onClick: () => onOpen && onOpen(e.item), style: { flex: 1, minWidth: 0, minHeight: "44px", padding: "2px 2px 2px 8px", border: "none", background: "none", textAlign: "left", fontFamily: "inherit", color: "var(--hs-text, #1B2430)", opacity: on ? 0.62 : 1, cursor: "pointer", fontSize: "14px", fontWeight: 700, lineHeight: 1.35, overflowWrap: "anywhere" } }, T(e.item.name)));
  };
  const TASK_UI = { [TASK_WATER]: ["water", "#3B82B6", "পানি পান", "Water"], [TASK_GUT]: ["gut", "#7A5BB0", "পেট ডায়েরি", "Gut diary"] };
  const taskTile = (key) => {
    const [icon, color, bn, en] = TASK_UI[key], on = today.includes(key);
    return React.createElement("button", { key, type: "button", role: "checkbox", "aria-checked": on, onClick: () => onTick(key), style: { minHeight: "56px", display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px 8px 10px", borderRadius: "18px", border: "1.5px solid " + (on ? "#1F7A5C" : tint(color, 28)), background: on ? tint("#1F7A5C", 14) : "linear-gradient(135deg, " + tint(color, 14) + ", " + tint(color, 5) + ")", fontFamily: "inherit", color: "var(--hs-text, #1B2430)", cursor: "pointer", textAlign: "left", minWidth: 0 } },
      React.createElement(IconBox, { id: icon, color, size: 34 }),
      React.createElement("span", { style: { flex: 1, minWidth: 0, fontSize: "14px", fontWeight: 800, lineHeight: 1.3 } }, L(bn, en)),
      circle(on, 24));
  };
  const hidden = !!collapsible && !open;
  const chip = { fontSize: "12.5px", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", background: tint("#1F7A5C", 14), color: "var(--hs-primary, #0E4B43)", whiteSpace: "nowrap" };
  const headInner = [
    React.createElement("span", { key: "ic", "aria-hidden": "true", style: { width: "36px", height: "36px", borderRadius: "12px", background: "linear-gradient(135deg, #2A9A74, #0E4B43)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 3px 8px rgba(14,75,67,0.25)" } }, React.createElement(CareIcon, { id: "sparkle", color: "#fff", size: 20 })),
    React.createElement("span", { key: "tt", style: { flex: 1, minWidth: 0, textAlign: "left" } },
      React.createElement("span", { style: { display: "block", fontSize: "17px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", lineHeight: 1.2 } }, L("আজকের যত্ন", "Today's care")),
      log && streak > 0 && React.createElement("span", { style: { display: "block", fontSize: "12.5px", fontWeight: 800, color: "#B8860B", marginTop: "1px" } }, "🔥 " + streakText(streak))),
    log && planned.length > 0 && React.createElement("span", { key: "ch", style: chip }, digits(doneN) + "/" + digits(planned.length)),
    onOpen && compact && React.createElement("span", { key: "mc", role: "link", onClick: (ev) => { ev.stopPropagation(); onOpen(null); }, style: { fontSize: "13px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", padding: "10px 4px", cursor: "pointer" } }, "MyCare ›"),
    collapsible && React.createElement("span", { key: "ar", "aria-hidden": "true", style: { fontSize: "15px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)" } }, open ? "▴" : "▾"),
  ];
  const headStyle = { width: "100%", minHeight: "48px", padding: 0, border: "none", background: "none", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "10px" };
  const groupPanel = ([id, bn, en, color, icon]) => care[id].length > 0 && React.createElement("div", { key: id, style: { minWidth: 0, gridColumn: id === "anytime" ? "1 / -1" : "auto", padding: "8px 10px 4px", borderRadius: "18px", background: tint(color, 9), border: "1px solid " + tint(color, 20) } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 800, color, marginBottom: "2px" } }, React.createElement(CareIcon, { id: icon, color, size: 16 }), L(bn, en)),
    React.createElement("div", { style: id === "anytime" ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "10px" } : null }, care[id].map((e) => row(e, id + e.item.id, id, color))));
  return React.createElement("div", { style: { padding: "14px", borderRadius: "24px", border: "1px solid var(--hs-border, #D9E5DE)", background: "linear-gradient(180deg, var(--hs-surface, #fff), " + tint("#1F7A5C", 4) + ")", boxShadow: "0 6px 20px rgba(14,75,67,0.10)", marginBottom: "12px" } },
    React.createElement(collapsible ? "button" : "div", collapsible ? { type: "button", onClick: () => setOpen((o) => !o), "aria-expanded": open, style: { ...headStyle, cursor: "pointer" } } : { style: headStyle }, headInner),
    log && planned.length > 0 && React.createElement("div", { "aria-hidden": "true", style: { height: "6px", borderRadius: "3px", background: tint("#1F7A5C", 12), margin: "8px 0 4px", overflow: "hidden" } },
      React.createElement("div", { style: { width: pct + "%", height: "100%", borderRadius: "3px", background: "linear-gradient(90deg, #2A9A74, #0E4B43)", transition: "width .25s" } })),
    !hidden && React.createElement(React.Fragment, null,
      log && isDayComplete(today) && React.createElement("div", { role: "status", style: { margin: "8px 0 2px", padding: "8px 12px", borderRadius: "14px", background: "linear-gradient(135deg, #2A9A74, #0E4B43)", color: "#fff", fontSize: "13.5px", fontWeight: 700 } }, "✓ " + L("আজকের যত্ন সম্পূর্ণ। ভালো করেছেন।", "Today's care is complete. Well done.")),
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", marginTop: "8px" } }, GROUPS.map(groupPanel)),
      tasks.length > 0 && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + tasks.length + ", minmax(0, 1fr))", gap: "8px", marginTop: "8px" } }, tasks.map(taskTile)),
      care.seasonTip && React.createElement("div", { style: { marginTop: "8px", padding: "8px 12px", borderRadius: "18px", background: "linear-gradient(135deg, " + tint("#C25B3A", 10) + ", " + tint("#1F7A5C", 8) + ")", border: "1px solid " + tint("#1F7A5C", 22) } },
        React.createElement("div", { style: { fontSize: "12.5px", fontWeight: 800, color: "#1F6B50" } }, L("ঋতুর টিপ", "Season tip") + (SEASON_LABEL[season] ? " · " + L(SEASON_LABEL[season][0], SEASON_LABEL[season][1]) : "")),
        row(care.seasonTip, "tip", null, "#C25B3A")),
      msg && React.createElement("div", { role: "alert", style: { marginTop: "8px", fontSize: "13px", fontWeight: 700, color: "#B3261E" } }, msg),
      care.mode === "core-only" && React.createElement("div", { style: { marginTop: "8px", fontSize: "12.5px", color: "var(--hs-muted, #5F716C)", lineHeight: 1.5 } }, L("কিছু তথ্য জানা নেই, তাই শুধু সবচেয়ে নিরাপদ পরামর্শ।", "Some details are unknown, so only the safest advice is shown.")),
      React.createElement("div", { style: { marginTop: "8px", fontSize: "12px", color: "var(--hs-muted, #5F716C)" } }, L("এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।", "This is a general guide, not medical advice."))));
}

// সাপ্তাহিক চক্র (শনি–শুক্র): ✓ = দিনের সব ধাপ সম্পূর্ণ; সংখ্যা = আংশিক টিক। শুধু MyCare পেজে; "অন্যের জন্য" মোডে দেখানো হয় না।
const WEEK_DAYS = [["শনি", "Sat"], ["রবি", "Sun"], ["সোম", "Mon"], ["মঙ্গল", "Tue"], ["বুধ", "Wed"], ["বৃহ", "Thu"], ["শুক্র", "Fri"]];
export function CareWeekCard({ log }) {
  if (!log) return null;
  const cells = weekCells(log.days, isoOf(new Date()));
  const doneN = cells.filter((c) => c.state === "done").length;
  const circle = (c) => {
    const base = { width: "34px", height: "34px", borderRadius: "50%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 800, margin: "0 auto" };
    if (c.state === "done") return { ...base, background: "#1F7A5C", color: "#fff", border: c.today ? "3px solid #0E4B43" : "2px solid #1F7A5C" };
    if (c.state === "part") return { ...base, background: "#E4F0E9", color: "#1F6B50", border: "2px solid " + (c.today ? "#0E4B43" : "#1F7A5C") };
    if (c.state === "future") return { ...base, border: "2px dashed var(--hs-border, #C7D6CE)", color: "var(--hs-muted, #5F716C)" };
    return { ...base, border: "2px solid " + (c.today ? "#0E4B43" : "var(--hs-border, #C7D6CE)"), color: "var(--hs-muted, #5F716C)" };
  };
  return React.createElement("div", { style: { padding: "14px", borderRadius: "22px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", boxShadow: "0 4px 14px rgba(14,75,67,0.08)", marginBottom: "12px" } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", marginBottom: "8px" } },
      React.createElement("span", { style: { fontSize: "16px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)" } }, L("এই সপ্তাহের যত্ন", "Care this week")),
      React.createElement("span", { style: { fontSize: "12.5px", color: "var(--hs-muted, #5F716C)" } }, L(digits(doneN) + "/৭ দিন সম্পূর্ণ", doneN + "/7 days complete"))),
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "2px" } },
      cells.map((c) => React.createElement("div", { key: c.iso, style: { textAlign: "center" } },
        React.createElement("div", { style: { fontSize: "12px", color: "var(--hs-muted, #5F716C)", marginBottom: "4px" } }, L(WEEK_DAYS[c.index][0], WEEK_DAYS[c.index][1])),
        React.createElement("div", { style: circle(c), "aria-label": c.iso + (c.state === "done" ? " ✓" : "") }, c.state === "done" ? "✓" : c.state === "part" ? digits(c.count) : "")))),
    React.createElement("div", { style: { marginTop: "8px", fontSize: "12px", color: "var(--hs-muted, #5F716C)" } }, L("✓ = সব ধাপ সম্পূর্ণ · সংখ্যা = যতটি টিক হয়েছে", "✓ = all steps done · number = steps ticked")));
}

// হোমে (পানি ও পেট ডায়েরির নিচে) ছোট এক-ট্যাপ কার্ড: ট্যাপে আজকের যত্ন সম্পন্ন ধরা হয় (আবার ট্যাপে বাতিল)।
// পড়া চলাকালীন, লগ না পড়া গেলে বা ফাঁকা হলে কিছুই দেখায় না (হোম অক্ষত)।
export function HomeTodayCare({ familyId, callerMemberId, selectedMemberId, members, onOpen }) {
  const { ready, profile, showGut } = useCareProfile(familyId, selectedMemberId, members);
  const log = useCareLog(familyId, selectedMemberId, callerMemberId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  if (!ready || !log) return null;
  const care = pickTodayCare(profile, ALL_ITEMS, { season: seasonOf(new Date()), date: new Date() });
  const tasks = taskKeysFor(!!showGut);
  if (care.mode === "referral" || (isEmptyCare(care) && !tasks.length)) return null;
  const todayISO = isoOf(new Date());
  const planned = plannedKeys(care, tasks);
  const done = isDayComplete(log.days[todayISO] || []);
  const streak = streakOf(log.days, todayISO);
  const tap = async () => { if (busy) return; setBusy(true); setErr(false); const r = await log.setDone(planned, !done); setBusy(false); if (r) setErr(true); };
  const sub = err ? L("সংরক্ষণ হয়নি। আবার চেষ্টা করুন।", "Could not save. Please try again.")
    : done ? L("আজকের যত্ন সম্পন্ন ✓", "Today's care done ✓") + (streak > 1 ? " · 🔥 " + streakText(streak) : "")
    : L("রাতে ট্যাপ করুন — আজকের যত্ন হয়েছে", "Tap at night once today's care is done");
  return React.createElement("div", { style: { display: "flex", alignItems: "stretch", gap: "6px", marginBottom: "8px", borderRadius: "22px", border: "1.5px solid " + (done ? "#1F7A5C" : "var(--hs-border, #D9E5DE)"), background: done ? tint("#1F7A5C", 12) : "linear-gradient(180deg, var(--hs-surface, #fff), " + tint("#1F7A5C", 4) + ")", boxShadow: "0 4px 14px rgba(14,75,67,0.09)" } },
    React.createElement("button", { type: "button", role: "checkbox", "aria-checked": done, disabled: busy, onClick: tap, style: { flex: 1, minWidth: 0, minHeight: "56px", display: "flex", alignItems: "center", gap: "10px", padding: "8px 6px 8px 12px", border: "none", background: "none", fontFamily: "inherit", cursor: "pointer", textAlign: "left", color: "var(--hs-text, #1B2430)" } },
      React.createElement("span", { "aria-hidden": "true", style: { width: "34px", height: "34px", borderRadius: "12px", background: "linear-gradient(135deg, #2A9A74, #0E4B43)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, React.createElement(CareIcon, { id: "sparkle", color: "#fff", size: 19 })),
      React.createElement("span", { style: { flex: 1, minWidth: 0 } },
        React.createElement("span", { style: { display: "block", fontSize: "15px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", lineHeight: 1.2 } }, L("আজকের যত্ন", "Today's care")),
        React.createElement("span", { role: err ? "alert" : undefined, style: { display: "block", fontSize: "12.5px", color: err ? "#B3261E" : "var(--hs-muted, #5F716C)", marginTop: "1px", lineHeight: 1.3 } }, sub)),
      React.createElement("span", { "aria-hidden": "true", style: { width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", border: "2px solid " + (done ? "#1F7A5C" : "var(--hs-border, #B9CFC5)"), background: done ? "linear-gradient(135deg, #2A9A74, #0E4B43)" : "var(--hs-surface, #fff)", display: "flex", alignItems: "center", justifyContent: "center" } }, done && React.createElement(CareIcon, { id: "check", color: "#fff", size: 16 }))),
    onOpen && React.createElement("button", { type: "button", onClick: () => onOpen(null), "aria-label": L("MyCare খুলুন", "Open MyCare"), style: { minWidth: "44px", border: "none", background: "none", fontFamily: "inherit", fontSize: "20px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", cursor: "pointer" } }, "›"));
}
