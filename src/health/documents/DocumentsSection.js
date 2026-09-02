// Document/Report vault section — HealthRecordsSection.js-এর হুবহু member-picker
// pattern reuse। Permission enforcement সবসময় server-side rules (firestore.rules +
// storage.rules) করে — এই picker শুধু UI-convenience (Process Rule ৪)।

import { ErrorBox, SelectField } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { DocumentUploadForm } from "./DocumentUploadForm.js";
import { DocumentList } from "./DocumentList.js";

const { useState, useEffect } = React;

export function DocumentsSection({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    listMembers(familyId)
      .then((list) => {
        setMembers(list);
        setTargetMemberId((prev) => prev || callerMemberId || (list[0] && list[0].id) || null);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, [familyId, callerMemberId]);

  if (loadErr) return ErrorBox(loadErr);
  if (!members || !targetMemberId) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য-তালিকা লোড হচ্ছে...");
  }

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "Documents / Reports"),
    SelectField("সদস্য বাছাই করুন", targetMemberId, setTargetMemberId, members.map((m) => [m.id, m.name])),
    React.createElement(DocumentUploadForm, {
      key: "upload-" + targetMemberId,
      familyId, targetMemberId, callerMemberId,
      onUploaded: () => setRefreshTick((t) => t + 1),
    }),
    React.createElement(DocumentList, {
      key: "list-" + targetMemberId, familyId, targetMemberId, callerMemberId, refreshTick,
      onDeleted: () => setRefreshTick((t) => t + 1),
    })
  );
}
