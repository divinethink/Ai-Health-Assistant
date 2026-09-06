// Herbal/Homeopathy Remedy Browse Section (roadmap §12.2, Architecture Plan
// Part B §5.2/§5.2.1, P6 ধাপ ৫)। Global data (family-independent), তাই কোনো
// familyId/memberId prop লাগে না। এটাই প্রথম screen যেখানে EvidenceBadge
// (P6 ধাপ ২) আসলে wire হলো।
//
// এই মুহূর্তে সব remedy entry এখনো `status: "draft"` (populateRemedyDb.js
// দিয়ে লেখা, pharmacist/physician-review pending) — তাই এই section খালি
// দেখানোর কথাই প্রত্যাশিত (safe-default), ভাঙা না। Verification সম্পন্ন হয়ে
// কোনো entry `status: "verified"`-এ গেলে তখনই এখানে দেখা যাবে।
//
// P7 (roadmap §11.1 "Multi-remedy comparison view") — এই থ্রেডে যোগ হলো একটা
// toggle: default mode-grouped view (উপরের মতোই, অপরিবর্তিত) vs নতুন
// useCase-অনুযায়ী Herbal/Homeopathy পাশাপাশি comparison view। কোনো নতুন
// Firestore read/collection লাগেনি — existing `listVerifiedRemedies()` data
// শুধু client-side পুনর্গঠন (§4.3 risk-based rule এখানে প্রযোজ্য না, কারণ এটা
// standalone reference-browse, কোনো active symptom/riskLevel-context নেই —
// AI-guidance flow-এর risk-based primary/secondary rendering, TriageForm.js-এর
// RiskBasedTreatmentModes, এখানে অপরিবর্তিত ও পৃথক থাকছে)।

import { ErrorBox } from "../../shared/ui.js";
import { listVerifiedRemedies } from "./remedyData.js";
import { EvidenceBadge } from "./EvidenceBadge.js";

const { useState, useEffect } = React;

function RemedyCard(r) {
  return React.createElement(
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
  );
}

function buildUseCaseComparison(herbal, homeo) {
  const byUseCase = {};
  function add(mode, list) {
    list.forEach((r) => {
      (r.useCase && r.useCase.length ? r.useCase : ["(unspecified)"]).forEach((uc) => {
        if (!byUseCase[uc]) byUseCase[uc] = { herbal: [], homeopathy: [] };
        byUseCase[uc][mode].push(r);
      });
    });
  }
  add("herbal", herbal);
  add("homeopathy", homeo);
  return byUseCase;
}

function ComparisonView({ herbal, homeo }) {
  const byUseCase = buildUseCaseComparison(herbal, homeo);
  const useCases = Object.keys(byUseCase).sort();
  if (useCases.length === 0) {
    return React.createElement(
      "p", { style: { color: "#888", fontSize: "13px" } },
      "এখনো কোনো verified remedy নেই — pharmacist/physician review-এর অপেক্ষায়।"
    );
  }
  return React.createElement(
    "div", { style: { display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" } },
    ...useCases.map((uc) =>
      React.createElement(
        "div", { key: uc, style: { border: "1px solid #D8E3E0", borderRadius: "8px", padding: "10px", background: "#FAFCFB" } },
        React.createElement("div", { style: { fontWeight: 700, fontSize: "13px", color: "#0E4B43", marginBottom: "8px" } }, uc),
        React.createElement(
          "div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
          React.createElement(
            "div", { style: { flex: "1 1 160px" } },
            React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "4px" } }, "Herbal / ভেষজ"),
            byUseCase[uc].herbal.length
              ? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } }, ...byUseCase[uc].herbal.map(RemedyCard))
              : React.createElement("div", { style: { fontSize: "12px", color: "#AAA" } }, "—")
          ),
          React.createElement(
            "div", { style: { flex: "1 1 160px" } },
            React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "4px" } }, "Homeopathy"),
            byUseCase[uc].homeopathy.length
              ? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } }, ...byUseCase[uc].homeopathy.map(RemedyCard))
              : React.createElement("div", { style: { fontSize: "12px", color: "#AAA" } }, "—")
          )
        )
      )
    )
  );
}

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
  const [compareMode, setCompareMode] = useState(false);

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
    React.createElement(
      "div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
      React.createElement("h3", { style: { fontSize: "15px", color: "#0E4B43", margin: 0 } }, "Herbal / Homeopathy — Evidence-Level Reference"),
      React.createElement(
        "button",
        {
          onClick: () => setCompareMode((v) => !v),
          style: { fontSize: "12px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #0E4B43", background: "#fff", color: "#0E4B43", cursor: "pointer" },
        },
        compareMode ? "সাধারণ তালিকা দেখুন" : "Use-case অনুযায়ী তুলনা করুন"
      )
    ),
    compareMode
      ? React.createElement(ComparisonView, { herbal, homeo })
      : React.createElement(
          React.Fragment, null,
          React.createElement(RemedyGroup, { title: "Herbal / ভেষজ", list: herbal }),
          React.createElement(RemedyGroup, { title: "Homeopathy", list: homeo })
        )
  );
}
