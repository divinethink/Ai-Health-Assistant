// Member-picker + form + list — কোন সদস্যের record দেখা/যোগ করা হচ্ছে তা বেছে
// নেওয়া যায় (open roster থেকে, §3.1 অনুযায়ী)। Permission actual enforcement
// সবসময় server-side rules করে — এই picker শুধু UI-convenience, security
// boundary না (Process ফাইল Rule ৪-এর সাথে সংগতিপূর্ণ)। তাই non-admin/non-grant
// সদস্য বেছে নিলে read/write উভয়েই permission-denied আসবে, যা Walking
// Skeleton-এর permission smoke-test-এর জন্যই প্রয়োজনীয়। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { HealthRecordForm } from "./HealthRecordForm.js";
import { HealthRecordList } from "./HealthRecordList.js";
import { TrendChartSection } from "../reports/TrendChartSection.js";
import { HealthSummaryCard } from "./HealthSummaryCard.js";
import { T } from "../tracker/trackerTheme.js";

const { useState, useEffect, useRef } = React;
import { takeQuickIntent } from "../../shared/quickIntent.js";

// section: "all" (ডিফল্ট, পুরনো callers-এর জন্য অপরিবর্তিত) | "profile"
// (শুধু vitals) | "records" (form+list+trend) — P11 mockup §৩-এর হোম-পেজ
// sub-tab split-এর জন্য (HealthRecordsPageSection.js)।
//
// member-selector unification (owner-request): আগে এই component নিজেই
// member-list fetch করে নিজস্ব "সদস্য বাছাই করুন" dropdown দেখাত। এখন
// `selectedMemberId` parent (HealthRecordsPageSection)-এর কাছ থেকে prop
// হিসেবে আসে — পেজের সব sub-tab একই সদস্য শেয়ার করে, ট্যাব পাল্টালে আর
// নতুন করে বাছতে হয় না। কোনো schema/permission পরিবর্তন নেই।
export function HealthRecordsSection({ familyId, callerMemberId, selectedMemberId, section = "all", belowSummary, onUpload, onMedChoice, onRecordAdded }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);
  const [adding, setAdding] = useState(false); // "+ নতুন যোগ করুন" চাপলে ফর্ম খোলে
  const [presetType, setPresetType] = useState(null); // ＋ পপআপ থেকে অসুখ/অ্যালার্জি/পরিমাপ — ধরন আগে-থেকে-বাছা
  const [presetObs, setPresetObs] = useState(null); // "+ দ্রুত যোগ" থেকে প্রেসার/সুগার (ধাপ ৯)
  const formRef = useRef(null);
  const targetMemberId = selectedMemberId;

  // সদস্য বদলালে আগের সদস্যের edit-in-progress record ভুলবশত অন্য সদস্যের
  // ফর্মে খোলা না থাকে তা নিশ্চিত করতে reset (আগে dropdown-change handler-এ
  // ইনলাইন ছিল, এখন selectedMemberId parent থেকে আসায় effect দিয়ে)।
  useEffect(() => { setEditingRecord(null); setAdding(false); }, [targetMemberId]);
  useEffect(() => {
    if (section !== "records" && section !== "all") return;
    const k = takeQuickIntent(["bp", "sugar", "condition", "allergy", "observation"]);
    if (k === "bp" || k === "sugar") { setPresetObs(k); setAdding(true); }
    else if (k) { setPresetType(k === "observation" ? "observation" : k); setAdding(true); }
    // eslint-disable-next-line
  }, []);
  useEffect(() => { if (adding && formRef.current && formRef.current.scrollIntoView) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, [adding]);
  // ✎ সম্পাদনা চাপলে ফর্ম খোলে ও দৃশ্যে আসে
  useEffect(() => { if (editingRecord && formRef.current && formRef.current.scrollIntoView) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, [editingRecord]);

  if (!targetMemberId) {
    return React.createElement("p", { style: { color: "#5F716C", fontSize: "14px" } }, "সদস্য বেছে নিন।");
  }

  return React.createElement(
    "div", { style: { marginTop: "0" } },
    (section === "all" || section === "profile") && React.createElement(HealthSummaryCard, {
      key: "summary-" + targetMemberId,
      familyId, selectedMemberId: targetMemberId, callerMemberId, refreshTick,
      onVitalsSaved: () => setRefreshTick((t) => t + 1),
    }),
    // গর্ভাবস্থা-টগল সরানো (owner ২০২৬-১১-১৪): নারী হলেই দেখায় না — অসুখ-তালিকায় "গর্ভাবস্থা" যোগ করলেই ট্র্যাকার/খাবার/AI নিজে ধরে (effectivePregnant)।
    belowSummary || null, // স্বাস্থ্য-প্রোফাইল ট্যাব: কার্ডের ঠিক নিচে ফিল্টার-পিল (প্রোফাইল ও তালিকা এক instance → ✎ সেভে কার্ড সাথে সাথে রিফ্রেশ)
    (section === "all" || section === "records" || !!onUpload) && React.createElement("div", { ref: formRef },
      // ＋ এখন app.js-এর একটাই সাধারণ পপআপ (হোমের সাথে এক); বাছা ধরন intent হয়ে এখানে ফর্ম খোলে
      (() => {
        const form = (adding || editingRecord) && React.createElement(HealthRecordForm, {
          key: "form-" + targetMemberId + (presetObs || "") + (presetType || ""),
          familyId, targetMemberId, callerMemberId, presetObs, presetType, onUpload: onUpload ? () => { setAdding(false); onUpload(); } : undefined,
          onMedChoice: onMedChoice ? (k) => { setAdding(false); onMedChoice(k); } : undefined,
          editingRecord, onCancelEdit: () => { setEditingRecord(null); setAdding(false); setPresetObs(null); setPresetType(null); },
          onAdded: () => { setRefreshTick((t) => t + 1); setAdding(false); setPresetObs(null); setPresetType(null); if (onRecordAdded) onRecordAdded(); },
        });
        // নতুন যোগ: হোমের মতো নিচ-থেকে-ওঠা পপআপ (ব্যাকড্রপ চাপলে বন্ধ নয় — লেখা হারানো ঠেকাতে শুধু ✕); edit আগের মতো ইনলাইন
        if (!(adding && !editingRecord)) return form;
        return React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 80 } },
          React.createElement("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" } }),
          React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": "কী যোগ করবেন?", style: { position: "absolute", left: 0, right: 0, bottom: 0, background: T.canvas, borderRadius: "28px 28px 0 0", padding: "14px 16px 20px", fontFamily: "'Hind Siliguri', sans-serif", maxHeight: "85%", overflowY: "auto" } },
            React.createElement("div", { style: { width: "44px", height: "5px", borderRadius: "3px", background: T.border, margin: "0 auto 10px" } }),
            form));
      })(),
      ),
    (section === "all" || section === "records") && React.createElement(HealthRecordList, {
      key: "list-" + targetMemberId, familyId, targetMemberId, callerMemberId, refreshTick,
      onEdit: setEditingRecord,
      onDeleted: () => setRefreshTick((t) => t + 1),
    }),
    (section === "all" || section === "records") && React.createElement(TrendChartSection, {
      key: "trend-" + targetMemberId, familyId, targetMemberId, refreshTick,
    })
  );
}
