// Nutrition/Fitness Guidance UI (roadmap §11, P7 প্রথম ধাপ) — existing AI-call
// architecture সম্পূর্ণ reuse করে (TriageForm.js-এর askAI/healthContextEngine
// প্যাটার্ন, Process Rule ২ — Minimal Change): কোনো নতুন triage/schema/worker
// dose-logic লাগেনি। এটা symptom-triage না বলে TriageForm-এর alarm-checklist/
// red-flag স্তর এখানে প্রযোজ্য না — শুধু existing condition/allergy/medicine
// context (healthContextEngine.buildHealthContext, অপরিবর্তিত) AI-কে পাঠানো
// হয়, যাতে roadmap §11-এর "Medical condition থাকলে wellness recommendation
// দেওয়ার আগে safety context বিবেচনা করতে হবে" নীতি পালিত হয়।
//
// Specialty-routing: keyword-map (specialtyRouter.js) touch না করে সরাসরি
// context.specialty = "nutrition-fitness" override করা হয়েছে — এই entry-point
// definition-অনুযায়ীই nutrition/fitness, তাই keyword-detection অপ্রয়োজনীয়
// (existing specialtyRouter.js/detectSpecialty() অপরিবর্তিত থাকে)।
// worker/src/index.js-এ SPECIALTY_NOTES["nutrition-fitness"] যোগ হয়েছে (§6.3
// এভিডেন্স-হায়ারার্কি সংক্ষিপ্ত reminder হিসেবে)।

import { SelectField, TextField, PrimaryButton } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { assembleHealthContext } from "../../legacy/healthContextEngine.js";
import { askAI } from "../../ai/aiClient.js";

const { useState, useEffect } = React;

export function NutritionGuidance({ familyId }) {
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
      context.specialty = "nutrition-fitness"; // দেখুন উপরের নোট — keyword-detection বাইপাস, definitional override
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

  if (loadErr) return React.createElement("div", { style: { marginTop: "20px" } }, React.createElement("div", { style: { color: "#C0392B", fontSize: "13px" } }, "সদস্য তালিকা লোড ব্যর্থ: " + loadErr));
  if (!members) return null;

  return React.createElement(
    "div", { style: { marginTop: "20px", background: "#fff", padding: "16px", borderRadius: "10px", border: "1px solid #E0E4E2" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43", margin: "0 0 8px" } }, "Nutrition / Fitness Guidance"),
    React.createElement("div", { style: { fontSize: "12px", color: "#666", marginBottom: "6px" } },
      "সাধারণ খাদ্য/ব্যায়াম-সংক্রান্ত পরামর্শ — এটা symptom-triage/emergency-checklist না। কোনো severe/জরুরি উপসর্গ থাকলে দয়া করে উপরের \"Symptom Check\" ব্যবহার করুন।"
    ),
    SelectField("সদস্য নির্বাচন করুন", targetMemberId || "", handleMemberChange, members.map((m) => [m.id, m.name])),
    TextField("আপনার প্রশ্ন (যেমন: ওজন কমানোর জন্য ডায়েট, শিশুর পুষ্টি, ব্যায়ামের পরিকল্পনা)", question, setQuestion, "এখানে লিখুন..."),

    // Cloud AI Hosting Disclosure (roadmap §13) — TriageForm.js-এর একই টেক্সট/প্যাটার্ন পুনর্ব্যবহার।
    React.createElement(
      "details", { style: { marginTop: "12px", fontSize: "11px", color: "#555", background: "#F3F6F5", padding: "8px 10px", borderRadius: "6px", border: "1px solid #D8E3E0" } },
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
