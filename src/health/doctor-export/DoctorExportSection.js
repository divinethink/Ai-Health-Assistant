// Doctor-Facing Export — trigger UI (Architecture Plan Part C §10.7)। দুটো
// output-ই একই entry-point থেকে: Health Profile (factual) ও AI Health Summary
// (AI-এর সাম্প্রতিক triage/guidance, "Not a Medical Prescription" লেবেলসহ)।
// দুটোই PDF (browser print) ও DOCX (client-side `docx` library) — দুই ফরম্যাটেই
// (§10.4/§7.1 নীতি)।
import { ErrorBox, SelectField } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { buildHealthProfileExport } from "./doctorExportData.js";
import { buildAiHealthSummary } from "./aiSummaryData.js";
import { DoctorExportPrintView } from "./DoctorExportPrintView.js";
import { AiSummaryPrintView } from "./AiSummaryPrintView.js";
import { exportHealthProfileDocx, exportAiHealthSummaryDocx } from "./docxExport.js";

const { useState, useEffect } = React;

function actionButton(label, onClick, disabled, primary) {
  return React.createElement("button", {
    onClick, disabled,
    style: {
      padding: "9px 14px", borderRadius: "8px", fontWeight: 600, fontSize: "13px", marginRight: "8px", marginTop: "6px",
      border: primary ? "none" : "1px solid #0E4B43",
      background: primary ? "#0E4B43" : "#fff",
      color: primary ? "#fff" : "#0E4B43",
    },
  }, label);
}

export function DoctorExportSection({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);

  const [profileBusy, setProfileBusy] = useState(null); // "pdf" | "docx" | null
  const [profileErr, setProfileErr] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);

  const [summaryBusy, setSummaryBusy] = useState(null);
  const [summaryErr, setSummaryErr] = useState(null);
  const [summaryPreview, setSummaryPreview] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => { setMembers(list); if (list.length && !targetMemberId) setTargetMemberId(list[0].id); })
      .catch((e) => setLoadErr(e.message || String(e)));
    // eslint-disable-next-line
  }, [familyId]);

  const handleHealthProfile = async (mode) => {
    setProfileBusy(mode); setProfileErr(null);
    try {
      const data = await buildHealthProfileExport(familyId, targetMemberId, callerMemberId);
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
  if (!members) return null;

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "ডাক্তার দেখানোর ডকুমেন্ট"),
    SelectField("সদস্য বাছাই করুন", targetMemberId, setTargetMemberId, members.map((m) => [m.id, m.name])),

    React.createElement("div", { style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", marginTop: "10px" } },
      React.createElement("div", { style: { fontWeight: 600, fontSize: "13px", marginBottom: "4px" } }, "Health Profile (factual, কোনো AI মতামত নেই)"),
      actionButton(profileBusy === "pdf" ? "তৈরি হচ্ছে..." : "PDF (প্রিন্ট/প্রিভিউ)", () => handleHealthProfile("pdf"), !!profileBusy || !targetMemberId, true),
      actionButton(profileBusy === "docx" ? "তৈরি হচ্ছে..." : "DOCX ডাউনলোড", () => handleHealthProfile("docx"), !!profileBusy || !targetMemberId),
      profileErr && ErrorBox(profileErr)
    ),

    React.createElement("div", { style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", marginTop: "10px" } },
      React.createElement("div", { style: { fontWeight: 600, fontSize: "13px", marginBottom: "4px" } }, "AI Health Summary — Not a Medical Prescription"),
      React.createElement("p", { style: { fontSize: "11px", color: "#888", marginTop: 0 } }, "সদস্যের সবচেয়ে সাম্প্রতিক Symptom Check/AI Guidance session থেকে।"),
      actionButton(summaryBusy === "pdf" ? "তৈরি হচ্ছে..." : "PDF (প্রিন্ট/প্রিভিউ)", () => handleAiSummary("pdf"), !!summaryBusy || !targetMemberId, true),
      actionButton(summaryBusy === "docx" ? "তৈরি হচ্ছে..." : "DOCX ডাউনলোড", () => handleAiSummary("docx"), !!summaryBusy || !targetMemberId),
      summaryErr && ErrorBox(summaryErr)
    )
  );
}
