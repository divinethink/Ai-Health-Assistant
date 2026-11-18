// অ্যাক্টিভিটি ক্যালেন্ডারের নিচের তিনটি কার্ড: দিনের রিভিউ · ব্যায়াম-ঘর · ঘুম ও ক্যালরি।
// শুধু দেখানো — কিছু সংরক্ষণ হয় না। হিসাব dayReview.js-এ (pure)। বয়স্কদের জন্য: বড় অঙ্ক, সোজা শব্দ, রং ছাড়াও লেখায় বোঝা যায়।
import { T, HOME_CARD } from "./trackerTheme.js";
import { bnNum } from "../../shared/dates.js";
import { TrendBars } from "./TrendBars.js";
import { MIN_INPUTS } from "./dayReview.js";

const h = React.createElement;
const WEEK = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"];
const WARN = "#C46A12";

const card = (children, extra) => h("div", { style: { ...HOME_CARD, padding: "14px", marginBottom: "12px", ...(extra || {}) } }, children);
const title = (t, sub, icon, right) => h("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" } },
  icon && h("span", { "aria-hidden": "true", style: { width: "34px", height: "34px", borderRadius: "11px", background: T.track, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 } }, icon),
  h("div", { style: { flex: 1, minWidth: 0 } },
    h("div", { style: { fontSize: "16px", fontWeight: 800, color: T.ink, lineHeight: 1.25 } }, t),
    sub && h("div", { style: { fontSize: "12.5px", color: T.muted, marginTop: "2px" } }, sub)),
  right);
const para = (txt, extra) => h("div", { style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, ...(extra || {}) } }, txt);
const note = (txt) => h("div", { style: { fontSize: "12px", color: T.muted, lineHeight: 1.5, marginTop: "8px" } }, txt);

// ১) দিনের রিভিউ: আজ কমপক্ষে ৩টি বিষয়ে তথ্য থাকলে আজকের; নইলে সর্বশেষ যোগ্য দিনের (গতকাল ইত্যাদি)
// props: review (dayReview ফল | null), label ("আজকের রিভিউ" ইত্যাদি), pending (আজের জন্য বাকি-বার্তা | null), onGoInput
export function DayReviewCard({ review, label, pending, onGoInput }) {
  const goBtn = onGoInput && h("button", { key: "b", type: "button", onClick: onGoInput, style: { minHeight: "48px", padding: "0 18px", borderRadius: "14px", border: "1px solid " + T.green, background: T.surface, color: T.green, fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: "10px" } }, "আজকের তথ্য দিন");
  if (!review || !review.hasData) {
    return card([
      h("div", { key: "t" }, title("রিভিউ", "কমপক্ষে " + bnNum(MIN_INPUTS) + "টি বিষয়ে তথ্য দিলে রিভিউ আসবে — খাবার, ব্যায়াম, ঘুম, পানি", "🌙")),
      goBtn,
    ]);
  }
  const row = (it, good) => h("div", { key: it.key, style: { display: "flex", gap: "8px", fontSize: "14.5px", color: T.ink, lineHeight: 1.6, marginTop: "4px" } },
    h("span", { "aria-hidden": "true", style: { color: good ? T.green : WARN, flexShrink: 0 } }, good ? "✓" : "▼"), h("span", null, it.text));
  return card([
    h("div", { key: "t" }, title(review.final ? label : label + " (সাময়িক)", review.final ? "ওই দিনের দেওয়া তথ্য থেকে" : "রাত ৯টার পরে চূড়ান্ত হবে; এর মধ্যে তথ্য যোগ হলে বদলাবে", "🌙")),
    review.good.length > 0 && h("div", { key: "g", style: { marginTop: "2px" } },
      h("div", { style: { fontSize: "13.5px", fontWeight: 800, color: T.green } }, "ভালো হয়েছে"), review.good.map((x) => row(x, true))),
    review.improve.length > 0 && h("div", { key: "i", style: { marginTop: "10px" } },
      h("div", { style: { fontSize: "13.5px", fontWeight: 800, color: WARN } }, "ভালো করা দরকার"), review.improve.map((x) => row(x, false))),
    !review.good.length && !review.improve.length && h("div", { key: "e" }, para("এই দিনের তথ্য থেকে বিচার করার মতো লক্ষ্য নেই।")),
    review.tomorrow && h("div", { key: "tm", style: { background: T.track, borderRadius: "14px", padding: "10px 12px", marginTop: "10px", fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "💡 " + review.tomorrow),
    pending && h("div", { key: "p", style: { fontSize: "13.5px", color: T.muted, lineHeight: 1.5, marginTop: "10px" } }, pending),
    pending && goBtn,
    h("div", { key: "n" }, note("শুধু আপনার দেওয়া তথ্য থেকে। সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।")),
  ]);
}

// ২) সাপ্তাহিক ব্যায়াম-ঘর (শনি–শুক্র)
export function ExerciseBoxCard({ wk }) {
  if (!wk) return null;
  const line = wk.done ? "🎉 এ সপ্তাহের লক্ষ্য পূরণ হয়েছে" : "বাকি " + bnNum(wk.remaining) + " মিনিট" + (wk.daysLeft > 0 ? " · সপ্তাহে আর " + bnNum(wk.daysLeft) + " দিন, দিনে প্রায় " + bnNum(wk.perDay) + " মিনিট করলেই হবে" : "");
  return card([
    h("div", { key: "t" }, title("এই সপ্তাহের ব্যায়াম", "শনি–শুক্র · সব ধরনের ব্যায়াম মিলিয়ে", "🏃")),
    h("div", { key: "n", style: { display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" } },
      h("span", { style: { fontSize: "30px", fontWeight: 800, color: T.green } }, bnNum(wk.total)),
      h("span", { style: { fontSize: "15px", color: T.muted } }, "/ " + bnNum(wk.target) + " মিনিট")),
    h("div", { key: "b", role: "img", "aria-label": "লক্ষ্যের " + wk.pct + "% হয়েছে", style: { height: "12px", borderRadius: "999px", background: T.track, overflow: "hidden", margin: "8px 0" } },
      h("div", { style: { width: wk.pct + "%", height: "100%", background: T.green2, borderRadius: "999px" } })),
    h("div", { key: "l" }, para(line)),
    h("div", { key: "d", style: { display: "flex", gap: "6px", marginTop: "12px" } },
      wk.days.map((d, i) => h("div", { key: d.iso, style: { flex: 1, minWidth: 0, textAlign: "center" } },
        h("div", { "aria-label": WEEK[i] + (d.future ? "" : " " + d.min + " মিনিট"), style: { minHeight: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700,
          background: d.min > 0 ? T.green2 : T.track, color: d.min > 0 ? T.onDark : T.muted, opacity: d.future ? 0.5 : 1, border: d.isToday ? "2px solid " + T.orange : "2px solid transparent" } }, d.future ? "·" : bnNum(d.min)),
        h("div", { style: { fontSize: "12px", color: T.muted, marginTop: "2px", fontWeight: d.isToday ? 800 : 400 } }, WEEK[i])))),
  ]);
}

// ৩) ঘুম ও ক্যালরি: বড় অঙ্ক + এক শব্দের রায় + ৭ দিনের সাধারণ বার
function Verdict({ v }) {
  if (!v) return null;
  const good = v.key === "good";
  return h("span", { style: { display: "inline-block", fontSize: "13.5px", fontWeight: 800, borderRadius: "999px", padding: "3px 12px", background: good ? T.track : T.sand, color: good ? T.green : WARN, border: good ? "none" : "1px solid " + T.sandBorder } }, (good ? "✓ " : v.key === "missing" ? "" : "▼ ") + v.word);
}

function Block({ head, big, unit, verdict, sub, chart }) {
  return h("div", { style: { marginTop: "6px", paddingBottom: "6px" } },
    h("div", { style: { fontSize: "14px", fontWeight: 800, color: T.ink } }, head),
    h("div", { style: { display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap", marginTop: "2px" } },
      h("span", { style: { fontSize: "28px", fontWeight: 800, color: T.green } }, big), h("span", { style: { fontSize: "14px", color: T.muted } }, unit), h(Verdict, { v: verdict })),
    sub && h("div", { style: { fontSize: "13px", color: T.muted, marginTop: "2px" } }, sub), chart);
}

export function SleepCalCard({ rv, calorieTarget, sleepRange }) {
  if (!rv) return null;
  const labels = rv.dates.map((d) => bnNum(Number(d.slice(8))));
  const sMin = sleepRange ? sleepRange[0] : null;
  const showCal = !!calorieTarget;
  if (!rv.hasSleep && !(showCal && rv.hasCal)) {
    return card([h("div", { key: "t" }, title("ঘুম ও ক্যালরি", "গত ৭ দিন", "😴")), h("div", { key: "e" }, para("ঘুম বা খাবারের তথ্য দিলে এখানে সহজ ছবি আসবে।"))]);
  }
  return card([
    h("div", { key: "t" }, title("ঘুম ও ক্যালরি", "গত ৭ দিন · বিন্দু-রেখা = লক্ষ্য", "😴")),
    sMin && h(Block, { key: "s", head: "ঘুম", big: rv.todaySleepH !== null ? bnNum(rv.todaySleepH) : "—", unit: "ঘণ্টা (আজ)", verdict: rv.sleepV,
      sub: "লক্ষ্য " + bnNum(sMin) + "–" + bnNum(sleepRange[1]) + " ঘণ্টা" + (rv.sleepAvg !== null ? " · ৭ দিনের গড় " + bnNum(rv.sleepAvg) : ""),
      chart: rv.hasSleep ? h(TrendBars, { labels, values: rv.sleepH, target: sMin, color: "#6B5BD2", width: 320 }) : null }),
    showCal && h("div", { key: "d", style: { height: "1px", background: T.border, margin: "8px 0" } }),
    showCal && h(Block, { key: "c", head: "ক্যালরি", big: rv.todayCal !== null ? bnNum(rv.todayCal) : "—", unit: "/ " + bnNum(calorieTarget) + " kcal (আজ)", verdict: rv.calV,
      chart: rv.hasCal ? h(TrendBars, { labels, values: rv.cal, target: calorieTarget, color: "#E0A100", width: 320 }) : null }),
  ]);
}
