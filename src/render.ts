/** Builds every result view. All user-supplied text (title, artist, designer,
 *  error messages, source lines) goes through `esc()` before it reaches HTML. */
import {AXIS_ORDER, type AxisReport, type ChartAnalysis} from './analyze';
import {AXIS_COLOR, createRadar} from './radar';

const SHARE_COLORS = ['#38bdf8', '#a78bfa', '#fbbf24', '#34d399'];

const esc = (value: unknown) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const num = (value: number | null, digits = 2) => value === null ? '—' : value.toFixed(digits);

function clock(ms: number): string {
  const seconds = Math.max(0, ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(1).padStart(4, '0')}`;
}

const bars = (from: number, to: number) => `第 ${from % 1 ? from.toFixed(1) : from}–${to % 1 ? to.toFixed(1) : to} 拍`;

/** Exactly the shape the CLI prints, so the page and the command line agree. */
export function cliJson(charts: readonly ChartAnalysis[]): string {
  return JSON.stringify(charts.map(chart => ({
    title: chart.title, difficulty: chart.difficulty, scores: chart.scores,
  })), null, 2).replace(/("(?:键盘|星星|技巧|体力|爆发)": )([\d.]+)/g,
    (_match, prefix: string, value: string) => prefix + Number(value).toFixed(1));
}

const shareBar = (report: AxisReport) => report.baselineParts.length < 2 ? '' : `
  <div class="share-bar" title="${esc(report.baselineParts.map(part =>
    `${part.label} ${(part.share * 100).toFixed(0)}%`).join(' · '))}">
    ${report.baselineParts.map((part, index) =>
      `<i style="width:${(part.share * 100).toFixed(2)}%;background:${SHARE_COLORS[index % SHARE_COLORS.length]}"></i>`).join('')}
  </div>`;

function factorRows(report: AxisReport): string {
  const baseline = report.baseline === null ? '' : `
    <tr>
      <td class="label"><b>${esc(report.baselineLabel.split('=')[0]!.trim())}</b>
        <span>${esc(report.baselineLabel.split('=')[1]?.trim() ?? '')}${report.baselineRaw === null ? '' :
          ` · 原值 ${num(report.baselineRaw)}`}</span>${shareBar(report)}</td>
      <td class="num">${num(report.baselineRaw)}</td>
      <td class="num">${report.baseline.toFixed(1)}</td>
      <td class="num">—</td>
      <td class="num">${report.baseline.toFixed(1)}</td>
    </tr>`;
  const factors = report.factors.map(factor => `
    <tr>
      <td class="label"><b>${esc(factor.label)}</b><span>${esc(factor.detail)}</span></td>
      <td class="num">${num(factor.raw, 3)}</td>
      <td class="num">${num(factor.normalized, 1)}${factor.capped ? ' <span class="pill is-capped">封顶</span>' : ''}</td>
      <td class="num">${factor.weight.toFixed(2)}</td>
      <td class="num gain">+${factor.contributed.toFixed(1)}</td>
    </tr>`).join('');
  if (!baseline && !factors) return '';
  return `
    <table class="factors">
      <caption>得分构成（按引擎的运算顺序逐项归因）</caption>
      <thead><tr><th>项目</th><th>原值</th><th>归一</th><th>权重</th><th>本轴贡献</th></tr></thead>
      <tbody>${baseline}${factors}</tbody>
    </table>`;
}

function axisCard(report: AxisReport, index: number): string {
  const color = AXIS_COLOR[report.axis];
  return `
    <article class="panel axis-card" id="axis-${index}" data-axis="${esc(report.axis)}" style="--accent:${color}">
      <header class="axis-head">
        <span class="axis-badge" style="background:${color}">${esc(report.axis)}</span>
        <div>
          <h3>${esc(report.axis)} ${report.score.toFixed(1)} / 10</h3>
          <p>${esc(report.baselineLabel)}</p>
        </div>
        <div class="axis-score">${report.score.toFixed(1)}<small> /10</small></div>
      </header>
      <div class="axis-body">
        <div class="formula">${esc(report.formula)}</div>
        <p class="reason">${esc(report.reason)}</p>
        ${factorRows(report)}
        <div class="evidence">
          ${report.evidence.map(item =>
            `<div><span>${esc(item.label)}</span><b>${esc(item.value)}</b></div>`).join('')}
        </div>
      </div>
    </article>`;
}

function hotspot(title: string, hint: string, items: string[]): string {
  const body = items.length ? `<ol>${items.join('')}</ol>` : '<ol><li class="is-empty">没有触发该证据的片段</li></ol>';
  return `<section class="panel hotspot"><h3>${esc(title)}</h3><p>${esc(hint)}</p>${body}</section>`;
}

function hotspots(analysis: ChartAnalysis): string {
  const star = analysis.star.windows.map((window, index) => `
    <li><span class="rank">${index + 1}</span>
      <span class="where"><b>${esc(bars(window.startBeat, window.endBeat))}</b> · ${esc(clock(window.startMs))}
        <br />${window.slideCount} 个 Slide / ${window.branchCount} 条分支</span>
      <span class="val">${window.raw.toFixed(1)}</span></li>`);
  const bursts = analysis.star.bursts.map((burst, index) => `
    <li><span class="rank">${index + 1}</span>
      <span class="where"><b>${esc(bars(burst.startBeat, burst.endBeat))}</b> · ${esc(clock(burst.startMs))}
        <br />该四拍块复杂度 ${burst.raw.toFixed(1)}</span>
      <span class="val">+${burst.riseRaw.toFixed(1)}</span></li>`);
  const rhythm = analysis.rhythm.windows.map((window, index) => `
    <li><span class="rank">${index + 1}</span>
      <span class="where"><b>${esc(bars(window.startBeat, window.endBeat))}</b> · ${window.onsets} 个起音
        <br />起音 ${window.onsetRate.toFixed(2)}/秒 · 平均位移 ${window.movementMean.toFixed(2)}</span>
      <span class="val">${window.raw.toFixed(3)}</span></li>`);
  const locks = analysis.input.locks.map((lock, index) => `
    <li><span class="rank">${index + 1}</span>
      <span class="where"><b>${esc(lock.kind === 'touch-hold-start' ? 'Touch HOLD' : 'HOLD')} @${esc(lock.position)}</b>
        · 第 ${lock.line} 行<br />${esc(bars(lock.startBeat, lock.endBeat))} · ${lock.foreign} 个外来输入</span>
      <span class="val">${lock.raw.toFixed(2)}</span></li>`);
  return `
    <div class="hotspots">
      ${hotspot('星星最重的片段', '十六拍统计窗口，按连续复杂度排序', star)}
      ${hotspot('复杂度突增', '四拍网格上最大的正跃升，决定星星突增', bursts)}
      ${hotspot('输入节奏最不规则', '17 组起音窗口，按节奏与位移负担排序', rhythm)}
      ${hotspot('锁手窗口', 'HOLD 占用期间的外来输入，决定锁手负担', locks)}
    </div>`;
}

function statsStrip(analysis: ChartAnalysis): string {
  const {stats} = analysis;
  const items: [string, string][] = [
    ['总音符', String(stats.notes)],
    ['TAP / BREAK', `${stats.taps} / ${stats.breaks}`],
    ['HOLD / Touch', `${stats.holds + stats.touchHolds} / ${stats.touches}`],
    ['Slide / 分支', `${stats.slides} / ${stats.branches}`],
    ['同时按键组', String(stats.chords)],
    ['峰值密度', `${stats.peakPerSecond} /秒`],
    ['BPM', stats.bpmMin === stats.bpmMax ? String(stats.bpmMin) : `${stats.bpmMin}–${stats.bpmMax}`],
    ['时长', clock(stats.seconds * 1000)],
    ['小节', String(stats.measures)],
  ];
  if (stats.mines) items.push(['地雷（不参与评分）', String(stats.mines)]);
  return `<dl class="panel stats-strip">${items.map(([label, value]) =>
    `<div class="stat"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}

export type ChartViewOptions = {
  charts: readonly ChartAnalysis[];
  slots: readonly {slot: number; name: string}[];
  activeSlot: number;
};

export function renderChartView(analysis: ChartAnalysis, options: ChartViewOptions): string {
  const {stats} = analysis;
  const tabs = options.slots.map(slot => {
    const scored = options.charts.some(chart => chart.slot === slot.slot);
    return `<button type="button" class="tab${slot.slot === options.activeSlot ? ' is-active' : ''}"
      data-slot="${slot.slot}"${scored ? '' : ' disabled title="该难度计算失败，见上方错误信息"'}>${esc(slot.name)}</button>`;
  }).join('');

  const subtitle = [
    stats.artist ? `<span><i>艺术家</i>${esc(stats.artist)}</span>` : '',
    stats.designer ? `<span><i>谱师</i>${esc(stats.designer)}</span>` : '',
    stats.declaredLevel ? `<span><i>声明等级</i>${esc(stats.declaredLevel)}（不参与评分）</span>` : '',
  ].filter(Boolean).join('');

  const ranked = [...AXIS_ORDER].sort((a, b) => analysis.scores[b] - analysis.scores[a]);
  const top = ranked[0]!, low = ranked.at(-1)!;
  const average = AXIS_ORDER.reduce((total, axis) => total + analysis.scores[axis], 0) / AXIS_ORDER.length;
  const summary = `
    <p class="score-summary">
      最高 <b style="color:${AXIS_COLOR[top]}">${top} ${analysis.scores[top].toFixed(1)}</b>
      · 最低 <b style="color:${AXIS_COLOR[low]}">${low} ${analysis.scores[low].toFixed(1)}</b>
      · 平均 <b>${average.toFixed(2)}</b>
    </p>`;

  return `
    <section class="panel chart-head">
      <div>
        <h2 class="chart-title">${esc(analysis.title || '（未命名谱面）')}</h2>
        <p class="chart-sub"><span><i>难度</i>${esc(analysis.difficulty)}</span>${subtitle}</p>
      </div>
      <div class="tabs" role="tablist" aria-label="选择难度">${tabs}</div>
      <div class="head-actions">
        <button type="button" class="ghost-button" id="copy-json">复制 CLI JSON</button>
        <button type="button" class="ghost-button" id="reset-view">换一份谱面</button>
      </div>
    </section>

    <section class="overview">
      <div class="panel radar-panel" id="radar-host"></div>
      <div class="panel score-panel">
        <h2>五维得分</h2>
        ${AXIS_ORDER.map((axis, index) => `
          <button type="button" class="score-row" data-jump="${index}" style="--accent:${AXIS_COLOR[axis]}">
            <span class="score-name">${axis}</span>
            <span class="score-bar"><i style="width:${(analysis.scores[axis] / 10 * 100).toFixed(1)}%"></i></span>
            <span class="score-num">${analysis.scores[axis].toFixed(1)}</span>
          </button>`).join('')}
        ${summary}
      </div>
    </section>

    ${statsStrip(analysis)}

    <section class="analysis">
      <h2 class="section-title">详细分析 · 每一分的来源</h2>
      ${analysis.axes.map((report, index) => axisCard(report, index)).join('')}
    </section>

    ${hotspots(analysis)}

    <section class="panel raw-panel">
      <h2 class="section-title">引擎原始观察量与版本</h2>
      <div class="raw-grid">
        ${analysis.features.map(feature =>
          `<div class="raw-item"><span>${esc(feature.label)}</span><b>${feature.value.toFixed(4)}</b></div>`).join('')}
      </div>
      <p class="versions">
        算法 ${esc(analysis.versions.algorithm)} · 标尺 ${esc(analysis.versions.scale)}<br />
        星星 ${esc(analysis.versions.star)} · 节奏 ${esc(analysis.versions.rhythm)} · 输入 ${esc(analysis.versions.input)} · 融合 ${esc(analysis.versions.radar)}
      </p>
    </section>`;
}

export function mountRadar(host: HTMLElement, analysis: ChartAnalysis, onSelectAxis: (axis: string) => void): void {
  host.replaceChildren();
  const caption = document.createElement('p');
  caption.className = 'section-title';
  caption.textContent = '五维雷达图（外环 10.0 分）';
  host.append(caption, createRadar(analysis, axis => onSelectAxis(axis)));
}
