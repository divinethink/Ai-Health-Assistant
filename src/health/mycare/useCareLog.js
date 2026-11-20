// MyCare — চেকলিস্ট ডেটা-হুক। পড়া ব্যর্থ হলে log = null (টিক-বাটন দেখানো হয় না, কার্ড আগের মতোই চলে)।
// টিক: আগে স্ক্রিনে বদল, সেভ ব্যর্থ হলে ওই দিনটি আগের অবস্থায় ফেরে। অন্যের-জন্য মোডে এই হুকের ফল ব্যবহার হয় না।
import { getCareLog, saveCareDay } from "./careLogData.js";
import { toggleTick, dayDone, isoOf, sanitizeDay } from "./careLogCore.js";

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

  // next(before) → আজকের নতুন টিক-তালিকা; ফল: null | "error"
  const commit = useCallback(async (next) => {
    const cur = ref.current;
    if (cur.loading || cur.error) return "error";
    const date = isoOf(new Date());
    const before = cur.days[date] || [];
    const after = next(before);
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

  // planned = আজ দেখানো সব টিক-key
  const toggle = useCallback((key, planned) => commit((before) => toggleTick(before, key, planned)), [commit]);
  // এক ট্যাপে পুরো দিন সম্পন্ন/বাতিল
  const setDone = useCallback((planned, done) => commit(() => (done ? dayDone(planned) : [])), [commit]);

  const log = st.loading || st.error ? null : { days: st.days, toggle, setDone };
  return log;
}
