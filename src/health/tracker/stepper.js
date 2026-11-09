// দৈনিক ইনপুটের +/− stepper-এর হিসাব (pure; UI নেই)। ফল সবসময় বৈধ সীমার ভেতরে।

// ওজন: ০.১ কেজি ধাপ, সীমা ২–৪০০ (InputTab-এর যাচাইয়ের সাথে মেলে)। খালি হলে fallback থেকে শুরু।
export function stepWeight(value, delta, fallback) {
  let base = parseFloat(value);
  if (Number.isNaN(base)) base = Number(fallback) > 0 ? Number(fallback) : 60;
  const next = Math.round((base + delta) * 10) / 10;
  return String(Math.min(400, Math.max(2, next)));
}

// সময় "HH:MM": মিনিট যোগ/বিয়োগ, মধ্যরাত পেরোলে ঘুরে আসে। খালি/অবৈধ হলে fallback থেকে শুরু।
export function shiftTime(value, deltaMin, fallback) {
  const ok = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || "");
  const base = ok(value) ? value : fallback;
  const total = Number(base.slice(0, 2)) * 60 + Number(base.slice(3, 5));
  const m = (((total + deltaMin) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
