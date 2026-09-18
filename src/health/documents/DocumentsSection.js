// Document/Report vault section। Permission enforcement সবসময় server-side
// rules (firestore.rules + storage.rules) করে (Process Rule ৪)।
//
// member-selector unification (owner-request): নিজস্ব member-fetch/dropdown
// সরিয়ে parent (DocumentsPageSection)-এর `selectedMemberId` প্রপ ব্যবহার।

import { CollapsibleSection } from "../../shared/ui.js";
import { DocumentUploadForm } from "./DocumentUploadForm.js";
import { DocumentList } from "./DocumentList.js";
import { ReportAnalysisPanel } from "../reports/ReportAnalysisPanel.js";

const { useState } = React;

export function DocumentsSection({ familyId, callerMemberId, selectedMemberId }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const targetMemberId = selectedMemberId;

  if (!targetMemberId) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য নির্বাচন করুন।");
  }

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "Documents / Reports"),
    React.createElement(CollapsibleSection, {
      title: "📎 নতুন Document/Report যোগ করুন", defaultOpen: false,
      children: React.createElement(DocumentUploadForm, {
        key: "upload-" + targetMemberId,
        familyId, targetMemberId, callerMemberId,
        onUploaded: () => setRefreshTick((t) => t + 1),
      }),
    }),
    React.createElement(CollapsibleSection, {
      title: "🔬 রিপোর্ট বিশ্লেষণ করুন (AI/OCR)", defaultOpen: false,
      children: React.createElement(ReportAnalysisPanel, {
        key: "analyze-" + targetMemberId,
        familyId, targetMemberId, callerMemberId,
      }),
    }),
    React.createElement(DocumentList, {
      key: "list-" + targetMemberId, familyId, targetMemberId, callerMemberId, refreshTick,
      onDeleted: () => setRefreshTick((t) => t + 1),
    })
  );
}
