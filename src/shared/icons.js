// একই ধাঁচের লাইন-আইকন সেট (inline SVG, নতুন লাইব্রেরি নেই)। রং = currentColor বা color প্রপ।
// ব্যবহার: Icon("home", { size: 22, color: "#fff", stroke: 1.8 })। শুধু UI।

const P = {
  home: [["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }], ["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }]],
  health: [["path", { d: "M11 2v2" }], ["path", { d: "M5 2v2" }], ["path", { d: "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" }], ["path", { d: "M8 15a6 6 0 0 0 12 0v-3" }], ["circle", { cx: 20, cy: 10, r: 2 }]],
  tracker: [["path", { d: "M16 7h6v6" }], ["path", { d: "m22 7-8.5 8.5-5-5L2 17" }]],
  blog: [["path", { d: "M12 7v14" }], ["path", { d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" }]],
  menu: [["path", { d: "M4 6h16" }], ["path", { d: "M4 12h16" }], ["path", { d: "M4 18h16" }]],
  calendar: [["path", { d: "M8 2v4" }], ["path", { d: "M16 2v4" }], ["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ["path", { d: "M3 10h18" }]],
  activity: [["path", { d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" }]],
  moon: [["path", { d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" }]],
  steps: [["path", { d: "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" }], ["path", { d: "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" }], ["path", { d: "M16 17h4" }], ["path", { d: "M4 13h4" }]],
  droplet: [["path", { d: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" }]],
  utensils: [["path", { d: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" }], ["path", { d: "M7 2v20" }], ["path", { d: "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" }]],
  plus: [["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }]],
  minus: [["path", { d: "M5 12h14" }]],
};

export function Icon(name, opts) {
  const o = opts || {};
  const size = o.size || 20;
  const parts = P[name] || [];
  return React.createElement("svg", {
    key: o.key, width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: o.color || "currentColor", strokeWidth: o.stroke || 1.8,
    strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false", style: { flexShrink: 0, display: "block" },
  }, parts.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs })));
}
