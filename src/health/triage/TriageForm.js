// Structured Trigger Layer UI (roadmap §10.3 স্তর-১) — member select + বয়স-গ্রুপ
// অনুযায়ী red-flag checklist, সরাসরি deterministic triageEngine.js-এ input (free-text
// নয়, skip-অযোগ্য নয়)। HealthTimeline.js/HealthRecordsSection.js-এর member-picker
// pattern reuse (Process ফাইল Rule ২ — Minimal Change)।
//
// এই থ্রেডে যোগ হলো — Health Episode session model (Architecture Plan Part C §9):
// প্রতিটা "চেক করুন" → নতুন HealthEpisode + TriageResult + structured-trigger
// message save হয় (episodesData.js, hasAccess-gated rules ইতিমধ্যে deploy করা)।
// AI-response স্তর-২ (ai-followup) message হিসেবে save হয়, ও নতুন post-guidance
// free-text follow-up box (স্তর-৩) conversation-history maintain করে। Episode-save
// ব্যর্থ হলেও triage/AI-flow bright-line অপ্রভাবিত থাকে (non-fatal try/catch)।
// Rate-Limit (429) Mitigation (§10.2.2) — askAI()-এর retry-callback দিয়ে
// non-alarming "একটু অপেক্ষা করুন" note দেখানো হয়, raw error না।

import { ErrorBox, SelectField, TextField, PrimaryButton, SecondaryButton } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { deriveAgeGroup, getChecklistForAgeGroup, isPediatricAgeGroup, runTriage, CHIEF_COMPLAINTS } from "./triageEngine.js";
import { TriageResultView } from "./TriageResultView.js";
import { assembleHealthContext } from "../../legacy/healthContextEngine.js";
import { askAI } from "../../ai/aiClient.js";
import { createEpisode, saveTriageResult, addMessage, archiveEpisode } from "../episodes/episodesData.js";

const { useState, useEffect, useRef } = React;

// Chat-Length Soft-Nudge (§9, §10.3) — heavy tokenizer library আনার দরকার নেই,
// rough char-count heuristic যথেষ্ট (soft-nudge, exact enforcement সংখ্যা না)।
// বাংলা টেক্সটে গড়ে প্রতি token-এ কম character লাগে বলে ২ দিয়ে divide করা হলো
// (conservative — বাস্তব token-count-এর চেয়ে সামান্য বেশি estimate দেখাবে)।
const CHAT_LENGTH_SOFT_LIMIT_TOKENS = 3000;
function estimateTokens(text) {
  return Math.ceil((text || "").length / 2);
}

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

export function TriageForm({ familyId, callerMemberId }) {
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
  const [aiRetryNote, setAiRetryNote] = useState(null);

  // Health Episode session-state
  const [episodeId, setEpisodeId] = useState(null);
  const [episodeSaveErr, setEpisodeSaveErr] = useState(null);
  const [conversationTurns, setConversationTurns] = useState([]); // askAI-এর conversationHistory ফরম্যাট
  const [discussionLog, setDiscussionLog] = useState([]); // শুধু UI-display-এর জন্য (স্তর-৩)
  const [followUpText, setFollowUpText] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpErr, setFollowUpErr] = useState(null);
  const [followUpRetryNote, setFollowUpRetryNote] = useState(null);
  const turnCounterRef = useRef(0);

  function nextTurnIndex() {
    turnCounterRef.current += 1;
    return turnCounterRef.current;
  }

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

  function resetEpisodeState() {
    setEpisodeId(null);
    setEpisodeSaveErr(null);
    setConversationTurns([]);
    setDiscussionLog([]);
    setFollowUpText("");
    setFollowUpErr(null);
    setFollowUpRetryNote(null);
    turnCounterRef.current = 0;
  }

  function handleMemberChange(id) {
    setTargetMemberId(id);
    setChecklist({});
    setChiefComplaint("none");
    setResult(null);
    setHealthContext(null);
    setAiResponse(null);
    setAiErr(null);
    resetEpisodeState();
  }

  function toggleItem(id) {
    setResult(null);
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function runCheck() {
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
    resetEpisodeState(); // নতুন "চেক করুন" ক্লিক = নতুন Health Episode (§9)

    // Health Context Engine — dev-preview assemble, কোনো Firestore write না।
    assembleHealthContext(familyId, targetMemberId, triageResult, { symptoms: chiefComplaint })
      .then(setHealthContext)
      .catch((e) => setContextErr(e.message || String(e)));

    // Episode/TriageResult/structured-trigger-message persist — non-fatal:
    // এটা ব্যর্থ হলেও triage output/health-context bright-line অপ্রভাবিত থাকে।
    try {
      const tag = chiefComplaint !== "none" ? chiefComplaint : "emergency-checklist";
      const epId = await createEpisode(familyId, targetMemberId, callerMemberId, tag);
      await saveTriageResult(familyId, epId, targetMemberId, callerMemberId, triageResult);
      await addMessage(familyId, epId, {
        turnIndex: nextTurnIndex(),
        layer: "structured-trigger",
        role: "user",
        inputMode: "structured-field",
        content: "checklist: " + JSON.stringify(checklist) + ", chiefComplaint: " + chiefComplaint,
      });
      setEpisodeId(epId);
    } catch (e) {
      setEpisodeSaveErr(e.message || String(e));
    }
  }

  async function handleAskAI() {
    if (!healthContext) return;
    setAiLoading(true);
    setAiErr(null);
    setAiRetryNote(null);
    try {
      const data = await askAI(familyId, healthContext, conversationTurns, {
        onRetry: (attempt, max) => setAiRetryNote("একটু অপেক্ষা করুন... (retry " + attempt + "/" + max + ")"),
      });
      const content = data && data.content;
      setAiResponse(content);
      setConversationTurns((prev) => [...prev, { role: "assistant", content }]);
      if (episodeId) {
        addMessage(familyId, episodeId, {
          turnIndex: nextTurnIndex(), layer: "ai-followup", role: "ai", inputMode: null, content,
        }).catch(() => {});
      }
    } catch (e) {
      setAiErr(e.message || String(e));
    } finally {
      setAiLoading(false);
      setAiRetryNote(null);
    }
  }

  async function handleSendFollowUp() {
    const text = followUpText.trim();
    if (!text || !healthContext) return;
    setFollowUpLoading(true);
    setFollowUpErr(null);
    setFollowUpRetryNote(null);
    const newHistory = [...conversationTurns, { role: "user", content: text }];
    if (episodeId) {
      addMessage(familyId, episodeId, {
        turnIndex: nextTurnIndex(), layer: "post-guidance-discussion", role: "user", inputMode: "free-text", content: text,
      }).catch(() => {});
    }
    try {
      const data = await askAI(familyId, healthContext, newHistory, {
        onRetry: (attempt, max) => setFollowUpRetryNote("একটু অপেক্ষা করুন... (retry " + attempt + "/" + max + ")"),
      });
      const content = data && data.content;
      setConversationTurns([...newHistory, { role: "assistant", content }]);
      setDiscussionLog((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content }]);
      setFollowUpText("");
      if (episodeId) {
        addMessage(familyId, episodeId, {
          turnIndex: nextTurnIndex(), layer: "post-guidance-discussion", role: "ai", inputMode: null, content,
        }).catch(() => {});
      }
    } catch (e) {
      setFollowUpErr(e.message || String(e));
    } finally {
      setFollowUpLoading(false);
      setFollowUpRetryNote(null);
    }
  }

  async function handleArchiveAndStartNew() {
    if (episodeId) {
      try { await archiveEpisode(familyId, episodeId, callerMemberId); } catch (e) { /* non-fatal, নতুন episode শুরু করাই primary উদ্দেশ্য */ }
    }
    setChecklist({});
    setChiefComplaint("none");
    setResult(null);
    setHealthContext(null);
    setContextErr(null);
    setAiResponse(null);
    setAiErr(null);
    resetEpisodeState();
  }

  if (loadErr) return ErrorBox(loadErr);
  if (!members) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");
  }

  // Chat-Length Soft-Nudge check (§9) — শুধু conversationTurns + aiResponse-এর
  // cumulative char-length থেকে rough token-estimate।
  const cumulativeText = (aiResponse || "") + conversationTurns.map((t) => t.content || "").join(" ");
  const estimatedTokens = estimateTokens(cumulativeText);
  const showLengthNudge = estimatedTokens > CHAT_LENGTH_SOFT_LIMIT_TOKENS;

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

    episodeSaveErr && React.createElement(
      "div", { style: { fontSize: "11px", color: "#C0392B", marginTop: "6px" } },
      "Episode/conversation history সংরক্ষণ করা যায়নি (triage/AI ফলাফল অপ্রভাবিত): " + episodeSaveErr
    ),

    // Cloud AI Hosting Disclosure (roadmap §13) — AI-call-এর আগে স্পষ্ট, non-intrusive
    // transparency নোটিস (existing details/summary pattern reuse, healthContext dev-
    // preview block-এর মতোই)।
    healthContext && React.createElement(
      "details", { style: { marginTop: "12px", fontSize: "11px", color: "#555", background: "#F3F6F5", padding: "8px 10px", borderRadius: "6px", border: "1px solid #D8E3E0" } },
      React.createElement("summary", { style: { cursor: "pointer", fontWeight: 600, color: "#0E4B43" } }, "🔒 AI ব্যবহারের গোপনীয়তা তথ্য"),
      React.createElement(
        "div", { style: { marginTop: "6px", lineHeight: "1.5" } },
        "এই প্রশ্নোত্তরের জন্য ক্লাউড-ভিত্তিক AI (Groq) ব্যবহার করা হচ্ছে। Zero Data Retention (ZDR) মোড সক্রিয় থাকায় Groq এই তথ্য দিয়ে কোনো মডেল ট্রেইন করে না। আপনার নাম, ফোন নম্বর বা সরাসরি পরিচয়সূচক কোনো তথ্য কখনো পাঠানো হয় না — শুধু বয়স-গ্রুপ ও প্রাসঙ্গিক লক্ষণ/স্বাস্থ্য-তথ্য পাঠানো হয়।"
      )
    ),

    healthContext && React.createElement(
      "div", { style: { marginTop: "12px" } },
      PrimaryButton("AI-কে জিজ্ঞাসা করুন", handleAskAI, aiLoading),
      aiRetryNote && React.createElement("div", { style: { fontSize: "11px", color: "#7A5B00", marginTop: "4px" } }, aiRetryNote)
    ),

    aiErr && React.createElement(
      "div", { style: { fontSize: "12px", color: "#C0392B", marginTop: "8px" } },
      "AI response পাওয়া যায়নি: " + aiErr
    ),

    // roadmap §12.0 — output কখনো "Prescription" হিসেবে উপস্থাপন করা যাবে না,
    // স্পষ্ট লেবেল বাধ্যতামূলক।
    aiResponse && React.createElement(
      "div", { style: { marginTop: "12px", background: "#EAF6F0", padding: "12px", borderRadius: "8px", border: "1px solid #A9D8C4" } },
      React.createElement("div", { style: { fontSize: "10px", fontWeight: 700, color: "#7A5B00", marginBottom: "4px", letterSpacing: "0.2px" } }, "AI Health Guidance — Not a Medical Prescription"),
      React.createElement("div", { style: { fontSize: "12px", fontWeight: 600, color: "#0E4B43", marginBottom: "6px" } }, "AI Guidance" + (episodeId ? "" : " (dev-preview — episode save হয়নি)")),
      React.createElement("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap", color: "#333" } }, aiResponse)
    ),

    // Post-Guidance Discussion Layer (স্তর-৩, §10.3) — শুধু প্রথম AI-response আসার পর সক্রিয়।
    aiResponse && React.createElement(
      "div", { style: { marginTop: "14px" } },
      discussionLog.length > 0 && React.createElement(
        "div", { style: { marginBottom: "8px" } },
        discussionLog.map((m, i) => React.createElement(
          "div", {
            key: i,
            style: {
              marginTop: "6px", fontSize: "13px", whiteSpace: "pre-wrap",
              background: m.role === "user" ? "#F0F0EA" : "#EAF6F0",
              padding: "8px", borderRadius: "6px",
            },
          },
          React.createElement("b", null, m.role === "user" ? "আপনি: " : "AI: "), m.content
        ))
      ),
      // Re-triage nudge (§10.3 স্তর-৩) — নতুন/ভিন্ন উপসর্গে deterministic triage
      // আবার চালানো উচিত; কোনো AI-based auto-detection না (triage bright-line
      // non-bypassable থাকার নীতি, Process Rule ৫)। existing handleArchiveAndStartNew
      // reuse — নতুন logic/state নেই।
      React.createElement(
        "div", { style: { fontSize: "11px", color: "#7A5B00", marginBottom: "8px" } },
        "⚠️ নতুন বা ভিন্ন উপসর্গ দেখা দিলে, দয়া করে আলোচনা চালিয়ে যাওয়ার বদলে নতুন Symptom Check চালান।",
        React.createElement(
          "div", { style: { marginTop: "6px" } },
          SecondaryButton("নতুন Symptom Check শুরু করুন", handleArchiveAndStartNew)
        )
      ),
      TextField("আরও জিজ্ঞাসা করুন (ঐচ্ছিক)", followUpText, setFollowUpText, "যেমন: এটার সাথে কি কিছু খাওয়া নিরাপদ?"),
      PrimaryButton("পাঠান", handleSendFollowUp, followUpLoading),
      followUpRetryNote && React.createElement("div", { style: { fontSize: "11px", color: "#7A5B00", marginTop: "4px" } }, followUpRetryNote),
      followUpErr && React.createElement("div", { style: { fontSize: "12px", color: "#C0392B", marginTop: "6px" } }, "পাঠানো যায়নি: " + followUpErr)
    ),

    showLengthNudge && React.createElement(
      "div", { style: { marginTop: "14px", background: "#FFF7E6", padding: "10px", borderRadius: "8px", border: "1px solid #E8C46B", fontSize: "12px", color: "#7A5B00" } },
      "এই আলোচনা বেশ দীর্ঘ হয়ে গেছে — নতুন সমস্যায় নতুন Health Episode শুরু করা ভালো।",
      React.createElement("div", { style: { marginTop: "8px" } }, PrimaryButton("সংরক্ষণ করে নতুন Episode শুরু করুন", handleArchiveAndStartNew))
    )
  );
}
