// মিল-প্ল্যান পাতার "খাদ্য-তালিকা দেখুন" বাটন (owner-approved ২০২৬-১১-১৪): ট্যাপে নিচ থেকে শিট খোলে,
// ভেতরে Food Habit-এর একই FoodGroupGuide (ডুপ্লিকেট নয়)। শুধু display — schema/rules/ডেটা বদল নেই।
import { Sheet } from "./PlanEditSheets.js";
import { FoodGroupGuide } from "../nutrition-fitness/FoodGroupGuide.js";
import { T, CARD_STYLE } from "./trackerTheme.js";
import { Icon } from "../../shared/icons.js";

const { useState } = React;
const h = React.createElement;

export function FoodListButton({ info }) {
  const [open, setOpen] = useState(false);
  return h(React.Fragment, null,
    h("button", {
      type: "button", onClick: () => setOpen(true),
      style: { ...CARD_STYLE, width: "100%", minHeight: "48px", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: T.green, fontSize: "14px", fontWeight: 700 },
    },
    h("span", { "aria-hidden": "true", style: { width: "34px", height: "34px", flexShrink: 0, borderRadius: "10px", background: T.track, display: "flex", alignItems: "center", justifyContent: "center", color: T.green } }, Icon("utensils", { size: 20 })),
    h("span", { style: { flex: 1 } }, "খাদ্য-তালিকা দেখুন"),
    h("span", { "aria-hidden": "true", style: { color: T.muted, display: "flex" } }, Icon("chevronRight", { size: 18, stroke: 2 }))),
    open && h(Sheet, { title: "খাদ্য-তালিকা", onClose: () => setOpen(false) },
      h(FoodGroupGuide, { allergyTags: info.allergyTags, ctx: { age: info.age, flags: info.flags, condKeys: info.condKeys } })));
}
