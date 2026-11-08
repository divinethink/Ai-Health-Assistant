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

  const F = "14px";
  const bullets = (items, sources) => React.createElement("ul", { style: { margin: 0, paddingLeft: "20px", fontSize: F, color: "#1F2D2A", lineHeight: 1.6 } },
    items.map((x, i) => React.createElement("li", { key: i, style: { marginBottom: "4px" } }, x,
      sources && sources[x] && sources[x].length > 1 && React.createElement("span", { style: { color: "#6B7B76", fontSize: "12px" } }, " (" + sources[x].join(", ") + ")"))));
  const box = (title, items, color, bg, sources) => React.createElement("div", { style: { background: bg, borderRadius: "14px", padding: "12px", marginTop: "10px", border: "1px solid " + color + "33" } },
    React.createElement("div", { style: { fontSize: "15px", fontWeight: 700, color, marginBottom: "8px" } }, title),
    items.length ? bullets(items, sources) : React.createElement("div", { style: { fontSize: F, color: "#5F716C" } }, "নির্দিষ্ট কিছু নেই"));

  return React.createElement(
    "div", { style: { marginTop: "0" } },
    !result && React.createElement("div", { style: { marginTop: "8px", color: "#5F716C", fontSize: F } }, "লোড হচ্ছে..."),
    result && result.matchedTags.length === 0 && React.createElement(
      "div", { style: { padding: "10px", background: "#EEF5F0", borderRadius: "14px", fontSize: F, color: "#3E4E49" } },
      "কোনো নির্দিষ্ট শর্ত পাওয়া যায়নি — সাধারণ সুষম খাদ্যাভ্যাস অনুসরণ করুন।"
    ),
    result && result.matchedTags.length > 0 && React.createElement(
      React.Fragment, null,
      React.createElement("div", { style: { fontSize: F, fontWeight: 600, color: "#0E4B43", marginBottom: "6px" } }, "🩺 আপনার সমস্যা"),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
        result.matchedTags.map((tag) => React.createElement("span", { key: tag, style: { padding: "4px 12px", borderRadius: "999px", background: "#fff", border: "1px solid #C3D2CA", fontSize: F, color: "#0E4B43", fontWeight: 600 } }, tag))),
      box("❌ এড়িয়ে চলুন", result.avoidFoods, "#B3261E", "#FDF0EE", result.avoidSources),
      box("✅ খাবেন", result.includeFoods, "#0E4B43", "#EAF6F0"),
      result.matchedTags.length > 1 && React.createElement("button", {
        onClick: () => setOpenTag(openTag ? null : "__all"),
        style: { marginTop: "12px", width: "100%", padding: "10px", borderRadius: "12px", border: "1px solid #C3D2CA", background: "#fff", color: "#0E4B43", fontSize: F, fontWeight: 600, cursor: "pointer" },
      }, openTag ? "▲ অসুখ-ভিত্তিক বিস্তারিত বন্ধ করুন" : "▼ অসুখ-ভিত্তিক বিস্তারিত দেখুন"),
      openTag && result.byTag.map((b) => React.createElement("div", { key: b.tag, style: { marginTop: "10px", border: "1px solid #D3E0D9", borderRadius: "14px", padding: "10px 12px", background: "#fff" } },
        React.createElement("div", { style: { fontSize: F, fontWeight: 700, color: "#0E4B43", marginBottom: "4px" } }, b.tag),
        b.avoid.length > 0 && React.createElement("div", { style: { fontSize: F, color: "#B3261E", fontWeight: 600, marginTop: "4px" } }, "❌ এড়িয়ে চলুন"),
        b.avoid.length > 0 && bullets(b.avoid),
        b.include.length > 0 && React.createElement("div", { style: { fontSize: F, color: "#0E4B43", fontWeight: 600, marginTop: "6px" } }, "✅ খাবেন"),
        b.include.length > 0 && bullets(b.include)))
    )
  );
}
