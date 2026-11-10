// টাইমলাইনের বাড়তি এন্ট্রি (ধাপ ৭, খ৩) — pure (React/Firestore নেই, unit-testable)।
// নতুন ইনপুট/schema নেই: বিদ্যমান ক্যালেন্ডার ইভেন্ট (টিকা/অ্যাপয়েন্টমেন্ট) ও ট্র্যাকারের শেষ ৭ দিনের দৈনিক ডক পড়ে সাজায়।
// ট্র্যাকার-সারাংশে শুধু সদস্যের নিজের দেওয়া সংখ্যার গড়/যোগফল — কোনো রায়/মন্তব্য নেই।

const bn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const dateMs = (s) => { const t = new Date(s + "T00:00:00").getTime(); return Number.isNaN(t) ? 0 : t; };
const dayDiff = (a, b) => Math.round((dateMs(a) - dateMs(b)) / 86400000);

const TYPE_ICON = { vaccination: "💉", appointment: "🩺", checkup: "🩺" };

// events: ক্যালেন্ডার ইভেন্ট (পুরো পরিবারের); এই সদস্যের বা সবার (memberId==null)। today = "YYYY-MM-DD"।
// ভবিষ্যতের ইভেন্ট শুধু futureDays দিনের ভেতরে (টাইমলাইন ভরে না যেতে)।
export function calendarEntries(events, memberId, today, { futureDays = 60 } = {}) {
  return (events || [])
    .filter((e) => e && e.id && e.date && (!e.memberId || e.memberId === memberId))
    .filter((e) => dateMs(e.date) && (e.status === "done" || dayDiff(e.date, today) <= futureDays))
    .map((e) => {
      const done = e.status === "done";
      const left = dayDiff(e.date, today);
      const vacc = e.eventType === "vaccination";
      return {
        id: "cal-" + e.id,
        icon: TYPE_ICON[e.eventType] || "📅",
        label: e.title || (vacc ? "টিকা" : "ইভেন্ট"),
        description: done ? "সম্পন্ন" : left >= 0 ? (left === 0 ? "আজ" : "আসন্ন · " + bn(left) + " দিন পরে") : "তারিখ পেরিয়েছে",
        displayDate: e.date,
        sortMillis: dateMs(e.date),
        category: vacc ? "vaccine" : "calendar",
        source: "ক্যালেন্ডার",
        url: null,
      };
    });
}

// docs: শেষ ৭ দিনের দৈনিক ডক। কোনো ডক না থাকলে null।
export function trackerWeekEntry(docs) {
  const days = (docs || []).filter((d) => d && d.date && dateMs(d.date));
  if (!days.length) return null;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sleep = days.filter((d) => d.sleepMinutes > 0).map((d) => d.sleepMinutes);
  const steps = days.filter((d) => d.steps > 0).map((d) => d.steps);
  const kcal = days.filter((d) => d.caloriesIn > 0).map((d) => d.caloriesIn);
  const exMin = days.reduce((a, d) => a + (d.exerciseMin || 0), 0);
  const parts = [];
  if (sleep.length) parts.push("গড় ঘুম " + bn(Math.round((avg(sleep) / 60) * 10) / 10) + " ঘণ্টা");
  if (steps.length) parts.push("গড় স্টেপ " + bn(Math.round(avg(steps)).toLocaleString("en-US")));
  if (kcal.length) parts.push("গড় ক্যালরি " + bn(Math.round(avg(kcal))));
  if (exMin > 0) parts.push("ব্যায়াম " + bn(exMin) + " মিনিট");
  if (!parts.length) return null;
  const last = days.map((d) => d.date).sort().pop();
  return {
    id: "tracker-week-" + last,
    icon: "📈",
    label: "সপ্তাহের সারাংশ",
    description: parts.join(" · "),
    displayDate: last,
    sortMillis: dateMs(last),
    category: "tracker",
    source: "ট্র্যাকার",
    url: null,
  };
}
