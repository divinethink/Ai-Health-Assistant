// সাপ্তাহিক ট্রেন্ড ও রিভিউ — pure functions (ধাপ ৫)। AI নয়: মন্তব্য ফিক্সড নিয়মে,
// শুধু ব্যবহারকারীর নিজের দেওয়া ডাটা থেকে; নতুন সংখ্যা বানানো হয় না।

export function last7DatesISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  });
}

const round1 = (n) => Math.round(n * 10) / 10;

// docs: দৈনিক ডক-তালিকা। opts: { calorieTarget|null, sleepMinH, weeklyExerciseTarget|null }
export function buildTrend(docs, dates, opts) {
  const byDate = {};
  (docs || []).forEach((d) => { if (d && d.date) byDate[d.date] = d; });
  const days = dates.map((date) => {
    const d = byDate[date] || {};
    return {
      date,
      weightKg: d.weightKg || null,
      calories: d.caloriesIn > 0 ? d.caloriesIn : null,
      sleepH: d.sleepMinutes ? round1(d.sleepMinutes / 60) : null,
      exerciseMin: d.exerciseMin || 0,
      logged: !!byDate[date],
    };
  });

  const weights = days.filter((x) => x.weightKg);
  const weightChange = weights.length >= 2 ? round1(weights[weights.length - 1].weightKg - weights[0].weightKg) : null;
  const calDays = days.filter((x) => x.calories);
  const T = opts.calorieTarget;
  const calInRange = T ? calDays.filter((x) => Math.abs(x.calories - T) <= T * 0.1).length : null;
  const sleepDays = days.filter((x) => x.sleepH);
  const sleepLow = sleepDays.filter((x) => x.sleepH < opts.sleepMinH).length;
  const exerciseTotal = days.reduce((a, x) => a + x.exerciseMin, 0);
  const loggedDays = days.filter((x) => x.logged).length;
  return { days, weightChange, weightPoints: weights.length, calDays: calDays.length, calInRange, sleepDays: sleepDays.length, sleepLow, exerciseTotal, loggedDays, weeklyExerciseTarget: opts.weeklyExerciseTarget };
}

// বাংলা সংখ্যা-ফরম্যাটার bn পাঠানো হয় (UI-নির্ভরতা এড়াতে)
export function reviewPoints(t, bn) {
  const out = [];
  if (t.weightChange !== null) {
    out.push(t.weightChange === 0 ? "ওজন অপরিবর্তিত" : "ওজন " + bn(Math.abs(t.weightChange)) + " কেজি " + (t.weightChange < 0 ? "কমেছে" : "বেড়েছে"));
  }
  if (t.calInRange !== null && t.calDays > 0) out.push(bn(t.calInRange) + " দিন ক্যালরি লক্ষ্যের মধ্যে (" + bn(t.calDays) + " দিনের তথ্যে)");
  if (t.sleepDays > 0) out.push("গত ৭ দিনে " + bn(t.sleepDays) + " দিনের ঘুম দেওয়া; " + bn(t.sleepLow) + " দিন লক্ষ্যের নিচে");
  if (t.weeklyExerciseTarget) out.push("ব্যায়াম " + bn(t.exerciseTotal) + "/" + bn(t.weeklyExerciseTarget) + " মিনিট");
  return out;
}

export function reviewComment(t, bn) {
  const lines = [];
  if (t.loggedDays < 3) return ["তথ্য কম আছে। রোজ ইনপুট দিলে রিভিউ আরও কাজের হবে।"];
  if (t.sleepDays >= 3 && t.sleepLow * 2 >= t.sleepDays) lines.push("ঘুম কয়েকদিন লক্ষ্যের নিচে। রাতে একটু আগে ঘুমাতে যাওয়ার চেষ্টা করুন।");
  if (t.weeklyExerciseTarget) {
    const left = t.weeklyExerciseTarget - t.exerciseTotal;
    lines.push(left > 0 ? "ব্যায়ামের লক্ষ্য পূরণে আরও " + bn(left) + " মিনিট বাকি।" : "ব্যায়ামের সাপ্তাহিক লক্ষ্য পূরণ হয়েছে।");
  }
  if (t.calInRange !== null && t.calDays >= 3 && t.calInRange * 2 < t.calDays) lines.push("বেশিরভাগ দিন ক্যালরি লক্ষ্যের বাইরে ছিল; মিল-প্ল্যান অনুসরণ করে দেখুন।");
  if (t.weightChange !== null && Math.abs(t.weightChange) >= 1) lines.push("এক সপ্তাহে ওজনের বড় পরিবর্তন হয়েছে। অস্বাভাবিক মনে হলে ডাক্তার দেখান।");
  if (!lines.length) lines.push("এই সপ্তাহে বড় কোনো সমস্যা চোখে পড়েনি। এভাবেই চালিয়ে যান।");
  return lines;
}
