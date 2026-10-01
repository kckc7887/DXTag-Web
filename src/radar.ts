/** Hand-built SVG radar: five axes, 0–10 scale, one accent hue per axis.
 *  No chart library, so the geometry, labels and interaction stay exact.
 *  The viewBox is wider than tall so the left/right axis labels keep their room. */
import {AXIS_ORDER, type AxisName, type ChartAnalysis} from './analyze';

export const AXIS_COLOR: Record<AxisName, string> = {
  键盘: '#38bdf8',
  星星: '#a78bfa',
  技巧: '#fbbf24',
  体力: '#34d399',
  爆发: '#fb7185',
};

const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 520, HEIGHT = 440, CENTER_X = 260, CENTER_Y = 214;
const RADIUS = 140, LABEL_RADIUS = RADIUS + 40, MAX = 10;
let gradientId = 0;

const angleOf = (index: number) => (-90 + index * 72) * Math.PI / 180;
const pointAt = (index: number, radius: number) => [
  CENTER_X + radius * Math.cos(angleOf(index)),
  CENTER_Y + radius * Math.sin(angleOf(index)),
] as const;

function node<K extends keyof SVGElementTagNameMap>(
  name: K, attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

const polygon = (radiusFor: (index: number) => number) =>
  AXIS_ORDER.map((_, index) => pointAt(index, radiusFor(index)).map(value => value.toFixed(2)).join(',')).join(' ');

/** Left/right vertices read outwards; top and bottom stay centred. */
const anchorFor = (index: number) => {
  const cos = Math.cos(angleOf(index));
  return cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
};

export function createRadar(analysis: ChartAnalysis, onSelect?: (axis: AxisName) => void): SVGSVGElement {
  const svg = node('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img',
    'aria-label': `五维雷达图：${AXIS_ORDER.map(axis => `${axis} ${analysis.scores[axis].toFixed(1)} 分`).join('，')}`,
  });
  const id = `radar-fill-${++gradientId}`;

  const defs = node('defs');
  const gradient = node('linearGradient', {id, x1: '0', y1: '0', x2: '1', y2: '1'});
  for (const [offset, color] of [['0', '#38bdf8'], ['.5', '#a78bfa'], ['1', '#fb7185']] as const) {
    gradient.append(node('stop', {offset, 'stop-color': color, 'stop-opacity': '.45'}));
  }
  defs.append(gradient);
  svg.append(defs);

  // Grid: rings at 2/4/6/8/10 plus the spokes.
  const grid = node('g');
  for (const level of [2, 4, 6, 8, 10]) {
    grid.append(node('polygon', {
      points: polygon(() => RADIUS * level / MAX),
      class: level === MAX ? 'radar-ring is-outer' : 'radar-ring',
    }));
  }
  for (let index = 0; index < AXIS_ORDER.length; index++) {
    const [x, y] = pointAt(index, RADIUS);
    grid.append(node('line', {x1: CENTER_X, y1: CENTER_Y, x2: x, y2: y, class: 'radar-spoke'}));
  }
  svg.append(grid);

  // Data polygon. The fill lives on the element itself: a CSS `fill` would win
  // over the presentation attribute and the polygon would render transparent.
  svg.append(node('polygon', {
    points: polygon(index => RADIUS * Math.min(MAX, analysis.scores[AXIS_ORDER[index]!]) / MAX),
    class: 'radar-area', fill: `url(#${id})`,
  }));

  // Vertices and one-line labels ("星星 8.6") so text can never collide.
  AXIS_ORDER.forEach((axis, index) => {
    const score = analysis.scores[axis];
    const [dotX, dotY] = pointAt(index, RADIUS * Math.min(MAX, score) / MAX);
    const dot = node('circle', {cx: dotX, cy: dotY, r: 5.4, fill: AXIS_COLOR[axis], class: 'radar-dot'});
    const tip = node('title');
    tip.textContent = `${axis} ${score.toFixed(1)} 分`;
    dot.append(tip);
    if (onSelect) {
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('role', 'button');
      dot.setAttribute('aria-label', `${axis} ${score.toFixed(1)} 分，查看分析`);
      dot.addEventListener('click', () => onSelect(axis));
      dot.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(axis); }
      });
    }
    svg.append(dot);

    const [x, y] = pointAt(index, LABEL_RADIUS);
    const label = node('text', {
      x, y, class: 'radar-axis-label', 'text-anchor': anchorFor(index), 'dominant-baseline': 'middle',
    });
    const name = node('tspan');
    name.textContent = axis;
    const value = node('tspan', {class: 'radar-axis-value', fill: AXIS_COLOR[axis], dx: 7});
    value.textContent = score.toFixed(1);
    label.append(name, value);
    svg.append(label);
  });

  return svg;
}
