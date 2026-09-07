// Doctor-Facing Export — trigger UI (Architecture Plan Part C §10.7)।
// এই ধাপে শুধু "Health Profile" (factual) export — AI Health Summary export
// পরবর্তী ধাপ হিসেবে deferred (owner-approved scope-narrowing)।
import { ErrorBox, SelectField } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { buildHealthProfileExport } from "./doctorExportData.js";
import { DoctorExportPrintView } from "./DoctorExportPrintView.js";

const { useState, useEffect } = React;

export function DoctorExportSection({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [genErr, setGenErr] = useState(null);
  const [exportData, setExportData] = useState(null);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => { setMembers(list); if (list.length && !targetMemberId) setTargetMemberId(list[0].id); })
      .catch((e) => setLoadErr(e.message || String(e)));
    // eslint-disable-next-line
  }, [familyId]);

  const handleGenerate = async () => {
    setBusy(true); setGenErr(null);
    try {
      const data = await buildHealthProfileExport(familyId, targetMemberId, callerMemberId);
      setExportData(data);
    } catch (e) {
      setGenErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (exportData) {
    return React.createElement(DoctorExportPrintView, { data: exportData, onBack: () => setExportData(null) });
  }

  if (loadErr) return ErrorBox(loadErr);
  if (!members) return null;

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "ডাক্তার দেখানোর ডকুমেন্ট"),
    React.createElement("p", { style: { fontSize: "12px", color: "#888" } },
      "Health Profile — factual সারাংশ (কোনো AI মতামত নেই), PDF হিসেবে প্রিন্ট/সেভ করা যাবে (§10.2)।"),
    SelectField("সদস্য বাছাই করুন", targetMemberId, setTargetMemberId, members.map((m) => [m.id, m.name])),
    React.createElement("button", {
      onClick: handleGenerate, disabled: busy || !targetMemberId,
      style: { marginTop: "8px", padding: "10px 16px", borderRadius: "8px", border: "1px solid #0E4B43", background: "#fff", color: "#0E4B43", fontWeight: 600 }
    }, busy ? "তৈরি হচ্ছে..." : "Health Profile তৈরি করুন"),
    genErr && ErrorBox(genErr)
  );
}
