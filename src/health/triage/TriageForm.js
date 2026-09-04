// Structured Trigger Layer UI (roadmap §10.3 স্তর-১) — member select + বয়স-গ্রুপ
// অনুযায়ী red-flag checklist, সরাসরি deterministic triageEngine.js-এ input (free-text
// নয়, skip-অযোগ্য নয়)। HealthTimeline.js/HealthRecordsSection.js-এর member-picker
// pattern reuse (Process ফাইল Rule ২ — Minimal Change)।

import { ErrorBox, SelectField, TextField, PrimaryButton } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { deriveAgeGroup, getChecklistForAgeGroup, isPediatricAgeGroup, runTriage, CHIEF_COMPLAINTS } from "./triageEngine.js";
import { TriageResultView } from "./TriageResultView.js";
import { assembleHealthContext } from "../../legacy/healthContextEngine.js";
import { askAI } from "../../ai/aiClient.js";

const { useState, useEffect } = React;

function checkboxLine(label, checked, onChange) {
  return React.createElement(
    "label", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "6px 0", cursor: "pointer" } },
    React.createElement("input", { type: "checkbox", checked, onChange }),
    label
  );
}

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
  const [chiefComplaint, setChiefComplaint] = useState("none");
  const [feverDays, setFeverDays] = useState("");
  const [diarrheaDays, setDiarrheaDays] = useState("");
  const [bloodyStool, setBloodyStool] = useState(false);
  const [stridorCalm, setStridorCalm] = useState(false);
  const [chestIndrawing, setChestIndrawing] = useState(false);
  const [fastBreathing, setFastBreathing] = useState(false);
  const [cough14Days, setCough14Days] = useState(false);
  const [earSwellingTender, setEarSwellingTender] = useState(false);
  const [earPainDischarge, setEarPainDischarge] = useState(false);
  const [earDurationDays, setEarDurationDays] = useState("");
  const [measlesSevere, setMeaslesSevere] = useState(false);
  const [measlesEyeMouth, setMeaslesEyeMouth] = useState(false);
  const [measlesCurrent, setMeaslesCurrent] = useState(false);
  const [result, setResult] = useState(null);
  const [healthContext, setHealthContext] = useState(null);
  const [contextErr, setContextErr] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiErr, setAiErr] = useState(null);

  function check(setter) {
    return () => { setter((v) => !v); setResult(null); setHealthContext(null); };
  }

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
    setChiefComplaint("none");
    setResult(null);
  }

  function toggleItem(id) {
    setResult(null);
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function runCheck() {
    const triageResult = runTriage({
      ageGroup, checklist, chiefComplaint,
      complaintInputs: {
        feverDays, diarrheaDays, bloodyStool,
        stridorCalm, chestIndrawing, fastBreathing, cough14Days,
        earSwellingTender, earPainDischarge, earDurationDays,
        measlesSevere, measlesEyeMouth, measlesCurrent,
      },
    });
    setResult(triageResult);
    setHealthContext(null);
    setContextErr(null);
    setAiResponse(null);
    setAiErr(null);
    // Health Context Engine — শুধু in-memory assemble/preview, কোনো Firestore write
    // বা cloud/AI call এখানে নেই (Cloudflare Worker LLM-proxy পরের ধাপে যোগ হবে)।
    assembleHealthContext(familyId, targetMemberId, triageResult, { symptoms: chiefComplaint })
      .then(setHealthContext)
      .catch((e) => setContextErr(e.message || String(e)));
  }

  function handleAskAI() {
    if (!healthContext) return;
    setAiLoading(true);
    setAiErr(null);
    setAiResponse(null);
    askAI(familyId, healthContext)
      .then((data) => setAiResponse(data && data.content))
      .catch((e) => setAiErr(e.message || String(e)))
      .finally(() => setAiLoading(false));
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

    ageGroup && isPediatricAgeGroup(ageGroup) && React.createElement(
      "div", { style: { marginTop: "12px" } },
      SelectField("প্রধান সমস্যা (chief complaint)", chiefComplaint, (v) => { setChiefComplaint(v); setResult(null); }, CHIEF_COMPLAINTS),
      chiefComplaint === "fever" && TextField("জ্বর কতদিন ধরে (দিন সংখ্যা)", feverDays, (v) => { setFeverDays(v); setResult(null); }, "যেমন: 2"),
      chiefComplaint === "diarrhea" && React.createElement(
        React.Fragment, null,
        TextField("ডায়রিয়া কতদিন ধরে (দিন সংখ্যা)", diarrheaDays, (v) => { setDiarrheaDays(v); setResult(null); }, "যেমন: 3"),
        checkboxLine("মলে রক্ত আছে", bloodyStool, check(setBloodyStool))
      ),
      chiefComplaint === "cough" && React.createElement(
        React.Fragment, null,
        checkboxLine("শিশু স্থির/শান্ত থাকা অবস্থায়ও শ্বাসের সাথে শব্দ (stridor)", stridorCalm, check(setStridorCalm)),
        checkboxLine("শ্বাস নেওয়ার সময় বুক দেবে যাচ্ছে (chest indrawing)", chestIndrawing, check(setChestIndrawing)),
        checkboxLine("দ্রুত শ্বাস-প্রশ্বাস (fast breathing)", fastBreathing, check(setFastBreathing)),
        checkboxLine("কাশি ১৪ দিনের বেশি ধরে", cough14Days, check(setCough14Days))
      ),
      chiefComplaint === "ear" && React.createElement(
        React.Fragment, null,
        checkboxLine("কানের পেছনে ফোলা/ব্যথা (tenderness)", earSwellingTender, check(setEarSwellingTender)),
        checkboxLine("কানে ব্যথা/স্রাব হচ্ছে", earPainDischarge, check(setEarPainDischarge)),
        earPainDischarge && TextField("কতদিন ধরে (দিন সংখ্যা)", earDurationDays, (v) => { setEarDurationDays(v); setResult(null); }, "যেমন: 5")
      ),
      chiefComplaint === "measles" && React.createElement(
        React.Fragment, null,
        checkboxLine("গুরুতর জটিলতা (খুব অসুস্থ/গভীর মুখের ঘা/কর্নিয়া মেঘলা)", measlesSevere, check(setMeaslesSevere)),
        checkboxLine("চোখ/মুখে হালকা জটিলতা (পুঁজ/ঘা)", measlesEyeMouth, check(setMeaslesEyeMouth)),
        checkboxLine("বর্তমানে বা গত ৩ মাসে হাম হয়েছে, জটিলতা ছাড়া", measlesCurrent, check(setMeaslesCurrent))
      )
    ),

    checklistItems.length > 0 && PrimaryButton("চেক করুন", runCheck),

    result && React.createElement(TriageResultView, { result }),

    contextErr && React.createElement("div", { style: { fontSize: "11px", color: "#C0392B", marginTop: "8px" } }, "Health Context তৈরি করা যায়নি: " + contextErr),
    healthContext && React.createElement(
      "details", { style: { marginTop: "10px", fontSize: "11px", color: "#666" } },
      React.createElement("summary", null, "Health Context (dev-preview)"),
      React.createElement("pre", { style: { whiteSpace: "pre-wrap", background: "#F5F5F0", padding: "8px", borderRadius: "6px" } }, JSON.stringify(healthContext, null, 2))
    ),

    healthContext && React.createElement(
      "div", { style: { marginTop: "12px" } },
      PrimaryButton(aiLoading ? "AI ভাবছে..." : "AI-কে জিজ্ঞাসা করুন", handleAskAI)
    ),

    aiErr && React.createElement(
      "div", { style: { fontSize: "12px", color: "#C0392B", marginTop: "8px" } },
      "AI response পাওয়া যায়নি: " + aiErr
    ),

    aiResponse && React.createElement(
      "div", { style: { marginTop: "12px", background: "#EAF6F0", padding: "12px", borderRadius: "8px", border: "1px solid #A9D8C4" } },
      React.createElement("div", { style: { fontSize: "12px", fontWeight: 600, color: "#0E4B43", marginBottom: "6px" } }, "AI Guidance (dev-preview — এখনো chat-history save হচ্ছে না)"),
      React.createElement("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap", color: "#333" } }, aiResponse)
    )
  );
}
