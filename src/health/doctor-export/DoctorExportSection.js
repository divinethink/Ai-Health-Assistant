// Doctor-Facing Export — trigger UI (Architecture Plan Part C §10.7)। দুটো
// output-ই একই entry-point থেকে: Health Profile (factual) ও AI Health Summary
// (AI-এর সাম্প্রতিক triage/guidance, "Not a Medical Prescription" লেবেলসহ)।
// দুটোই PDF (browser print) ও DOCX (client-side `docx` library) — দুই ফরম্যাটেই
// (§10.4/§7.1 নীতি)।
// member-selector unification (owner-request): নিজস্ব dropdown সরিয়ে parent
// (DocumentsPageSection)-এর `selectedMemberId` প্রপ ব্যবহার — `listMembers`
// এখনো fetch হয় শুধু AI Summary export-এ memberName lookup-এর জন্য (নিচে
// handleAiSummary), dropdown-এর জন্য না।
import { ErrorBox } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { buildHealthProfileExport } from "./doctorExportData.js";
import { buildAiHealthSummary } from "./aiSummaryData.js";
import { DoctorExportPrintView } from "./DoctorExportPrintView.js";
import { AiSummaryPrintView } from "./AiSummaryPrintView.js";
import { exportHealthProfileDocx, exportAiHealthSummaryDocx } from "./docxExport.js";
import { DoctorDocumentPicker, exportCard } from "./DoctorDocumentPicker.js";

const { useState, useEffect } = React;

function actionButton(label, onClick, disabled, primary) {
  return React.createElement("button", {
    onClick, disabled,
    style: {
      flex: 1, minHeight: "46px", padding: "10px 8px", borderRadius: "14px", fontWeight: 700, fontSize: "14px", cursor: disabled ? "default" : "pointer",
      border: primary ? "none" : "1.5px solid var(--hs-primary, #0E4B43)",
      background: primary ? (disabled ? "#8FAFA9" : "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))") : "#fff",
      color: primary ? "#fff" : "var(--hs-primary, #0E4B43)",
      boxShadow: primary && !disabled ? "0 3px 8px rgba(14,75,67,0.22)" : "none",
    },
  }, label);
}

function buttonRow(...btns) {
  return React.createElement("div", { style: { display: "flex", gap: "8px", marginTop: "12px" } }, ...btns);
}

export function DoctorExportSection({ familyId, callerMemberId, selectedMemberId, onGoUpload }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const targetMemberId = selectedMemberId;

  const [profileBusy, setProfileBusy] = useState(null); // "pdf" | "docx" | null
  const [profileErr, setProfileErr] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [includeTracker, setIncludeTracker] = useState(true); // পার্ট ৮: ট্র্যাকারের ৭-দিন সারাংশ (ডেটা থাকলেই দেখায়)

  const [summaryBusy, setSummaryBusy] = useState(null);
  const [summaryErr, setSummaryErr] = useState(null);
  const [summaryPreview, setSummaryPreview] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then(setMembers)
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId]);

  const handleHealthProfile = async (mode) => {
    setProfileBusy(mode); setProfileErr(null);
    try {
      const data = await buildHealthProfileExport(familyId, targetMemberId, callerMemberId, { includeTracker });
      if (mode === "pdf") setProfilePreview(data);
      else await exportHealthProfileDocx(data);
    } catch (e) {
      setProfileErr(e.message || String(e));
    } finally {
      setProfileBusy(null);
    }
  };

  const handleAiSummary = async (mode) => {
    setSummaryBusy(mode); setSummaryErr(null);
    try {
      const memberName = (members.find((m) => m.id === targetMemberId) || {}).name;
      const data = await buildAiHealthSummary(familyId, targetMemberId, memberName);
      if (mode === "pdf") setSummaryPreview(data);
      else await exportAiHealthSummaryDocx(data);
    } catch (e) {
      setSummaryErr(e.message || String(e));
    } finally {
      setSummaryBusy(null);
    }
  };

  if (profilePreview) {
    return React.createElement(DoctorExportPrintView, { data: profilePreview, onBack: () => setProfilePreview(null) });
  }
  if (summaryPreview) {
    return React.createElement(AiSummaryPrintView, { data: summaryPreview, onBack: () => setSummaryPreview(null) });
  }

  if (loadErr) return ErrorBox(loadErr);
  if (!members || !targetMemberId) return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "সদস্য বেছে নিন।");

  const memberName = (members.find((m) => m.id === targetMemberId) || {}).name;
  return React.createElement(
    "div", { style: { marginTop: "12px" } },
    React.createElement("h3", { style: { fontSize: "16px", color: "var(--hs-primary, #0E4B43)", margin: 0 } }, "ডাক্তারকে দেখানোর জন্য"),

    exportCard("🧾", "স্বাস্থ্য প্রোফাইল", "যাচাই-করা তথ্য থেকে — কোনো AI মতামত নেই।", null,
      React.createElement(React.Fragment, null,
        React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", fontSize: "13px", color: "#1F2D2A", minHeight: "44px" } },
          React.createElement("input", { type: "checkbox", checked: includeTracker, onChange: (e) => setIncludeTracker(e.target.checked), style: { width: "20px", height: "20px" } }),
          "গত ৭ দিনের ট্র্যাকার সারাংশ যোগ করুন (ডেটা থাকলে)"),
        buttonRow(
          actionButton(profileBusy === "pdf" ? "তৈরি হচ্ছে..." : "📄 PDF দেখুন/প্রিন্ট", () => handleHealthProfile("pdf"), !!profileBusy || !targetMemberId, true),
          actionButton(profileBusy === "docx" ? "তৈরি হচ্ছে..." : "⬇ DOCX", () => handleHealthProfile("docx"), !!profileBusy || !targetMemberId)),
        profileErr && ErrorBox(profileErr))),

    exportCard("🤖", "AI স্বাস্থ্য সারাংশ", "সদস্যের সবচেয়ে সাম্প্রতিক Symptom Check/AI Guidance session থেকে।", "AI Health Guidance — Not a Medical Prescription",
      React.createElement(React.Fragment, null,
        buttonRow(
          actionButton(summaryBusy === "pdf" ? "তৈরি হচ্ছে..." : "📄 PDF দেখুন/প্রিন্ট", () => handleAiSummary("pdf"), !!summaryBusy || !targetMemberId, true),
          actionButton(summaryBusy === "docx" ? "তৈরি হচ্ছে..." : "⬇ DOCX", () => handleAiSummary("docx"), !!summaryBusy || !targetMemberId)),
        summaryErr && ErrorBox(summaryErr))),

    React.createElement(DoctorDocumentPicker, {
      key: "docs-" + targetMemberId, familyId, targetMemberId, memberName, onGoUpload,
    })
  );
}
