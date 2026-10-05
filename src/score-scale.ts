import type {ChartAnalysis} from './analyze';

export type ScoreScale = 'library' | 'chart';

export const SCORE_SCALE_LABELS: Record<ScoreScale, string> = {
  library: '相对全曲库',
  chart: '相对本谱面',
};

export const SCORE_SCALE_DESCRIPTIONS: Record<ScoreScale, string> = {
  library: '使用全曲库固定标尺，可跨谱面比较。',
  chart: '直接分析本谱面的输入、滑动与占手，以整谱负担为主；最强维度为 10.0，用于同谱五维比较。',
};

export function scoresFor(chart: ChartAnalysis, scale: ScoreScale) {
  return scale === 'chart' ? chart.chartRelativeScores : chart.scores;
}

export function scoreScaleDescription(chart: ChartAnalysis, scale: ScoreScale): string {
  if (scale === 'library') return SCORE_SCALE_DESCRIPTIONS.library;
  const maximum = Math.max(...Object.values(chart.chartRelative.rawScores));
  if (maximum === 0) return '本谱面五维原始负担均为 0，谱内分数都为 0.0。';
  return SCORE_SCALE_DESCRIPTIONS.chart;
}
