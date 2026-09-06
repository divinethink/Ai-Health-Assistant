// Herbal/Homeopathy Remedy Browse Section (roadmap §12.2, Architecture Plan
// Part B §5.2/§5.2.1, P6 ধাপ ৫)। Global data (family-independent), তাই কোনো
// familyId/memberId prop লাগে না। এটাই প্রথম screen যেখানে EvidenceBadge
// (P6 ধাপ ২) আসলে wire হলো।
//
// এই মুহূর্তে সব remedy entry এখনো `status: "draft"` (populateRemedyDb.js
// দিয়ে লেখা, pharmacist/physician-review pending) — তাই এই section খালি
// দেখানোর কথাই প্রত্যাশিত (safe-default), ভাঙা না। Verification সম্পন্ন হয়ে
// কোনো entry `status: "verified"`-এ গেলে তখনই এখানে দেখা যাবে।

import { ErrorBox } from "../../shared/ui.js";
import { listVerifiedRemedies } from "./remedyData.js";
import { EvidenceBadge } from "./EvidenceBadge.js";

const { useState, useEffect } = React;

function RemedyGroup({ title, list }) {
  return React.createElement(
    "div", { style: { marginTop: "12px" } },
    React.createElement("h4", { style: { fontSize: "14px", color: "#0E4B43", marginBottom: "6px" } }, title),
    list.length === 0
      ? React.createElement(
          "p", { style: { color: "#888", fontSize: "13px" } },
          "এখনো কোনো verified remedy নেই — pharmacist/physician review-এর অপেক্ষায়।"
        )
      : React.createElement(
          "div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          ...list.map((r) =>
            React.createElement(
              "div",
              { key: r.id, style: { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px" } },
              React.createElement("div", { style: { fontWeight: 600, marginBottom: "6px" } }, r.name),
              React.createElement(EvidenceBadge, {
                evidenceTier: r.evidenceTier,
                disclaimerRequired: r.disclaimerRequired,
                disclaimerText: r.disclaimerText,
              }),
              React.createElement(
                "div", { style: { fontSize: "12px", color: "#555", marginTop: "6px" } },
                (r.useCase || []).join(" · ")
              )
            )
          )
        )
  );
}

export function RemedySection() {
  const [herbal, setHerbal] = useState(null);
  const [homeo, setHomeo] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    Promise.all([listVerifiedRemedies("herbal"), listVerifiedRemedies("homeopathy")])
      .then(([h, ho]) => {
        setHerbal(h);
        setHomeo(ho);
      })
      .catch((e) => setLoadErr(e.message || String(e)));
  }, []);

  if (loadErr) return ErrorBox(loadErr);
  if (herbal === null || homeo === null) {
    return React.createElement("p", { style: { color: "#888", fontSize: "13px" } }, "Remedy তালিকা লোড হচ্ছে...");
  }

  return React.createElement(
    "div", { style: { marginTop: "20px" } },
    React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43" } }, "Herbal / Homeopathy — Evidence-Level Reference"),
    React.createElement(RemedyGroup, { title: "Herbal / ভেষজ", list: herbal }),
    React.createElement(RemedyGroup, { title: "Homeopathy", list: homeo })
  );
}
