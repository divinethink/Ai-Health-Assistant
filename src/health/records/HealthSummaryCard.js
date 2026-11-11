// Health Summary Card — owner-request (২০২৬-০৯-১৬, প্রথম বার্তা থেকেই চাওয়া
// হয়েছিল): হোম→প্রোফাইল ট্যাবে ক্লিক করলেই সংশ্লিষ্ট সদস্যের সব জরুরি তথ্য
// এক নজরে — নাম/জন্মসাল/উচ্চতা/ওজন/BMI + BMI-ভিত্তিক ১-লাইন মন্তব্য, চলমান
// অসুস্থতা (নাম+সংক্ষিপ্ত নোট), চলমান ঔষধ (নাম+কয়বেলা), ও BMI/অসুস্থতা-
// ভিত্তিক সংক্ষিপ্ত খাদ্য নির্দেশিকা। এটা শুধু READ-ONLY aggregation/display —
// existing data-source-ই reuse করে (HealthVitalsWidget-এর BMI-সূত্র,
// dietGuidanceData.js-এর matching-logic, healthRecordsData.js-এর records) —
// কোনো নতুন schema/collection/permission-rule লাগেনি।

import { ErrorBox } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { listHealthRecords } from "./healthRecordsData.js";
import { HealthVitalsWidget } from "./HealthVitalsWidget.js";
import { getAgeInYears } from "../triage/triageEngine.js";
import { listCalendarEvents } from "../calendar/calendarData.js";
import { bnDate } from "../../shared/dates.js";
import { groupObservations } from "./recordGrouping.js";
import { fetchTestNameDictionary } from "../reports/testDictionaryData.js";
import { buildLabAlerts, LEVEL_WORD } from "../reports/labAlerts.js";
import { computeVaccinationDueDates, CHILD_AGE_CUTOFF_YEARS } from "../calendar/epiSchedule.js";

const { useState, useEffect } = React;

function bmiCategoryOf(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

// owner-request-এর exact ভাষা অনুসরণ করে (BMI কম/বেশি/সঠিক + পরামর্শ)।
function bmiAdviceLine(category) {
  if (category === "underweight") return "আপনার বয়স ও উচ্চতার তুলনায় ওজন কম (BMI অনুসারে) — বেশি ক্যালরি ও প্রোটিন-সমৃদ্ধ সুষম খাবার খান, প্রয়োজনে ডাক্তার/পুষ্টিবিদের পরামর্শ নিন।";
  if (category === "overweight" || category === "obese") return "আপনার বয়স ও উচ্চতার তুলনায় ওজন বেশি (BMI অনুসারে) — নিয়মিত ব্যায়াম করুন, সুষম খাবার খান ও ওজন কমানোর চেষ্টা করুন।";
  if (category === "normal") return "আপনার বয়স ও উচ্চতার তুলনায় ওজন সঠিক (BMI অনুসারে) — বর্তমান সুষম খাদ্যাভ্যাস বজায় রাখুন।";
  return null;
}

// টিকা-স্ট্যাটাস এক-লাইন — শুধু শিশু (<৬ বছর, VaccinationScheduler-এর একই cutoff)।
function vaccinationSummaryOf(member, ageYears, events, today) {
  if (!member || !member.dob || ageYears === null || ageYears >= CHILD_AGE_CUTOFF_YEARS) return null;
  const schedule = computeVaccinationDueDates(member.dob);
  if (schedule.length === 0) return null;
  const doneIds = events.filter((e) => e.eventType === "vaccination" && e.status === "done" && e.memberId === member.id).map((e) => e.doseId);
  const done = schedule.filter((d) => doneIds.includes(d.doseId)).length;
  const overdue = schedule.filter((d) => !doneIds.includes(d.doseId) && d.dueDate < today).length;
  return { done, total: schedule.length, overdue };
}

// পরবর্তী অ্যাপয়েন্টমেন্ট/চেকআপ — শুধু এই সদস্যের নামে tag করা, আজ বা ভবিষ্যতের, সবচেয়ে কাছেরটা।
function nextAppointmentOf(memberId, events, today) {
  return events.find((e) => e.memberId === memberId && (e.eventType === "appointment" || e.eventType === "checkup") && e.status !== "done" && (e.date || "") >= today) || null;
}

const bn = (n) => String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);

const h = React.createElement;
const BMI_CHIP = {
  underweight: { text: "কম ওজন", bg: "#FFE3A8", fg: "#7A4B00" },
  normal: { text: "সঠিক ওজন", bg: "#CFF1DE", fg: "#0E4B43" },
  overweight: { text: "বেশি ওজন", bg: "#FFE3A8", fg: "#7A4B00" },
  obese: { text: "স্থূলতা", bg: "#FFD3CD", fg: "#8A1C12" },
};
const SOFT = "#4A6159";
const INK = "var(--hs-primary, #0E4B43)";
const GLASS = { background: "#FFFFFF", border: "1px solid #CFE0D5", borderRadius: "10px", padding: "4px 9px", minWidth: 0, boxSizing: "border-box" };

// হিরোর ভেতরের সংখ্যা-টাইল (উচ্চতা/ওজন/BMI)
function stat(label, big, unit, chip) {
  return h("div", { style: GLASS },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", minHeight: "16px" } },
      h("span", { style: { fontSize: "11.5px", color: SOFT } }, label),
      chip && h("span", { style: { padding: "0 6px", borderRadius: "999px", fontSize: "10.5px", fontWeight: 700, lineHeight: "16px", whiteSpace: "nowrap", background: chip.bg, color: chip.fg } }, chip.text)),
    h("div", { style: { whiteSpace: "nowrap", lineHeight: 1.2 } },
      h("span", { style: { fontSize: "17px", fontWeight: 800, color: INK } }, big),
      unit && h("span", { style: { fontSize: "12px", color: SOFT } }, " " + unit)));
}

// "এক নজরে" প্যানেলের একটি লাইন: আইকন + লেবেল বামে, মান ডানে
function glance(icon, label, value, tone) {
  return h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", padding: "3px 0" } },
    h("span", { style: { fontSize: "13px", color: "#5F716C", flexShrink: 0 } }, icon + " " + label),
    h("span", { style: { fontSize: "14px", fontWeight: 700, textAlign: "right", overflowWrap: "anywhere", color: tone === "red" ? "#B3261E" : tone === "muted" ? "#5F716C" : "#1F2D2A" } }, value));
}

export function HealthSummaryCard({ familyId, selectedMemberId, callerMemberId, refreshTick, onVitalsSaved }) {
  const [editing, setEditing] = useState(false); // ✎ চাপলে উচ্চতা/ওজন ফর্ম নিচে খোলে
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!selectedMemberId) return;
    setLoading(true);
    setErr(null);
    Promise.all([
      listMembers(familyId),
      listHealthRecords(familyId, selectedMemberId),
      // সম্পূরক লাইন (টিকা/অ্যাপয়েন্টমেন্ট) — এই read ব্যর্থ হলে পুরো কার্ড আটকাবে না, শুধু ঐ দুই লাইন বাদ যাবে।
      listCalendarEvents(familyId).catch(() => null),
      fetchTestNameDictionary().catch(() => []), // ল্যাব সতর্কতা — না এলে শুধু ঐ টাইল বাদ
    ])
      .then(([members, records, calEvents, dict]) => {
        const member = members.find((m) => m.id === selectedMemberId) || null;

        const heightObs = records.filter((r) => r.resourceType === "observation" && r.type === "height").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const weightObs = records.filter((r) => r.resourceType === "observation" && r.type === "weight").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const heightCm = heightObs[0] ? parseFloat(heightObs[0].value) : null;
        const weightKg = weightObs[0] ? parseFloat(weightObs[0].value) : null;
        const bmi = (heightCm && weightKg) ? weightKg / ((heightCm / 100) * (heightCm / 100)) : null;
        const bmiCategory = bmiCategoryOf(bmi);

        const allergies = records.filter((r) => r.resourceType === "allergy");
        const nowD = new Date();
        const today = nowD.getFullYear() + "-" + String(nowD.getMonth() + 1).padStart(2, "0") + "-" + String(nowD.getDate()).padStart(2, "0"); // লোকাল তারিখ (UTC না)
        const ageForVax = member ? getAgeInYears(member.dob) : null;
        const vaccination = calEvents ? vaccinationSummaryOf(member, ageForVax, calEvents, today) : null;
        const nextAppt = calEvents ? nextAppointmentOf(selectedMemberId, calEvents, today) : null;

        // সংরক্ষিত সর্বশেষ মান থেকে হিসাব (নতুন ডেটা নয়)
        const labAlerts = buildLabAlerts(groupObservations(records).map((g) => g.items[0]), dict);

        setData({ member, heightCm, weightKg, bmi, bmiCategory, allergies, vaccination, nextAppt, labAlerts });
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [familyId, selectedMemberId, refreshTick]);

  if (!selectedMemberId) return null;
  if (err) return ErrorBox(err);
  if (loading || !data) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে...");

  const { member, heightCm, weightKg, bmi, bmiCategory, allergies, vaccination, nextAppt, labAlerts } = data;
  const ageYears = member ? getAgeInYears(member.dob) : null;
  const birthYear = member && member.dob ? member.dob.slice(0, 4) : null;
  const adviceLine = bmiAdviceLine(bmiCategory);

  const chip = bmiCategory ? BMI_CHIP[bmiCategory] : null;
  const initial = member && member.name ? Array.from(member.name.trim())[0] || "?" : "?";
  const a0 = allergies[0];
  const allergyText = allergies.length === 0 ? "নেই" : a0.substance + (a0.reaction ? " (" + a0.reaction + ")" : "") + (allergies.length > 1 ? " +" + bn(allergies.length - 1) : "");

  // হিরো-কার্ড: হোম-পেজের মতোই সবুজ গ্রেডিয়েন্ট। অসুখ/ওষুধ এখানে নয় — নিচের তালিকায় (ডুপ্লিকেট এড়াতে)।
  return h("div", { style: { background: "#E4F1E9", color: INK, border: "1px solid #C3D9CC", borderRadius: "16px", padding: "8px 10px", marginBottom: "8px" } },
    h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
      h("div", { "aria-hidden": "true", style: { width: "34px", height: "34px", flexShrink: 0, borderRadius: "50%", background: "#CBE4D5", color: INK, border: "1px solid #B2D2BF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800 } }, initial),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("h3", { style: { fontSize: "18px", fontWeight: 800, margin: 0, lineHeight: 1.2, overflowWrap: "anywhere" } }, member ? member.name : "সদস্য"),
        h("div", { style: { fontSize: "12.5px", color: SOFT, marginTop: "1px" } },
          birthYear ? (ageYears != null ? "বয়স " + bn(Math.floor(ageYears)) + " বছর · " : "") + "জন্ম " + bn(birthYear) : "জন্মতারিখ যোগ করা হয়নি")),
      h("button", {
        onClick: () => setEditing((v) => !v), "aria-label": "উচ্চতা ও ওজন বদলান", "aria-expanded": editing,
        style: { width: "44px", height: "44px", flexShrink: 0, borderRadius: "50%", margin: "-4px 0", border: "1px solid #B2D2BF", background: editing ? "#CBE4D5" : "#fff", color: INK, fontSize: "18px", cursor: "pointer" },
      }, editing ? "✕" : "✎")),

    // ফর্মটি হালকা রঙের জন্য বানানো — তাই সাদা প্যানেলের ভেতরে
    editing && h("div", { style: { marginTop: "10px", background: "#fff", color: "#1F2D2A", borderRadius: "14px", padding: "8px 10px" } },
      h(HealthVitalsWidget, {
        familyId, targetMemberId: selectedMemberId, callerMemberId, refreshTick, embedded: true,
        onSaved: () => { setEditing(false); onVitalsSaved && onVitalsSaved(); },
      })),

    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px", marginTop: "6px", alignItems: "start" } },
      stat("উচ্চতা", heightCm ? String(Math.round(heightCm * 10) / 10) : "—", heightCm ? "cm" : ""),
      stat("ওজন", weightKg ? String(weightKg) : "—", weightKg ? "kg" : ""),
      stat("BMI", bmi ? bmi.toFixed(1) : "—", "", chip)),
    adviceLine && h("div", { style: { fontSize: "12px", lineHeight: 1.35, color: SOFT, marginTop: "5px", padding: "0 2px" } }, adviceLine),
    (!heightCm || !weightKg) && h("div", { style: { fontSize: "13px", color: SOFT, marginTop: "8px", padding: "0 2px" } }, "উচ্চতা/ওজন যোগ করলে BMI ও পরামর্শ এখানে দেখা যাবে (উপরের ✎ চাপুন)।"),

    // এক নজরে: অ্যালার্জি (সবসময় — নিরাপত্তা-তথ্য, "নেই"-ও দেখানো হয়) + যা আছে (পরবর্তী অ্যাপয়েন্টমেন্ট, ল্যাব সতর্কতা, টিকা)
    h("div", { style: { marginTop: "6px", padding: "1px 12px", borderRadius: "12px", background: "var(--hs-surface, #fff)", color: "#1F2D2A", border: "1px solid #CFE0D5" } },
      glance("⚠️", "অ্যালার্জি", allergyText, allergies.length ? "red" : "muted"),
      nextAppt && glance("📅", "পরবর্তী", nextAppt.title + " · " + bnDate(nextAppt.date) + (nextAppt.time ? " " + nextAppt.time : "")),
      labAlerts.length > 0 && glance("🔴", "ল্যাব সতর্কতা", labAlerts.slice(0, 2).map((x) => x.name + (LEVEL_WORD[x.level] ? " " + LEVEL_WORD[x.level] : x.value ? " " + x.value : "")).join(", ") + (labAlerts.length > 2 ? " +" + bn(labAlerts.length - 2) : ""), "red"),
      vaccination && glance("💉", "টিকা", vaccination.done + "/" + vaccination.total + " সম্পন্ন" + (vaccination.overdue > 0 ? " · ⚠️ " + vaccination.overdue + "টির মেয়াদ পার" : ""))));
}
