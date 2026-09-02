// Member-picker + form + list — কোন সদস্যের record দেখা/যোগ করা হচ্ছে তা বেছে
// নেওয়া যায় (open roster থেকে, §3.1 অনুযায়ী)। Permission actual enforcement
// সবসময় server-side rules করে — এই picker শুধু UI-convenience, security
// boundary না (Process ফাইল Rule ৪-এর সাথে সংগতিপূর্ণ)। তাই non-admin/non-grant
// সদস্য বেছে নিলে read/write উভয়েই permission-denied আসবে, যা Walking
// Skeleton-এর permission smoke-test-এর জন্যই প্রয়োজনীয়। app.js থেকে split
// (Component-Split — অংশ A), কোনো functional পরিবর্তন নেই।

import { ErrorBox, SelectField } from "../../shared/ui.js";
import { listMembers } from "../../legacy/familyIdentity.js";
import { HealthRecordForm } from "./HealthRecordForm.js";
import { HealthRecordList } from "./HealthRecordList.js";

const { useState, useEffect } = React;

export function HealthRecordsSection({ familyId, callerMemberId }) {
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [targetMemberId, setTargetMemberId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);

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
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "Health Records"),
    SelectField("সদস্য বাছাই করুন", targetMemberId, (v) => { setTargetMemberId(v); setEditingRecord(null); }, members.map((m) => [m.id, m.name])),
    React.createElement(HealthRecordForm, {
      key: "form-" + targetMemberId,
      familyId, targetMemberId, callerMemberId,
      editingRecord, onCancelEdit: () => setEditingRecord(null),
      onAdded: () => setRefreshTick((t) => t + 1),
    }),
    React.createElement(HealthRecordList, {
      key: "list-" + targetMemberId, familyId, targetMemberId, callerMemberId, refreshTick,
      onEdit: setEditingRecord,
      onDeleted: () => setRefreshTick((t) => t + 1),
    })
  );
}
