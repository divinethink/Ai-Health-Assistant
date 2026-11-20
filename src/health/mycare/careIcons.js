// MyCare — বিভাগের আইকন (inline SVG, stroke-ভিত্তিক; থিম-নিরপেক্ষ)। শুধু UI; তথ্য-যুক্তি নেই।
const PATHS = {
  skin: "M12 3c3 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 9 7 12 3z",
  hair: "M4 7c2-2 4 2 6 0s4 2 6 0 3 1 4 0M4 12c2-2 4 2 6 0s4 2 6 0 3 1 4 0M4 17c2-2 4 2 6 0s4 2 6 0 3 1 4 0",
  oral: "M7.5 4C5.5 4 4 5.7 4 8c0 2 1 3.6 1.5 5.6.5 2.4.8 6.4 2.5 6.4 1.5 0 1.5-3.8 4-3.8s2.5 3.8 4 3.8c1.7 0 2-4 2.5-6.4C19 11.6 20 10 20 8c0-2.3-1.5-4-3.5-4-1.5 0-2.2.8-4.5.8S9 4 7.5 4z",
  body: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  seasonal: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
  natural: "M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19c3-4 6-7 10-9",
  water: "M12 3c3 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 9 7 12 3z",
  gut: "M5 8c0-2 2-3 4-3h6c2 0 4 1 4 3s-2 3-4 3H9c-2 0-4 1-4 3s2 3 4 3h8",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  leaf: "M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19c3-4 6-7 10-9",
  check: "M5 12.5l4.5 4.5L19 7.5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z",
  saved: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  alert: "M12 3l10 18H2L12 3zM12 10v4.5M12 17.5v.1",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
};

export function CareIcon({ id, color, size }) {
  const s = size || 22;
  return React.createElement("svg", { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: color || "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false" },
    React.createElement("path", { d: PATHS[id] || PATHS.skin }));
}

// রঙিন হালকা পটভূমির বর্গাকার আইকন-বক্স (color = #RRGGBB)
export function IconBox({ id, color, size }) {
  const box = size || 44;
  return React.createElement("span", { "aria-hidden": "true", style: { width: box + "px", height: box + "px", borderRadius: Math.round(box * 0.32) + "px", background: color + "22", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
    React.createElement(CareIcon, { id, color, size: Math.round(box * 0.55) }));
}
