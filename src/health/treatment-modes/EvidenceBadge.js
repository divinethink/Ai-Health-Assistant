// Evidence-Tier Badge — Architecture Plan Part B §5.2.1 (Confirmed, Thread 16)
// P6 ধাপ ২। RemedyEntry (§5.2)-এর evidenceTier/disclaimerRequired/disclaimerText
// থেকে সরাসরি props নেয় — কোনো নতুন dependency, repo-র বিদ্যমান
// React.createElement + inline-style প্যাটার্ন (shared/ui.js) অনুসরণ করে।
//
// নামকরণ-সংঘর্ষ এড়ানো নীতি (§5.2.1): badge-এ কখনো শুধু "Tier X" লেখা হয় না,
// সবসময় "Evidence Level X" — Medicine Tier ১/২ (§12.1)-এর সাথে collision এড়াতে।
//
// Accessibility: রঙের উপর নির্ভর না করে সবসময় icon + text label একসাথে থাকে।

const TIER_CONFIG = {
  1: {
    label: "Evidence Level 1",
    subLabel: "ক্লিনিক্যালি প্রমাণিত",
    bg: "#E8F3EC",
    border: "#0E4B43",
    text: "#0E4B43",
  },
  2: {
    label: "Evidence Level 2",
    subLabel: "প্রাথমিক গবেষণা সমর্থিত",
    bg: "#FFF8E1",
    border: "#8A6100",
    text: "#8A6100",
  },
  3: {
    label: "Evidence Level 3",
    subLabel: "ঐতিহ্যগত ব্যবহার",
    bg: "#F1F5F9",
    border: "#475569",
    text: "#475569",
  },
};

// ছোট inline SVG icon — নতুন dependency ছাড়াই। রং সবসময় currentColor (badge-এর
// text-color inherit করে), তাই টেক্সটের সাথে সবসময় সামঞ্জস্যপূর্ণ।
function TierIcon({ tier }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

  if (tier === 1) {
    // shield-checkmark ("verified/validated")
    return React.createElement(
      "svg", common,
      React.createElement("path", { d: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" }),
      React.createElement("path", { d: "M9 12l2 2 4-4" })
    );
  }
  if (tier === 2) {
    // flask ("under research")
    return React.createElement(
      "svg", common,
      React.createElement("path", { d: "M9 2v6L4 19a1.5 1.5 0 001.4 2h13.2a1.5 1.5 0 001.4-2L15 8V2" }),
      React.createElement("path", { d: "M8 2h8" }),
      React.createElement("path", { d: "M6.5 15h11" })
    );
  }
  // tier === 3 — history/clock (mode-নিরপেক্ষ, herbal ও homeopathy দুটোতেই প্রযোজ্য — leaf না)
  return React.createElement(
    "svg", common,
    React.createElement("circle", { cx: 12, cy: 12, r: 9 }),
    React.createElement("path", { d: "M12 7v5l3 2" })
  );
}

// প্রধান export — RemedyEntry (§5.2) থেকে সরাসরি props পাঠানো যায়।
export function EvidenceBadge({ evidenceTier, disclaimerRequired, disclaimerText, compact }) {
  const cfg = TIER_CONFIG[evidenceTier];
  if (!cfg) return null; // অজানা/অবৈধ tier হলে চুপচাপ কিছু render না করা নিরাপদ ডিফল্ট

  const badge = React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: compact ? "2px 8px" : "4px 10px",
        borderRadius: "999px",
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        fontSize: compact ? "11px" : "12px",
        fontWeight: 600,
        lineHeight: 1.4,
      },
    },
    React.createElement(TierIcon, { tier: evidenceTier }),
    cfg.label
  );

  if (compact) return badge; // শুধু badge, sub-label/disclaimer ছাড়া (তালিকা-view-এর জন্য)

  return React.createElement(
    "div", { style: { display: "inline-flex", flexDirection: "column", gap: "4px" } },
    badge,
    React.createElement("span", { style: { fontSize: "11px", color: "#666" } }, cfg.subLabel),
    disclaimerRequired && disclaimerText
      ? React.createElement(
          "span",
          { style: { fontSize: "11px", color: "#7A1F14", fontStyle: "italic", maxWidth: "260px" } },
          disclaimerText
        )
      : null
  );
}

// অন্য component (Remedy list/card, Risk-Based Presentation) থেকে reuse করার জন্য
// tier-এর Bangla label আলাদাভাবে দরকার হতে পারে বলে export করা হলো।
export const EVIDENCE_TIER_LABELS = {
  1: TIER_CONFIG[1].subLabel,
  2: TIER_CONFIG[2].subLabel,
  3: TIER_CONFIG[3].subLabel,
};
