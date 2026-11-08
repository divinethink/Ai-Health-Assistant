// ছোট SVG bar-chart (নতুন dependency নেই)। values: সংখ্যা বা null; target: আনুমানিক লক্ষ্য-রেখা (ঐচ্ছিক)।
export function TrendBars({ labels, values, target, color }) {
  const w = 320, h = 120, pad = { t: 10, r: 8, b: 20, l: 8 };
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
  const max = Math.max(1, target || 0, ...values.map((v) => v || 0)) * 1.1;
  const bw = plotW / values.length;
  const y = (v) => pad.t + plotH - (v / max) * plotH;
  return React.createElement("svg", { width: "100%", viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": "সাপ্তাহিক বার-চার্ট" },
    ...values.map((v, i) => v ? React.createElement("rect", { key: "b" + i, x: pad.l + i * bw + bw * 0.15, y: y(v), width: bw * 0.7, height: pad.t + plotH - y(v), rx: 3, fill: color }) : null),
    target ? React.createElement("line", { key: "t", x1: pad.l, x2: w - pad.r, y1: y(target), y2: y(target), stroke: "#5F716C", strokeDasharray: "4 3", strokeWidth: 1 }) : null,
    ...labels.map((l, i) => React.createElement("text", { key: "l" + i, x: pad.l + i * bw + bw / 2, y: h - 6, fontSize: 9, textAnchor: "middle", fill: "#5F716C" }, l)));
}
