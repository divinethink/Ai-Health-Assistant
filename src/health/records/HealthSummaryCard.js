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
import { t } from "../../shared/i18n.js";
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

// এক-নজর টাইল। tone "red" = সতর্কতা; big+unit = সংখ্যা-টাইল; lines = লেখা-টাইল; inline = প্রতি লাইনে নাম + পাশে ছোট বিবরণ
function tile({ icon, label, big, unit, lines, tone, inline }) {
  const red = tone === "red";
  const box = { background: red ? "#FFF7F6" : "#F4F8F5", border: "1px solid " + (red ? "#E8B4AE" : "#D3E0D9"), borderRadius: "14px", padding: "10px 12px", minHeight: "44px", boxSizing: "border-box", minWidth: 0 };
  return React.createElement("div", { style: box },
    React.createElement("div", { style: { fontSize: "13px", color: "#5F716C" } }, (icon ? icon + " " : "") + label),
    big != null && React.createElement("div", { style: { marginTop: "2px", whiteSpace: "nowrap" } },
      React.createElement("span", { style: { fontSize: "22px", fontWeight: 700, color: "#0E4B43" } }, big),
      unit && React.createElement("span", { style: { fontSize: "14px", color: "#5F716C" } }, " " + unit)),
    (lines || []).filter(Boolean).map((l, i) => React.createElement("div", { key: i, style: { marginTop: i === 0 ? "4px" : "2px", fontSize: l.strong ? "16px" : "14px", fontWeight: l.strong ? 700 : 400, color: l.color || (l.muted ? "#5F716C" : "#1F2D2A"), overflowWrap: "anywhere" } },
      l.t, l.sub && React.createElement("span", { style: { fontSize: "14px", fontWeight: 400, color: "#5F716C" } }, (inline ? "  ·  " : " ") + l.sub))));
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

        const activeConditions = records.filter((r) => r.resourceType === "condition" && (r.status === "active" || r.status === "chronic"));
        const activeMeds = records.filter((r) => r.resourceType === "medicationStatement" && r.status === "active");


        const allergies = records.filter((r) => r.resourceType === "allergy");
        const nowD = new Date();
        const today = nowD.getFullYear() + "-" + String(nowD.getMonth() + 1).padStart(2, "0") + "-" + String(nowD.getDate()).padStart(2, "0"); // লোকাল তারিখ (UTC না)
        const ageForVax = member ? getAgeInYears(member.dob) : null;
        const vaccination = calEvents ? vaccinationSummaryOf(member, ageForVax, calEvents, today) : null;
        const nextAppt = calEvents ? nextAppointmentOf(selectedMemberId, calEvents, today) : null;

        // সংরক্ষিত সর্বশেষ মান থেকে হিসাব (নতুন ডেটা নয়)
        const labAlerts = buildLabAlerts(groupObservations(records).map((g) => g.items[0]), dict);

        setData({ member, heightCm, weightKg, bmi, bmiCategory, activeConditions, activeMeds, allergies, vaccination, nextAppt, labAlerts });
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [familyId, selectedMemberId, refreshTick]);

  if (!selectedMemberId) return null;
  if (err) return ErrorBox(err);
  if (loading || !data) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "লোড হচ্ছে...");

  const { member, heightCm, weightKg, bmi, bmiCategory, activeConditions, activeMeds, allergies, vaccination, nextAppt, labAlerts } = data;
  const ageYears = member ? getAgeInYears(member.dob) : null;
  const birthYear = member && member.dob ? member.dob.slice(0, 4) : null;
  const adviceLine = bmiAdviceLine(bmiCategory);

  return React.createElement(
    "div", { style: { background: "#fff", border: "1px solid #D3E0D9", borderRadius: "16px", boxShadow: "0 2px 8px rgba(14,75,67,0.07)", padding: "14px", marginBottom: "14px" } },

    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "0" } },
      React.createElement("h3", { style: { fontSize: "20px", fontWeight: 800, color: "#0E4B43", margin: 0, overflowWrap: "anywhere" } }, member ? member.name : "সদস্য"),
      React.createElement("button", {
        onClick: () => setEditing((v) => !v), "aria-label": "উচ্চতা ও ওজন বদলান", "aria-expanded": editing,
        style: { width: "44px", height: "44px", flexShrink: 0, borderRadius: "50%", border: "1px solid #C3D2CA", background: editing ? "#E4F0E9" : "#F1F6F2", color: "#0E4B43", fontSize: "18px", cursor: "pointer" },
      }, editing ? "✕" : "✎")),

    editing && React.createElement(HealthVitalsWidget, {
      familyId, targetMemberId: selectedMemberId, callerMemberId, refreshTick, embedded: true,
      onSaved: () => { setEditing(false); onVitalsSaved && onVitalsSaved(); },
    }),

    React.createElement("div", { style: { fontSize: "14px", color: "#5F716C", marginTop: "-4px", marginBottom: "10px" } },
      birthYear ? "জন্ম " + bn(birthYear) + (ageYears != null ? " · বয়স " + bn(Math.floor(ageYears)) + " বছর" : "") : "জন্মতারিখ যোগ করা হয়নি"
    ),

    // উচ্চতা / ওজন / BMI — ৩ টাইল
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" } },
      tile({ label: "উচ্চতা", big: heightCm ? String(Math.round(heightCm * 10) / 10) : "—", unit: heightCm ? "cm" : "" }),
      tile({ label: "ওজন", big: weightKg ? String(weightKg) : "—", unit: weightKg ? "kg" : "" }),
      tile({ label: "BMI", big: bmi ? bmi.toFixed(1) : "—" })),
    adviceLine && React.createElement("div", {
      style: { fontSize: "14px", color: bmiCategory === "normal" ? "#0E4B43" : "#8A5A00", background: bmiCategory === "normal" ? "#EAF6F0" : "#FFF6E5", padding: "8px 10px", borderRadius: "10px", marginTop: "10px" },
    }, adviceLine),
    (!heightCm || !weightKg) && React.createElement("div", { style: { fontSize: "14px", color: "#6B7B76", marginTop: "10px" } }, "উচ্চতা/ওজন যোগ করলে BMI ও পরামর্শ এখানে দেখা যাবে (উপরের ✎ চাপুন)।"),

    // এলার্জি | অসুস্থতা
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", marginTop: "10px" } },
      tile({
        icon: "⚠️", label: "অ্যালার্জি", tone: allergies.length ? "red" : null,
        lines: allergies.length === 0 ? [{ t: "নেই", muted: true }] : [
          { t: allergies[0].substance, strong: true, color: "#B3261E" },
          (allergies[0].reaction || allergies[0].severity) && { t: allergies[0].reaction || t("sev." + allergies[0].severity), muted: true },
          allergies.length > 1 && { t: "আরও " + bn(allergies.length - 1) + "টি", muted: true },
        ],
      }),
      tile({
        icon: "🩺", label: "চলমান অসুস্থতা",
        lines: activeConditions.length === 0 ? [{ t: "নেই", muted: true }] : [
          { t: activeConditions[0].name, strong: true, sub: activeConditions[0].status ? "(" + t("st." + activeConditions[0].status) + ")" : null },
          activeConditions[0].notes && { t: activeConditions[0].notes, muted: true },
          activeConditions.length > 1 && { t: "আরও " + bn(activeConditions.length - 1) + "টি", muted: true },
        ],
      })),

    // চলমান ঔষধ (পুরো প্রস্থ)
    React.createElement("div", { style: { marginTop: "8px" } },
      tile({
        icon: "💊", label: "চলমান ওষুধ" + (activeMeds.length ? " (" + bn(activeMeds.length) + ")" : ""),
        lines: activeMeds.length === 0 ? [{ t: "নেই", muted: true }] : [
          ...activeMeds.slice(0, 3).map((m) => ({ t: m.genericName, strong: true, sub: (m.frequency || null) })),
          activeMeds.length > 3 && { t: "আরও " + bn(activeMeds.length - 3) + "টি — স্বাস্থ্য তথ্য → ওষুধ", muted: true },
        ],
        inline: true,
      })),

    // পরবর্তী অ্যাপয়েন্টমেন্ট | ল্যাব সতর্কতা (যেটা আছে শুধু সেটা; একটা হলে পুরো প্রস্থ)
    (nextAppt || labAlerts.length > 0) && React.createElement("div", { style: { display: "grid", gridTemplateColumns: nextAppt && labAlerts.length > 0 ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: "8px", marginTop: "8px" } },
      nextAppt && tile({
        icon: "📅", label: "পরবর্তী",
        lines: [{ t: nextAppt.title, strong: true }, { t: bnDate(nextAppt.date) + (nextAppt.time ? " · " + nextAppt.time : ""), muted: true }],
      }),
      labAlerts.length > 0 && tile({
        icon: "🔴", label: "ল্যাব সতর্কতা", tone: "red",
        lines: [
          ...labAlerts.slice(0, 2).map((a) => ({ t: a.name + (LEVEL_WORD[a.level] ? " " + LEVEL_WORD[a.level] : a.value ? " " + a.value : ""), strong: true, color: "#B3261E" })),
          labAlerts.length > 2 && { t: "আরও " + bn(labAlerts.length - 2) + "টি", muted: true },
        ],
      })),

    vaccination && React.createElement("div", { style: { fontSize: "14px", color: "#1F2D2A", marginTop: "10px" } },
      "💉 টিকা: " + vaccination.done + "/" + vaccination.total + " সম্পন্ন" + (vaccination.overdue > 0 ? " · ⚠️ " + vaccination.overdue + "টির মেয়াদ পার" : "")),

  );
}
