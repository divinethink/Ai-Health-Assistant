// ঘরোয়া ব্যায়াম গাইড (ব্যায়াম-প্ল্যান ট্যাবের সবচেয়ে নিচে): গ্রুপ অনুযায়ী তালিকা; ট্যাপে বিস্তারিত শিট।
// সদস্যের অবস্থার সাথে মিললে ✕/! ব্যাজ। শুধু display — কিছু ব্লক করে না, কিছু সংরক্ষণ করে না। নিয়ম exerciseGuide.js-এ।
import { EXERCISE_TYPES } from "./planPrefs.js";
import { exerciseDetail } from "./homeWorkout.js";
import { GUIDE_GROUPS, EXERCISE_GUIDE, guideStatus, riskLists } from "./exerciseGuide.js";
import { STATUS_COLORS } from "./foodStatus.js";
import { EX_ICON } from "./PlanEditSheets.js";
import { T } from "./trackerTheme.js";

const { useState } = React;
const h = React.createElement;
const DISCLAIMER = "সাধারণ তথ্য — চিকিৎসা পরামর্শ নয়। ডাক্তারের নির্দেশ প্রাধান্য পায়; ব্যথা, বুকে চাপ, মাথা ঘোরা বা শ্বাসকষ্টে থামুন।";

const badge = (st) => {
  const c = STATUS_COLORS[st.level];
  return h("span", { style: { fontSize: "12px", fontWeight: 700, padding: "1px 8px", borderRadius: "999px", background: c.bg, border: "1px solid " + c.border, color: c.text, whiteSpace: "nowrap" } }, st.icon + " " + st.label);
};

function Section({ title, color, bg, border, children }) {
  return h("div", { style: { margin: "0 0 8px", padding: "8px 10px", borderRadius: "12px", background: bg, border: "1px solid " + border, color, fontSize: "14px", lineHeight: 1.6 } },
    h("div", { style: { fontWeight: 700, marginBottom: "2px" } }, title), children);
}

function Sheet({ type, ctx, onClose }) {
  const g = EXERCISE_GUIDE[type];
  if (!g) return null;
  const st = guideStatus(type, ctx);
  const c = STATUS_COLORS[st.level];
  const det = exerciseDetail(type);
  const { avoid, careful } = riskLists(type);
  const name = (EX_ICON[type] || "") + " " + EXERCISE_TYPES[type].label;
  return h("div", { role: "dialog", "aria-label": EXERCISE_TYPES[type].label, onClick: onClose, style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(20,28,26,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" } },
    h("div", { onClick: (e) => e.stopPropagation(), style: { background: T.surface, color: T.ink, width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "16px 16px 20px", boxShadow: "0 -8px 30px rgba(0,0,0,0.25)" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
        h("div", { style: { fontSize: "18px", fontWeight: 700, color: T.green } }, name),
        h("button", { onClick: onClose, "aria-label": "বন্ধ করুন", style: { minWidth: "44px", minHeight: "44px", border: "none", background: "transparent", fontSize: "20px", color: T.muted, cursor: "pointer" } }, "✕")),
      h("div", { style: { margin: "4px 0 10px", padding: "8px 10px", borderRadius: "12px", background: c.bg, border: "1px solid " + c.border, color: c.text, fontSize: "14px" } },
        h("b", null, st.icon + " " + st.label + " (আপনার জন্য)"),
        st.reasons.length > 0 && h("div", { style: { fontSize: "13px", marginTop: "2px" } }, "কারণ: " + st.reasons.join(" • "))),
      h("div", { style: { fontSize: "14px", lineHeight: 1.6, marginBottom: "6px" } }, h("b", null, "পরিচয়: "), g.intro),
      h("div", { style: { fontSize: "14px", lineHeight: 1.6, marginBottom: "6px" } }, h("b", null, "✨ উপকার: "), g.benefit),
      (det || g.how) && h("div", { style: { fontSize: "14px", lineHeight: 1.6, marginBottom: "6px" } }, h("b", null, "কীভাবে করবেন: "), det ? det.sets + " — " + det.tip : g.how),
      h("div", { style: { fontSize: "14px", lineHeight: 1.6, marginBottom: "10px" } }, h("b", null, "⚠ সতর্কতা: "), g.caution),
      avoid.length > 0 && h(Section, { title: "✕ এই অবস্থায় করবেন না", color: STATUS_COLORS.red.text, bg: STATUS_COLORS.red.bg, border: STATUS_COLORS.red.border }, avoid.join(" • ")),
      careful.length > 0 && h(Section, { title: "! এই অবস্থায় সতর্ক থাকুন (ডাক্তারের পরামর্শ নিন)", color: STATUS_COLORS.yellow.text, bg: STATUS_COLORS.yellow.bg, border: STATUS_COLORS.yellow.border }, careful.join(" • ")),
      avoid.length === 0 && careful.length === 0 && h("div", { style: { fontSize: "13px", color: T.muted, marginBottom: "8px" } }, "সাধারণভাবে নিরাপদ; তবু ব্যথা হলে থামুন।"),
      h("div", { style: { fontSize: "12px", color: T.muted, lineHeight: 1.5 } }, DISCLAIMER)));
}

export function ExerciseGuide({ age, flags, condKeys }) {
  const [open, setOpen] = useState(null);
  const ctx = { age, flags, condKeys };
  return h("div", { style: { marginTop: "12px" } },
    h("div", { style: { fontSize: "15px", fontWeight: 700, color: T.green, marginBottom: "2px" } }, "🏋️ ঘরোয়া ব্যায়াম গাইড"),
    h("div", { style: { fontSize: "13px", color: T.muted, marginBottom: "6px" } }, "ব্যায়ামে ট্যাপ করলে বিস্তারিত দেখাবে — কোন অসুখে এড়াবেন তাও লেখা আছে।"),
    GUIDE_GROUPS.map((g) => {
      const rows = g.types.filter((t) => EXERCISE_GUIDE[t] && EXERCISE_TYPES[t]);
      const sts = rows.map((t) => guideStatus(t, ctx));
      const warn = sts.filter((s) => s.level !== "green").length;
      return h("details", { key: g.id, style: { background: T.surface, border: "1.5px solid " + T.border, borderRadius: "14px", padding: "4px 10px", marginTop: "8px" } },
        h("summary", { style: { fontSize: "14px", fontWeight: 700, color: T.green, cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center", gap: "6px" } },
          g.icon + " " + g.label + " (" + rows.length + ")", warn > 0 && h("span", { style: { fontSize: "12px", color: STATUS_COLORS.yellow.text, fontWeight: 600 } }, "· " + warn + "টিতে সতর্কতা")),
        rows.map((t, i) => h("button", { key: t, type: "button", onClick: () => setOpen(t), style: { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: "1px solid " + T.border, padding: "8px 2px", minHeight: "44px", cursor: "pointer", color: T.ink, fontFamily: "inherit" } },
          h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" } },
            h("span", { style: { fontSize: "14px", fontWeight: 700 } }, (EX_ICON[t] || "") + " " + EXERCISE_TYPES[t].label),
            sts[i].level !== "green" && badge(sts[i])),
          h("div", { style: { fontSize: "13px", color: T.muted, lineHeight: 1.5, marginTop: "2px" } }, EXERCISE_GUIDE[t].intro),
          sts[i].level !== "green" && h("div", { style: { fontSize: "12px", color: STATUS_COLORS[sts[i].level].text, marginTop: "2px" } }, sts[i].reasons.join(" • ")))));
    }),
    h("div", { style: { fontSize: "12px", color: T.muted, marginTop: "8px" } }, DISCLAIMER),
    open && h(Sheet, { type: open, ctx, onClose: () => setOpen(null) }));
}
