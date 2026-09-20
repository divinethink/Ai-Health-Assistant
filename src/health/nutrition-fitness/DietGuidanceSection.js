// খাদ্য নির্দেশিকা — UI (Amendment Plan Item ১, dietGuidanceData.js data-layer
// ব্যবহার করে)। Read-only display — Condition/Allergy ভিত্তিক matched
// avoid/include food তালিকা, কোনো chat/input এখানে নেই (owner-confirmed)।
// member-selector unification (owner-request): নিজস্ব member-fetch/dropdown
// সরিয়ে parent (HealthRecordsPageSection)-এর `selectedMemberId` প্রপ ব্যবহার —
// পুরো হোম-পেজে একবার সদস্য বাছলেই এই sub-tab-এও persist থাকে।

import { ErrorBox } from "../../shared/ui.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { listVerifiedDietGuidanceRules, matchDietGuidanceForTags } from "./dietGuidanceData.js";

const { useState, useEffect } = React;

// BMI category derive (owner-request, item ৩, ২০২৬-০৯-১৬) — সর্বশেষ verified
// height/weight Observation থেকে client-side BMI বের করে dietGuidanceRules-এর
// tag-match-এ যোগ করা হয় (dietGuidanceData.js-এর matchDietGuidanceForTags()
// substring-match logic অপরিবর্তিত — শুধু নতুন tag-value পাঠানো হচ্ছে,
// HealthVitalsWidget.js-এর BMI-হিসাব একই সূত্র reuse)। normal-range-এ কোনো
// tag পাঠানো হয় না (নির্দিষ্ট restriction দরকার নেই)।
function deriveBmiTag(records) {
  const heightObs = records.filter((r) => r.resourceType === "observation" && r.type === "height").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const weightObs = records.filter((r) => r.resourceType === "observation" && r.type === "weight").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const h = heightObs[0] ? parseFloat(heightObs[0].value) : null;
  const w = weightObs[0] ? parseFloat(weightObs[0].value) : null;
  if (!h || !w) return null;
  const bmi = w / ((h / 100) * (h / 100));
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return null;
  if (bmi < 30) return "overweight";
  return "obese";
}

export function DietGuidanceSection({ familyId, selectedMemberId }) {
  const [loadErr, setLoadErr] = useState(null);
  const [result, setResult] = useState(null); // { avoidFoods, includeFoods, matchedTags }
  const [openTag, setOpenTag] = useState(null);
  const targetMemberId = selectedMemberId;

  useEffect(() => {
    if (!targetMemberId) return;
    setResult(null);
    Promise.all([listHealthRecords(familyId, targetMemberId), listVerifiedDietGuidanceRules()])
      .then(([records, allRules]) => {
        const relevantConditions = records
          .filter((r) => r.resourceType === "condition" && (r.status === "active" || r.status === "chronic"))
          .map((r) => r.name);
        const relevantAllergies = records
          .filter((r) => r.resourceType === "allergy")
          .map((r) => r.substance);
        const bmiTag = deriveBmiTag(records);
        setResult(matchDietGuidanceForTags(allRules, [...relevantConditions, ...relevantAllergies, ...(bmiTag ? [bmiTag] : [])]));
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId, targetMemberId]);

  if (loadErr) return ErrorBox(loadErr);
  if (!targetMemberId) return React.createElement("div", null, "সদস্য নির্বাচন করুন।");

  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    !result && React.createElement("div", { style: { marginTop: "8px", color: "#888", fontSize: "13px" } }, "লোড হচ্ছে..."),
    result && result.matchedTags.length === 0 && React.createElement(
      "div", { style: { marginTop: "10px", padding: "10px", background: "#F5F5F0", borderRadius: "8px", fontSize: "13px", color: "#555" } },
      "কোনো নির্দিষ্ট শর্ত পাওয়া যায়নি — সাধারণ সুষম খাদ্যাভ্যাস অনুসরণ করুন।"
    ),
    result && result.matchedTags.length > 0 && React.createElement(
      "div", { style: { marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" } },
      result.matchedTags.map((tag) => {
        const isOpen = openTag === tag;
        return React.createElement(
          "div", { key: tag, style: { border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden" } },
          React.createElement(
            "button", {
              onClick: () => setOpenTag(isOpen ? null : tag),
              style: { width: "100%", textAlign: "left", padding: "10px 12px", background: "#fff", border: "none", fontSize: "13px", fontWeight: 600, color: "#0E4B43", cursor: "pointer", display: "flex", justifyContent: "space-between" },
            },
            tag, React.createElement("span", null, isOpen ? "▲" : "▼")
          ),
          isOpen && React.createElement(
            "div", { style: { padding: "10px 12px", background: "#F5F5F0", fontSize: "13px" } },
            React.createElement("div", { style: { color: "#B3261E", fontWeight: 600, marginBottom: "4px" } }, "❌ এড়িয়ে চলুন"),
            React.createElement("div", { style: { marginBottom: "10px" } }, result.avoidFoods.length ? result.avoidFoods.join(", ") : "নির্দিষ্ট কিছু নেই"),
            React.createElement("div", { style: { color: "#0E4B43", fontWeight: 600, marginBottom: "4px" } }, "✅ বেশি খান"),
            React.createElement("div", null, result.includeFoods.length ? result.includeFoods.join(", ") : "নির্দিষ্ট কিছু নেই")
          )
        );
      })
    )
  );
}
