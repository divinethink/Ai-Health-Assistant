// Member-picker + form + list — কোন সদস্যের record দেখা/যোগ করা হচ্ছে তা বেছে
// নেওয়া যায় (open roster থেকে, §3.1 অনুযায়ী)। Permission actual enforcement
// সবসময় server-side rules করে — এই picker শুধু UI-convenience, security
// boundary না (Process ফাইল Rule ৪-এর সাথে সংগতিপূর্ণ)। তাই non-admin/non-grant
// সদস্য বেছে নিলে read/write উভয়েই permission-denied আসবে, যা Walking
// Skeleton-এর permission smoke-test-এর জন্যই প্রয়োজনীয়। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { HealthRecordForm } from "./HealthRecordForm.js";
import { HealthVitalsWidget } from "./HealthVitalsWidget.js";
import { HealthRecordList } from "./HealthRecordList.js";
import { TrendChartSection } from "../reports/TrendChartSection.js";

const { useState, useEffect } = React;

// section: "all" (ডিফল্ট, পুরনো callers-এর জন্য অপরিবর্তিত) | "profile"
// (শুধু vitals) | "records" (form+list+trend) — P11 mockup §৩-এর হোম-পেজ
// sub-tab split-এর জন্য (HealthRecordsPageSection.js)।
//
// member-selector unification (owner-request): আগে এই component নিজেই
// member-list fetch করে নিজস্ব "সদস্য বাছাই করুন" dropdown দেখাত। এখন
// `selectedMemberId` parent (HealthRecordsPageSection)-এর কাছ থেকে prop
// হিসেবে আসে — পেজের সব sub-tab একই সদস্য শেয়ার করে, ট্যাব পাল্টালে আর
// নতুন করে বাছতে হয় না। কোনো schema/permission পরিবর্তন নেই।
export function HealthRecordsSection({ familyId, callerMemberId, selectedMemberId, section = "all" }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);
  const targetMemberId = selectedMemberId;

  // সদস্য বদলালে আগের সদস্যের edit-in-progress record ভুলবশত অন্য সদস্যের
  // ফর্মে খোলা না থাকে তা নিশ্চিত করতে reset (আগে dropdown-change handler-এ
  // ইনলাইন ছিল, এখন selectedMemberId parent থেকে আসায় effect দিয়ে)।
  useEffect(() => { setEditingRecord(null); }, [targetMemberId]);

  if (!targetMemberId) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "সদস্য নির্বাচন করুন।");
  }

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "Health Records"),
    (section === "all" || section === "profile") && React.createElement(HealthVitalsWidget, {
      key: "vitals-" + targetMemberId,
      familyId, targetMemberId, callerMemberId, refreshTick,
      onSaved: () => setRefreshTick((t) => t + 1),
    }),
    (section === "all" || section === "records") && React.createElement(HealthRecordForm, {
      key: "form-" + targetMemberId,
      familyId, targetMemberId, callerMemberId,
      editingRecord, onCancelEdit: () => setEditingRecord(null),
      onAdded: () => setRefreshTick((t) => t + 1),
    }),
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
