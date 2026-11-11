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

import { TextField, PrimaryButton } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { assembleHealthContext } from "../../legacy/healthContextEngine.js";
import { askAI } from "../../ai/aiClient.js";
import { renderRichText } from "../../shared/richText.js";
import { listDietGuidanceRules, matchFoodGuidance } from "./dietGuidanceData.js";

const { useState, useEffect } = React;

// member-selector unification (owner-request): নিজস্ব dropdown সরিয়ে parent
// (AIChatSection)-এর `selectedMemberId` প্রপ ব্যবহার।
// focus: "nutrition" | "fitness" — পুষ্টি ও ব্যায়াম এখন আলাদা ট্যাব; AI-কে শুধু ওই বিষয়ে বলতে ইঙ্গিত যায়।
const FOCUS_TEXT = {
  nutrition: { title: "Nutrition / পুষ্টি", hint: "[বিষয়: শুধু খাদ্য ও পুষ্টি] ", sample: "যেমন: ওজন কমানোর জন্য ডায়েট, শিশুর পুষ্টি", note: "সাধারণ খাদ্য-সংক্রান্ত পরামর্শ" },
  fitness: { title: "Fitness / ব্যায়াম", hint: "[বিষয়: শুধু ব্যায়াম ও ফিটনেস] ", sample: "যেমন: ব্যায়ামের পরিকল্পনা, হাঁটার অভ্যাস", note: "সাধারণ ব্যায়াম-সংক্রান্ত পরামর্শ" },
};

export function NutritionGuidance({ familyId, selectedMemberId, focus }) {
  const ft = FOCUS_TEXT[focus] || { title: "Nutrition / Fitness", hint: "", sample: "যেমন: ওজন কমানোর জন্য ডায়েট, শিশুর পুষ্টি, ব্যায়ামের পরিকল্পনা", note: "সাধারণ খাদ্য/ব্যায়াম-সংক্রান্ত পরামর্শ" };
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [err, setErr] = useState(null);
  const [retryNote, setRetryNote] = useState(null);
  const [dietGuidance, setDietGuidance] = useState(null); // { avoidFoods, includeFoods } — গ্রাউন্ডিং, শুধু display+AI-context-এর জন্য

  useEffect(() => {
    listMembers(familyId)
      .then(setMembers)
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId]);

  function handleMemberChange(id) {
    setTargetMemberId(id);
    setResponse(null);
    setErr(null);
    setDietGuidance(null);
  }

  useEffect(() => {
    if (selectedMemberId && selectedMemberId !== targetMemberId) handleMemberChange(selectedMemberId);
    // eslint-disable-next-line
  }, [selectedMemberId]);

  async function handleAsk() {
    const text = question.trim();
    if (!text || !targetMemberId) return;
    setLoading(true);
    setErr(null);
    setRetryNote(null);
    setResponse(null);
    try {
      const { context, ageYears } = await assembleHealthContext(familyId, targetMemberId, null, { symptoms: ft.hint + text });
      context.specialty = "nutrition-fitness"; // দেখুন উপরের নোট — keyword-detection বাইপাস, definitional override

      // Diet/Food Guidance grounding (amendment item ১) — member-এর
      // relevantConditions/relevantAllergies (ইতিমধ্যে context-এ derive হওয়া,
      // নতুন PII না) দিয়ে avoid/include food-list lookup। lookup ব্যর্থ হলে
      // soft-fail — AI-flow অপ্রভাবিত থাকে (medicineDatabase lookup-এর মতোই
      // safe-default: কিছুই পাওয়া না গেলে dietGuidanceContext পাঠানো হয় না)।
      let guidance = null;
      try {
        if (focus === "fitness") throw new Error("skip-diet-grounding"); // ব্যায়াম-ট্যাবে খাদ্য-তালিকা দরকার নেই
        const allRules = await listDietGuidanceRules();
        const tags = [
          ...(context.relevantClinicalContext.relevantConditions || []),
          ...(context.relevantClinicalContext.relevantAllergies || []),
        ];
        // প্রসঙ্গ-ডেটায় শুধু রোগের নাম আছে → নাম থেকেই বয়স/অবস্থা-নিয়ম মেলানো (রেকর্ড-আকারে সাজিয়ে)
        const condRecs = (context.relevantClinicalContext.relevantConditions || []).map((name) => ({ resourceType: "condition", name, status: "active" }));
        const matched = matchFoodGuidance(allRules, tags, { records: condRecs, age: typeof ageYears === "number" ? ageYears : null, goal: null });
        if (matched.avoidFoods.length || matched.includeFoods.length) {
          guidance = matched;
          context.dietGuidanceContext = { avoidFoods: matched.avoidFoods, includeFoods: matched.includeFoods };
        }
      } catch (ge) {
        guidance = null; // soft-fail, AI-flow চলতেই থাকবে
      }
      setDietGuidance(guidance);

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

  if (loadErr) return React.createElement("div", { style: { marginTop: "20px" } }, React.createElement("div", { style: { color: "#C0392B", fontSize: "14px" } }, "সদস্যদের তালিকা আনা যায়নি: " + loadErr));
  if (!members || !targetMemberId) return null;

  return React.createElement(
    "div", { style: { marginTop: "20px", background: "#fff", padding: "16px", borderRadius: "10px", border: "1px solid #D3E0D9" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "var(--hs-primary, #0E4B43)", margin: "0 0 8px" } }, ft.title),
    React.createElement("div", { style: { fontSize: "14px", color: "#4B5C57", marginBottom: "6px" } },
      ft.note + " — এটা symptom-triage/emergency-checklist না। কোনো severe/জরুরি উপসর্গ থাকলে দয়া করে উপরের \"Symptom Check\" ব্যবহার করুন।"
    ),
    TextField("আপনার প্রশ্ন (" + ft.sample + ")", question, setQuestion, "এখানে লিখুন..."),

    // Cloud AI Hosting Disclosure (roadmap §13) — TriageForm.js-এর একই টেক্সট/প্যাটার্ন পুনর্ব্যবহার।
    React.createElement(
      "details", { style: { marginTop: "12px", fontSize: "14px", color: "#3E4E49", background: "#F3F6F5", padding: "8px 10px", borderRadius: "10px", border: "1px solid #D3E0D9" } },
      React.createElement("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--hs-primary, #0E4B43)" } }, "🔒 AI ব্যবহারের গোপনীয়তা তথ্য"),
      React.createElement(
        "div", { style: { marginTop: "6px", lineHeight: "1.5" } },
        "এই প্রশ্নোত্তরের জন্য ক্লাউড-ভিত্তিক AI (Groq) ব্যবহার করা হচ্ছে। Zero Data Retention (ZDR) মোড সক্রিয় থাকায় Groq এই তথ্য দিয়ে কোনো মডেল ট্রেইন করে না। আপনার নাম, ফোন নম্বর বা সরাসরি পরিচয়সূচক কোনো তথ্য কখনো পাঠানো হয় না — শুধু বয়স-গ্রুপ ও প্রাসঙ্গিক প্রশ্ন/স্বাস্থ্য-তথ্য পাঠানো হয়।"
      )
    ),

    PrimaryButton("পরামর্শ নিন", handleAsk, loading),
    retryNote && React.createElement("div", { style: { fontSize: "14px", color: "#7A5B00", marginTop: "4px" } }, retryNote),
    err && React.createElement("div", { style: { fontSize: "14px", color: "#C0392B", marginTop: "8px" } }, "AI response পাওয়া যায়নি: " + err),

    // Diet Guidance grounding card (amendment item ১) — deterministic reference-
    // list, AI-generated না; transparency-এর জন্য AI response-এর আগে দেখানো হয়।
    dietGuidance && (dietGuidance.avoidFoods.length > 0 || dietGuidance.includeFoods.length > 0) && React.createElement(
      "div", { style: { marginTop: "12px", background: "#FBF7EC", padding: "12px", borderRadius: "14px", border: "1px solid #E8DDBB" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: "#7A5B00", marginBottom: "6px" } }, "আপনার স্বাস্থ্য-তথ্য অনুযায়ী খাদ্য নির্দেশিকা (রেফারেন্স)"),
      dietGuidance.avoidFoods.length > 0 && React.createElement(
        "div", { style: { fontSize: "14px", color: "#1F2D2A", marginBottom: "4px" } },
        React.createElement("b", null, "এড়িয়ে চলুন: "), dietGuidance.avoidFoods.join(", ")
      ),
      dietGuidance.includeFoods.length > 0 && React.createElement(
        "div", { style: { fontSize: "14px", color: "#1F2D2A" } },
        React.createElement("b", null, "বেশি রাখুন: "), dietGuidance.includeFoods.join(", ")
      )
    ),

    response && React.createElement(
      "div", { style: { marginTop: "12px", background: "#EAF6F0", padding: "12px", borderRadius: "14px", border: "1px solid #A9D8C4" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: "#7A5B00", marginBottom: "4px", letterSpacing: "0.2px" } }, "AI Health Guidance — Not a Medical Prescription"),
      React.createElement("div", { style: { fontSize: "14px", whiteSpace: "pre-wrap", color: "#1F2D2A" } }, renderRichText(response))
    )
  );
}
