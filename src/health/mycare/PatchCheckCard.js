// MyCare — প্যাচ টেস্টের ২৪ ঘণ্টা পরের স্মরণ ("ত্বক কেমন আছে?")। শুধু ডিভাইস-স্টোরেজ; অন্যের মোডে বসানো হয় না।
import { L } from "../../shared/i18n.js";
import { ALL_ITEMS } from "./data/index.js";
import { duePatches, finishPatch, snoozePatch } from "./carePatch.js";

const { useState } = React;
const T = (o) => (o ? L(o.bn, o.en) : "");
const nameOf = (id) => { const it = ALL_ITEMS.find((i) => i.id === id); return it ? T(it.name) : ""; };
const btn = (bg, fg, bd) => ({ width: "100%", minHeight: "44px", padding: "8px 12px", borderRadius: "12px", border: "1px solid " + bd, background: bg, color: fg, fontSize: "14.5px", fontWeight: 800, fontFamily: "inherit", cursor: "pointer", textAlign: "left" });

const MSG = {
  ok: ["প্যাচ টেস্টে সমস্যা না হলে পণ্যটি অল্প অল্প করে ব্যবহার শুরু করা যায়। পরে কিছু মনে হলে বন্ধ করে দিন।", "If the patch test shows no reaction, you can start using the product gradually. Stop if anything changes later."],
  bad: ["পণ্যটি আর ব্যবহার করবেন না। জায়গাটি পানি দিয়ে আলতো করে ধুয়ে নিন। ফোসকা, ফোলা বা ব্যথা বাড়লে ডাক্তার দেখান। মুখ-ঠোঁট ফুলে গেলে বা শ্বাসকষ্ট হলে এখনই জরুরি সেবা নিন।", "Do not use the product again. Rinse the area gently with water. See a doctor if there are blisters, swelling or growing pain. If lips or face swell or breathing is hard, get emergency help now."],
};

export function PatchCheckCard({ list, update }) {
  const [res, setRes] = useState({}); // id → "ok" | "bad" (উত্তর দেখানো চলছে)
  const due = duePatches(list, Date.now()).map((x) => x.id).filter((id) => nameOf(id));
  const ids = [...new Set([...due, ...Object.keys(res)])];
  if (!ids.length) return null;
  const answer = (id, kind) => { setRes((r) => ({ ...r, [id]: kind })); update((l) => finishPatch(l, id)); };
  return React.createElement("div", null, ids.map((id) => {
    const r = res[id];
    return React.createElement("div", { key: id, role: "status", style: { padding: "14px", borderRadius: "20px", border: "1px solid " + (r === "bad" ? "#E5A29A" : "#A9D8C4"), background: r === "bad" ? "#FDECEA" : "#EAF6F0", marginBottom: "12px" } },
      r
        ? [React.createElement("div", { key: "m", style: { fontSize: "14.5px", lineHeight: 1.6, color: "#1F2D2A", fontWeight: r === "bad" ? 700 : 500 } }, L(MSG[r][0], MSG[r][1])),
           React.createElement("button", { key: "c", type: "button", onClick: () => setRes((x) => { const n = { ...x }; delete n[id]; return n; }), style: { ...btn("#fff", "#0E4B43", "#C3D2CA"), marginTop: "10px", textAlign: "center" } }, L("বুঝেছি", "Got it"))]
        : [React.createElement("div", { key: "t", style: { fontSize: "17px", fontWeight: 800, color: "#0E4B43" } }, L("ত্বক কেমন আছে?", "How does your skin look?")),
           React.createElement("div", { key: "s", style: { fontSize: "13.5px", color: "#3F514B", margin: "2px 0 10px", lineHeight: 1.5 } }, L(nameOf(id) + "-এর প্যাচ টেস্ট শুরু করেছিলেন। এখন জায়গাটি দেখে জানান।", "You started a patch test for " + nameOf(id) + ". Check the spot and tell us.")),
           React.createElement("div", { key: "b", style: { display: "flex", flexDirection: "column", gap: "8px" } },
             React.createElement("button", { type: "button", onClick: () => answer(id, "ok"), style: btn("#fff", "#1F6B50", "#A9D8C4") }, L("কোনো সমস্যা নেই", "No reaction")),
             React.createElement("button", { type: "button", onClick: () => answer(id, "bad"), style: btn("#fff", "#8A2A1E", "#E5A29A") }, L("লালচে ভাব, চুলকানি বা জ্বালা আছে", "Redness, itching or burning")),
             React.createElement("button", { type: "button", onClick: () => update((l) => snoozePatch(l, id, Date.now())), style: btn("transparent", "#5F716C", "#C3D2CA") }, L("পরে মনে করান", "Remind me later")))]);
  }));
}
