import { ErrorBox, Skeleton } from "../../shared/ui.js";
// হোম ▸ "আজ" — আজকের সারাংশ (ধাপ ৪, মকআপ ১ অনুযায়ী)। নতুন ইনপুট/schema নেই:
// ওষুধ-রেকর্ড (useMemberHealth, ধাপ ১) + ট্র্যাকারের আজকের ডক (পানি/ক্যালরি/ওজন/`medTaken`, ধাপ ২) + ক্যালেন্ডার ইভেন্ট পড়ে দেখায়।
// একমাত্র লেখা: "খেয়েছি" বাটন → বিদ্যমান setMedDoseTaken (নির্দিষ্ট key → double-tap-এ ডুপ্লিকেট নয়; ধাপ ২-এর মতোই)।
// হিসাব → todaySummaryCalc.js (pure + test)।

import { useMemberHealth } from "../records/useMemberHealth.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { getGoal, getDaily, setMedDoseTaken } from "../tracker/trackerData.js";
import { listCalendarEvents } from "../calendar/calendarData.js";
import { sanitizeTaken } from "../records/medTaken.js";
import { ageYears, bmiOf, safetyGate, waterTargetFor, detectFlagsFromConditions, effectivePregnant } from "../tracker/trackerCalc.js";
import { T } from "../tracker/trackerTheme.js";
import { bnNum, localISO } from "../../shared/dates.js";
import { buildTodayDoses, progressPct, headlineOf, upcomingEvents } from "./todaySummaryCalc.js";
import { DoseGrid } from "./DoseGrid.js";
import { UpcomingGrid } from "./UpcomingGrid.js";
import { homeVisibleDoses } from "./doseGroups.js";

const { useState, useEffect, useCallback } = React;
const h = React.createElement;

const FONT = "'Hind Siliguri', sans-serif";
const BOX = { background: T.surface, border: "1px solid " + T.border, borderRadius: "20px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" };
const SEC = { fontSize: "17px", fontWeight: 700, color: T.green, margin: "16px 2px 8px" };

function numOf(r) { const n = r ? parseFloat(r.value) : NaN; return Number.isNaN(n) ? null : n; }
function isType(r, names) { return r.resourceType === "observation" && names.includes((r.type || "").trim().toLowerCase()); }
const nowHHMM = () => new Date().toTimeString().slice(0, 5);

function Bar({ pct, color }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return h("div", { style: { height: "8px", borderRadius: "999px", background: T.track, overflow: "hidden", marginTop: "10px" } },
    h("div", { style: { width: p + "%", height: "100%", background: color || T.green, borderRadius: "999px" } }));
}

function Stat({ icon, title, big, small, pct, color }) {
  return h("div", { style: { ...BOX, padding: "12px 14px", minWidth: 0 } },
    h("div", { style: { fontSize: "14px", color: T.muted } }, icon + " " + title),
    h("div", { style: { marginTop: "6px", color: T.green, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
      h("span", { style: { fontSize: "24px", fontWeight: 700 } }, big),
      small && h("span", { style: { fontSize: "14px", color: T.muted, marginLeft: "3px" } }, small)),
    pct !== undefined && h(Bar, { pct, color }));
}

export function TodaySummary({ familyId, callerMemberId, selectedMemberId, onlyMeds }) {
  const { records, loading, error } = useMemberHealth(familyId, selectedMemberId);
  const [aux, setAux] = useState(null); // { member, goal, daily, events }
  const [auxErr, setAuxErr] = useState(null);
  const [today, setToday] = useState(localISO());
  const [now, setNow] = useState(nowHHMM());
  const [busyKey, setBusyKey] = useState(null);
  const [doseErr, setDoseErr] = useState(null);
  const [showAllDoses, setShowAllDoses] = useState(false);

  const load = useCallback(async () => {
    if (!familyId || !selectedMemberId) return;
    setAuxErr(null);
    try {
      const day = localISO();
      const [members, goal, daily, events] = await Promise.all([
        listMembers(familyId).catch(() => []),
        onlyMeds ? Promise.resolve(null) : getGoal(familyId, selectedMemberId), // শুধু ওষুধ/আসন্ন মোডে লক্ষ্য লাগে না
        getDaily(familyId, selectedMemberId, day),
        listCalendarEvents(familyId).catch(() => []), // ইভেন্ট না পড়া গেলে শুধু "আসন্ন" খালি — বাকি সারাংশ চলে
      ]);
      setAux({ member: members.find((m) => m.id === selectedMemberId) || null, goal, daily, events });
    } catch (e) {
      setAux(null);
      setAuxErr(e.code === "permission-denied" ? "এই সদস্যের তথ্য দেখার অনুমতি আপনার নেই।" : (e.message || String(e)));
    }
  }, [familyId, selectedMemberId, onlyMeds]);

  useEffect(() => { setAux(null); load(); }, [load, today]);

  // প্রতি মিনিটে "সময় হয়েছে" হালনাগাদ; দিন বদলালে (মধ্যরাত) নতুন দিনের ডেটা আবার পড়া
  useEffect(() => {
    const id = setInterval(() => { setNow(nowHHMM()); setToday((d) => (d === localISO() ? d : localISO())); }, 60000);
    return () => clearInterval(id);
  }, []);

  const toggle = async (d) => {
    if (busyKey) return;
    setDoseErr(null); setBusyKey(d.key);
    const prevDaily = aux.daily;
    const nextTaken = !d.taken;
    const cur = sanitizeTaken(prevDaily && prevDaily.medTaken);
    if (nextTaken) cur[d.key] = true; else delete cur[d.key];
    setAux((a) => ({ ...a, daily: { ...(a.daily || {}), medTaken: cur } })); // তাৎক্ষণিক দেখানো; ব্যর্থ হলে ফেরত
    try {
      await setMedDoseTaken(familyId, selectedMemberId, callerMemberId, today, d.key, nextTaken);
    } catch (e) {
      setAux((a) => ({ ...a, daily: prevDaily }));
      setDoseErr(e && e.code === "permission-denied" ? "এই সদস্যের জন্য চিহ্ন দেওয়ার অনুমতি আপনার নেই।" : "সংরক্ষণ হয়নি — আবার চেষ্টা করুন।");
    } finally { setBusyKey(null); }
  };

  if (error || auxErr) return ErrorBox(auxErr || (error.code === "permission-denied" ? "এই সদস্যের তথ্য দেখার অনুমতি আপনার নেই।" : (error.message || String(error))));
  if (!selectedMemberId || loading || !records || !aux) return onlyMeds ? null : Skeleton(4, 96); // হোমে লোডের সময় ফাঁকা জায়গা/লাফ এড়াতে কিছুই দেখাই না

  const { member, goal, daily, events } = aux;
  const d = daily || {};
  const age = member ? ageYears(member.dob) : null;
  const detected = detectFlagsFromConditions(records);
  const gf = (goal && goal.flags) || {};
  const flags = { pregnant: effectivePregnant(goal, records), diabetes: !!gf.diabetes || detected.diabetes, kidney: !!gf.kidney || detected.kidney };
  const gate = safetyGate({ age, flags });
  const calorieTarget = !gate.blocked && goal && goal.calc ? goal.calc.calorieTarget : null;
  const waterTarget = waterTargetFor(age, flags, goal && goal.waterTarget);
  const water = d.waterGlasses || 0;
  const weightKg = d.weightKg || numOf(records.find((r) => isType(r, ["weight", "ওজন"])));
  const heightCm = numOf(records.find((r) => isType(r, ["height", "উচ্চতা"])));
  const bmi = bmiOf(weightKg, heightCm);

  const { doses, noTimeCount } = buildTodayDoses(member || { id: selectedMemberId, name: "" }, records, today, now, sanitizeTaken(d.medTaken));
  const taken = doses.filter((x) => x.taken).length;
  const homeDoses = homeVisibleDoses(doses);
  const pct = progressPct({ doses, water, waterTarget });
  const upcoming = upcomingEvents(events, selectedMemberId, today);
  const dateLine = new Date(today + "T00:00:00").toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long" });

  // হোমে (onlyMeds) ইনপুট না থাকলে কার্ডই দেখাব না; রেকর্ড/ইভেন্ট দিলে অটো আসবে
  if (onlyMeds && !doses.length && !noTimeCount && !upcoming.length) return null;

  return h("div", { style: { fontFamily: FONT, marginBottom: onlyMeds ? "10px" : 0 } },
    ...(onlyMeds ? [] : [h("div", { style: { fontSize: "14px", color: T.muted, margin: "0 2px 8px" } }, dateLine + (member && member.name ? " · " + member.name.split(" ")[0] : "")),
    h("div", { style: { background: T.green, borderRadius: "20px", padding: "16px 18px", color: "#fff" } },
      h("div", { style: { fontSize: "14px", color: T.onDarkSoft } }, "আজকের স্বাস্থ্য" + (pct === null ? "" : " — " + bnNum(pct) + "% সম্পন্ন")),
      h("div", { style: { fontSize: "22px", fontWeight: 700, lineHeight: 1.3, marginTop: "6px" } }, headlineOf({ doses, water, waterTarget })),
      pct !== null && h("div", { style: { height: "8px", borderRadius: "999px", background: T.ringTrackOnDark, overflow: "hidden", marginTop: "14px" } },
        h("div", { style: { width: pct + "%", height: "100%", background: "#fff", borderRadius: "999px" } }))),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" } },
      h(Stat, { icon: "💊", title: "ওষুধ", big: bnNum(taken), small: "/" + bnNum(doses.length) + " খাওয়া", pct: doses.length ? (taken / doses.length) * 100 : undefined }),
      waterTarget
        ? h(Stat, { icon: "💧", title: "পানি", big: bnNum(water), small: "/" + bnNum(waterTarget) + " গ্লাস", pct: (water / waterTarget) * 100 })
        : h(Stat, { icon: "💧", title: "পানি", big: bnNum(water), small: "গ্লাস" }),
      h(Stat, { icon: "🍽️", title: "ক্যালরি", big: bnNum(d.caloriesIn || 0), small: calorieTarget ? "/" + bnNum(calorieTarget) : "কিলোক্যালরি", pct: calorieTarget ? ((d.caloriesIn || 0) / calorieTarget) * 100 : undefined, color: T.green }),
      h(Stat, { icon: "⚖️", title: "ওজন", big: weightKg ? bnNum(weightKg) : "—", small: weightKg ? "কেজি" + (bmi ? " · বিএমআই " + bnNum(Math.round(bmi * 10) / 10) : "") : "" }))]),

    (!onlyMeds || doses.length > 0) && h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
      h("div", { style: SEC }, "আজকের ওষুধ"), doses.length > 0 && h("div", { style: { fontSize: "13px", color: T.muted } }, "সব ডিভাইসে মিলবে")),
    doseErr && ErrorBox(doseErr),
    (!onlyMeds || doses.length > 0) && h("div", { style: { ...BOX, padding: onlyMeds ? "8px 10px" : "12px 12px" } },
      doses.length === 0
        ? h("div", { style: { fontSize: "14px", color: T.muted, padding: "2px 2px", lineHeight: 1.5 } }, "আজকের জন্য সময়-নির্ধারিত ওষুধ নেই। ওষুধ ও সময় যোগ করতে: স্বাস্থ্য তথ্য ▸ ওষুধ।")
        : h(React.Fragment, null,
            // হোমে (onlyMeds): শুধু দেরি-হওয়া + পরের বেলার ডোজ; "সব দেখুন"-এ পুরোটা
            (!onlyMeds || showAllDoses || homeDoses.length > 0)
              ? h(DoseGrid, { doses: onlyMeds && !showAllDoses ? homeDoses : doses, busyKey, onToggle: toggle, compact: onlyMeds })
              : h("div", { style: { fontSize: "15px", fontWeight: 600, color: T.green, padding: "2px" } }, "✓ আজকের সব ওষুধ খাওয়া হয়েছে"),
            onlyMeds && doses.length > homeDoses.length && h("button", { type: "button", onClick: () => setShowAllDoses((v) => !v), "aria-expanded": showAllDoses,
              style: { marginTop: "8px", width: "100%", minHeight: "40px", borderRadius: "12px", border: "1px solid " + T.inputBorder, background: "none", color: T.green, fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } },
              showAllDoses ? "কম দেখান" : "সব দেখুন (" + bnNum(doses.length) + "টি)"))),
    noTimeCount > 0 && h("div", { style: { fontSize: "13px", color: T.muted, margin: "6px 2px 0" } }, bnNum(noTimeCount) + "টি ওষুধে রিমাইন্ডার-সময় সেট নেই, তাই এখানে আসেনি।"),

    (!onlyMeds || upcoming.length > 0) && h("div", { style: SEC }, "আসন্ন ইভেন্ট"),
    (!onlyMeds || upcoming.length > 0) && h("div", { style: { ...BOX, padding: upcoming.length === 0 ? "4px 14px" : "8px 10px" } },
      upcoming.length === 0
        ? h("div", { style: { fontSize: "14px", color: T.muted, padding: "12px 0" } }, "আগামী ৩০ দিনে টিকা বা অ্যাপয়েন্টমেন্ট নেই।")
        : h(UpcomingGrid, { events: upcoming })),
    !onlyMeds && h("p", { style: { fontSize: "12px", color: T.muted, margin: "10px 2px 0" } }, "এটা শুধু আপনার দেওয়া তথ্যের সারাংশ; চিকিৎসা পরামর্শ নয়।"));
}
