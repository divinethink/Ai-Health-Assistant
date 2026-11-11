// ট্র্যাকার ডিজাইন-টোকেন (ধাপ C) — রং/আকার এক জায়গায়। শুধু মান; কোনো state/logic নেই।
// নতুন ট্র্যাকার-UI এখান থেকে নেবে; হাতে hex বসানো নয়।

export const T = {
  ink: "var(--hs-text, #1F2D2A)", muted: "var(--hs-muted, #5F716C)", green: "var(--hs-primary, #0E4B43)", green2: "var(--hs-primary-2, #17705F)",
  amber: "#E0A100", amberSoft: "#FFC86B", orange: "#E8892B", blue: "#3B8ED8", blueSoft: "#D6E6F5",
  purple: "#7B6BC9", leaf: "#2FAE6B", track: "#E4ECE7", surface: "var(--hs-surface, #FFFFFF)", canvas: "var(--hs-bg, #F1F6F2)",
  sand: "#FBF1DF", sandBorder: "#EBD9B4", border: "var(--hs-border, #D9E5DE)", inputBorder: "#C3D2CA",
  onDark: "#FFFFFF", onDarkSoft: "rgba(255,255,255,0.85)", ringTrackOnDark: "rgba(255,255,255,0.22)",
};

export const GRADIENT_HERO = "linear-gradient(135deg, var(--hs-hero-1, #0E4B43), var(--hs-hero-2, #17705F))";

export const CARD_STYLE = { background: "var(--hs-surface, #fff)", border: "1px solid var(--hs-border, #D9E5DE)", borderRadius: "14px", padding: "10px 12px", marginBottom: "8px", boxShadow: "0 2px 8px rgba(14,75,67,0.06)" };

// বেলা-আইকন (emoji — অ্যাপের বাকি অংশের মতো) ও আইকন-টালির নরম রং
export const SLOT_ICON = { sehri: "🌙", iftar: "🌇", breakfast: "🌅", snack1: "🍎", lunch: "☀️", snack2: "🫖", dinner: "🌙" };
export const SLOT_TINT = { sehri: "#E6E4F5", iftar: "#FFE9CF", breakfast: "#FFF0D6", snack1: "#FDE8E4", lunch: "#E4F2EA", snack2: "#F3ECD9", dinner: "#E6E4F5" };

export const MAX_WATER = 40; // InputTab-এর সীমার সাথে মেলে
