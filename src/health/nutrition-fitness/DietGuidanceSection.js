// খাদ্য নির্দেশিকা — UI (Amendment Plan Item ১, dietGuidanceData.js data-layer
// ব্যবহার করে)। Read-only display — Condition/Allergy ভিত্তিক matched
// avoid/include food তালিকা, কোনো chat/input এখানে নেই (owner-confirmed)।
// member-selector unification (owner-request): নিজস্ব member-fetch/dropdown
// সরিয়ে parent (HealthRecordsPageSection)-এর `selectedMemberId` প্রপ ব্যবহার —
// পুরো হোম-পেজে একবার সদস্য বাছলেই এই sub-tab-এও persist থাকে।

import { ErrorBox } from "../../shared/ui.js";
import { bnNum } from "../../shared/dates.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { foodColumns, habitTipsBox } from "./FoodColumns.js";
import { tagLabel } from "./tagLabels.js";
import { FoodGroupGuide } from "./FoodGroupGuide.js";
import { listDietGuidanceRules, matchFoodGuidance } from "./dietGuidanceData.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { getGoal, getWeekDaily } from "../tracker/trackerData.js";
import { ageYears, detectFlagsFromConditions, safetyGate } from "../tracker/trackerCalc.js";
import { allergyTagsOf } from "../tracker/mealPlanData.js";
import { conditionKeysOf } from "../tracker/avoidRules.js";
import { recentDates, buildRecentFoodCards } from "../tracker/recentFoods.js";

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

// compact (ঐচ্ছিক, ডিফল্ট false): শুধু প্রথম ৩টি "এড়িয়ে চলুন" — ট্র্যাকারের মিল-পাতার জন্য।
// বিদ্যমান ব্যবহার (compact ছাড়া) অপরিবর্তিত।
export function DietGuidanceSection({ familyId, selectedMemberId, compact }) {
  const [loadErr, setLoadErr] = useState(null);
  const [result, setResult] = useState(null); // { avoidFoods, includeFoods, matchedTags }
  const [openTag, setOpenTag] = useState(null);
  const targetMemberId = selectedMemberId;

  useEffect(() => {
    if (!targetMemberId) return;
    setResult(null);
    Promise.all([
      listHealthRecords(familyId, targetMemberId), listDietGuidanceRules(),
      listMembers(familyId).catch(() => []), getGoal(familyId, targetMemberId).catch(() => null), // বয়স/অবস্থা-নিয়মের জন্য; না এলে শুধু বাকি নিয়ম
      getWeekDaily(familyId, targetMemberId, recentDates()).catch(() => []), // সাম্প্রতিক খাবার (গত ১৪ দিন); ব্যর্থ হলে শুধু বাকি অংশ
    ])
      .then(([records, allRules, members, goal, dailyDocs]) => {
        const member = (members || []).find((m) => m.id === targetMemberId) || null;
        const relevantConditions = records
          .filter((r) => r.resourceType === "condition" && (r.status === "active" || r.status === "chronic"))
          .map((r) => r.name);
        const relevantAllergies = records
          .filter((r) => r.resourceType === "allergy")
          .map((r) => r.substance);
        const bmiTag = deriveBmiTag(records);
        const age = member ? ageYears(member.dob) : null;
        const detected = detectFlagsFromConditions(records);
        const flags = { diabetes: !!(goal && goal.flags && goal.flags.diabetes) || detected.diabetes, kidney: !!(goal && goal.flags && goal.flags.kidney) || detected.kidney, pregnant: !!(goal && goal.flags && goal.flags.pregnant) };
        let recent;
        try {
          recent = buildRecentFoodCards({ dailyDocs, goal, allergyTags: allergyTagsOf(relevantAllergies), ctx: { age, flags, condKeys: conditionKeysOf(records) }, gateBlocked: safetyGate({ age, flags }).blocked });
        } catch (e) { recent = undefined; }
        setResult({ statusCtx: { allergyTags: allergyTagsOf(relevantAllergies), ctx: { age, flags, condKeys: conditionKeysOf(records) } }, ...matchFoodGuidance(allRules, [...relevantConditions, ...relevantAllergies, ...(bmiTag ? [bmiTag] : [])], { records, age, goal }), recent });
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId, targetMemberId]);

  if (loadErr) return ErrorBox(loadErr);
  if (!targetMemberId) return React.createElement("div", null, "সদস্য বেছে নিন।");

  const F = "14px";
  // রোগ-ট্যাগ চিপ — কাঁচা ট্যাগ (ibs, overweight) বাংলা লেবেল + আইকনে (tagLabels.js)
  const tagChip = (tag) => { const l = tagLabel(tag); return React.createElement("span", { key: tag, style: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px 4px 5px", borderRadius: "999px", background: "linear-gradient(135deg, var(--hs-chip-bg, #EEF3F0), var(--hs-surface, #fff))", border: "1px solid var(--hs-border, #C3D2CA)", boxShadow: "0 2px 6px rgba(14,75,67,0.08)", fontSize: F, color: "var(--hs-primary, #0E4B43)", fontWeight: 700 } },
    React.createElement("span", { "aria-hidden": true, style: { width: "26px", height: "26px", borderRadius: "50%", background: "var(--hs-surface, #fff)", border: "1px solid var(--hs-border, #C3D2CA)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "14px" } }, l.icon), l.text); };

  if (compact) {
    const top = result ? result.avoidFoods.slice(0, 3) : [];
    const more = result ? result.avoidFoods.length - top.length : 0;
    return React.createElement("div", null,
      !result && React.createElement("div", { style: { color: "#5F716C", fontSize: F } }, "লোড হচ্ছে..."),
      result && top.length === 0 && React.createElement("div", { style: { padding: "10px", background: "#EEF5F0", borderRadius: "14px", fontSize: F, color: "#3E4E49" } }, "কোনো নির্দিষ্ট শর্ত পাওয়া যায়নি — সাধারণ সুষম খাদ্যাভ্যাস অনুসরণ করুন।"),
      result && top.length > 0 && foodColumns({ avoid: top, include: [], avoidSources: result.avoidSources, avoidTitle: "আজ এড়িয়ে চলুন" }),
      more > 0 && React.createElement("div", { style: { fontSize: "12px", color: "#5F716C", marginTop: "6px" } }, "আরও " + bnNum(more) + "টি আছে — পূর্ণ তালিকায় দেখুন।"));
  }

  const guide = result ? React.createElement(FoodGroupGuide, { allergyTags: result.statusCtx.allergyTags, ctx: result.statusCtx.ctx }) : null;
  return React.createElement(
    "div", { style: { marginTop: "0" } },
    !result && React.createElement("div", { style: { marginTop: "8px", color: "#5F716C", fontSize: F } }, "লোড হচ্ছে..."),
    result && result.matchedTags.length === 0 && React.createElement(
      "div", { style: { padding: "10px", background: "#EEF5F0", borderRadius: "14px", fontSize: F, color: "#3E4E49" } },
      "কোনো নির্দিষ্ট শর্ত পাওয়া যায়নি — সাধারণ সুষম খাদ্যাভ্যাস অনুসরণ করুন।"
    ),
    result && result.matchedTags.length === 0 && guide,
    result && result.matchedTags.length > 0 && React.createElement(
      React.Fragment, null,
      React.createElement("div", { style: { fontSize: "13px", fontWeight: 800, letterSpacing: "0.3px", color: "var(--hs-muted, #5F716C)", marginBottom: "8px" } }, "🩺 আপনার সমস্যা"),
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" } }, result.matchedTags.map(tagChip)),
      foodColumns({ avoid: result.avoidFoods, include: result.includeFoods, avoidSources: result.avoidSources, recent: result.recent }),
      habitTipsBox(result.habitTips),
      guide,
      result.matchedTags.length > 1 && React.createElement("button", {
        onClick: () => setOpenTag(openTag ? null : "__all"),
        style: { marginTop: "14px", width: "100%", minHeight: "48px", padding: "10px", borderRadius: "14px", border: "1px solid var(--hs-border, #C3D2CA)", background: "var(--hs-surface, #fff)", boxShadow: "0 2px 8px rgba(14,75,67,0.08)", color: "var(--hs-primary, #0E4B43)", fontSize: F, fontWeight: 700, cursor: "pointer" },
      }, openTag ? "▲ অসুখ-ভিত্তিক বিস্তারিত বন্ধ করুন" : "▼ অসুখ-ভিত্তিক বিস্তারিত দেখুন"),
      openTag && result.byTag.map((b) => React.createElement("div", { key: b.tag, style: { marginTop: "12px", border: "1px solid var(--hs-border, #D3E0D9)", borderRadius: "18px", padding: "12px", background: "var(--hs-surface, #fff)", boxShadow: "0 4px 14px rgba(14,75,67,0.06)" } },
        tagChip(b.tag),
        foodColumns({ avoid: b.avoid, include: b.include }), habitTipsBox(b.tips)))
    )
  );
}
