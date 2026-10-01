/** Parity harness: proves the page's analysis equals the engine's own output.
 *  Bundled by `scripts/verify.mjs` and executed in Node. */
import {scoreChart} from '../engine/src/index';
import {AXIS_ORDER, analyzeChart, listDifficulties} from './analyze';
import {SAMPLES} from './samples';

const problems: string[] = [];
const rows: string[] = [];
let checked = 0;

for (const sample of SAMPLES) {
  for (const {slot, name} of listDifficulties(sample.text)) {
    const expected = scoreChart(sample.text, slot).scores;
    const analysis = analyzeChart(sample.text, slot);
    checked++;
    for (const axis of AXIS_ORDER) {
      if (analysis.scores[axis] !== expected[axis]) {
        problems.push(`${sample.id}/${name} ${axis}: 页面 ${analysis.scores[axis]} ≠ 引擎 ${expected[axis]}`);
      }
      const report = analysis.axes.find(entry => entry.axis === axis)!;
      if (Math.round(report.internal) / 10 !== analysis.scores[axis]) {
        problems.push(`${sample.id}/${name} ${axis}: 内部值 ${report.internal} 与公开分 ${analysis.scores[axis]} 不一致`);
      }
    }
    // The star axis is a sum of weighted parts, so the parts must rebuild it.
    const star = analysis.axes.find(entry => entry.axis === '星星')!;
    const sum = star.factors.reduce((total, factor) => total + factor.contributed, 0);
    const capped = star.factors.some(factor => factor.capped);
    if (!capped && Math.abs(sum - report(analysis, '星星')) > 0.5) {
      problems.push(`${sample.id}/${name} 星星: 分量合计 ${sum.toFixed(1)} 与轴值 ${report(analysis, '星星')} 偏差过大`);
    }
    // Multiplicative axes must close exactly on their reported internal value.
    for (const axis of ['键盘', '技巧', '爆发'] as const) {
      const entry = analysis.axes.find(candidate => candidate.axis === axis)!;
      const rebuilt = round1(100 - (100 - entry.baseline!) * entry.factors.reduce(
        (rest, factor) => rest * (1 - factor.weight * (factor.normalized ?? 0) / 100), 1));
      if (Math.abs(rebuilt - entry.internal) > 0.05) {
        problems.push(`${sample.id}/${name} ${axis}: 归因复算 ${rebuilt} ≠ 内部值 ${entry.internal}`);
      }
    }
    rows.push(`${sample.id.padEnd(9)}${name.padEnd(10)}${AXIS_ORDER.map(axis =>
      `${axis} ${analysis.scores[axis].toFixed(1).padStart(4)}`).join('  ')}`);
  }
}

function report(analysis: ReturnType<typeof analyzeChart>, axis: typeof AXIS_ORDER[number]) {
  return analysis.axes.find(entry => entry.axis === axis)!.internal;
}
function round1(value: number) { return Math.round(value * 10) / 10; }

console.log(`DXTag-Web 引擎一致性校验：${checked} 张谱面`);
console.log('样本      难度      ' + AXIS_ORDER.map(axis => axis.padStart(6)).join('  '));
for (const row of rows) console.log(row);

if (problems.length) {
  console.error(`\n✗ ${problems.length} 项不一致：`);
  for (const problem of problems) console.error('  - ' + problem);
  throw new Error('引擎一致性校验失败');
}
console.log(`\n✓ 五维分数、内部融合值与归因复算全部与引擎一致（${checked} 张谱面）`);
