import { t } from "../../shared/i18n.js";
// Document/Report vault section। Permission enforcement সবসময় server-side
// rules (firestore.rules + storage.rules) করে (Process Rule ৪)।
//
// member-selector unification (owner-request): নিজস্ব member-fetch/dropdown
// সরিয়ে parent (DocumentsPageSection)-এর `selectedMemberId` প্রপ ব্যবহার।
//
// নথিপত্র-reorg (owner-approved, ২০২৬-১১-০৮): তালিকা এখন সবার আগে; একটাই
// "＋ নতুন যোগ করুন" বোতাম পুরো প্যানেল (আপলোড → ঐচ্ছিক AI/OCR বিশ্লেষণ → হাতে-লেখা)
// খোলে। কোনো schema/rules/permission পরিবর্তন নেই।

import { DocumentUploadForm } from "./DocumentUploadForm.js";
import { DocumentList } from "./DocumentList.js";
import { ReportAnalysisPanel } from "../reports/ReportAnalysisPanel.js";

const { useState, useCallback } = React;

export function DocumentsSection({ familyId, callerMemberId, selectedMemberId }) {
  const [refreshTick, setRefreshTick] = useState(0);
  // panel: null | { mode: "add" } | { mode: "analyze", file } | { mode: "manual" }
  const [panel, setPanel] = useState(null);
  const targetMemberId = selectedMemberId;

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);
  const startAnalyze = useCallback((file) => setPanel({ mode: "analyze", file, key: Date.now() }), []);
  const startManual = useCallback(() => setPanel({ mode: "manual", key: Date.now() }), []);

  if (!targetMemberId) {
    return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "সদস্য নির্বাচন করুন।");
  }

  const panelTitle = panel && ({ add: "📎 নতুন নথি যোগ করুন", analyze: "🔬 রিপোর্ট বিশ্লেষণ", manual: "✍️ হাতে-লেখা রিপোর্ট" })[panel.mode];

  return React.createElement(
    "div", { style: { marginTop: "12px" } },
    React.createElement(
      "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
      React.createElement("h3", { style: { fontSize: "16px", color: "#0E4B43", margin: 0 } }, t("h.docs")),
      !panel && React.createElement("button", {
        onClick: () => setPanel({ mode: "add" }),
        style: { minHeight: "42px", padding: "8px 16px", border: "none", borderRadius: "999px", background: "linear-gradient(135deg, #0E4B43, #17705F)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 8px rgba(14,75,67,0.25)" },
      }, "＋ নতুন যোগ করুন")
    ),
    panel && React.createElement(
      "div", { style: { border: "1px solid #D9E5DE", borderRadius: "16px", marginBottom: "14px", background: "#FFFBF2", padding: "12px 14px" } },
      React.createElement(
        "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "#0E4B43" } }, panelTitle),
        React.createElement("button", {
          onClick: () => setPanel(null), "aria-label": "বন্ধ করুন",
          style: { border: "none", background: "none", fontSize: "18px", cursor: "pointer", color: "#5F716C" },
        }, "✕")
      ),
      panel.mode === "add" && React.createElement(DocumentUploadForm, {
        key: "upload-" + targetMemberId,
        familyId, targetMemberId, callerMemberId,
        onUploaded: refresh, onAnalyze: startAnalyze, onManual: startManual,
      }),
      panel.mode === "analyze" && React.createElement(ReportAnalysisPanel, {
        key: "analyze-" + targetMemberId + "-" + panel.key,
        familyId, targetMemberId, callerMemberId, presetFile: panel.file,
      }),
      panel.mode === "manual" && React.createElement(ReportAnalysisPanel, {
        key: "manual-" + targetMemberId + "-" + panel.key,
        familyId, targetMemberId, callerMemberId, initialManual: true,
      })
    ),
    React.createElement(DocumentList, {
      key: "list-" + targetMemberId, familyId, targetMemberId, callerMemberId, refreshTick,
      onDeleted: refresh, onAdd: () => setPanel({ mode: "add" }),
    })
  );
}
