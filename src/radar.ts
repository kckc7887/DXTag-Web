import { AXIS_ORDER, type AxisName, type ChartAnalysis } from "./analyze";
export const AXIS_COLOR: Record<AxisName, string> = {
  键盘: "#f34aa7",
  星星: "#20bfdc",
  技巧: "#e4c12e",
  体力: "#91cf44",
  爆发: "#9560d9",
};
const NS = "http://www.w3.org/2000/svg";
function el(name: string, attrs: Record<string, string | number> = {}) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
const point = (i: number, r: number) => [
  220 + Math.cos(((-90 + i * 72) * Math.PI) / 180) * r,
  220 + Math.sin(((-90 + i * 72) * Math.PI) / 180) * r,
];
const polygon = (radius: (i: number) => number) =>
  AXIS_ORDER.map((_, i) => point(i, radius(i)).join(",")).join(" ");
export function createRadar(
  chart: ChartAnalysis,
  onSelect?: (axis: AxisName) => void,
): SVGSVGElement {
  const scores = chart.scores;
  const svg = el("svg", {
    viewBox: "0 0 440 440",
  }) as SVGSVGElement;
  // Original CSS/SVG treatment: a candy-colored instrument ring, never a filled score area.
  svg.append(
    el("circle", { cx: 224, cy: 226, r: 200, class: "radar-orbit-shadow" }),
    el("circle", { cx: 220, cy: 220, r: 199, class: "radar-orbit-white" }),
    el("circle", { cx: 220, cy: 220, r: 194, class: "radar-orbit" }),
  );
  for (const [offset, color] of [[20, "#f4d641"], [350, "#f34aa7"], [640, "#91cf44"], [940, "#9560d9"]] as const) {
    svg.append(el("circle", {
      cx: 220, cy: 220, r: 194, class: "radar-segment", stroke: color,
      "stroke-dasharray": "23 1196", "stroke-dashoffset": -offset,
    }));
  }
  for (const n of [2, 4, 6, 8, 10]) {
    svg.append(
      el("polygon", { points: polygon(() => n * 11), class: "radar-ring" }),
    );
    const t = el("text", {
      x: 226,
      y: 220 - n * 11 + 4,
      class: "radar-scale",
    });
    t.textContent = String(n);
    svg.append(t);
  }
  AXIS_ORDER.forEach((_, i) => {
    const [x, y] = point(i, 110);
    svg.append(
      el("line", { x1: 220, y1: 220, x2: x!, y2: y!, class: "radar-spoke" }),
    );
  });
  svg.append(
    el("polygon", {
      points: polygon((i) => scores[AXIS_ORDER[i]!]! * 11),
      class: "radar-area",
    }),
  );
  AXIS_ORDER.forEach((axis, i) => {
    const [x, y] = point(i, scores[axis] * 11);
    svg.append(el("circle", { cx: x!, cy: y!, r: 4.5, class: "radar-dot" }));
    const [lx, ly] = point(i, 155);
    const g = el("g", {
      class: "radar-label",
    });
    const text = el("text", { x: lx!, y: ly!, "text-anchor": "middle" });
    text.textContent = axis;
    const value = el("text", {
      x: lx!,
      y: ly! + 21,
      "text-anchor": "middle",
      class: "radar-value",
    });
    value.textContent = scores[axis].toFixed(1);
    g.append(
      el("rect", {
        x: lx! - 30,
        y: ly! - 21,
        width: 60,
        height: 54,
        fill: "transparent",
        rx: 4,
      }),
      text,
      value,
    );
    if (onSelect) {
      g.addEventListener("click", () => onSelect(axis));
    }
    svg.append(g);
  });
  return svg;
}
