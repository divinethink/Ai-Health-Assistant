// খাদ্য নির্দেশিকা — UI (Amendment Plan Item ১, dietGuidanceData.js data-layer
// ব্যবহার করে)। Read-only display — Condition/Allergy ভিত্তিক matched
// avoid/include food তালিকা, কোনো chat/input এখানে নেই (owner-confirmed)।
// HealthRecordsSection.js-এর member-picker pattern reuse।

import { ErrorBox, SelectField } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { listVerifiedDietGuidanceRules, matchDietGuidanceForTags } from "./dietGuidanceData.js";

const { useState, useEffect } = React;

export function DietGuidanceSection({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [result, setResult] = useState(null); // { avoidFoods, includeFoods, matchedTags }
  const [openTag, setOpenTag] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        if (list.length > 0) setTargetMemberId(list[0].id);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId]);

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
        setResult(matchDietGuidanceForTags(allRules, [...relevantConditions, ...relevantAllergies]));
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId, targetMemberId]);

  if (loadErr) return ErrorBox(loadErr);
  if (!members) return React.createElement("div", null, "লোড হচ্ছে...");

  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    SelectField("সদস্য বাছাই করুন", targetMemberId, setTargetMemberId, members.map((m) => [m.id, m.name])),
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
