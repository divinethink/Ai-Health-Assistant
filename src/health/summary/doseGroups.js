// আজকের ডোজ-গ্রিডের pure helper (React/Firestore নেই — unit-testable)। শুধু দেখানোর জন্য;
// সেভ-করা নাম/ডেটা কখনো বদলায় না।

const FORM_PREFIX = /^(tab|tabs|tablet|cap|caps|capsule|syp|syr|syrup|susp|inj|drops?|cream|oint|gel|sachet)\.?\s+/i;

// "Cap. DDR 30 mg (Dexlansoprazole)" → { main: "DDR 30 mg", sub: "Dexlansoprazole" }
export function shortMedName(name) {
  const raw = String(name || "").trim();
  let main = raw.replace(FORM_PREFIX, "").trim();
  let sub = "";
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(main);
  if (m && m[1].trim()) { main = m[1].trim(); sub = m[2].trim(); }
  return { main: main || raw, sub };
}

// সময়-অনুযায়ী গ্রুপ (ইনপুট ইতিমধ্যে সময়ে সাজানো থাকলেও নিজে সাজায়)
export function groupDosesByTime(doses) {
  const map = new Map();
  [...(doses || [])].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)).forEach((d) => {
    if (!map.has(d.time)) map.set(d.time, []);
    map.get(d.time).push(d);
  });
  return [...map.entries()].map(([time, items]) => ({ time, items }));
}

// হোমের সংক্ষিপ্ত দৃশ্য: সময় হয়ে গেছে অথচ খাওয়া হয়নি + পরের সময়ের (এখনো-না-খাওয়া) ডোজ
export function homeVisibleDoses(doses) {
  const pending = (doses || []).filter((d) => !d.taken);
  const overdue = pending.filter((d) => d.due);
  const future = pending.filter((d) => !d.due);
  const nextTime = future.length ? future.reduce((m, d) => (d.time < m ? d.time : m), future[0].time) : null;
  const next = nextTime ? future.filter((d) => d.time === nextTime) : [];
  const keys = new Set([...overdue, ...next].map((d) => d.key));
  return (doses || []).filter((d) => keys.has(d.key));
}
