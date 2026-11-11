// Backup/Restore UI — Device-local JSON + Google Drive (Architecture Plan Part C
// §8, §11.3)। ২-ধাপ flow (দুই উৎসই শেয়ার করে): ফাইল/Drive থেকে "যাচাই করুন"
// (dry-run plan) → merge-summary preview → "নিশ্চিত করে রিস্টোর করুন" (§8.4)।

import { ErrorBox, SuccessBox } from "../../shared/ui.js";
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

  // ---- UI helpers (শুধু presentation; উপরের logic অপরিবর্তিত) ----
  const card = (icon, title, sub, children) => React.createElement(
    "div", { style: { border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "18px", background: "var(--hs-surface, #fff)", boxShadow: "0 2px 10px rgba(14,75,67,0.08)", padding: "16px", marginTop: "14px" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
      React.createElement("span", { style: { width: "42px", height: "42px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", background: "var(--hs-chip-bg, #E4F0E9)" } }, icon),
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: "var(--hs-primary, #0E4B43)" } }, title),
        sub && React.createElement("div", { style: { fontSize: "13px", color: "var(--hs-muted, #5F716C)" } }, sub))),
    children
  );
  const btn = (label, onClick, disabled, primary) => React.createElement("button", {
    onClick, disabled,
    style: {
      width: "100%", minHeight: "48px", marginTop: "10px", padding: "10px", borderRadius: "14px", fontSize: "14px", fontWeight: 700, cursor: disabled ? "default" : "pointer",
      border: primary ? "none" : "1.5px solid var(--hs-primary, #0E4B43)",
      background: primary ? (disabled ? "#8FAFA9" : "linear-gradient(135deg, var(--hs-primary, #0E4B43), var(--hs-primary-2, #17705F))") : "#fff",
      color: primary ? "#fff" : (disabled ? "#8FAFA9" : "var(--hs-primary, #0E4B43)"),
    },
  }, label);
  const segmented = (value, onChange, disabled) => React.createElement(
    "div", { style: { display: "flex", marginTop: "12px", padding: "3px", borderRadius: "999px", background: "var(--hs-chip-bg, #E4F0E9)" } },
    [["personal", "👤 আমার ডেটা"], ["family", "👨‍👩‍👧‍👦 পরিবারের ডেটা"]].map(([v, l]) => React.createElement("button", {
      key: v, onClick: () => onChange(v), disabled,
      style: { flex: 1, minHeight: "38px", border: "none", borderRadius: "999px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
        background: value === v ? "var(--hs-primary, #0E4B43)" : "transparent", color: value === v ? "#fff" : "var(--hs-primary, #0E4B43)" },
    }, l))
  );
  const stat = (n, label, color) => React.createElement(
    "div", { style: { flex: 1, textAlign: "center", padding: "10px 4px", borderRadius: "14px", background: "var(--hs-chip-bg, #E4F0E9)" } },
    React.createElement("div", { style: { fontSize: "22px", fontWeight: 800, color } }, n),
    React.createElement("div", { style: { fontSize: "13px", color: "var(--hs-muted, #5F716C)" } }, label)
  );

  return React.createElement(
    "div", null,
    React.createElement("div", { style: { padding: "12px 14px", borderRadius: "14px", background: "#FFF4DC", color: "#6B4A00", fontSize: "14px", lineHeight: 1.5 } },
      "💡 ব্যাকআপ নিজে হাতে নিতে হয়, নিজে থেকে হয় না। ফাইলটি এনক্রিপ্ট করা থাকে না — নিরাপদ জায়গায় রাখুন।"),

    // --- Backup ---
    card("📤", "ব্যাকআপ রাখুন", "আপনার তথ্যের একটা কপি সংরক্ষণ করুন",
      React.createElement(React.Fragment, null,
        isAdmin && segmented(scope, setScope, backupBusy || driveBackupBusy),
        btn(backupBusy ? "তৈরি হচ্ছে..." : "⬇ এই ডিভাইসে ডাউনলোড করুন", handleBackup, backupBusy || driveBackupBusy, true),
        driveConfigured
          ? btn(driveBackupBusy ? "Drive-এ পাঠানো হচ্ছে..." : "☁️ Google Drive-এ রাখুন", handleDriveBackup, backupBusy || driveBackupBusy, false)
          : React.createElement("p", { style: { fontSize: "13px", color: "#8A9A96", margin: "10px 0 0" } }, "Google Drive ব্যাকআপ এখনো সেটআপ করা হয়নি।"),
        backupMsg && SuccessBox(backupMsg),
        backupErr && ErrorBox(backupErr))),

    // --- Restore ---
    card("📥", "ব্যাকআপ থেকে ফিরিয়ে আনুন", "আগে যাচাই হবে, নিশ্চিত করলে তবেই রিস্টোর হবে",
      React.createElement(React.Fragment, null,
        !plan && React.createElement("label", {
          style: { display: "block", marginTop: "12px", textAlign: "center", padding: "12px", borderRadius: "14px", border: "1.5px dashed var(--hs-primary, #0E4B43)", color: "var(--hs-primary, #0E4B43)", fontWeight: 700, fontSize: "14px", cursor: restoreBusyAny ? "default" : "pointer", opacity: restoreBusyAny ? 0.6 : 1 },
        },
          "📂 ব্যাকআপ ফাইল বেছে নিন",
          React.createElement("input", { type: "file", accept: "application/json,.json", onChange: handleFileChosen, disabled: restoreBusyAny, style: { display: "none" } })),
        driveConfigured && !plan && React.createElement(React.Fragment, null,
          isAdmin && segmented(driveRestoreScope, setDriveRestoreScope, restoreBusyAny),
          btn(driveRestoreBusy ? "Drive থেকে আনা হচ্ছে..." : "☁️ Google Drive থেকে যাচাই করুন", handleDriveRestore, restoreBusyAny, false)),
        restoreBusyAny && !plan && React.createElement("p", { style: { fontSize: "14px", color: "#5F716C", margin: "10px 0 0" } }, "যাচাই করা হচ্ছে..."),
        restoreErr && ErrorBox(restoreErr),
        previewSummary && React.createElement(
          "div", { style: { marginTop: "12px" } },
          React.createElement("p", { style: { fontSize: "14px", margin: "0 0 8px", wordBreak: "break-all" } }, "📄 ", React.createElement("b", null, restoreFile)),
          React.createElement("div", { style: { display: "flex", gap: "8px" } },
            stat(previewSummary.added, "নতুন যোগ হবে", "var(--hs-primary, #0E4B43)"),
            stat(previewSummary.updated, "আপডেট হবে", "#8A5A00"),
            stat(previewSummary.skipped, "অপরিবর্তিত", "#5F716C")),
          btn(restoreBusy ? "রিস্টোর হচ্ছে..." : "✅ নিশ্চিত করে রিস্টোর করুন", handleConfirmRestore, restoreBusyAny, true),
          btn("বাতিল", cancelPreview, restoreBusyAny, false)),
        restoreDone && SuccessBox(
          "রিস্টোর সম্পন্ন — " + restoreDone.added + " টা নতুন যোগ হয়েছে, " + restoreDone.updated + " টা আপডেট হয়েছে, " + restoreDone.skipped + " টা অপরিবর্তিত ছিল।"
        )))
  );
}
