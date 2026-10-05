import type {ChartAnalysis} from './analyze';

export type ScoreScale = 'library' | 'chart';

export const SCORE_SCALE_LABELS: Record<ScoreScale, string> = {
  library: '相对全曲库',
  chart: '相对本谱面',
};

export const SCORE_SCALE_DESCRIPTIONS: Record<ScoreScale, string> = {
  library: '使用全曲库固定标尺，可跨谱面比较。',
  chart: '本谱面最高维度为 10.0，其余按比例换算，用于比较本谱面的五维强弱。',
};

export function scoresFor(chart: ChartAnalysis, scale: ScoreScale) {
  return scale === 'chart' ? chart.chartRelativeScores : chart.scores;
}

export function scoreScaleDescription(chart: ChartAnalysis, scale: ScoreScale): string {
  if (scale === 'library') return SCORE_SCALE_DESCRIPTIONS.library;
  const maximum = Math.max(...chart.axes.map(axis => axis.internal));
  if (maximum === 0) return '本谱面五维融合值均为 0，两种标尺的分数都为 0.0。';
  const sameScores = chart.axes.every(({axis}) => chart.scores[axis] === chart.chartRelativeScores[axis]);
  if (sameScores && maximum === 100) {
    return '本谱面最高维度已达到全曲库的 10.0 上限，比例换算倍数为 1，因此两组数值与雷达相同。此换算无法恢复封顶前的差异。';
  }
  if (sameScores) {
    return '本谱面比例换算后的差异在一位小数舍入后消失，因此两组显示数值与雷达相同。';
  }
  return SCORE_SCALE_DESCRIPTIONS.chart;
}
