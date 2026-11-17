// মেনু ▸ নোটিফিকেশন — রিমাইন্ডার-সেটিং + পরিবারের স্বাস্থ্য ক্যালেন্ডার (owner-approved ২০২৬-১১-১৭; আগে ট্র্যাকারের "রিমাইন্ডার" পিলে ছিল)।
// ReminderSettings অপরিবর্তিত; এখানে শুধু তার দরকারি goal/flags পড়া হয় (ট্র্যাকারের একই হিসাব)। কিছু নতুন লেখা/schema নেই।
import { ErrorBox, Skeleton } from "../../shared/ui.js";
import { listHealthRecords } from "../records/healthRecordsData.js";
import { getGoal } from "./trackerData.js";
import { detectFlagsFromConditions, effectivePregnant } from "./trackerCalc.js";
import { ReminderSettings } from "./ReminderSettings.js";

const { useState, useEffect, useCallback } = React;

export function ReminderPage({ familyId, callerMemberId, selectedMemberId }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!selectedMemberId) return;
    setErr(null);
    try {
      const [recs, goal] = await Promise.all([listHealthRecords(familyId, selectedMemberId), getGoal(familyId, selectedMemberId)]);
      const detected = detectFlagsFromConditions(recs);
      const flags = {
        pregnant: effectivePregnant(goal, recs),
        diabetes: !!(goal && goal.flags && goal.flags.diabetes) || detected.diabetes,
        kidney: !!(goal && goal.flags && goal.flags.kidney) || detected.kidney,
      };
      setInfo({ goal, flags });
    } catch (e) {
      setInfo(null);
      setErr(e.code === "permission-denied" ? "এই সদস্যের তথ্য দেখার অনুমতি আপনার নেই।" : (e.message || String(e)));
    }
  }, [familyId, selectedMemberId]);

  useEffect(() => { setInfo(null); load(); }, [load]);

  if (err) return ErrorBox(err);
  if (!info) return Skeleton(3, 88);
  return React.createElement(ReminderSettings, { key: selectedMemberId, info, familyId, memberId: selectedMemberId, callerMemberId, onSaved: load });
}
