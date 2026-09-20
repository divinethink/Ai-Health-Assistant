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
import { listVerifiedDietGuidanceRules, matchDietGuidanceForTags } from "../nutrition-fitness/dietGuidanceData.js";
import { getAgeInYears } from "../triage/triageEngine.js";
import { listCalendarEvents } from "../calendar/calendarData.js";
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

export function HealthSummaryCard({ familyId, selectedMemberId, refreshTick }) {
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
      listVerifiedDietGuidanceRules(),
      // সম্পূরক লাইন (টিকা/অ্যাপয়েন্টমেন্ট) — এই read ব্যর্থ হলে পুরো কার্ড আটকাবে না, শুধু ঐ দুই লাইন বাদ যাবে।
      listCalendarEvents(familyId).catch(() => null),
    ])
      .then(([members, records, allRules, calEvents]) => {
        const member = members.find((m) => m.id === selectedMemberId) || null;

        const heightObs = records.filter((r) => r.resourceType === "observation" && r.type === "height").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const weightObs = records.filter((r) => r.resourceType === "observation" && r.type === "weight").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const heightCm = heightObs[0] ? parseFloat(heightObs[0].value) : null;
        const weightKg = weightObs[0] ? parseFloat(weightObs[0].value) : null;
        const bmi = (heightCm && weightKg) ? weightKg / ((heightCm / 100) * (heightCm / 100)) : null;
        const bmiCategory = bmiCategoryOf(bmi);

        const activeConditions = records.filter((r) => r.resourceType === "condition" && (r.status === "active" || r.status === "chronic"));
        const activeMeds = records.filter((r) => r.resourceType === "medicationStatement" && r.status === "active");

        const relevantConditions = activeConditions.map((r) => r.name);
        const bmiTag = (bmiCategory && bmiCategory !== "normal") ? bmiCategory : null;
        const dietResult = matchDietGuidanceForTags(allRules, [...relevantConditions, ...(bmiTag ? [bmiTag] : [])]);

        const allergies = records.filter((r) => r.resourceType === "allergy");
        const nowD = new Date();
        const today = nowD.getFullYear() + "-" + String(nowD.getMonth() + 1).padStart(2, "0") + "-" + String(nowD.getDate()).padStart(2, "0"); // লোকাল তারিখ (UTC না)
        const ageForVax = member ? getAgeInYears(member.dob) : null;
        const vaccination = calEvents ? vaccinationSummaryOf(member, ageForVax, calEvents, today) : null;
        const nextAppt = calEvents ? nextAppointmentOf(selectedMemberId, calEvents, today) : null;

        setData({ member, heightCm, weightKg, bmi, bmiCategory, activeConditions, activeMeds, dietResult, allergies, vaccination, nextAppt });
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [familyId, selectedMemberId, refreshTick]);

  if (!selectedMemberId) return null;
  if (err) return ErrorBox(err);
  if (loading || !data) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "লোড হচ্ছে...");

  const { member, heightCm, weightKg, bmi, bmiCategory, activeConditions, activeMeds, dietResult, allergies, vaccination, nextAppt } = data;
  const ageYears = member ? getAgeInYears(member.dob) : null;
  const birthYear = member && member.dob ? member.dob.slice(0, 4) : null;
  const adviceLine = bmiAdviceLine(bmiCategory);

  return React.createElement(
    "div", { style: { background: "#fff", border: "1px solid #E0E4E2", borderRadius: "10px", padding: "14px", marginBottom: "14px" } },

    React.createElement("h3", { style: { fontSize: "16px", color: "#0E4B43", margin: "0 0 8px" } }, "🧑 " + (member ? member.name : "সদস্য")),

    React.createElement("div", { style: { fontSize: "13px", color: "#333", marginBottom: "4px" } },
      birthYear ? "জন্মসাল: " + birthYear + (ageYears != null ? " (আনুমানিক বয়স " + Math.floor(ageYears) + " বছর)" : "") : "জন্মতারিখ যোগ করা হয়নি"
    ),
    React.createElement("div", { style: { fontSize: "13px", color: "#333", marginBottom: "8px" } },
      "উচ্চতা: " + (heightCm ? Math.round(heightCm * 10) / 10 + " cm" : "—") +
      " · ওজন: " + (weightKg ? weightKg + " kg" : "—") +
      " · BMI: " + (bmi ? bmi.toFixed(1) : "—")
    ),
    adviceLine && React.createElement("div", {
      style: { fontSize: "13px", color: bmiCategory === "normal" ? "#0E4B43" : "#8A5A00", background: bmiCategory === "normal" ? "#EAF6F0" : "#FFF6E5", padding: "8px 10px", borderRadius: "6px", marginBottom: "10px" },
    }, adviceLine),
    (!heightCm || !weightKg) && React.createElement("div", { style: { fontSize: "12px", color: "#999", marginBottom: "10px" } }, "উচ্চতা/ওজন যোগ করলে BMI ও পরামর্শ এখানে দেখা যাবে (নিচের ফর্ম ব্যবহার করুন)।"),

    React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#B3261E", marginTop: "6px" } }, "⚠️ এলার্জি"),
    allergies.length === 0
      ? React.createElement("div", { style: { fontSize: "13px", color: "#888" } }, "কোনো এলার্জি রেকর্ড করা নেই।")
      : allergies.map((a) => React.createElement("div", { key: a.id, style: { fontSize: "13px", color: "#333", marginTop: "2px" } },
          "• " + a.substance + (a.reaction ? " — " + a.reaction : "") + (a.severity ? " (" + a.severity + ")" : ""))),

    React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#0E4B43", marginTop: "10px" } }, "🩺 চলমান অসুস্থতা"),
    activeConditions.length === 0
      ? React.createElement("div", { style: { fontSize: "13px", color: "#888" } }, "কোনো সক্রিয় অসুস্থতা নেই।")
      : activeConditions.map((c) => React.createElement("div", { key: c.id, style: { fontSize: "13px", color: "#333", marginTop: "2px" } }, "• " + c.name + (c.notes ? " — " + c.notes : ""))),

    React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#0E4B43", marginTop: "10px" } }, "💊 চলমান ঔষধ"),
    activeMeds.length === 0
      ? React.createElement("div", { style: { fontSize: "13px", color: "#888" } }, "কোনো সক্রিয় ঔষধ নেই।")
      : activeMeds.map((m) => React.createElement("div", { key: m.id, style: { fontSize: "13px", color: "#333", marginTop: "2px" } },
          "• " + m.genericName + (m.frequency ? " — " + m.frequency : "") + (m.durationDays ? " (" + m.durationDays + " দিন)" : "") + (m.mealTiming === "before" ? " · খাবারের আগে" : m.mealTiming === "after" ? " · খাবারের পরে" : ""))),
    activeMeds.length > 0 && React.createElement("div", { style: { fontSize: "11px", color: "#999", marginTop: "4px" } }, "রিমাইন্ডার-সময় সেট করতে \"ঔষধ ও রিমাইন্ডার\" ট্যাবে যান।"),

    vaccination && React.createElement("div", { style: { fontSize: "13px", color: "#333", marginTop: "10px" } },
      "💉 টিকা: " + vaccination.done + "/" + vaccination.total + " সম্পন্ন" + (vaccination.overdue > 0 ? " · ⚠️ " + vaccination.overdue + "টির মেয়াদ পার" : "")),
    nextAppt && React.createElement("div", { style: { fontSize: "13px", color: "#333", marginTop: "6px" } },
      "📅 পরবর্তী অ্যাপয়েন্টমেন্ট: " + nextAppt.title + " — " + nextAppt.date + (nextAppt.time ? " " + nextAppt.time : "")),

    (dietResult.avoidFoods.length > 0 || dietResult.includeFoods.length > 0) && React.createElement(
      React.Fragment, null,
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#0E4B43", marginTop: "10px" } }, "🍽️ খাদ্য নির্দেশিকা (সংক্ষিপ্ত)"),
      dietResult.avoidFoods.length > 0 && React.createElement("div", { style: { fontSize: "12px", color: "#B3261E", marginTop: "2px" } }, "❌ এড়িয়ে চলুন: " + dietResult.avoidFoods.join(", ")),
      dietResult.includeFoods.length > 0 && React.createElement("div", { style: { fontSize: "12px", color: "#0E4B43", marginTop: "2px" } }, "✅ বেশি খান: " + dietResult.includeFoods.join(", ")),
      React.createElement("div", { style: { fontSize: "11px", color: "#999", marginTop: "4px" } }, "বিস্তারিত জন্য \"খাদ্য নির্দেশিকা\" ট্যাবে যান।")
    )
  );
}
