// src/health/reports/TrendChart.js
//
// P5 — Report Intelligence — Trend Chart (Roadmap §11.1/§8: "Trend chart —
// lab value পরিবর্তনের visual উপস্থাপন")। কোনো নতুন charting dependency যোগ
// করা হয়নি (Process Rule ৮: unnecessary bundle-growth এড়ানো) — সাধারণ SVG
// দিয়ে হালকা line-chart, project-এর existing dependency-free ছোট UI
// primitives-এর (shared/ui.js) সাথে সংগতিপূর্ণ।
//
// @param {{ unit: string, referenceRange: {low:number, high:number}|null, points: Array<{date:string, value:number}> }} props
export function TrendChart({ unit, referenceRange, points, targetLine, height: heightProp }) {
  const width = 320, height = heightProp || 180;
  const padding = { top: 16, right: 16, bottom: 24, left: 8 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (referenceRange) {
    minV = Math.min(minV, referenceRange.low);
    maxV = Math.max(maxV, referenceRange.high);
  }
  if (targetLine) { minV = Math.min(minV, targetLine.value); maxV = Math.max(maxV, targetLine.value); }
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const rangePad = (maxV - minV) * 0.15;
  minV -= rangePad; maxV += rangePad;

  const xFor = (i) => padding.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yFor = (v) => padding.top + plotH - ((v - minV) / (maxV - minV)) * plotH;

  const linePoints = points.map((p, i) => xFor(i) + "," + yFor(p.value)).join(" ");

  const refBand = referenceRange
    ? React.createElement("rect", {
        x: padding.left, y: yFor(referenceRange.high),
        width: plotW, height: Math.max(0, yFor(referenceRange.low) - yFor(referenceRange.high)),
        fill: "#0E4B43", opacity: 0.08,
      })
    : null;

  // ঐচ্ছিক লক্ষ্য-রেখা (ট্র্যাকারের ওজন-চার্ট); অন্য ব্যবহারে targetLine না দিলে কিছু বদলায় না
  const tLine = targetLine
    ? [
        React.createElement("line", { key: "tl", x1: padding.left, x2: padding.left + plotW, y1: yFor(targetLine.value), y2: yFor(targetLine.value), stroke: "#E8892B", strokeWidth: 1.5, strokeDasharray: "5 4" }),
        React.createElement("text", { key: "tt", x: padding.left + plotW, y: yFor(targetLine.value) - 4, fontSize: 9, textAnchor: "end", fill: "#B5651B" }, targetLine.label),
      ]
    : null;

  return React.createElement(
    "div", { style: { marginTop: "10px" } },
    React.createElement(
      "svg", { width, height, style: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" } },
      refBand,
      ...(tLine || []),
      React.createElement("polyline", { points: linePoints, fill: "none", stroke: "#0E4B43", strokeWidth: 2 }),
      ...points.map((p, i) => React.createElement("circle", { key: "dot" + i, cx: xFor(i), cy: yFor(p.value), r: 3, fill: "#0E4B43" })),
      ...points.map((p, i) => React.createElement("text", {
        key: "lbl" + i, x: xFor(i), y: height - 6, fontSize: 8, textAnchor: "middle", fill: "#888",
      }, String(p.date).slice(5))), // MM-DD
      ...points.map((p, i) => React.createElement("text", {
        key: "val" + i, x: xFor(i), y: yFor(p.value) - 6, fontSize: 8, textAnchor: "middle", fill: "#0E4B43",
      }, String(p.value)))
    ),
    referenceRange
      ? React.createElement("div", { style: { fontSize: "14px", color: "#666", marginTop: "4px" } },
          "হালকা রঙের অংশ = স্বাভাবিক রেঞ্জ (" + referenceRange.low + "–" + referenceRange.high + (unit ? " " + unit : "") + ")")
      : null
  );
}
