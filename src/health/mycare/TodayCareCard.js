// MyCare — "আজকের যত্ন" কার্ড (MyCare পেজ ও হোম)। বাছাই careToday.js-এ; এখানে শুধু দেখানো।
import { L } from "../../shared/i18n.js";
import { seasonOf } from "./careSeason.js";
import { pickTodayCare, isEmptyCare } from "./careToday.js";
import { ALL_ITEMS } from "./data/index.js";
import { CAT_META, SEASON_LABEL } from "./careLabels.js";
import { IconBox } from "./careIcons.js";
import { useCareProfile } from "./useCareProfile.js";

const T = (o) => (o ? L(o.bn, o.en) : "");
const GROUPS = [["morning", "সকাল", "Morning", "#C98A12"], ["night", "রাত", "Night", "#5B4B9A"], ["anytime", "দিনের মধ্যে", "During the day", "#1F7A5C"]];
const colorOf = (cat) => (CAT_META.find((c) => c[0] === cat) || [0, 0, 0, "#1F7A5C"])[3];

export function TodayCareView({ profile, onOpen, compact }) {
  const season = seasonOf(new Date());
  const care = pickTodayCare(profile, ALL_ITEMS, { season, date: new Date() });
  if (isEmptyCare(care)) return null;
  const row = (e, key) => React.createElement("button", { key, type: "button", onClick: () => onOpen && onOpen(e.item), style: { width: "100%", minHeight: "44px", display: "flex", alignItems: "center", gap: "10px", padding: "4px 2px", border: "none", background: "none", textAlign: "left", fontFamily: "inherit", color: "var(--hs-text, #1B2430)", cursor: "pointer" } },
    React.createElement(IconBox, { id: e.item.category, color: colorOf(e.item.category), size: 30 }),
    React.createElement("span", { style: { flex: 1, minWidth: 0, fontSize: "14.5px", fontWeight: 700, overflowWrap: "anywhere" } }, T(e.item.name)));
  return React.createElement("div", { style: { padding: "14px", borderRadius: "22px", border: "1px solid var(--hs-border, #D9E5DE)", background: "var(--hs-surface, #fff)", boxShadow: "0 4px 14px rgba(14,75,67,0.08)", marginBottom: "12px" } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "4px" } },
      React.createElement("span", { style: { fontSize: "17px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)" } }, L("আজকের যত্ন", "Today's care")),
      onOpen && compact && React.createElement("button", { type: "button", onClick: () => onOpen(null), style: { minHeight: "44px", padding: "0 6px", border: "none", background: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 800, color: "var(--hs-primary, #0E4B43)", cursor: "pointer" } }, L("MyCare ›", "MyCare ›"))),
    GROUPS.map(([id, bn, en, color]) => care[id].length > 0 && React.createElement("div", { key: id, style: { marginTop: "6px" } },
      React.createElement("div", { style: { fontSize: "12.5px", fontWeight: 800, color } }, L(bn, en)),
      care[id].map((e) => row(e, id + e.item.id)))),
    care.seasonTip && React.createElement("div", { style: { marginTop: "10px", padding: "8px 10px", borderRadius: "14px", background: "#EAF6F0", border: "1px solid #A9D8C4" } },
      React.createElement("div", { style: { fontSize: "12.5px", fontWeight: 800, color: "#1F6B50" } }, L("ঋতুর টিপ", "Season tip") + (SEASON_LABEL[season] ? " · " + L(SEASON_LABEL[season][0], SEASON_LABEL[season][1]) : "")),
      row(care.seasonTip, "tip")),
    care.mode === "core-only" && React.createElement("div", { style: { marginTop: "8px", fontSize: "12.5px", color: "var(--hs-muted, #5F716C)", lineHeight: 1.5 } }, L("কিছু তথ্য জানা নেই, তাই শুধু সবচেয়ে নিরাপদ পরামর্শ।", "Some details are unknown, so only the safest advice is shown.")),
    React.createElement("div", { style: { marginTop: "6px", fontSize: "12px", color: "var(--hs-muted, #5F716C)" } }, L("এটি সাধারণ গাইড, চিকিৎসা পরামর্শ নয়।", "This is a general guide, not medical advice.")));
}

// হোমে বসানোর রূপ: নিজে profile পড়ে; পড়া চলাকালীন বা ফাঁকা হলে কিছুই দেখায় না (হোম অক্ষত)
export function HomeTodayCare({ familyId, selectedMemberId, members, onOpen }) {
  const { ready, profile } = useCareProfile(familyId, selectedMemberId, members);
  if (!ready) return null;
  return React.createElement(TodayCareView, { profile, onOpen, compact: true });
}
