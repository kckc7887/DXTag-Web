import { AXIS_ORDER, type AxisName, type ChartAnalysis } from "./analyze";
export const AXIS_COLOR: Record<AxisName, string> = {
  键盘: "#254dff",
  星星: "#7544d1",
  技巧: "#b53968",
  体力: "#157869",
  爆发: "#b24e14",
};
const NS = "http://www.w3.org/2000/svg";
function el(name: string, attrs: Record<string, string | number> = {}) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
const point = (i: number, r: number) => [
  220 + Math.cos(((-90 + i * 72) * Math.PI) / 180) * r,
  207 + Math.sin(((-90 + i * 72) * Math.PI) / 180) * r,
];
const polygon = (radius: (i: number) => number) =>
  AXIS_ORDER.map((_, i) => point(i, radius(i)).join(",")).join(" ");
export function createRadar(
  chart: ChartAnalysis,
  onSelect?: (axis: AxisName) => void,
): SVGSVGElement {
  const svg = el("svg", {
    viewBox: "0 0 440 410",
    role: onSelect ? "group" : "img",
    "aria-label": `五维雷达图，满分10：${AXIS_ORDER.map((a) => `${a} ${chart.scores[a].toFixed(1)}`).join("，")}`,
  }) as SVGSVGElement;
  for (const n of [2, 4, 6, 8, 10]) {
    svg.append(
      el("polygon", { points: polygon(() => n * 12.6), class: "radar-ring" }),
    );
    const t = el("text", {
      x: 226,
      y: 207 - n * 12.6 + 4,
      class: "radar-scale",
    });
    t.textContent = String(n);
    svg.append(t);
  }
  AXIS_ORDER.forEach((_, i) => {
    const [x, y] = point(i, 126);
    svg.append(
      el("line", { x1: 220, y1: 207, x2: x!, y2: y!, class: "radar-spoke" }),
    );
  });
  svg.append(
    el("polygon", {
      points: polygon((i) => chart.scores[AXIS_ORDER[i]!]! * 12.6),
      class: "radar-area",
    }),
  );
  AXIS_ORDER.forEach((axis, i) => {
    const [x, y] = point(i, chart.scores[axis] * 12.6);
    svg.append(el("circle", { cx: x!, cy: y!, r: 4, class: "radar-dot" }));
    const [lx, ly] = point(i, 167);
    const g = el("g", {
      class: "radar-label",
      ...(onSelect
        ? {
            role: "button",
            tabindex: "0",
            "aria-label": `${axis} ${chart.scores[axis].toFixed(1)}，查看依据`,
          }
        : {}),
    });
    const text = el("text", { x: lx!, y: ly!, "text-anchor": "middle" });
    text.textContent = axis;
    const value = el("text", {
      x: lx!,
      y: ly! + 24,
      "text-anchor": "middle",
      class: "radar-value",
    });
    value.textContent = chart.scores[axis].toFixed(1);
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
      g.addEventListener("keydown", (event) => {
        const e = event as KeyboardEvent;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(axis);
        }
      });
    }
    svg.append(g);
  });
  return svg;
}
