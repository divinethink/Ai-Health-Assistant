// MyCare — চেকলিস্ট ডেটা-হুক। পড়া ব্যর্থ হলে log = null (টিক-বাটন দেখানো হয় না, কার্ড আগের মতোই চলে)।
// টিক: আগে স্ক্রিনে বদল, সেভ ব্যর্থ হলে ওই দিনটি আগের অবস্থায় ফেরে। অন্যের-জন্য মোডে এই হুকের ফল ব্যবহার হয় না।
import { getCareLog, saveCareDay } from "./careLogData.js";
import { toggleTick, isoOf, sanitizeDay } from "./careLogCore.js";

const { useState, useEffect, useRef, useCallback } = React;

export function useCareLog(familyId, memberId, callerMemberId) {
  const [st, setSt] = useState({ loading: true, days: {}, existed: false, error: false });
  const ref = useRef(st);
  ref.current = st;

  useEffect(() => {
    if (!familyId || !memberId) { setSt({ loading: false, days: {}, existed: false, error: true }); return undefined; }
    let alive = true;
    setSt({ loading: true, days: {}, existed: false, error: false });
    getCareLog(familyId, memberId)
      .then((r) => { if (alive) setSt({ loading: false, days: r ? r.days : {}, existed: r != null, error: false }); })
      .catch(() => { if (alive) setSt({ loading: false, days: {}, existed: false, error: true }); });
    return () => { alive = false; };
  }, [familyId, memberId]);

  // planned = আজ দেখানো সব টিক-key; ফল: null | "error"
  const toggle = useCallback(async (key, planned) => {
    const cur = ref.current;
    if (cur.loading || cur.error) return "error";
    const date = isoOf(new Date());
    const before = cur.days[date] || [];
    const after = toggleTick(before, key, planned);
    const nextDays = { ...cur.days };
    if (after.length) nextDays[date] = after; else delete nextDays[date];
    setSt((s) => ({ ...s, days: nextDays }));
    try {
      await saveCareDay(familyId, memberId, callerMemberId, date, after, cur.existed, nextDays);
      setSt((s) => ({ ...s, existed: true }));
      return null;
    } catch (e) {
      setSt((s) => {
        const d = { ...s.days };
        const back = sanitizeDay(before);
        if (back.length) d[date] = back; else delete d[date];
        return { ...s, days: d };
      });
      return "error";
    }
  }, [familyId, memberId, callerMemberId]);

  const log = st.loading || st.error ? null : { days: st.days, toggle };
  return log;
}
