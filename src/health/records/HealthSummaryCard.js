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
    ])
      .then(([members, records, allRules]) => {
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

        setData({ member, heightCm, weightKg, bmi, bmiCategory, activeConditions, activeMeds, dietResult });
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [familyId, selectedMemberId, refreshTick]);

  if (!selectedMemberId) return null;
  if (err) return ErrorBox(err);
  if (loading || !data) return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "লোড হচ্ছে...");

  const { member, heightCm, weightKg, bmi, bmiCategory, activeConditions, activeMeds, dietResult } = data;
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

    React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#0E4B43", marginTop: "6px" } }, "🩺 চলমান অসুস্থতা"),
    activeConditions.length === 0
      ? React.createElement("div", { style: { fontSize: "13px", color: "#888" } }, "কোনো সক্রিয় অসুস্থতা নেই।")
      : activeConditions.map((c) => React.createElement("div", { key: c.id, style: { fontSize: "13px", color: "#333", marginTop: "2px" } }, "• " + c.name + (c.notes ? " — " + c.notes : ""))),

    React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#0E4B43", marginTop: "10px" } }, "💊 চলমান ঔষধ"),
    activeMeds.length === 0
      ? React.createElement("div", { style: { fontSize: "13px", color: "#888" } }, "কোনো সক্রিয় ঔষধ নেই।")
      : activeMeds.map((m) => React.createElement("div", { key: m.id, style: { fontSize: "13px", color: "#333", marginTop: "2px" } },
          "• " + m.genericName + (m.frequency ? " — " + m.frequency : "") + (m.durationDays ? " (" + m.durationDays + " দিন)" : ""))),
    activeMeds.length > 0 && React.createElement("div", { style: { fontSize: "11px", color: "#999", marginTop: "4px" } }, "রিমাইন্ডার-সময় সেট করতে \"ঔষধ ও রিমাইন্ডার\" ট্যাবে যান।"),

    (dietResult.avoidFoods.length > 0 || dietResult.includeFoods.length > 0) && React.createElement(
      React.Fragment, null,
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 600, color: "#0E4B43", marginTop: "10px" } }, "🍽️ খাদ্য নির্দেশিকা (সংক্ষিপ্ত)"),
      dietResult.avoidFoods.length > 0 && React.createElement("div", { style: { fontSize: "12px", color: "#B3261E", marginTop: "2px" } }, "❌ এড়িয়ে চলুন: " + dietResult.avoidFoods.join(", ")),
      dietResult.includeFoods.length > 0 && React.createElement("div", { style: { fontSize: "12px", color: "#0E4B43", marginTop: "2px" } }, "✅ বেশি খান: " + dietResult.includeFoods.join(", ")),
      React.createElement("div", { style: { fontSize: "11px", color: "#999", marginTop: "4px" } }, "বিস্তারিত জন্য \"খাদ্য নির্দেশিকা\" ট্যাবে যান।")
    )
  );
}
