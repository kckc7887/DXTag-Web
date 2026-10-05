/** Synthetic regression input, used only by verification harnesses. */
export type RegressionFixture = {id: string; label: string; note: string; text: string};

const cycle = (patterns: readonly string[], bars: number) =>
  Array.from({length: bars}, (_, index) => patterns[index % patterns.length]!);

function maidata(options: {
  title: string; artist: string; bpm: number; level: string; bars: readonly string[];
}): string {
  return [
    `&title=${options.title}`,
    `&artist=${options.artist}`,
    '&first=0',
    `&lv_5=${options.level}`,
    '&des_5=DXTag Regression',
    `&inote_5=(${options.bpm})${options.bars.join(',')},E`,
  ].join('\n');
}

const balanced = maidata({
  title: 'DXTag 回归 · 综合谱面', artist: 'DXTag Regression', bpm: 140, level: '14',
  bars: cycle([
    '{8}1,2,3,4,5,6,7,8', '{8}1/5,2/6,3/7,4/8,5,6,7,8', '{8}1-5[8:1],2,3,4,5<1[8:1],6,7,8',
    '{8}1h[4:1],2,3,4,5,6,7,8', '{8}1,8,2,7,3,6,4,5', '{8}A1,B1,C,D1,1,2,3,4',
    '{8}1b,2,3,4,5b,6,7,8', '{8}1>5[8:1],2,3,4,5v7[8:1],6,7,8',
  ], 32),
});

const starHeavy = maidata({
  title: 'DXTag 回归 · 星星密集', artist: 'DXTag Regression', bpm: 150, level: '14',
  bars: cycle([
    '{8}1pp5[8:1],2,3,4,5qq1[8:1],6,7,8', '{8}1>5[8:1],2,3,4,5<1[8:1],6,7,8',
    '{8}1s5[8:1],2,3,4,5z1[8:1],6,7,8', '{8}1V72[8:1],2,3,4,5pp1[8:1],6,7,8',
    '{8}1qq5[8:1],2,3,4,5w1[8:1],6,7,8', '{8}1s5[8:1],2,3,4,5qq1[8:1],6,7,8',
  ], 28),
});

const burstHeavy = maidata({
  title: 'DXTag 回归 · 爆发对比', artist: 'DXTag Regression', bpm: 160, level: '14',
  bars: cycle([
    '{4}1,2,3,4', '{16}1,2,3,4,5,6,7,8,1,2,3,4,5,6,7,8',
    '{4}1/5,2/6,3/7,4/8', '{16}1,2,3,4,5,6,7,8,8,7,6,5,4,3,2,1',
    '{4}5h[2:1],6,7,8', '{16}1-5[16:1],2,3,4,5-1[16:1],6,7,8',
    '{4}1,2,3,4', '{16}1/5,1/5,2/6,2/6,3/7,3/7,4/8,4/8,5,6,7,8',
  ], 24),
});

const saturated = maidata({
  title: 'DXTag 回归 · 标尺封顶', artist: 'DXTag Regression', bpm: 600, level: '15',
  bars: cycle(['{16}1/5,2/6,3/7,4/8,5/1,6/2,7/3,8/4,1/5,2/6,3/7,4/8,5/1,6/2,7/3,8/4'], 32),
});

export const FIXTURES: readonly RegressionFixture[] = [
  {id: 'balanced', label: '综合谱面', note: '键盘 / 星星 / 技巧均衡', text: balanced},
  {id: 'star', label: '星星密集', note: 'Slide 与扇形为主，星星轴突出', text: starHeavy},
  {id: 'burst', label: '爆发对比', note: '稀疏与十六分爆发交替', text: burstHeavy},
  {id: 'low', label: '低分舍入', note: '验证显示舍入前的相对换算', text: '&inote_5=(120){4}1,A2,2,E'},
  {id: 'saturated', label: '标尺封顶', note: '最高维度为 10.0 时两组相同', text: saturated},
];
