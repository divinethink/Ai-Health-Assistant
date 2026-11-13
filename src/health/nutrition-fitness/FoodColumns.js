// খাবারের তালিকা — ❌ এড়িয়ে চলুন / ✅ খাবেন প্রিমিয়াম কার্ডে; প্রতিটি খাবার গ্রিড-টাইলে।
// প্রোফাইল-কার্ড ও খাদ্য নির্দেশিকা (DietGuidanceSection) একই UI ব্যবহার করে।
// শুধু display; কোনো data/schema বদল নেই। রং হালকা-স্বচ্ছ টিন্ট + --hs-* টোকেন, তাই সব থিমে (গাঢ়/সেপিয়া সহ) মানায়।

import { bnNum } from "../../shared/dates.js";
import { sourceLabels } from "./tagLabels.js";

const h = React.createElement;
const TEXT = "var(--hs-text, #1F2D2A)";
const MUTED = "var(--hs-muted, #5F716C)";
const SURFACE = "var(--hs-surface, #fff)";

// কার্ডের রং-সেট: accent = আইকন/মার্কার, tint(a) = স্বচ্ছ রং।
const PAL = {
  avoid: { accent: "#C0392B", tint: (a) => "rgba(192,57,43," + a + ")", mark: "✕", icon: "⛔", label: "এড়িয়ে চলুন" },
  include: { accent: "#2E8B63", tint: (a) => "rgba(46,139,99," + a + ")", mark: "✓", icon: "🥗", label: "খাবেন" },
  tips: { accent: "#B7791F", tint: (a) => "rgba(183,121,31," + a + ")", mark: "›", icon: "💡", label: "অভ্যাস ও জীবনযাত্রা" },
};

const cardStyle = (p) => ({
  background: "linear-gradient(160deg, " + p.tint(0.13) + ", " + p.tint(0.03) + " 62%), " + SURFACE,
  border: "1px solid " + p.tint(0.3), borderRadius: "16px", padding: "10px", minWidth: 0,
  boxShadow: "0 6px 18px " + p.tint(0.1) + ", 0 1px 2px rgba(0,0,0,0.05)",
});
const gridStyle = (min) => ({ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(" + min + "px, 1fr))", gap: "8px" });

function cardHeader(p, title, count) {
  return h("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" } },
    h("span", { "aria-hidden": true, style: { width: "32px", height: "32px", borderRadius: "50%", background: p.tint(0.16), border: "1px solid " + p.tint(0.35), display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 } }, p.icon),
    h("div", { style: { fontSize: "15px", fontWeight: 800, color: TEXT, letterSpacing: "0.1px", minWidth: 0 } }, title),
    count > 0 && h("span", { style: { marginLeft: "auto", flexShrink: 0, fontSize: "12px", fontWeight: 700, padding: "2px 10px", borderRadius: "999px", background: p.tint(0.14), border: "1px solid " + p.tint(0.3), color: TEXT } }, bnNum(count) + "টি"));
}

function moreSummary(p, n) {
  return h("summary", { style: { fontSize: "14px", fontWeight: 700, color: TEXT, cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", border: "1px dashed " + p.tint(0.45), background: p.tint(0.06) } }, "আরও " + bnNum(n) + "টি দেখুন ▾");
}

// একটা খাবার-টাইল: মার্কার + নাম + (একাধিক রোগ হলে) ছোট কারণ-ব্যাজ।
function tile(p, x, i, sources) {
  const src = sourceLabels(sources && sources[x]);
  // কম্প্যাক্ট: ছোট প্যাডিং, কলাম-ফ্লো (নিচে ফাঁকা জায়গা নেই), ব্যাজ শুধু আইকন+সংক্ষিপ্ত নাম
  return h("li", { key: i, style: { listStyle: "none", breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: "6px", background: SURFACE, border: "1px solid " + p.tint(0.25), borderRadius: "10px", padding: "6px 8px", display: "block" } },
    h("div", { style: { display: "flex", gap: "6px", alignItems: "flex-start" } },
      h("span", { "aria-hidden": true, style: { width: "16px", height: "16px", borderRadius: "50%", background: p.tint(0.16), color: p.accent, fontSize: "10px", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "3px" } }, p.mark),
      h("span", { style: { fontSize: "14px", lineHeight: 1.4, color: TEXT, overflowWrap: "anywhere", minWidth: 0 } }, x)),
    src.length > 0 && h("div", { style: { display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px", paddingLeft: "22px" } },
      src.map((s, k) => h("span", { key: k, "aria-label": s.text, style: { fontSize: "12px", lineHeight: 1.3, padding: "0 6px", borderRadius: "999px", background: "var(--hs-chip-bg, #EEF3F0)", color: MUTED, border: "1px solid var(--hs-border, #D3E0D9)" } }, s.icon + " " + s.text.replace(/\s*\(.*\)$/, "")))));
}

// সাম্প্রতিক খাবার (ধাপ ১): কার্ডের শেষে ছোট অংশ। rows: [{name, level, icon, reasons}] বা undefined (= দেখানো নয়)।
const LEVEL_COLOR = { green: "#2E8B63", yellow: "#B7791F", red: "#C0392B" };
function recentBlock(rows, p, emptyText) {
  if (!rows) return null;
  return h("div", { style: { marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed " + p.tint(0.4) } },
    h("div", { style: { fontSize: "13px", fontWeight: 700, color: TEXT, marginBottom: "6px" } }, "🕘 আপনার সাম্প্রতিক খাবার"),
    rows.length === 0
      ? h("div", { style: { fontSize: "13px", color: MUTED } }, emptyText)
      : h("ul", { style: { margin: 0, padding: 0, columns: "140px 2", columnGap: "6px" } }, rows.map((r) => {
        const c = LEVEL_COLOR[r.level] || p.accent;
        return h("li", { key: r.key, style: { listStyle: "none", breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: "6px", background: SURFACE, border: "1px solid " + c + "44", borderRadius: "10px", padding: "6px 8px", display: "block" } },
          h("div", { style: { display: "flex", gap: "6px", alignItems: "flex-start" } },
            h("span", { "aria-label": r.level === "red" ? "এড়িয়ে চলুন" : r.level === "yellow" ? "সীমিত রাখুন" : "ঠিক আছে", style: { color: c, fontWeight: 800, flexShrink: 0, lineHeight: 1.4 } }, r.icon),
            h("span", { style: { fontSize: "14px", lineHeight: 1.4, color: TEXT, overflowWrap: "anywhere", minWidth: 0 } }, r.name)),
          r.reasons && r.reasons[0] && h("div", { style: { fontSize: "12px", lineHeight: 1.4, color: MUTED, marginTop: "2px", paddingLeft: "18px", overflowWrap: "anywhere" } }, r.reasons[0]));
      })));
}

function column(kind, title, items, sources, limit, recent, emptyText) {
  const p = PAL[kind];
  const clean = items.map((x) => String(x).trim()).filter(Boolean);
  const first = limit ? clean.slice(0, limit) : clean;
  const rest = limit ? clean.slice(limit) : [];
  const ul = { margin: 0, padding: 0, columns: "140px 2", columnGap: "6px" }; // মেসনরি-ফ্লো: টাইল নিজের উচ্চতায়, ফাঁকা নয়
  return h("section", { style: cardStyle(p) },
    cardHeader(p, title, clean.length),
    clean.length === 0
      ? h("div", { style: { fontSize: "14px", color: MUTED } }, "নির্দিষ্ট কিছু নেই")
      : h("ul", { style: ul }, first.map((x, i) => tile(p, x, i, sources))),
    rest.length > 0 && h("details", { style: { marginTop: "8px" } },
      moreSummary(p, rest.length),
      h("ul", { style: { ...ul, marginTop: "8px" } }, rest.map((x, i) => tile(p, x, i + first.length, sources)))),
    recentBlock(recent, p, emptyText));
}

// avoid/include: string[]; sources: { খাবার: [tag,...] } (ঐচ্ছিক); limit: প্রতি কার্ডে প্রথমে কয়টা (ঐচ্ছিক)।
// দুই দিকের একটা খালি হলে শুধু অন্যটা পুরো প্রস্থে; ফোনে ওপর-নিচে, চওড়া স্ক্রিনে পাশাপাশি।
// recent (ঐচ্ছিক): { avoid: [...], include: [...] } — দিলে প্রতি কার্ডের শেষে সাম্প্রতিক খাবার; না দিলে আগের মতোই।
// avoidTitle (ঐচ্ছিক): "এড়িয়ে চলুন"-কার্ডের শিরোনাম বদলাতে (যেমন "আজ এড়িয়ে চলুন")।
export function foodColumns({ avoid, include, avoidSources, limit, recent, avoidTitle }) {
  const hasAvoid = avoid.length > 0, hasInclude = include.length > 0;
  if (!hasAvoid && !hasInclude) return null;
  const none = recent && recent.avoid.length === 0 && recent.include.length === 0;
  const hint = "ট্র্যাকারে খাবার যোগ করলে এখানে দেখাবে";
  return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "12px", marginTop: "12px" } },
    hasAvoid && column("avoid", avoidTitle || PAL.avoid.label, avoid, avoidSources, limit, recent && recent.avoid, none ? hint : "এড়ানোর মতো সাম্প্রতিক খাবার নেই"),
    hasInclude && column("include", PAL.include.label, include, null, limit, recent && recent.include, none ? hint : "সাম্প্রতিক ঠিক-থাকা খাবার নেই"));
}

// 💡 অভ্যাস ও জীবনযাত্রা — খাবার নয় এমন পরামর্শ (ব্যায়াম, খাওয়ার নিয়ম, বিশ্রাম ইত্যাদি)। নম্বরযুক্ত টাইলে।
export function habitTipsBox(tips, limit) {
  const clean = (tips || []).map((x) => String(x).trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const p = PAL.tips;
  const first = limit ? clean.slice(0, limit) : clean;
  const rest = limit ? clean.slice(limit) : [];
  const li = (x, i) => h("li", { key: i, style: { listStyle: "none", background: SURFACE, border: "1px solid " + p.tint(0.25), borderRadius: "10px", padding: "7px 9px", display: "flex", gap: "8px", alignItems: "flex-start", minWidth: 0 } },
    h("span", { "aria-hidden": true, style: { width: "22px", height: "22px", borderRadius: "50%", background: p.tint(0.18), color: p.accent, fontSize: "12px", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" } }, bnNum(i + 1)),
    h("span", { style: { fontSize: "14px", lineHeight: 1.55, color: TEXT, overflowWrap: "anywhere", minWidth: 0 } }, x));
  const ul = { margin: 0, padding: 0, ...gridStyle(230) };
  return h("section", { style: { ...cardStyle(p), marginTop: "12px" } },
    cardHeader(p, p.label, 0),
    h("ul", { style: ul }, first.map(li)),
    rest.length > 0 && h("details", { style: { marginTop: "8px" } },
      moreSummary(p, rest.length),
      h("ul", { style: { ...ul, marginTop: "8px" } }, rest.map((x, i) => li(x, i + first.length)))));
}
