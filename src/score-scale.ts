import type {ChartAnalysis} from './analyze';

export type ScoreScale = 'library' | 'chart';

export const SCORE_SCALE_LABELS: Record<ScoreScale, string> = {
  library: '相对全曲库',
  chart: '相对本谱面',
};

export const SCORE_SCALE_DESCRIPTIONS: Record<ScoreScale, string> = {
  library: '使用全曲库固定标尺，可跨谱面比较。',
  chart: '沿用曲库五维的锚点、权重、融合和封顶，按显示舍入前的本谱最大融合值等比放大；最强维度为 10.0，用于同谱五维比较。',
};

export function scoresFor(chart: ChartAnalysis, scale: ScoreScale) {
  return scale === 'chart' ? chart.chartRelativeScores : chart.scores;
}

export function scoreScaleDescription(chart: ChartAnalysis, scale: ScoreScale): string {
  if (scale === 'library') return SCORE_SCALE_DESCRIPTIONS.library;
  const maximum = Math.max(...chart.axes.map(axis => axis.internal));
  if (maximum === 0) return '本谱面五维内部融合值均为 0，单曲分数都为 0.0。';
  return SCORE_SCALE_DESCRIPTIONS.chart;
}
