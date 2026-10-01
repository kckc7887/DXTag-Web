/**
 * Extended analysis layer for the DXTag display page.
 *
 * DXTag's public API returns only `{title, difficulty, scores}`. The page also
 * has to explain *why* each axis got its score, so this module calls the very
 * same engine functions in the very same order as `src/index.ts#scoreChart`
 * and keeps every intermediate value instead of discarding it.
 *
 * The five returned scores are identical to the CLI — `npm run verify` asserts
 * that against the engine's own `scoreChart` for every sample chart.
 *
 * Axis fusion reference: engine `docs/ALGORITHM.md` §8.
 *   键盘 = 100 - (100-K0) * (1-0.65H/100) * (1-0.35L/100)
 *   星星 = Xs
 *   技巧 = 100 - (100-T0) * (1-0.65Xt/100) * (1-0.65R/100) * (1-0.65L/100)
 *   体力 = S0
 *   爆发 = 100 - (100-B0) * (1-0.65Xb/100)
 */
import {getAvailableDifficulties, parseSimaiChart} from '../engine/src/simai/core/parser/SimaiParser';
import {baseBurden} from '../engine/src/algorithm/base-burden';
import {starComplexity} from '../engine/src/algorithm/star-complexity';
import {keyboardRhythmComplexity} from '../engine/src/algorithm/rhythm-complexity';
import {inputComplexity} from '../engine/src/algorithm/input-complexity';
import {complexityRadar, legacyRadar} from '../engine/src/algorithm/five-axis-complexity';
import {ALGORITHM_VERSION, DIFFICULTIES, SCALE_VERSION, type Difficulty} from '../engine/src/index';
import scale from '../engine/src/scale.json';
import type {Chart, Note} from '../engine/src/simai/types';

export {ALGORITHM_VERSION, SCALE_VERSION, DIFFICULTIES};
export type {Difficulty};

export const AXIS_ORDER = ['键盘', '星星', '技巧', '体力', '爆发'] as const;
export type AxisName = (typeof AXIS_ORDER)[number];

/** Same normalisation helper as DXTag's `src/index.ts`. */
const clamp100 = (value: number) => Math.max(0, Math.min(100, value));
const support = (raw: number, anchor: number) => Math.round(clamp100(raw / anchor * 100) * 10) / 10;
const share = (part: number, total: number) => total > 0 ? part / total : 0;

export type Factor = {
  label: string;
  detail: string;
  /** Raw observation before normalisation; null when the factor is structural. */
  raw: number | null;
  anchor: number | null;
  /** 0–100 value after the fixed anchor, one decimal. */
  normalized: number | null;
  /** Weight from the fusion policy (multiplicative, except star parts). */
  weight: number;
  /** Internal 0–100 points this factor added to the axis. */
  contributed: number;
  /** Multiplicative recovery of the remaining gap, or an additive part. */
  mode: 'gain' | 'part';
  /** True when the raw value already reached the anchor. */
  capped: boolean;
};

export type BaselinePart = {label: string; value: number; share: number};

export type AxisReport = {
  axis: AxisName;
  score: number;
  internal: number;
  baseline: number | null;
  baselineLabel: string;
  baselineRaw: number | null;
  baselineAnchor: number | null;
  baselineParts: BaselinePart[];
  factors: Factor[];
  formula: string;
  reason: string;
  evidence: {label: string; value: string}[];
};

export type ChartStats = {
  notes: number; taps: number; breaks: number; holds: number;
  touches: number; touchHolds: number; slides: number; branches: number; mines: number;
  chords: number; peakPerSecond: number; bpmMin: number; bpmMax: number;
  seconds: number; measures: number; artist: string; designer: string; declaredLevel: string;
};

export type StarWindowView = {
  id: string; startBeat: number; endBeat: number; startMs: number; endMs: number;
  raw: number; branchCount: number; slideCount: number;
  components: {motion: number; rhythm: number; coordination: number; context: number};
};
export type BurstView = {startBeat: number; endBeat: number; startMs: number; endMs: number; riseRaw: number; raw: number};
export type RhythmWindowView = {
  startBeat: number; endBeat: number; startMs: number; endMs: number;
  raw: number; onsetRate: number; onsets: number; movementMean: number;
};
export type LockWindowView = {
  holdId: number; kind: string; position: string; line: number;
  startBeat: number; endBeat: number; startMs: number; endMs: number;
  raw: number; sustained: number; movement: number; coordination: number; foreign: number;
};

export type ChartAnalysis = {
  slot: number; difficulty: string; title: string;
  scores: Record<AxisName, number>;
  axes: AxisReport[];
  stats: ChartStats;
  features: {label: string; value: number}[];
  star: {
    trajectories: number;
    components: {motion: number; rhythm: number; coordination: number; context: number};
    occupancy: {movingSeconds: number; headReturnCount: number};
    windows: StarWindowView[];
    bursts: BurstView[];
  };
  rhythm: {onsetCount: number; windows: RhythmWindowView[]};
  input: {touchCount: number; touchTapCount: number; touchHoldCount: number; locks: LockWindowView[]};
  versions: {
    algorithm: string; scale: string; star: string; rhythm: string; input: string; radar: string;
  };
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const fmt = (value: number | null, digits = 2) => value === null ? '—' : value.toFixed(digits);

/** Apply a chain of multiplicative factors, recording each step's contribution.
 *  The order matches the source expression, so attribution stays exact. */
function chain(start: number, steps: {factor: Factor}[]) {
  let current = start;
  for (const step of steps) {
    const normalized = step.factor.normalized ?? 0;
    const next = current * (1 - step.factor.weight * normalized / 100);
    step.factor.contributed = round1(start === 0 ? 0 : current - next);
    current = next;
  }
  return 100 - current;
}

function counts(chart: Chart) {
  const live = chart.notes.filter(note => !note.isMine);
  const by = (type: Note['type']) => live.filter(note => note.type === type).length;
  const slides = live.filter((note): note is Extract<Note, {type: 'slide'}> => note.type === 'slide');
  const groups = new Map<number, number>();
  for (const note of live) groups.set(note.timingMs, (groups.get(note.timingMs) ?? 0) + 1);
  const times = [...groups.keys()].sort((a, b) => a - b);
  let peak = 0, left = 0;
  for (let right = 0; right < times.length; right++) {
    while (times[right]! - times[left]! > 1000) left++;
    let sum = 0;
    for (let index = left; index <= right; index++) sum += groups.get(times[index]!)!;
    peak = Math.max(peak, sum);
  }
  const starts = live.map(note => note.timingMs);
  const ends = live.map(note => note.endTimeMs);
  return {
    live, slides, peak,
    taps: by('tap'), breaks: by('break'), holds: by('hold-start'),
    touches: by('touch'), touchHolds: by('touch-hold-start'),
    branches: slides.reduce((sum, note) => sum + note.branches.length, 0),
    chords: [...groups.values()].filter(size => size >= 2).length,
    seconds: starts.length ? Math.max(1, (Math.max(...ends) - Math.min(...starts)) / 1000) : 0,
    mines: chart.notes.filter(note => note.isMine).length,
  };
}

/** Score one ordinary chart and return the full reasoning behind it. */
export function analyzeChart(text: string, difficulty: Difficulty): ChartAnalysis {
  const chart = parseSimaiChart(text, difficulty);
  const base = baseBurden(chart);
  const star = starComplexity(chart, base.slideEvents);
  if (!star.coverage.complete || star.raw === null || star.techniqueRaw === null || star.burstRaw === null) {
    const known = new Set(base.slideEvents.map(event => `${event.slideId}:${event.branchIndex}`));
    const missing = chart.notes.flatMap(note => note.type === 'slide' && !note.isMine ? note.branches.flatMap((branch, index) =>
      known.has(`${note.id}:${index}`) ? [] : [`第 ${note.source.line} 行 ${branch.segments.map(segment => segment.code).join('→')}`]) : []);
    throw new Error(`Slide 路径不完整（${star.coverage.observedBranches}/${star.coverage.expectedBranches}）；${missing.join('；') || '时值或几何无法完整解算'}。`);
  }
  const rhythm = keyboardRhythmComplexity(chart);
  const input = inputComplexity(chart);

  const baseline = legacyRadar(base.features, scale.baseline);
  const supports = {
    star_technique: support(star.techniqueRaw, scale.starTechnique),
    keyboard_rhythm: support(rhythm.raw, scale.rhythm),
    star_burst: support(star.burstRaw, scale.starBurst),
    touch_input: support(input.touchRaw, scale.touch),
    hold_lock: support(input.raw, scale.holdLock),
  };
  const starScore = support(star.raw, scale.star);
  const fused = complexityRadar(baseline, starScore, supports);
  const scores = Object.fromEntries(AXIS_ORDER.map(axis => [axis, Math.round(fused[axis]) / 10])) as Record<AxisName, number>;

  const feature = (key: string) => Number(base.features[key] ?? 0);
  const KB = feature('axis_keyboard_burst'), KS = feature('axis_keyboard_stamina'), KT = feature('axis_keyboard_technique');
  const SB = feature('axis_star_burst'), SS = feature('axis_star_stamina'), ST = feature('axis_star_technique');
  const stat = counts(chart);

  const parts = (pairs: [string, number][]): BaselinePart[] => {
    const total = pairs.reduce((sum, [, value]) => sum + value, 0);
    return pairs.map(([label, value]) => ({label, value, share: share(value, total)}));
  };
  const factor = (label: string, detail: string, raw: number, anchor: number, normalized: number, weight: number): Factor =>
    ({label, detail, raw, anchor, normalized, weight, contributed: 0, mode: 'gain', capped: raw > anchor});

  // ---- 键盘: keyboard baseline supplemented by Touch input and held-hand support.
  const keyboardSteps = [
    {factor: factor('Touch 输入', 'Touch 敲击数量、实际起音频率与位移', input.touchRaw, scale.touch, supports.touch_input, 0.65)},
    {factor: factor('锁手负担', 'HOLD 占用期间的外来输入与位移', input.raw, scale.holdLock, supports.hold_lock, 0.35)},
  ];
  const keyboard = chain(100 - baseline.键盘, keyboardSteps);

  // ---- 星星: the star axis is the normalised continuous star complexity itself.
  const starWeighted = {
    motion: star.components!.motion, rhythm: star.components!.rhythm * 0.7,
    coordination: star.components!.coordination * 1.2, context: star.components!.context * 1.5,
  };
  const starFactors: Factor[] = ([
    ['运动', 'motion', '路径长度、速度与曲率、扇形跨度', 1],
    ['节奏', 'rhythm', '段间速度偏差、启动相位与等待不规则度', 0.7],
    ['并发协调', 'coordination', '同时移动路径的间距、夹角与速度差', 1.2],
    ['接续上下文', 'context', '前后两拍的外来输入、跟随与原星头回占', 1.5],
  ] as const).map(([label, key, detail, weight]) => {
    const value = starWeighted[key];
    return {
      label, detail, raw: value, anchor: scale.star, normalized: round1(value / scale.star * 100),
      weight, contributed: round1(clamp100(value / scale.star * 100)), mode: 'part' as const,
      capped: star.raw! > scale.star,
    };
  });

  // ---- 技巧: keyboard-technique baseline supplemented by star work, rhythm and held hands.
  const techniqueSteps = [
    {factor: factor('星星技巧', '路径节奏、并发协调与上下文（运动权重仅 0.15）', star.techniqueRaw, scale.starTechnique, supports.star_technique, 0.65)},
    {factor: factor('输入节奏', '起音间隔不规则度与重复动机、实际起音频率与位移', rhythm.raw, scale.rhythm, supports.keyboard_rhythm, 0.65)},
    {factor: factor('锁手负担', 'HOLD 占用期间的外来输入、位移与其它 HOLD 压力', input.raw, scale.holdLock, supports.hold_lock, 0.65)},
  ];
  const technique = chain(100 - baseline.技巧, techniqueSteps);

  // ---- 爆发: burst baseline raised by local star complexity rises.
  const burstSteps = [
    {factor: factor('星星突增', '四拍网格上最大的复杂度跃升', star.burstRaw, scale.starBurst, supports.star_burst, 0.65)},
  ];
  const burst = chain(100 - baseline.爆发, burstSteps);

  const internal: Record<AxisName, number> = {
    键盘: round1(keyboard), 星星: starScore, 技巧: round1(technique), 体力: baseline.体力, 爆发: round1(burst),
  };

  const starWindows: StarWindowView[] = star.windows
    .filter(window => window.raw > 0)
    .sort((a, b) => b.raw - a.raw).slice(0, 5)
    .map(window => ({
      id: window.id, startBeat: window.startBeat, endBeat: window.endBeat,
      startMs: window.startMs, endMs: window.endMs, raw: window.raw,
      branchCount: window.branchCount, slideCount: window.slideIds.length,
      components: {...window.components},
    }));
  const bursts: BurstView[] = star.profile
    .filter(block => block.riseRaw > 0)
    .sort((a, b) => b.riseRaw - a.riseRaw).slice(0, 4)
    .map(block => ({
      startBeat: block.startBeat, endBeat: block.endBeat, startMs: block.startMs,
      endMs: block.endMs, riseRaw: block.riseRaw, raw: block.raw,
    }));
  const rhythmWindows: RhythmWindowView[] = rhythm.windows
    .filter(window => window.raw > 0)
    .sort((a, b) => b.raw - a.raw).slice(0, 5)
    .map(window => ({
      startBeat: round1(window.startBeat), endBeat: round1(window.endBeat),
      startMs: window.startMs, endMs: window.endMs, raw: window.raw,
      onsetRate: window.onsetRate, onsets: window.noteIds.length, movementMean: window.movementMean,
    }));
  const locks: LockWindowView[] = input.windows
    .filter(window => window.raw > 0)
    .sort((a, b) => b.raw - a.raw).slice(0, 6)
    .map(window => ({
      holdId: window.holdId, kind: window.holdKind, position: String(window.holdPosition),
      line: window.source.line, startBeat: round1(window.startBeat), endBeat: round1(window.endBeat),
      startMs: window.startMs, endMs: window.endMs, raw: window.raw,
      sustained: window.components.sustained, movement: window.components.movement,
      coordination: window.components.coordination, foreign: window.inputs.length,
    }));

  const beats = (from: number, to: number) => `第 ${round1(from)}–${round1(to)} 拍`;
  const axes: AxisReport[] = [
    {
      axis: '键盘', score: scores.键盘, internal: internal.键盘,
      baseline: baseline.键盘, baselineLabel: '基础键盘负担 K0 =（KB + KS + KT）归一',
      baselineRaw: KB + KS + KT, baselineAnchor: scale.baseline.键盘,
      baselineParts: parts([['KB 键盘爆发', KB], ['KS 键盘体力', KS], ['KT 键盘技巧', KT]]),
      factors: keyboardSteps.map(step => step.factor),
      formula: `100 − (100 − ${fmt(baseline.键盘, 1)}) × (1 − 0.65×${fmt(supports.touch_input, 1)}/100) × (1 − 0.35×${fmt(supports.hold_lock, 1)}/100)`,
      reason: `按键密度窗口给出基础负担 K0=${fmt(baseline.键盘, 1)}，占满分的 ${fmt(baseline.键盘 / 10, 1)} 成。` +
        `Touch 输入归一 ${fmt(supports.touch_input, 1)}（权重 0.65）补上 ${fmt(keyboardSteps[0]!.factor.contributed, 1)} 分，` +
        `锁手负担归一 ${fmt(supports.hold_lock, 1)}（权重 0.35）再补 ${fmt(keyboardSteps[1]!.factor.contributed, 1)} 分。`,
      evidence: [
        {label: '基础键盘爆发 KB', value: fmt(KB)},
        {label: '基础键盘体力 KS', value: fmt(KS)},
        {label: '基础键盘技巧 KT', value: fmt(KT)},
        {label: 'Touch 输入数', value: `${input.touchCount}（TAP ${input.touchTapCount} / HOLD ${input.touchHoldCount}）`},
        {label: '锁手窗口', value: `${input.windows.length} 个`},
      ],
    },
    {
      axis: '星星', score: scores.星星, internal: internal.星星,
      baseline: null, baselineLabel: '连续星星复杂度 Xs = 星星原值 ÷ 锚点',
      baselineRaw: star.raw, baselineAnchor: scale.star,
      baselineParts: [],
      factors: starFactors,
      formula: `(ΣM + 0.7ΣR + 1.2ΣC + 1.5ΣX) ÷ √N ÷ ${fmt(scale.star, 2)} × 100 = ${fmt(starScore, 1)}`,
      reason: `星星轴直接取归一化后的连续复杂度，不做叠加：${star.coverage.observedBranches} 条已解算分支、` +
        `${star.windows.length} 个十六拍窗口、${fmt(star.occupancy!.movingDurationMs / 1000, 1)} 秒实际移动、` +
        `${star.occupancy!.headReturnCount} 次原星头回占。权重最高的分量是接续上下文（1.5）与并发协调（1.2）。`,
      evidence: [
        {label: '已解算分支', value: `${star.coverage.observedBranches} / ${star.coverage.expectedBranches} 条`},
        {label: '涉及 Slide', value: `${new Set(star.windows.flatMap(window => window.slideIds)).size} 个音符`},
        {label: '实际移动时长', value: `${fmt(star.occupancy!.movingDurationMs / 1000, 1)} 秒`},
        {label: '原星头回占', value: `${star.occupancy!.headReturnCount} 次`},
        {label: '最重窗口', value: starWindows[0] ? `${beats(starWindows[0].startBeat, starWindows[0].endBeat)}（原值 ${fmt(starWindows[0].raw)}）` : '无'},
      ],
    },
    {
      axis: '技巧', score: scores.技巧, internal: internal.技巧,
      baseline: baseline.技巧, baselineLabel: '基础技巧负担 T0 =（KT + ST）归一',
      baselineRaw: KT + ST, baselineAnchor: scale.baseline.技巧,
      baselineParts: parts([['KT 键盘技巧', KT], ['ST 星星技巧', ST]]),
      factors: techniqueSteps.map(step => step.factor),
      formula: `100 − (100 − ${fmt(baseline.技巧, 1)}) × (1 − 0.65×${fmt(supports.star_technique, 1)}/100) × (1 − 0.65×${fmt(supports.keyboard_rhythm, 1)}/100) × (1 − 0.65×${fmt(supports.hold_lock, 1)}/100)`,
      reason: `技巧基础 T0=${fmt(baseline.技巧, 1)} 来自纵连、大位移、交互、扫键、附点位移等关系计数；` +
        `星星技巧归一 ${fmt(supports.star_technique, 1)}、输入节奏归一 ${fmt(supports.keyboard_rhythm, 1)}、锁手归一 ${fmt(supports.hold_lock, 1)} ` +
        `各以 0.65 权重依次补足剩余空间。`,
      evidence: [
        {label: '基础技巧 KT', value: fmt(KT)},
        {label: '基础星星技巧 ST', value: fmt(ST)},
        {label: '输入节奏原值', value: fmt(rhythm.raw, 3)},
        {label: '节奏窗口', value: `${rhythm.windows.length} 个（共 ${rhythm.onsetCount} 组起音）`},
        {label: '最不规则片段', value: rhythmWindows[0] ? `${beats(rhythmWindows[0].startBeat, rhythmWindows[0].endBeat)}（原值 ${fmt(rhythmWindows[0].raw, 3)}）` : '无'},
      ],
    },
    {
      axis: '体力', score: scores.体力, internal: internal.体力,
      baseline: baseline.体力, baselineLabel: '体力 S0 =（KS + SS）归一',
      baselineRaw: KS + SS, baselineAnchor: scale.baseline.体力,
      baselineParts: parts([['KS 键盘体力', KS], ['SS 星星体力', SS]]),
      factors: [],
      formula: `(KS + SS) ÷ ${fmt(scale.baseline.体力, 2)} × 100 = ${fmt(baseline.体力, 1)}`,
      reason: `体力轴是纯基线轴，没有补充项：32 秒窗口峰值与 16 秒窗口 75% 分位决定 KS，持续滑动占用决定 SS。` +
        `本谱 KS 占 ${fmt(share(KS, KS + SS) * 100, 1)}%、SS 占 ${fmt(share(SS, KS + SS) * 100, 1)}%。`,
      evidence: [
        {label: '基础键盘体力 KS', value: fmt(KS)},
        {label: '基础星星体力 SS', value: fmt(SS)},
        {label: '谱面时长', value: `${fmt(stat.seconds, 1)} 秒`},
        {label: '峰值每秒按键', value: `${stat.peak} 个`},
      ],
    },
    {
      axis: '爆发', score: scores.爆发, internal: internal.爆发,
      baseline: baseline.爆发, baselineLabel: '爆发 B0 =（KB + SB）归一',
      baselineRaw: KB + SB, baselineAnchor: scale.baseline.爆发,
      baselineParts: parts([['KB 键盘爆发', KB], ['SB 星星爆发', SB]]),
      factors: burstSteps.map(step => step.factor),
      formula: `100 − (100 − ${fmt(baseline.爆发, 1)}) × (1 − 0.65×${fmt(supports.star_burst, 1)}/100)`,
      reason: `四秒 / 两秒窗口峰值给出基础爆发 B0=${fmt(baseline.爆发, 1)}；` +
        `星星突增归一 ${fmt(supports.star_burst, 1)}（权重 0.65）补上 ${fmt(burstSteps[0]!.factor.contributed, 1)} 分，` +
        `对应四拍网格上最大的局部复杂度跃升。`,
      evidence: [
        {label: '基础键盘爆发 KB', value: fmt(KB)},
        {label: '基础星星爆发 SB', value: fmt(SB)},
        {label: '一秒窗口峰值', value: `${stat.peak} 个/秒（1 秒窗口）`},
        {label: '最大突增', value: bursts[0] ? `${beats(bursts[0].startBeat, bursts[0].endBeat)}（+${fmt(bursts[0].riseRaw)}）` : '无'},
      ],
    },
  ];

  const bpms = chart.bpmEvents.length ? chart.bpmEvents.map(event => event.bpm) : [chart.bpm];
  const declaredLevel = String(chart.level?.[`lv_${difficulty}`] ?? '');
  return {
    slot: difficulty,
    difficulty: DIFFICULTIES[difficulty],
    title: chart.title,
    scores,
    axes,
    stats: {
      notes: stat.live.length, taps: stat.taps, breaks: stat.breaks, holds: stat.holds,
      touches: stat.touches, touchHolds: stat.touchHolds, slides: stat.slides.length,
      branches: stat.branches, mines: stat.mines, chords: stat.chords,
      peakPerSecond: stat.peak, bpmMin: Math.min(...bpms), bpmMax: Math.max(...bpms),
      seconds: stat.seconds, measures: chart.measures, artist: chart.artist,
      designer: chart.designer, declaredLevel,
    },
    features: [
      {label: 'KB 键盘爆发', value: KB}, {label: 'KS 键盘体力', value: KS}, {label: 'KT 键盘技巧', value: KT},
      {label: 'SB 星星爆发', value: SB}, {label: 'SS 星星体力', value: SS}, {label: 'ST 星星技巧', value: ST},
    ],
    star: {
      trajectories: new Set(star.windows.flatMap(window => window.slideIds)).size,
      components: {...star.components!},
      occupancy: {
        movingSeconds: star.occupancy!.movingDurationMs / 1000,
        headReturnCount: star.occupancy!.headReturnCount,
      },
      windows: starWindows, bursts,
    },
    rhythm: {onsetCount: rhythm.onsetCount, windows: rhythmWindows},
    input: {
      touchCount: input.touchCount, touchTapCount: input.touchTapCount,
      touchHoldCount: input.touchHoldCount, locks,
    },
    versions: {
      algorithm: ALGORITHM_VERSION, scale: SCALE_VERSION,
      star: star.schemaVersion, rhythm: rhythm.version,
      input: input.version, radar: 'five-axis-complexity-v2',
    },
  };
}

export type ScoreError = {difficulty: string; message: string};
export type MaidataAnalysis = {charts: ChartAnalysis[]; errors: ScoreError[]};

/** Which ordinary slots the file declares, in engine slot order. */
export function listDifficulties(text: string): {slot: Difficulty; name: string}[] {
  const available = getAvailableDifficulties(text);
  return ([2, 3, 4, 5, 6] as Difficulty[])
    .filter(slot => available[slot])
    .map(slot => ({slot, name: DIFFICULTIES[slot]}));
}

/** Score every ordinary chart in the file; failures are collected, not thrown. */
export function analyzeMaidata(text: string): MaidataAnalysis {
  const charts: ChartAnalysis[] = [], errors: ScoreError[] = [];
  for (const {slot} of listDifficulties(text)) {
    try { charts.push(analyzeChart(text, slot)); }
    catch (error) { errors.push({difficulty: DIFFICULTIES[slot], message: error instanceof Error ? error.message : String(error)}); }
  }
  if (!charts.length && !errors.length) throw new Error('文件中没有普通谱：需要 &inote_2 至 &inote_6。');
  return {charts, errors};
}
