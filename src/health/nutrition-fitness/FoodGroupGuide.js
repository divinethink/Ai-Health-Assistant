// গ্রুপ-ভিত্তিক খাদ্য-তালিকা (ধাপ ২): নাম · পুষ্টি-চিপ · এক লাইনের গুণ; ট্যাপে বিস্তারিত শিট (সদস্যের ✓/!/✕ সহ)।
// প্রসেসড/ভাজাপোড়া আলাদা লাল সেকশনে ক্ষতিকর প্রভাবসহ। শুধু display; কোনো data/schema বদল নেই। কিছু ব্লক করে না।
import { groupedFoodList, foodDetail } from "../tracker/foodGroupList.js";
import { FOODS } from "../tracker/mealPlanData.js";
import { foodStatus, STATUS_COLORS } from "../tracker/foodStatus.js";
import { FOOD_INFO_DISCLAIMER, FOOD_INFO_SOURCES } from "../tracker/foodInfo.js";
import { T } from "../tracker/trackerTheme.js";

const { useState } = React;
const h = React.createElement;
const GROUP_ICON = { rice: "🍚", curry: "🥘", protein: "🐟", fruit: "🍎", snack: "🥜", drink: "🥛" };
const chip = (t, k) => h("span", { key: k, style: { fontSize: "12px", padding: "2px 8px", borderRadius: "999px", background: "#EAF6F0", color: "#0E4B43", border: "1px solid #BBDCCB", whiteSpace: "normal" } }, t);

function Sheet({ foodKey, allergyTags, ctx, onClose }) {
  const d = foodDetail(foodKey);
  if (!d) return null;
  const st = foodStatus(foodKey, FOODS[foodKey], { allergyTags, ctx });
  const c = STATUS_COLORS[st.level];
  return h("div", { role: "dialog", "aria-label": d.name, onClick: onClose, style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(20,28,26,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" } },
    h("div", { onClick: (e) => e.stopPropagation(), style: { background: T.surface, color: T.ink, width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", borderRadius: "22px 22px 0 0", padding: "16px 16px 20px", boxShadow: "0 -8px 30px rgba(0,0,0,0.25)" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" } },
        h("div", { style: { fontSize: "18px", fontWeight: 700, color: T.green } }, d.name),
        h("button", { onClick: onClose, "aria-label": "বন্ধ করুন", style: { minWidth: "44px", minHeight: "44px", border: "none", background: "transparent", fontSize: "20px", color: T.muted, cursor: "pointer" } }, "✕")),
      h("div", { style: { margin: "4px 0 10px", padding: "8px 10px", borderRadius: "12px", background: c.bg, border: "1px solid " + c.border, color: c.text, fontSize: "14px" } },
        h("b", null, st.icon + " " + st.label + " (আপনার জন্য)"), st.reasons.length > 0 && h("div", { style: { fontSize: "13px", marginTop: "2px" } }, st.reasons.join(" • "))),
      d.n.length > 0 && h("div", { style: { marginBottom: "10px" } },
        h("div", { style: { fontSize: "13px", fontWeight: 700, color: T.muted, marginBottom: "4px" } }, "ভিটামিন, মিনারেল ও উপাদান"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } }, d.n.map((x, i) => chip(x, i)))),
      d.w && h("div", { style: { fontSize: "14px", lineHeight: 1.6, marginBottom: "8px" } }, "✨ " + d.w),
      d.harm && h("div", { style: { fontSize: "14px", lineHeight: 1.6, marginBottom: "8px", padding: "8px 10px", borderRadius: "12px", background: STATUS_COLORS.red.bg, border: "1px solid " + STATUS_COLORS.red.border, color: STATUS_COLORS.red.text } }, "⚠ ক্ষতিকর প্রভাব: " + d.harm),
      d.note && h("div", { style: { fontSize: "13px", lineHeight: 1.5, marginBottom: "8px", padding: "8px 10px", borderRadius: "12px", background: STATUS_COLORS.yellow.bg, border: "1px solid " + STATUS_COLORS.yellow.border, color: STATUS_COLORS.yellow.text } }, "! " + d.note),
      h("div", { style: { fontSize: "13px", color: T.muted, marginBottom: "8px" } }, d.kcalText),
      h("div", { style: { fontSize: "12px", color: T.muted, lineHeight: 1.5 } }, FOOD_INFO_DISCLAIMER + " উৎস: " + FOOD_INFO_SOURCES + "।")));
}

export function FoodGroupGuide({ allergyTags, ctx }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const { groups, avoid } = groupedFoodList(q);
  // সদস্যের জন্য হলুদ !/লাল ✕ ব্যাজ (সবুজ হলে কিছু নয়, যাতে তালিকা ভিড় না হয়); লাল "প্রসেসড" সেকশনে আলাদা ব্যাজ নেই (আগে থেকেই লাল)
  const row = (key, name, chips, line, red) => {
    const st = red ? null : foodStatus(key, FOODS[key], { allergyTags, ctx });
    const warn = st && st.level !== "green" ? st : null;
    const c = warn ? STATUS_COLORS[warn.level] : null;
    return h("button", { key, onClick: () => setOpen(key), style: { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: "1px solid " + T.border, padding: "8px 2px", minHeight: "44px", cursor: "pointer", color: T.ink, fontFamily: "inherit" } },
      h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" } },
        h("span", { style: { fontSize: "14px", fontWeight: 700, color: red ? "#B3261E" : T.ink } }, name),
        warn && h("span", { style: { fontSize: "12px", fontWeight: 700, padding: "1px 8px", borderRadius: "999px", background: c.bg, border: "1px solid " + c.border, color: c.text, whiteSpace: "nowrap" } }, warn.icon + " " + warn.label),
        chips && chips.slice(0, 2).map((x, i) => chip(x, i))),
      line && h("div", { style: { fontSize: "13px", color: T.muted, lineHeight: 1.5, marginTop: "2px" } }, line),
      warn && warn.reasons[0] && h("div", { style: { fontSize: "12px", color: c.text, lineHeight: 1.4, marginTop: "2px" } }, warn.reasons[0]));
  };
  const det = (id, title, color, bg, border, rows, k) => h("details", { key: id, style: { background: bg, border: "1.5px solid " + border, borderRadius: "14px", padding: "4px 10px", marginTop: "8px" } },
    h("summary", { style: { fontSize: "14px", fontWeight: 700, color, cursor: "pointer", minHeight: "44px", display: "flex", alignItems: "center" } }, title), rows);
  return h("div", { style: { marginTop: "12px" } },
    h("div", { style: { fontSize: "15px", fontWeight: 700, color: T.green, marginBottom: "6px" } }, "🥗 খাদ্য-তালিকা (গ্রুপ অনুযায়ী)"),
    h("input", { type: "search", value: q, placeholder: "খাবার বা ভিটামিন খুঁজুন (বাংলা/English)", onChange: (e) => setQ(e.target.value), "aria-label": "খাবার খুঁজুন", style: { width: "100%", boxSizing: "border-box", minHeight: "44px", padding: "8px 12px", fontSize: "14px", borderRadius: "12px", border: "1.5px solid " + T.inputBorder, background: T.surface, color: T.ink } }),
    groups.length === 0 && avoid.length === 0 && h("div", { style: { fontSize: "14px", color: T.muted, padding: "10px 2px" } }, "কিছু পাওয়া যায়নি।"),
    groups.map((g) => det("g_" + g.id, (GROUP_ICON[g.id] || "🍽️") + " " + g.label + " (" + g.items.length + ")", T.green, T.surface, T.border,
      g.items.map((x) => row(x.key, x.name, x.n, x.w)))),
    avoid.length > 0 && h("div", { style: { fontSize: "13px", fontWeight: 700, color: "#B3261E", marginTop: "12px" } }, "🚫 প্রসেসড ও ভাজাপোড়া — ক্ষতিকর প্রভাবসহ"),
    avoid.map((g) => det("a_" + g.id, g.label + " (" + g.items.length + ")", "#B3261E", "#FDF0EE", "#DB9C95",
      g.items.map((x) => row(x.key, x.name, null, x.h, true)))),
    h("div", { style: { fontSize: "12px", color: T.muted, marginTop: "8px" } }, "খাবারে ট্যাপ করলে বিস্তারিত দেখাবে। " + FOOD_INFO_DISCLAIMER),
    open && h(Sheet, { foodKey: open, allergyTags, ctx, onClose: () => setOpen(null) }));
}
