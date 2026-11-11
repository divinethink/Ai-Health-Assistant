// Herbal/Homeopathy Chat Guidance (owner-request, ২০২৬-০৯-১২) — NutritionGuidance.js-এর
// হুবহু pattern reuse (Process Rule ২ — Minimal Change): existing AI-call architecture
// (askAI/healthContextEngine) reuse, কোনো নতুন triage/schema/worker dose-logic লাগেনি।
// শুধু context.specialty = "herbal-homeopathy" override করা হয়েছে (definitional,
// keyword-detection না — nutrition-fitness-এর একই যুক্তি)।
//
// এটা verified RemedyEntry browse (RemedySection.js উপরের অংশ)-এর পরিপূরক — সব
// remedy এখনো "draft" (pharmacist/physician-review pending) থাকায় browse-অংশ খালি
// থাকতে পারে, কিন্তু এই চ্যাট AI-এর general knowledge + evidence-tier wording-rule
// (worker SPECIALTY_NOTES["herbal-homeopathy"]) দিয়ে তাৎক্ষণিক সাধারণ তথ্য দিতে পারে।

import { TextField, PrimaryButton } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { assembleHealthContext } from "../../legacy/healthContextEngine.js";
import { askAI } from "../../ai/aiClient.js";
import { renderRichText } from "../../shared/richText.js";

const { useState, useEffect } = React;

// member-selector unification (owner-request): নিজস্ব dropdown সরিয়ে parent
// (AIChatSection → RemedySection)-এর `selectedMemberId` প্রপ ব্যবহার।
// mode: "herbal" | "homeopathy" (না দিলে দুটোই) — AI-কে শুধু ওই ধরনের চিকিৎসা নিয়ে বলতে বিষয়-ইঙ্গিত যায়।
const MODE_TEXT = {
  herbal: { title: "Herbal / ভেষজ", hint: "[বিষয়: শুধু ভেষজ চিকিৎসা] ", sample: "যেমন: সর্দি-কাশিতে কী ভেষজ সাহায্য করতে পারে?" },
  homeopathy: { title: "Homeopathy / হোমিওপ্যাথি", hint: "[বিষয়: শুধু হোমিওপ্যাথি] ", sample: "যেমন: হোমিওপ্যাথিতে সর্দি-কাশির সাধারণ ধারণা কী?" },
};

export function HerbalHomeopathyChat({ familyId, selectedMemberId, mode }) {
  const mt = MODE_TEXT[mode] || { title: "Herbal / Homeopathy", hint: "", sample: "যেমন: সর্দি-কাশিতে কী ভেষজ সাহায্য করতে পারে?" };
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
      .then(setMembers)
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
      const { context, ageYears } = await assembleHealthContext(familyId, targetMemberId, null, { symptoms: mt.hint + text });
      context.specialty = "herbal-homeopathy"; // দেখুন উপরের নোট — definitional override
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

  useEffect(() => {
    if (selectedMemberId && selectedMemberId !== targetMemberId) handleMemberChange(selectedMemberId);
    // eslint-disable-next-line
  }, [selectedMemberId]);

  if (loadErr) return React.createElement("div", { style: { marginTop: "14px" } }, React.createElement("div", { style: { color: "#C0392B", fontSize: "14px" } }, "সদস্যদের তালিকা আনা যায়নি: " + loadErr));
  if (!members || !targetMemberId) return null;

  return React.createElement(
    "div", { style: { marginTop: "14px", background: "#fff", padding: "14px", borderRadius: "10px", border: "1px solid #D3E0D9" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "var(--hs-primary, #0E4B43)", margin: "0 0 8px" } }, mt.title + " — জিজ্ঞাসা করুন"),
    React.createElement("div", { style: { fontSize: "14px", color: "#4B5C57", marginBottom: "6px" } },
      "সাধারণ ভেষজ/হোমিওপ্যাথি তথ্য — এটা symptom-triage/emergency-checklist না। কোনো severe/জরুরি উপসর্গ থাকলে দয়া করে উপরের \"Symptom Check\" ব্যবহার করুন। কোনো dose/মাত্রা এখানে বলা হবে না, শুধু evidence-level-সচেতন সাধারণ তথ্য।"
    ),
    TextField("আপনার প্রশ্ন (" + mt.sample + ")", question, setQuestion, "এখানে লিখুন..."),

    React.createElement(
      "details", { style: { marginTop: "10px", fontSize: "14px", color: "#3E4E49", background: "#F3F6F5", padding: "8px 10px", borderRadius: "10px", border: "1px solid #D3E0D9" } },
      React.createElement("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--hs-primary, #0E4B43)" } }, "🔒 AI ব্যবহারের গোপনীয়তা তথ্য"),
      React.createElement(
        "div", { style: { marginTop: "6px", lineHeight: "1.5" } },
        "এই প্রশ্নোত্তরের জন্য ক্লাউড-ভিত্তিক AI (Groq) ব্যবহার করা হচ্ছে। Zero Data Retention (ZDR) মোড সক্রিয় থাকায় Groq এই তথ্য দিয়ে কোনো মডেল ট্রেইন করে না। আপনার নাম, ফোন নম্বর বা সরাসরি পরিচয়সূচক কোনো তথ্য কখনো পাঠানো হয় না — শুধু বয়স-গ্রুপ ও প্রাসঙ্গিক প্রশ্ন/স্বাস্থ্য-তথ্য পাঠানো হয়।"
      )
    ),

    PrimaryButton("পরামর্শ নিন", handleAsk, loading),
    retryNote && React.createElement("div", { style: { fontSize: "14px", color: "#7A5B00", marginTop: "4px" } }, retryNote),
    err && React.createElement("div", { style: { fontSize: "14px", color: "#C0392B", marginTop: "8px" } }, "AI response পাওয়া যায়নি: " + err),

    response && React.createElement(
      "div", { style: { marginTop: "12px", background: "#EAF6F0", padding: "12px", borderRadius: "14px", border: "1px solid #A9D8C4" } },
      React.createElement("div", { style: { fontSize: "14px", fontWeight: 700, color: "#7A5B00", marginBottom: "4px", letterSpacing: "0.2px" } }, "AI Health Guidance — Not a Medical Prescription"),
      React.createElement("div", { style: { fontSize: "14px", whiteSpace: "pre-wrap", color: "#1F2D2A" } }, renderRichText(response))
    )
  );
}
