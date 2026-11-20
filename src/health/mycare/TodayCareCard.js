// MyCare — "আজকের যত্ন" কার্ড (MyCare পেজ ও হোম)। বাছাই careToday.js-এ; এখানে শুধু দেখানো।
import { L, digits } from "../../shared/i18n.js";
import { seasonOf } from "./careSeason.js";
import { pickTodayCare, isEmptyCare } from "./careToday.js";
import { ALL_ITEMS } from "./data/index.js";
import { CAT_META, SEASON_LABEL } from "./careLabels.js";
import { IconBox } from "./careIcons.js";
import { useCareProfile } from "./useCareProfile.js";
import { useCareLog } from "./useCareLog.js";
import { usePatches } from "./carePatchStore.js";
import { PatchCheckCard } from "./PatchCheckCard.js";
import { plannedKeys, tickKey, isoOf, isDayComplete, streakOf, weekCells, taskKeysFor, TASK_WATER, TASK_GUT } from "./careLogCore.js";

const { useState } = React;

const T = (o) => (o ? L(o.bn, o.en) : "");
const GROUPS = [["morning", "সকাল", "Morning", "#C98A12"], ["night", "রাত", "Night", "#5B4B9A"], ["anytime", "দিনের মধ্যে", "During the day", "#1F7A5C"]];
const colorOf = (cat) => (CAT_META.find((c) => c[0] === cat) || [0, 0, 0, "#1F7A5C"])[3];

const streakText = (n) => L("ধারাবাহিক " + digits(n) + " দিন", n + "-day streak");

// log = { days, toggle } হলে চেকলিস্ট (টিক ও streak); null হলে আগের মতো শুধু তালিকা ("অন্যের জন্য" মোডে সবসময় null)
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
  const onTick = async (key) => { setMsg(""); const r = await log.toggle(key, planned); if (r) setMsg(L("সংরক্ষণ হয়নি। আবার চেষ্টা করুন।", "Could not save. Please try again.")); };
  const box = (e, slot) => {
    const key = tickKey(e.item.id, slot), on = today.includes(key);
    return React.createElement("button", { type: "button", role: "checkbox", "aria-checked": on, "aria-label": T(e.item.name), onClick: () => onTick(key), style: { width: "44px", height: "44px", margin: "0 -4px 0 -8px", padding: 0, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" } },
      React.createElement("span", { "aria-hidden": "true", style: { width: "26px", height: "26px", borderRadius: "8px", border: "2px solid " + (on ? "#1F7A5C" : "var(--hs-border, #B9CFC5)"), background: on ? "#1F7A5C" : "transparent", color: "#fff", fontSize: "16px", fontWeight: 800, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" } }, on ? "✓" : ""));
  };
  const row = (e, key, slot, slim) => React.createElement("div", { key, style: { display: "flex", alignItems: "center", gap: "4px", minWidth: 0 } },
    log && slot && box(e, slot),
    React.createElement("button", { type: "button", onClick: () => onOpen && onOpen(e.item), style: { flex: 1, minWidth: 0, minHeight: "44px", display: "flex", alignItems: "center", gap: slim ? "4px" : "10px", padding: "2px", border: "none", background: "none", textAlign: "left", fontFamily: "inherit", color: "var(--hs-text, #1B2430)", cursor: "pointer" } },
      !slim && React.createElement(IconBox, { id: e.item.category, color: colorOf(e.item.category), size: 30 }),
      React.createElement("span", { style: { flex: 1, minWidth: 0, fontSize: slim ? "14px" : "14.5px", lineHeight: 1.35, fontWeight: 700, overflowWrap: "anywhere" } }, T(e.item.name))));
  const TASK_UI = { [TASK_WATER]: ["water", "#3B82B6", "পানি পান", "Water"], [TASK_GUT]: ["gut", "#7A5BB0", "পেট ডায়েরি", "Gut diary"] };
  const taskTile = (key) => {
    const [icon, color, bn, en] = TASK_UI[key], on = today.includes(key);
    return React.createElement("button", { key, type: "button", role: "checkbox", "aria-checked": on, onClick: () => onTick(key), style: { minHeight: "52px", display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px 6px 8px", borderRadius: "16px", border: "1.5px solid " + (on ? "#1F7A5C" : "var(--hs-border, #D9E5DE)"), background: on ? "var(--hs-chip-bg, #E4F0E9)" : "var(--hs-surface, #fff)", boxShadow: on ? "none" : "0 2px 6px rgba(14,75,67,0.07)", fontFamily: "inherit", color: "var(--hs-text, #1B2430)", cursor: "pointer", textAlign: "left", minWidth: 0 } },
      React.createElement(IconBox, { id: icon, color, size: 32 }),
      React.createElement("span", { style: { flex: 1, minWidth: 0, fontSize: "14px", fontWeight: 700, lineHeight: 1.3 } }, L(bn, en)),
      React.createElement("span", { "aria-hidden": "true", style: { width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0, border: "2px solid " + (on ? "#1F7A5C" : "var(--hs-border, #B9CFC5)"), background: on ? "#1F7A5C" : "transparent", color: "#fff", fontSize: "14px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" } }, on ? "✓" : ""));
  };
  const hidden = !!collapsible && !open;
  const chip = { fontSize: "12.5px", fontWeight: 800, padding: "2px 10px", borderRadius: "999px", background: "var(--hs-chip-bg, #E4F0E9)", color: "var(--hs-primary, #0E4B43)", whiteSpace: "nowrap" };
  return React.createElement("div", { style: { padding: "14px", borderRadius: "22px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", boxShadow: "0 4px 14px rgba(14,75,67,0.08)", marginBottom: "12px" } },
    React.createElement(collapsible ? "button" : "div", collapsible ? { type: "button", onClick: () => setOpen((o) => !o), "aria-expanded": open, style: { width: "100%", minHeight: "44px", padding: 0, border: "none", background: "none", fontFamily: "inherit", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: open ? "4px" : 0 } } : { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "4px" } },
      React.createElement("span", { style: { fontSize: "17px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)" } }, L("আজকের যত্ন", "Today's care")),
      React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "6px" } },
        log && planned.length > 0 && React.createElement("span", { style: chip }, digits(doneN) + "/" + digits(planned.length)),
        onOpen && compact && React.createElement("button", { type: "button", onClick: () => onOpen(null), style: { minHeight: "44px", padding: "0 6px", border: "none", background: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", cursor: "pointer" } }, L("MyCare ›", "MyCare ›")),
        collapsible && React.createElement("span", { "aria-hidden": "true", style: { fontSize: "16px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)" } }, open ? "▴" : "▾"))),
!hidden && React.createElement(React.Fragment, null,
    log && streak > 0 && React.createElement("div", { style: { fontSize: "13px", fontWeight: 800, color: "#B8860B", marginBottom: "2px" } }, streakText(streak)),
    log && isDayComplete(today) && React.createElement("div", { role: "status", style: { fontSize: "13px", fontWeight: 700, color: "#1F6B50", marginBottom: "2px" } }, L("আজকের যত্ন সম্পূর্ণ। ভালো করেছেন।", "Today's care is complete. Well done.")),
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "10px" } },
      GROUPS.map(([id, bn, en, color]) => care[id].length > 0 && React.createElement("div", { key: id, style: { marginTop: "6px", minWidth: 0, gridColumn: id === "anytime" ? "1 / -1" : "auto" } },
        React.createElement("div", { style: { fontSize: "12.5px", fontWeight: 800, color } }, L(bn, en)),
        React.createElement("div", { style: id === "anytime" ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "10px" } : null },
          care[id].map((e) => row(e, id + e.item.id, id, true)))))),
    tasks.length > 0 && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + tasks.length + ", minmax(0, 1fr))", gap: "8px", marginTop: "10px" } }, tasks.map(taskTile)),
    care.seasonTip && React.createElement("div", { style: { marginTop: "10px", padding: "8px 10px", borderRadius: "14px", background: "#EAF6F0", border: "1px solid #A9D8C4" } },
      React.createElement("div", { style: { fontSize: "12.5px", fontWeight: 800, color: "#1F6B50" } }, L("ঋতুর টিপ", "Season tip") + (SEASON_LABEL[season] ? " · " + L(SEASON_LABEL[season][0], SEASON_LABEL[season][1]) : "")),
      row(care.seasonTip, "tip", null)),
    msg && React.createElement("div", { role: "alert", style: { marginTop: "8px", fontSize: "13px", fontWeight: 700, color: "#B3261E" } }, msg),
    care.mode === "core-only" && React.createElement("div", { style: { marginTop: "8px", fontSize: "12.5px", color: "var(--hs-muted, #5F716C)", lineHeight: 1.5 } }, L("কিছু তথ্য জানা নেই, তাই শুধু সবচেয়ে নিরাপদ পরামর্শ।", "Some details are unknown, so only the safest advice is shown.")),
    React.createElement("div", { style: { marginTop: "6px", fontSize: "12px", color: "var(--hs-muted, #5F716C)" } }, L("এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।", "This is a general guide, not medical advice."))));
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

// হোমে বসানোর রূপ: নিজে profile পড়ে; পড়া চলাকালীন বা ফাঁকা হলে কিছুই দেখায় না (হোম অক্ষত)
export function HomeTodayCare({ familyId, callerMemberId, selectedMemberId, members, onOpen }) {
  const { ready, profile, showGut } = useCareProfile(familyId, selectedMemberId, members);
  const log = useCareLog(familyId, selectedMemberId, callerMemberId);
  const patches = usePatches(selectedMemberId);
  if (!ready) return null;
  return React.createElement(React.Fragment, null,
    React.createElement(PatchCheckCard, { list: patches.list, update: patches.update }),
    React.createElement(TodayCareView, { profile, onOpen, compact: true, log, showGut }));
}
