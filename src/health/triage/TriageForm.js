// Structured Trigger Layer UI (roadmap §10.3 স্তর-১) — member select + বয়স-গ্রুপ
// অনুযায়ী red-flag checklist, সরাসরি deterministic triageEngine.js-এ input (free-text
// নয়, skip-অযোগ্য নয়)। HealthTimeline.js/HealthRecordsSection.js-এর member-picker
// pattern reuse (Process ফাইল Rule ২ — Minimal Change)।

import { ErrorBox, SelectField, PrimaryButton } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { deriveAgeGroup, getChecklistForAgeGroup, runTriage } from "./triageEngine.js";
import { TriageResultView } from "./TriageResultView.js";

const { useState, useEffect } = React;

const AGE_GROUP_LABELS = {
  neonate: "নবজাতক (< ২৮ দিন)",
  infant: "শিশু (< ২ বছর)",
  child: "শিশু (২–১৮ বছর)",
  adult: "প্রাপ্তবয়স্ক",
  elderly: "বয়স্ক (৬৫+)",
};

export function TriageForm({ familyId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [checklist, setChecklist] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        setTargetMemberId((prev) => prev || (list[0] && list[0].id) || null);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId]);

  const targetMember = members && members.find((m) => m.id === targetMemberId);
  const ageGroup = targetMember ? deriveAgeGroup(targetMember.dob) : null;
  const checklistItems = ageGroup ? getChecklistForAgeGroup(ageGroup) : [];

  function handleMemberChange(id) {
    setTargetMemberId(id);
    setChecklist({});
    setResult(null);
  }

  function toggleItem(id) {
    setResult(null);
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function runCheck() {
    setResult(runTriage({ ageGroup, checklist }));
  }

  if (loadErr) return ErrorBox(loadErr);
  if (!members) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");
  }

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "Symptom Check / Triage"),
    SelectField("সদস্য বাছাই করুন", targetMemberId, handleMemberChange, members.map((m) => [m.id, m.name])),

    !ageGroup && targetMember && React.createElement(
      "div", { style: { fontSize: "12px", color: "#C0392B", marginTop: "6px" } },
      "এই সদস্যের জন্ম-তারিখ সেট করা নেই — Health Profile-এ জন্ম-তারিখ যোগ করুন, তারপর triage checklist দেখানো যাবে।"
    ),
    ageGroup && React.createElement(
      "div", { style: { fontSize: "12px", color: "#666", marginTop: "6px" } },
      "বয়স-গ্রুপ: " + (AGE_GROUP_LABELS[ageGroup] || ageGroup)
    ),

    checklistItems.length > 0 && React.createElement(
      "div", { style: { marginTop: "12px", background: "#FFF7E6", padding: "12px", borderRadius: "8px", border: "1px solid #E8C46B" } },
      React.createElement(
        "div", { style: { fontSize: "13px", fontWeight: 600, color: "#7A5B00", marginBottom: "8px" } },
        "নিচের কোনোটা এখন প্রযোজ্য কিনা মিলিয়ে দেখুন (জরুরি সতর্কতা-চেকলিস্ট):"
      ),
      checklistItems.map((it) =>
        React.createElement(
          "label", { key: it.id, style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "6px 0", cursor: "pointer" } },
          React.createElement("input", { type: "checkbox", checked: !!checklist[it.id], onChange: () => toggleItem(it.id) }),
          it.label
        )
      )
    ),

    checklistItems.length > 0 && PrimaryButton("চেক করুন", runCheck),

    result && React.createElement(TriageResultView, { result })
  );
}
