// Medical Science / Allopathy — General Discussion Chat (owner-request, ২০২৬-০৯-১২) —
// HerbalHomeopathyChat.js/NutritionGuidance.js-এর হুবহু pattern reuse (Process Rule ২ —
// Minimal Change): existing AI-call architecture (askAI/healthContextEngine) reuse,
// কোনো নতুন triage/schema/worker dose-logic লাগেনি। শুধু context.specialty =
// "medical-science" override করা হয়েছে (definitional, keyword-detection না —
// nutrition-fitness/herbal-homeopathy-এর একই যুক্তি)।
//
// এটা Symptom Check (deterministic triage + dose-enforcement, §9/§10.2) থেকে সম্পূর্ণ
// আলাদা ও সম্পূরক — সেটা structured emergency/dose-flow-এর জন্য, এটা সাধারণ
// medical-science/allopathy খোলামেলা আলোচনার জন্য (শুধু dose এখানে দেওয়া হবে না,
// worker SPECIALTY_NOTES["medical-science"] দিয়ে সেই সীমা বলবৎ থাকে — diagnosis-avoidance
// ভাষা owner-request অনুযায়ী সরানো হয়েছে, ২০২৬-০৯-১২, যাতে বোঝার জন্য সম্ভাব্য কারণ/
// condition নিয়ে খোলাখুলি আলোচনা করা যায়)।

import { SelectField, TextField, PrimaryButton } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { assembleHealthContext } from "../../legacy/healthContextEngine.js";
import { askAI } from "../../ai/aiClient.js";

const { useState, useEffect } = React;

export function MedicalScienceChat({ familyId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [err, setErr] = useState(null);
  const [retryNote, setRetryNote] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        setTargetMemberId((prev) => prev || (list[0] && list[0].id) || null);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId]);

  function handleMemberChange(id) {
    setTargetMemberId(id);
    setResponse(null);
    setErr(null);
  }

  async function handleAsk() {
    const text = question.trim();
    if (!text || !targetMemberId) return;
    setLoading(true);
    setErr(null);
    setRetryNote(null);
    setResponse(null);
    try {
      const { context, ageYears } = await assembleHealthContext(familyId, targetMemberId, null, { symptoms: text });
      context.specialty = "medical-science"; // দেখুন উপরের নোট — definitional override
      const data = await askAI(familyId, context, [], {
        onRetry: (attempt, max) => setRetryNote("একটু অপেক্ষা করুন... (retry " + attempt + "/" + max + ")"),
        ageYears,
      });
      setResponse(data && data.content);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
      setRetryNote(null);
    }
  }

  if (loadErr) return React.createElement("div", { style: { marginTop: "14px" } }, React.createElement("div", { style: { color: "#C0392B", fontSize: "13px" } }, "সদস্য তালিকা লোড ব্যর্থ: " + loadErr));
  if (!members) return null;

  return React.createElement(
    "div", { style: { marginTop: "14px", background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #E0E4E2" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", margin: "0 0 8px" } }, "Medical Science / এলোপ্যাথি — জিজ্ঞাসা করুন"),
    React.createElement("div", { style: { fontSize: "12px", color: "#666", marginBottom: "6px" } },
      "সাধারণ মেডিকেল সায়েন্স/এলোপ্যাথি আলোচনা — এটা symptom-triage/emergency-checklist না, এবং কোনো ওষুধের dose/মাত্রা এখানে বলা হবে না (dose-প্রয়োজনে উপরের \"Symptom Check\" ব্যবহার করুন)। কোনো severe/জরুরি উপসর্গ থাকলে দয়া করে \"Symptom Check\" ব্যবহার করুন।"
    ),
    SelectField("সদস্য নির্বাচন করুন", targetMemberId || "", handleMemberChange, members.map((m) => [m.id, m.name])),
    TextField("আপনার প্রশ্ন (যেমন: উচ্চ রক্তচাপ কীভাবে নিয়ন্ত্রণ করা যায়?)", question, setQuestion, "এখানে লিখুন..."),

    React.createElement(
      "details", { style: { marginTop: "10px", fontSize: "11px", color: "#555", background: "#F3F6F5", padding: "8px 10px", borderRadius: "6px", border: "1px solid #D8E3E0" } },
      React.createElement("summary", { style: { cursor: "pointer", fontWeight: 600, color: "#0E4B43" } }, "🔒 AI ব্যবহারের গোপনীয়তা তথ্য"),
      React.createElement(
        "div", { style: { marginTop: "6px", lineHeight: "1.5" } },
        "এই প্রশ্নোত্তরের জন্য ক্লাউড-ভিত্তিক AI (Groq) ব্যবহার করা হচ্ছে। Zero Data Retention (ZDR) মোড সক্রিয় থাকায় Groq এই তথ্য দিয়ে কোনো মডেল ট্রেইন করে না। আপনার নাম, ফোন নম্বর বা সরাসরি পরিচয়সূচক কোনো তথ্য কখনো পাঠানো হয় না — শুধু বয়স-গ্রুপ ও প্রাসঙ্গিক প্রশ্ন/স্বাস্থ্য-তথ্য পাঠানো হয়।"
      )
    ),

    PrimaryButton("পরামর্শ নিন", handleAsk, loading),
    retryNote && React.createElement("div", { style: { fontSize: "11px", color: "#7A5B00", marginTop: "4px" } }, retryNote),
    err && React.createElement("div", { style: { fontSize: "12px", color: "#C0392B", marginTop: "8px" } }, "AI response পাওয়া যায়নি: " + err),

    response && React.createElement(
      "div", { style: { marginTop: "12px", background: "#EAF6F0", padding: "12px", borderRadius: "8px", border: "1px solid #A9D8C4" } },
      React.createElement("div", { style: { fontSize: "10px", fontWeight: 700, color: "#7A5B00", marginBottom: "4px", letterSpacing: "0.2px" } }, "AI Health Guidance — Not a Medical Prescription"),
      React.createElement("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap", color: "#333" } }, response)
    )
  );
}
