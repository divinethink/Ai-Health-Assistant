// MyCare — হোমের "আজকের যত্ন"-এর জন্য নির্বাচিত সদস্যের profile পড়া (রেকর্ড + যত্ন-প্রোফাইল)। ব্যর্থ হলে "অজানা" ধরা হয় (শুধু নিরাপদ মূল সেট)।
import { useMemberHealth } from "../records/useMemberHealth.js";
import { getCarePrefs } from "./carePrefsData.js";
import { buildOwnProfile } from "./careAdapter.js";
import { conditionKeysOf } from "../tracker/avoidRules.js";

const { useState, useEffect } = React;

export function useCareProfile(familyId, memberId, members) {
  const health = useMemberHealth(familyId, memberId);
  const [pf, setPf] = useState({ loading: true, prefs: null });
  useEffect(() => {
    if (!familyId || !memberId) { setPf({ loading: false, prefs: null }); return undefined; }
    let alive = true;
    setPf({ loading: true, prefs: null });
    getCarePrefs(familyId, memberId)
      .then((prefs) => { if (alive) setPf({ loading: false, prefs }); })
      .catch(() => { if (alive) setPf({ loading: false, prefs: null }); });
    return () => { alive = false; };
  }, [familyId, memberId]);
  const member = (members || []).find((m) => m.id === memberId) || null;
  if (!member || health.loading || pf.loading) return { ready: false, profile: null, showGut: false };
  const recordsOk = !health.error && Array.isArray(health.records);
  return { ready: true, profile: buildOwnProfile({ member, records: health.records, recordsOk, prefs: pf.prefs }), showGut: recordsOk && conditionKeysOf(health.records).includes("gut") };
}
