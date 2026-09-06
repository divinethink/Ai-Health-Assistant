// Risk-Based Presentation Policy (roadmap §4.3, P6 ধাপ ৪)।
//
// নীতি:
// - Low-risk/Routine (riskLevel: routine/self-care, non-pediatric, non-pregnant,
//   non-chronic): তিন treatment mode পাশাপাশি, সমান গুরুত্বে, ব্যবহারকারী
//   স্বাধীনভাবে বেছে নেবেন।
// - High-risk (শিশু, pregnancy, red-flag-triggered [emergency/urgent/needs-
//   attention], serious/chronic condition): Medical Science card primary/
//   expanded বাধ্যতামূলক। Herbal/Homeopathy card secondary/compact — কিন্তু
//   **কখনো সম্পূর্ণ hide না** — evidence-tier badge ও disclaimer সবসময়
//   visible থাকে (§4.3 bright-line: primary alternative হিসেবে উপস্থাপন করা
//   যাবে না, কিন্তু তথ্য গোপন করাও যাবে না)।
//
// এই ফাইল এখনো কোনো screen-এ wire করা হয়নি — নতুন, স্বাধীন building-block,
// তাই existing app-এর কোনো আচরণ পরিবর্তন করে না (Zero-Risk Discipline)।

import { isPediatricAgeGroup } from "../triage/triageEngine.js";

const HIGH_RISK_LEVELS = ["emergency", "urgent", "needs-attention"];

// Pure function — Firebase/React dependency নেই, unit-testable, রেন্ডারিং থেকে
// আলাদা রাখা হয়েছে (Process Rule ১১: state/logic vs presentational component)।
export function isHighRiskContext({ riskLevel, ageGroupContext, chronicManagement } = {}) {
  if (isPediatricAgeGroup(ageGroupContext)) return true;
  if (ageGroupContext === "pregnant") return true;
  if (HIGH_RISK_LEVELS.includes(riskLevel)) return true;
  if (chronicManagement === true) return true;
  return false;
}

const CARD_BASE_STYLE = {
  border: "1px solid #CBD5E1",
  borderRadius: "10px",
  padding: "14px",
  background: "#fff",
  boxSizing: "border-box",
};

function ModeCard({ title, node, emphasis, compact }) {
  return React.createElement(
    "div",
    {
      style: {
        ...CARD_BASE_STYLE,
        ...(emphasis ? { border: "2px solid #0E4B43", background: "#F3FAF7" } : {}),
        ...(compact ? { padding: "10px", opacity: 0.85 } : {}),
        flex: "1 1 240px",
        minWidth: "220px",
      },
    },
    React.createElement(
      "div",
      { style: { fontSize: compact ? "13px" : "15px", fontWeight: 700, color: "#0E4B43", marginBottom: "8px" } },
      title
    ),
    node || null
  );
}

/**
 * @param {{
 *   riskLevel?: string,               // TriageResult.riskLevel
 *   ageGroupContext?: string,         // TriageResult.ageGroupContext বা Member ageGroup
 *   chronicManagement?: boolean,      // Condition.chronicManagement (§12.4 Category B)
 *   medicalScienceNode?: any,         // Medical Science mode-এর content (React node)
 *   herbalNode?: any,                 // Herbal mode-এর content
 *   homeopathyNode?: any,             // Homeopathy mode-এর content
 * }} props
 */
export function RiskBasedTreatmentModes({
  riskLevel,
  ageGroupContext,
  chronicManagement,
  medicalScienceNode,
  herbalNode,
  homeopathyNode,
}) {
  const highRisk = isHighRiskContext({ riskLevel, ageGroupContext, chronicManagement });

  const medicalCard = React.createElement(ModeCard, { title: "Medical Science", node: medicalScienceNode, emphasis: highRisk });
  const herbalCard = React.createElement(ModeCard, { title: "Herbal / ভেষজ", node: herbalNode, compact: highRisk });
  const homeoCard = React.createElement(ModeCard, { title: "Homeopathy", node: homeopathyNode, compact: highRisk });

  if (!highRisk) {
    return React.createElement(
      "div",
      { style: { display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "10px" } },
      medicalCard,
      herbalCard,
      homeoCard
    );
  }

  return React.createElement(
    "div",
    { style: { marginTop: "10px" } },
    React.createElement(
      "div",
      { style: { fontSize: "12px", color: "#8A6100", marginBottom: "8px" } },
      "⚠ শিশু/গর্ভাবস্থা/গুরুতর বা দীর্ঘমেয়াদি অবস্থায় Medical Science-ই প্রধান পরামর্শ — Herbal/Homeopathy শুধু সম্পূরক তথ্য হিসেবে (evidence-level ও disclaimer-সহ) দেখানো হচ্ছে।"
    ),
    medicalCard,
    React.createElement(
      "div",
      { style: { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px" } },
      herbalCard,
      homeoCard
    )
  );
}
