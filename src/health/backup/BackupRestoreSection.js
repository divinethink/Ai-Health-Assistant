// Backup/Restore UI — Device-local JSON (Architecture Plan Part C §8, §11.3)।
// এই ধাপে (P8) শুধু Device-local — Google Drive পরবর্তী ধাপ (owner-side OAuth
// Client ID setup প্রয়োজন)। ২-ধাপ flow: Restore-এ "যাচাই করুন" (dry-run plan)
// → merge-summary preview → "নিশ্চিত করে রিস্টোর করুন" (§8.4/§11.3 নীতি)।

import { ErrorBox, SuccessBox, SecondaryButton } from "../../shared/ui.js";
import { buildBackupPayload, buildBackupFileName, planRestore, commitRestore, summarizePlan } from "../../legacy/backupData.js";

const { useState } = React;

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BackupRestoreSection({ familyId, callerMemberId, isAdmin }) {
  const [scope, setScope] = useState("personal");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  const [backupErr, setBackupErr] = useState(null);

  const [restoreFile, setRestoreFile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [restoreErr, setRestoreErr] = useState(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreDone, setRestoreDone] = useState(null);

  const handleBackup = async () => {
    setBackupBusy(true); setBackupErr(null); setBackupMsg(null);
    try {
      const payload = await buildBackupPayload(familyId, scope, callerMemberId);
      downloadJson(buildBackupFileName(scope, familyId, callerMemberId), payload);
      setBackupMsg("ব্যাকআপ ফাইল ডাউনলোড হয়েছে। আপনার ডিভাইসের Downloads ফোল্ডারে খুঁজুন।");
    } catch (e) {
      setBackupErr(e.message || String(e));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // একই ফাইল আবার বেছে নিলেও onChange ট্রিগার হবে
    if (!file) return;
    setRestoreFile(file.name);
    setPlan(null); setRestoreErr(null); setRestoreDone(null); setRestoreBusy(true);
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error("ফাইলটি বৈধ JSON না।"); }
      const p = await planRestore(familyId, parsed);
      setPlan(p);
    } catch (e2) {
      setRestoreErr(e2.message || String(e2));
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!plan) return;
    setRestoreBusy(true); setRestoreErr(null);
    try {
      await commitRestore(familyId, plan);
      setRestoreDone(summarizePlan(plan));
      setPlan(null); setRestoreFile(null);
    } catch (e) {
      setRestoreErr(e.message || String(e));
    } finally {
      setRestoreBusy(false);
    }
  };

  const cancelPreview = () => { setPlan(null); setRestoreFile(null); setRestoreErr(null); };

  const previewSummary = plan ? summarizePlan(plan) : null;

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "ডেটা ব্যাকআপ / রিস্টোর"),
    React.createElement("p", { style: { fontSize: "12px", color: "#888" } },
      "সম্পূর্ণ manual, plaintext JSON (কোনো auto-backup না, encryption ছাড়া — roadmap §13)।"),

    // --- Backup ---
    React.createElement("div", { style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", marginTop: "8px" } },
      React.createElement("div", { style: { fontWeight: 600, fontSize: "13px", marginBottom: "6px" } }, "ব্যাকআপ রাখুন"),
      isAdmin && React.createElement(
        "div", { style: { display: "flex", gap: "8px", marginBottom: "8px" } },
        React.createElement("label", { style: { fontSize: "13px" } },
          React.createElement("input", { type: "radio", checked: scope === "personal", onChange: () => setScope("personal") }),
          " আমার ডেটা"),
        React.createElement("label", { style: { fontSize: "13px" } },
          React.createElement("input", { type: "radio", checked: scope === "family", onChange: () => setScope("family") }),
          " পরিবারের ডেটা")
      ),
      SecondaryButton(backupBusy ? "তৈরি হচ্ছে..." : "আপনার ডিভাইসে ব্যাকআপ ডাউনলোড করুন", handleBackup, backupBusy),
      backupMsg && SuccessBox(backupMsg),
      backupErr && ErrorBox(backupErr)
    ),

    // --- Restore ---
    React.createElement("div", { style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", marginTop: "10px" } },
      React.createElement("div", { style: { fontWeight: 600, fontSize: "13px", marginBottom: "6px" } }, "ব্যাকআপ থেকে রিস্টোর করুন"),
      !plan && React.createElement("input", { type: "file", accept: "application/json,.json", onChange: handleFileChosen, disabled: restoreBusy }),
      restoreBusy && !plan && React.createElement("p", { style: { fontSize: "12px", color: "#888" } }, "যাচাই করা হচ্ছে..."),
      restoreErr && ErrorBox(restoreErr),
      previewSummary && React.createElement(
        "div", { style: { marginTop: "8px" } },
        React.createElement("p", { style: { fontSize: "13px" } },
          "ফাইল: ", React.createElement("b", null, restoreFile)),
        React.createElement("p", { style: { fontSize: "13px" } },
          previewSummary.added + " টা নতুন যোগ হবে, " + previewSummary.updated + " টা আপডেট হবে, " + previewSummary.skipped + " টা অপরিবর্তিত থাকবে।"),
        React.createElement(
          "div", { style: { display: "flex", gap: "8px" } },
          React.createElement("button", {
            onClick: handleConfirmRestore, disabled: restoreBusy,
            style: { flex: 1, padding: "10px", borderRadius: "8px", background: "#0E4B43", color: "#fff", border: "none", fontWeight: 600 }
          }, restoreBusy ? "রিস্টোর হচ্ছে..." : "নিশ্চিত করে রিস্টোর করুন"),
          React.createElement("button", {
            onClick: cancelPreview, disabled: restoreBusy,
            style: { flex: 1, padding: "10px", borderRadius: "8px", background: "#fff", color: "#0E4B43", border: "1px solid #0E4B43", fontWeight: 600 }
          }, "বাতিল")
        )
      ),
      restoreDone && SuccessBox(
        "রিস্টোর সম্পন্ন — " + restoreDone.added + " টা নতুন যোগ হয়েছে, " + restoreDone.updated + " টা আপডেট হয়েছে, " + restoreDone.skipped + " টা অপরিবর্তিত ছিল।"
      )
    )
  );
}
