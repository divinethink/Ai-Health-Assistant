// React hook: একটা সদস্যের স্বাস্থ্য-রেকর্ড (শেয়ার্ড cache থেকে)। কোনো লেখার পর নিজে থেকে নতুন করে পড়ে।
// ব্যবহার: const { records, loading, error, reload } = useMemberHealth(familyId, memberId);
// reload() = cache মুছে সার্ভার থেকে আবার পড়া।

import { listHealthRecords } from "./healthRecordsData.js";
import { subscribeMemberHealth, invalidateMemberHealth } from "./memberHealthStore.js";

const { useState, useEffect, useCallback } = React;

export function useMemberHealth(familyId, memberId, opts) {
  const fresh = !!(opts && opts.fresh);
  const [state, setState] = useState({ records: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!familyId || !memberId) { setState({ records: [], loading: false, error: null }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    listHealthRecords(familyId, memberId, { fresh })
      .then((records) => { if (alive) setState({ records, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ records: null, loading: false, error: e }); });
    return () => { alive = false; };
  }, [familyId, memberId, fresh, tick]);

  useEffect(() => subscribeMemberHealth(({ familyId: f, memberId: m }) => {
    if (f === null || (f === familyId && (!m || m === memberId))) setTick((n) => n + 1);
  }), [familyId, memberId]);

  const reload = useCallback(() => invalidateMemberHealth(familyId, memberId), [familyId, memberId]);
  return { records: state.records, loading: state.loading, error: state.error, reload };
}
