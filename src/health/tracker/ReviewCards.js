// অ্যাক্টিভিটি রিভিউ: সাপ্তাহিক রিপোর্ট · আগামী সপ্তাহের ফোকাস · অভ্যাস-প্যাটার্ন · সম্ভাব্য ট্রিগার (শুধু display)।
// হিসাব reviewInsights.js-এ (pure); কিছু সংরক্ষণ করে না, ব্লক করে না। সদস্যের নিজের দেওয়া তথ্য থেকে — AI/রোগনির্ণয় নয়।
import { T, HOME_CARD } from "./trackerTheme.js";
import { weeklyReport, pickFocus, habitPatterns, triggerSearch } from "./reviewInsights.js";

const h = React.createElement;
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (s) => String(s).replace(/\d/g, (d) => BN[d]);
const MARK = { up: ["▲", T.green], down: ["▼", "#C46A12"], flat: ["●", T.muted] };

const card = (children) => h("div", { style: { ...HOME_CARD, padding: "14px", marginBottom: "12px" } }, children);
const title = (t, sub, icon) => h("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" } },
  h("span", { "aria-hidden": "true", style: { width: "34px", height: "34px", borderRadius: "11px", background: T.track, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 } }, icon),
  h("div", { style: { flex: 1, minWidth: 0 } },
    h("div", { style: { fontSize: "16px", fontWeight: 800, color: T.ink, lineHeight: 1.25 } }, t),
    sub && h("div", { style: { fontSize: "12.5px", color: T.muted, marginTop: "2px" } }, sub)));
const note = (t) => h("div", { style: { fontSize: "12px", color: T.muted, marginTop: "8px", lineHeight: 1.5 } }, t);
const row = (kind, text, i) => h("div", { key: i, style: { display: "flex", gap: "8px", fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: i ? "4px" : 0 } },
  h("span", { "aria-hidden": "true", style: { color: MARK[kind][1], flexShrink: 0 } }, MARK[kind][0]), h("span", null, bn(text)));

function ReportCard({ rep, past }) {
  const kids = [title(past ? "ওই মাসের শেষ সপ্তাহের রিপোর্ট" : "এ সপ্তাহের রিপোর্ট", "শেষ ৭ দিন · আগের ৭ দিনের সাথে মিলিয়ে", "🧾")];
  if (!rep.enough) {
    kids.push(h("div", { key: "n", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "রিপোর্ট বানাতে আরও " + bn(rep.need) + " দিনের তথ্য দরকার। ছোট ছোট এন্ট্রিই যথেষ্ট।"));
  } else {
    rep.lines.forEach((l, i) => kids.push(row(l.kind, l.text, i)));
    if (rep.focusProgress) {
      const f = rep.focusProgress;
      kids.push(h("div", { key: "fp", style: { marginTop: "10px", padding: "8px 10px", borderRadius: "12px", background: T.canvas, border: "1px solid " + T.border, fontSize: "14px", color: T.ink, lineHeight: 1.6 } },
        "🎯 গত সপ্তাহের ফোকাস ছিল " + f.label + ": ", bn(f.from + "% → " + f.to + "%"), h("span", { style: { color: MARK[f.kind][1], fontWeight: 800, marginLeft: "6px" } }, f.kind === "up" ? "▲ উন্নতি" : f.kind === "down" ? "▼ কমেছে" : "● প্রায় একই")));
    }
  }
  kids.push(note("শুধু আপনার দেওয়া তথ্য থেকে। সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।"));
  return card(kids);
}

function FocusCard({ focus }) {
  if (!focus) return card([title("আগামী সপ্তাহের ফোকাস", null, "🎯"), h("div", { key: "g", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "এ সপ্তাহে সব লক্ষ্যই ভালো ছিল — এভাবেই চালিয়ে যান।")]);
  return card([
    title("আগামী সপ্তাহের ফোকাস", "একবারে একটাই ছোট লক্ষ্য", "🎯"),
    h("div", { key: "t", style: { fontSize: "16px", fontWeight: 800, color: T.green } }, focus.label + (focus.pct !== null ? " — এ সপ্তাহে " + bn(focus.pct) + "%" : "")),
    h("div", { key: "a", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6, marginTop: "4px" } }, bn(focus.action)),
    note("সপ্তাহ শেষে এই রিপোর্টেই দেখবেন ফোকাসে কতটা উন্নতি হলো।"),
  ]);
}

function PatternCard({ pat }) {
  const kids = [title("অভ্যাস-প্যাটার্ন", "গত " + bn(pat.days) + " দিনের ধরন", "🔁")];
  const lines = [];
  if (pat.missDay) lines.push(["down", pat.missDay.day + " প্রায়ই তথ্য লেখা হয় না (" + pat.missDay.total + " দিনের মধ্যে " + pat.missDay.missed + " দিন ফাঁকা)"]);
  pat.weakDays.forEach((w) => lines.push(["down", w.day + " " + w.label + " বেশি ফসকায় (ওই বারে " + w.hit + "/" + w.logged + " দিন লক্ষ্যে; গড়ে " + w.overall + "%)"]));
  if (pat.recorded < 7) kids.push(h("div", { key: "n", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "প্যাটার্ন দেখতে অন্তত ৭ দিনের তথ্য লাগে — এখন " + bn(pat.recorded) + " দিন আছে।"));
  else if (!lines.length) kids.push(h("div", { key: "ok", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "নির্দিষ্ট কোনো বারে বড় ঘাটতি দেখা যায়নি — নিয়মিত আছেন।"));
  else lines.forEach(([k, t], i) => kids.push(row(k, t, i)));
  kids.push(note("এ থেকে আগে থেকে সতর্ক হয়ে ওই দিনের জন্য রিমাইন্ডার বা সহজ লক্ষ্য রাখতে পারেন।"));
  return card(kids);
}

function TriggerCard({ trg }) {
  const kids = [title("সম্ভাব্য ট্রিগার (পেট)", "পেট-ডায়েরি × খাবার-লগ, গত ৩৫ দিন", "🔍")];
  if (!trg.enough) {
    kids.push(h("div", { key: "n", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "মিল খুঁজতে আরও লগ দরকার — পেট-ডায়েরি ও খাবার একই দিনে লিখলে ভালো (এখন তুলনার দিন " + bn(trg.compared) + "টি, অস্বস্তির দিন " + bn(trg.badDays) + "টি)।"));
  } else if (!trg.items.length) {
    kids.push(h("div", { key: "n", style: { fontSize: "14px", color: T.ink, lineHeight: 1.6 } }, "কোনো নির্দিষ্ট খাবারের সাথে স্পষ্ট মিল পাওয়া যায়নি।"));
  } else {
    trg.items.forEach((x, i) => kids.push(row("down", x.name + " — অস্বস্তির " + x.bad + "টি দিনে খাওয়া হয়েছিল (মোট " + x.total + " দিনের মধ্যে)", i)));
  }
  kids.push(note("এটি শুধু আপনার লগের মিল — কারণ প্রমাণ নয়, রোগনির্ণয়ও নয়। অস্বস্তি বারবার হলে ডাক্তার/ডায়েটিশিয়ানকে এই তালিকা দেখান। ‘অস্বস্তির দিন’ = ব্রিস্টল ১–২ বা ৬–৭।"));
  return card(kids);
}

// props: docs (মিলিত দৈনিক ডক), endISO, scoreCtx (পানি বাদ), rateCtx (পানিসহ), gutEntries, showGut, full (অভ্যাস+ট্রিগারও)
export function ReviewCards({ docs, endISO, scoreCtx, rateCtx, gutEntries, showGut, full, past }) {
  const rep = weeklyReport({ docs, endISO, scoreCtx, rateCtx });
  const focus = pickFocus(rep, rateCtx);
  // মাস-ভিউ (full): সাপ্তাহিক রিপোর্ট ও ফোকাস সপ্তাহ-ভিউয়ে আছে — এখানে পুনরাবৃত্তি নয়
  const nodes = full ? [] : [h(ReportCard, { key: "r", rep, past }), h(FocusCard, { key: "f", focus })];
  if (full) {
    nodes.push(h(PatternCard, { key: "p", pat: habitPatterns({ docs, endISO, rateCtx }) }));
    if (showGut) nodes.push(h(TriggerCard, { key: "t", trg: triggerSearch({ docs, gutEntries, endISO }) }));
  }
  return h("div", null, nodes);
}
