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
