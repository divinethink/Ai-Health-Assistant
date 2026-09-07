// Backup/Restore UI — Device-local JSON + Google Drive (Architecture Plan Part C
// §8, §11.3)। ২-ধাপ flow (দুই উৎসই শেয়ার করে): ফাইল/Drive থেকে "যাচাই করুন"
// (dry-run plan) → merge-summary preview → "নিশ্চিত করে রিস্টোর করুন" (§8.4)।

import { ErrorBox, SuccessBox, SecondaryButton } from "../../shared/ui.js";
import { buildBackupPayload, buildBackupFileName, planRestore, commitRestore, summarizePlan } from "../../legacy/backupData.js";
import { isGoogleDriveConfigured, backupToGoogleDrive, fetchGoogleDriveBackup } from "../../legacy/googleDrive.js";

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
  const [driveBackupBusy, setDriveBackupBusy] = useState(false);
  const [driveRestoreScope, setDriveRestoreScope] = useState("personal");
  const [driveRestoreBusy, setDriveRestoreBusy] = useState(false);

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

  const handleDriveBackup = async () => {
    setDriveBackupBusy(true); setBackupErr(null); setBackupMsg(null);
    try {
      const { fileName } = await backupToGoogleDrive(familyId, scope, callerMemberId);
      setBackupMsg(`Google Drive-এ ব্যাকআপ রাখা হয়েছে (${fileName})।`);
    } catch (e) {
      setBackupErr(e.message || String(e));
    } finally {
      setDriveBackupBusy(false);
    }
  };

  // device-local file বা Google Drive — দুই উৎস থেকেই আসা raw parsed backup-object
  // এই একই dry-run plan-logic শেয়ার করে (§11.3-এর "দুই path একই preview/confirm
  // কোড শেয়ার করে" নীতি — duplicate এড়ানো)।
  const planFromParsedObject = async (parsed, sourceLabel) => {
    setRestoreFile(sourceLabel);
    setPlan(null); setRestoreErr(null); setRestoreDone(null);
    try {
      const p = await planRestore(familyId, parsed);
      setPlan(p);
    } catch (e) {
      setRestoreErr(e.message || String(e));
    }
  };

  const handleFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // একই ফাইল আবার বেছে নিলেও onChange ট্রিগার হবে
    if (!file) return;
    setRestoreBusy(true);
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error("ফাইলটি বৈধ JSON না।"); }
      await planFromParsedObject(parsed, file.name);
    } catch (e2) {
      setRestoreErr(e2.message || String(e2));
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleDriveRestore = async () => {
    setDriveRestoreBusy(true); setRestoreErr(null); setRestoreDone(null); setPlan(null);
    try {
      const { fileName, content } = await fetchGoogleDriveBackup(familyId, driveRestoreScope, callerMemberId);
      await planFromParsedObject(content, `Google Drive: ${fileName}`);
    } catch (e) {
      setRestoreErr(e.message || String(e));
    } finally {
      setDriveRestoreBusy(false);
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
  const driveConfigured = isGoogleDriveConfigured();
  const restoreBusyAny = restoreBusy || driveRestoreBusy;

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
      SecondaryButton(backupBusy ? "তৈরি হচ্ছে..." : "আপনার ডিভাইসে ব্যাকআপ ডাউনলোড করুন", handleBackup, backupBusy || driveBackupBusy),
      driveConfigured
        ? React.createElement("div", { style: { marginTop: "6px" } },
            SecondaryButton(driveBackupBusy ? "Drive-এ পাঠানো হচ্ছে..." : "Google Drive-এ ব্যাকআপ রাখুন", handleDriveBackup, backupBusy || driveBackupBusy))
        : React.createElement("p", { style: { fontSize: "11px", color: "#aaa", marginTop: "6px" } }, "Google Drive ব্যাকআপ এখনো সেটআপ করা হয়নি।"),
      backupMsg && SuccessBox(backupMsg),
      backupErr && ErrorBox(backupErr)
    ),

    // --- Restore ---
    React.createElement("div", { style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", marginTop: "10px" } },
      React.createElement("div", { style: { fontWeight: 600, fontSize: "13px", marginBottom: "6px" } }, "ব্যাকআপ থেকে রিস্টোর করুন"),
      !plan && React.createElement("input", { type: "file", accept: "application/json,.json", onChange: handleFileChosen, disabled: restoreBusyAny }),
      driveConfigured && !plan && React.createElement(
        "div", { style: { marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
        isAdmin && React.createElement(
          "select", { value: driveRestoreScope, onChange: (e) => setDriveRestoreScope(e.target.value), disabled: restoreBusyAny,
            style: { fontSize: "12px", padding: "4px" } },
          React.createElement("option", { value: "personal" }, "আমার ডেটা"),
          React.createElement("option", { value: "family" }, "পরিবারের ডেটা")
        ),
        SecondaryButton(driveRestoreBusy ? "Drive থেকে আনা হচ্ছে..." : "Google Drive থেকে যাচাই করুন", handleDriveRestore, restoreBusyAny)
      ),
      restoreBusyAny && !plan && React.createElement("p", { style: { fontSize: "12px", color: "#888" } }, "যাচাই করা হচ্ছে..."),
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
            onClick: handleConfirmRestore, disabled: restoreBusyAny,
            style: { flex: 1, padding: "10px", borderRadius: "8px", background: "#0E4B43", color: "#fff", border: "none", fontWeight: 600 }
          }, restoreBusy ? "রিস্টোর হচ্ছে..." : "নিশ্চিত করে রিস্টোর করুন"),
          React.createElement("button", {
            onClick: cancelPreview, disabled: restoreBusyAny,
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
