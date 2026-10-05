/** All imported metadata is escaped before HTML rendering. */
import { AXIS_ORDER, type AxisReport, type ChartAnalysis, type ChartRelativeAxis } from "./analyze";
import { AXIS_COLOR, createRadar } from "./radar";
import {scoreScaleDescription, SCORE_SCALE_LABELS, scoresFor, type ScoreScale} from './score-scale';
const esc = (v: unknown) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const num = (v: number | null, d = 2) => (v === null ? "—" : v.toFixed(d));
const time = (ms: number) => {
  const s = Math.max(0, ms / 1000),
    m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};
const beats = (a: number, b: number) => `第 ${num(a, 1)}–${num(b, 1)} 拍`;
export function scoreJson(charts: readonly ChartAnalysis[], scale: ScoreScale) {
  return JSON.stringify(
    charts.map((c) => ({
      title: c.title,
      difficulty: c.difficulty,
      ...(scale === 'chart' ? {chartRelativeScores: c.chartRelativeScores} : {scores: c.scores}),
    })),
    null,
    2,
  ).replace(
    /("(?:键盘|星星|技巧|体力|爆发)": )([\d.]+)/g,
    (_, p: string, v: string) => p + Number(v).toFixed(1),
  );
}
const descriptions = [
  "按键密度与输入负担",
  "滑动路径与并发协调",
  "手序、节奏与锁手",
  "持续输入与滑动占用",
  "短时强度与局部突增",
];
function axisDetail(a: AxisReport, i: number) {
  return /* HTML */ `<details
    class="axis-detail"
    data-axis="${esc(a.axis)}"
    id="axis-${i}"
    style="--axis:${AXIS_COLOR[a.axis]}"
  >
    <summary>
      <span class="axis-index">0${i + 1}</span>
      <h3>${a.axis}</h3>
      <span class="detail-hint">${descriptions[i]}</span
      ><strong>${a.score.toFixed(1)}<small> / 10</small></strong
      ><span class="disclosure">＋</span>
    </summary>
    <div class="axis-body">
      <p class="reason">${esc(a.reason)}</p>
      <div class="formula">
        <span>计算公式 · 内部标尺 0–100，换算为 0–10 并保留一位小数</span
        ><code>${esc(a.formula)}</code>
      </div>
      <div
        class="table-scroll"
      >
        <table>
          <caption>
            逐项归因
            <span>原值 → 固定锚点 → 内部归一值；贡献使用 0–100 标尺</span>
          </caption>
          <thead>
            <tr>
              <th>来源</th>
              <th>原值</th>
              <th>锚点</th>
              <th>归一值</th>
              <th>权重</th>
              <th>内部贡献</th>
            </tr>
          </thead>
          <tbody>
            ${a.baseline !== null ? `<tr><td><b>${esc(a.baselineLabel)}</b></td><td>${num(a.baselineRaw)}</td><td>${num(a.baselineAnchor)}</td><td>${num(a.baseline, 1)}</td><td>—</td><td>${num(a.baseline, 1)}</td></tr>` : ""}${a.factors.map((f) => `<tr><td><b>${esc(f.label)}</b><small>${esc(f.detail)}</small></td><td>${num(f.raw, 3)}</td><td>${num(f.anchor)}</td><td>${num(f.normalized, 1)}${f.capped ? " · 封顶" : ""}</td><td>${num(f.weight)}</td><td>${f.mode === "gain" ? "+" : ""}${num(f.contributed, 1)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      ${a.baselineParts.length ? `<div class="baseline-parts">${a.baselineParts.map((p) => `<span>${esc(p.label)} <b>${num(p.value)}</b> · ${(p.share * 100).toFixed(1)}%</span>`).join("")}</div>` : ""}${a.axis === "星星" ? `<p class="precision-note">星星原值 ${num(a.baselineRaw, 3)} ÷ 锚点 ${num(a.baselineAnchor)}；各分量独立舍入，整体归一后还会封顶，因此分量显示值之和可能与最终结果略有差异；以引擎汇总值为准。</p>` : ""}
      <dl class="evidence">
        ${a.evidence.map((e) => `<div><dt>${esc(e.label)}</dt><dd>${esc(e.value)}</dd></div>`).join("")}
      </dl>
    </div>
  </details>`;
}
function chartAxisDetail(a: ChartRelativeAxis, i: number, chart: ChartAnalysis) {
  const maximum = Math.max(...Object.values(chart.chartRelative.rawScores));
  const isBurst = a.axis === '爆发';
  const aggregate = isBurst
    ? `最高负担 ${num(a.peakBeats, 2)} 拍的时间加权均值 ${num(a.peakMean, 4)} = 原始负担 ${num(a.raw, 4)}`
    : `75% × 均值 ${num(a.mean, 4)} + 25% × P90 ${num(a.p90, 4)} = 原始负担 ${num(a.raw, 4)}`;
  const reason = isBurst
    ? '以短时动作强度为主，并计入超出持续水平的增量；按负担最高的四拍汇总，可来自不同段落。连续高密度保留爆发强度，短峰不摊到整谱时长。最强维度映射为 10.0。'
    : '按本谱面的原始动作计算四拍负担，以整谱均值为主，并考虑覆盖 90% 谱面时长的负担分位。最强维度映射为 10.0。';
  const projection = maximum > 0
    ? `原始负担 ${num(a.raw, 4)} / 本谱最强负担 ${num(maximum, 4)} × 10 → ${a.score.toFixed(1)}`
    : '五维原始负担均为 0 → 0.0';
  return /* HTML */ `<details class="axis-detail" data-axis="${esc(a.axis)}" id="axis-${i}" style="--axis:${AXIS_COLOR[a.axis]}">
    <summary><span class="axis-index">0${i + 1}</span><h3>${a.axis}</h3><span class="detail-hint">${descriptions[i]}</span><strong>${a.score.toFixed(1)}<small> / 10</small></strong><span class="disclosure">＋</span></summary>
    <div class="axis-body">
      <p class="reason">${reason}</p>
      <div class="formula"><span>谱内独立计算 · 动作负担 / 秒</span><code>${esc(a.formula)}</code><code>${esc(aggregate)}</code><code>${esc(projection)}</code></div>
      <div class="table-scroll chart-costs">
        <table><caption>原始负担来源<span>${isBurst ? '来源表为整谱时间均值；爆发原值使用最高负担四拍' : '时间均值反映组成；P90 根据本维度的完整块负担计算'}</span></caption>
          <thead><tr><th>来源</th><th>时间均值 / 秒</th><th>成本总和</th></tr></thead>
          <tbody>${a.sources.map(source => `<tr><td><b>${esc(source.label)}</b></td><td>${num(source.meanRate, 4)}</td><td>${num(source.totalCost, 3)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <dl class="evidence">
        ${isBurst ? `<div><dt>最高负担 ${num(a.peakBeats, 2)} 拍均值</dt><dd>${num(a.peakMean, 4)}</dd></div>` : ''}
        <div><dt>整谱时间均值${isBurst ? '（参考）' : ''}</dt><dd>${num(a.mean, 4)}</dd></div><div><dt>时间加权 P90${isBurst ? '（参考）' : ''}</dt><dd>${num(a.p90, 4)}</dd></div>
        <div><dt>原始负担</dt><dd>${num(a.raw, 4)}</dd></div><div><dt>本谱最强负担</dt><dd>${num(maximum, 4)}</dd></div>
        <div><dt>统计时长</dt><dd>${num(chart.chartRelative.seconds, 2)} 秒（保留谱中休息）</dd></div>
        <div><dt>原生输入间隔</dt><dd>${num(chart.chartRelative.nativeInputIntervalMs, 2)} 毫秒</dd></div>
      </dl>
      <p class="precision-note">原始量按显示精度列出；最终比例使用未舍入的整谱负担。</p>
      ${a.windows.length ? `<ol class="window-list">${a.windows.map((block, index) => `<li><span class="window-rank">${String(index + 1).padStart(2, '0')}</span><div><b class="window-time">${time(block.startMs)}–${time(block.endMs)}</b><span>${beats(block.startBeat, block.endBeat)}</span><p>当前负担 ${num(block.demand, 3)} · 周围持续水平 ${num(block.sustainedLevel, 3)}</p></div><strong>${num(block.rates[a.axis], 3)}<small>负担 / 秒</small></strong></li>`).join('')}</ol>` : '<p class="no-window">没有该维度的动作负担。</p>'}
    </div>
  </details>`;
}
type WindowRow = {
  startMs: number;
  endMs: number;
  startBeat: number;
  endBeat: number;
  raw: number;
};
function windowList<T extends WindowRow>(
  id: string,
  title: string,
  hint: string,
  items: T[],
  detail: (w: T) => string,
  value: (w: T) => string,
) {
  return /* HTML */ `<details class="window-group" id="windows-${id}">
    <summary>
      <h3>${title}</h3>
      <span>${items.length} 个片段</span
      ><span class="disclosure">＋</span>
    </summary>
    <p class="window-hint">${hint}</p>
    ${items.length ? `<ol class="window-list">${items.map((w, i) => `<li><span class="window-rank">${String(i + 1).padStart(2, "0")}</span><div><b class="window-time">${time(w.startMs)}–${time(w.endMs)}</b><span>${beats(w.startBeat, w.endBeat)}</span><p>${detail(w)}</p></div><strong>${value(w)}<small>原始量</small></strong></li>`).join("")}</ol>` : '<p class="no-window">没有触发该类证据的片段。</p>'}
  </details>`;
}
function windowMap(a: ChartAnalysis) {
  const groups: { label: string; items: WindowRow[]; id: string }[] = [
    { label: "星星", items: a.star.windows, id: "star" },
    { label: "突增", items: a.star.bursts, id: "burst" },
    { label: "节奏", items: a.rhythm.windows, id: "rhythm" },
    { label: "锁手", items: a.input.locks, id: "lock" },
  ];
  const all = groups.flatMap((g) => g.items);
  const first = all.length ? Math.min(...all.map((w) => w.startMs)) : 0;
  const last = Math.max(first + 1, ...all.map((w) => w.endMs));
  const span = last - first;
  return /* HTML */ `<div
    class="window-map"
  >
    <p class="timeline-caption">所选证据时间范围 · 仅展示下列高负担窗口</p>
    <div class="timeline-scale">
      <span>${time(first)}</span><span>${time(first + span / 2)}</span
      ><span>${time(last)}</span>
    </div>
    ${groups.map((g) => `<div class="timeline-row"><a href="#windows-${g.id}" data-window="${g.id}">${g.label}</a><div class="timeline-track">${g.items.map((w) => `<span style="left:${((w.startMs - first) / span) * 100}%;width:${Math.max(0.4, ((w.endMs - w.startMs) / span) * 100)}%" title="${g.label} ${time(w.startMs)}–${time(w.endMs)}，${beats(w.startBeat, w.endBeat)}"></span>`).join("")}${g.items.length ? "" : "<em>无窗口</em>"}</div></div>`).join("")}
  </div>`;
}
function stats(a: ChartAnalysis) {
  const s = a.stats;
  const data = [
    ["音符", String(s.notes)],
    [
      "BPM",
      s.bpmMin === s.bpmMax ? String(s.bpmMin) : `${s.bpmMin}–${s.bpmMax}`,
    ],
    ["时长", time(s.seconds * 1000)],
    ["峰值密度", `${s.peakPerSecond}/秒`],
  ];
  return /* HTML */ `<dl class="vitals">
      ${data.map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("")}
    </dl>
    <details class="note-detail">
      <summary>音符明细与谱面信息</summary>
      <dl class="note-counts">
        ${[
          ["TAP", s.taps],
          ["BREAK", s.breaks],
          ["HOLD", s.holds],
          ["Touch", s.touches],
          ["Touch HOLD", s.touchHolds],
          ["Slide", s.slides],
          ["分支", s.branches],
          ["同时按键组", s.chords],
          ["小节", s.measures],
          ["地雷（不计分）", s.mines],
        ]
          .map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`)
          .join("")}
      </dl>
    </details>`;
}
export type ChartViewOptions = {
  charts: readonly ChartAnalysis[];
  slots: readonly { slot: number; name: string }[];
  activeSlot: number;
  sourceLabel?: string;
  scoreScale: ScoreScale;
};
export function renderChartView(a: ChartAnalysis, o: ChartViewOptions) {
  const scores = scoresFor(a, o.scoreScale);
  const metadata = [
    a.stats.artist,
    a.stats.designer ? `谱师 ${a.stats.designer}` : "",
    a.stats.declaredLevel
      ? `声明等级 ${a.stats.declaredLevel}（不参与评分）`
      : "",
  ].filter(Boolean);
  return /* HTML */ `<header class="report-head">
      <div>
        <p class="report-label">
          <span class="source-label"
            >谱面报告 / ANALYSIS</span
          ><span>${esc(o.sourceLabel ?? "本地解析")}</span>
        </p>
        <h2>${esc(a.title || "未命名谱面")}</h2>
        <p class="chart-meta">${metadata.map(esc).join(" · ")}</p>
      </div>
      <div class="report-actions">
        <button id="copy-json" type="button">复制 JSON</button
        ><button id="reset-view" type="button">清空结果</button>
      </div>
    </header>
    <div class="difficulty-row">
      <span>谱面难度</span>
      <div class="tabs">
        ${o.slots.map((s) => `<button type="button" class="tab${s.slot === o.activeSlot ? " is-active" : ""}" data-slot="${s.slot}"${o.charts.some((c) => c.slot === s.slot) ? "" : ' disabled title="此难度计算失败，请查看错误信息"'}>${esc(s.name)}</button>`).join("")}
      </div>
      <span class="scale-note">独立维度 · 0.0–10.0</span>
    </div>
    <div class="scale-picker">
      <div class="scale-buttons">
        ${(['library', 'chart'] as const).map(scale => `<button type="button" class="${o.scoreScale === scale ? 'is-active' : ''}" data-score-scale="${scale}">${SCORE_SCALE_LABELS[scale]}</button>`).join('')}
      </div>
      <p class="scale-description">${scoreScaleDescription(a, o.scoreScale)}</p>
    </div>
    <div id="json-fallback" class="json-fallback" hidden>
      <label for="json-output"
        >自动复制不可用，请手动复制全部已解析难度的${SCORE_SCALE_LABELS[o.scoreScale]} JSON</label
      ><textarea id="json-output" readonly spellcheck="false"></textarea>
    </div>
    <section class="profile">
      <div class="radar-panel">
        <div class="radar-topline">
          <span>YOUR CHART, IN FIVE AXES</span><span>DX / 05</span>
        </div>
        <div id="radar-host"></div>
        <p class="radar-caption">${SCORE_SCALE_LABELS[o.scoreScale]} <span>网格外沿 = 10.0</span></p>
      </div>
      <div class="score-panel">
        <div class="score-heading">
          <h3>这张谱，难在哪里？</h3>
          <span>点选维度，展开依据 ↗</span>
        </div>
        ${AXIS_ORDER.map((axis, i) => `<button class="score-row" data-jump="${i}" style="--axis:${AXIS_COLOR[axis]}" type="button"><span class="score-index">0${i + 1}</span><span class="score-info"><b>${axis}</b><small>${descriptions[i]}</small><span class="score-track"><i style="width:${scores[axis] * 10}%"></i></span></span><span class="score-value">${scores[axis].toFixed(1)}</span></button>`).join("")}
        <p class="score-footnote">各维度独立描述谱面特征，不合并为总分。</p>
      </div>
    </section>
    ${stats(a)}
    <section class="explanations">
      <div class="section-heading">
        <span>01</span>
        <h2>分数从哪里来</h2>
        <p>每个数值，都可以继续往下追。</p>
      </div>
      ${o.scoreScale === 'chart' ? a.chartRelative.axes.map((axis, index) => chartAxisDetail(axis, index, a)).join('') : a.axes.map((axis, index) => axisDetail(axis, index)).join('')}
    </section>
    <section class="windows">
      <div class="section-heading">
        <span>02</span>
        <h2>把难点定位到片段</h2>
        <p>
          仅标记筛选出的高负担窗口，不代表完整密度曲线。展开查看时间、拍点与原始量。
        </p>
      </div>
      ${windowMap(a)}
      <div class="window-groups">
        ${windowList(
          "star",
          "星星高负担",
          "复杂度最高的 16 拍窗口，最多 5 个。",
          a.star.windows,
          (w) =>
            `${w.slideCount} 个 Slide · ${w.branchCount} 条分支<br>运动 ${num(w.components.motion)} · 节奏 ${num(w.components.rhythm)} · 协调 ${num(w.components.coordination)} · 上下文 ${num(w.components.context)}`,
          (w) => num(w.raw, 1),
        )}${windowList(
          "burst",
          "星星复杂度突增",
          "4 拍网格上最大的正跃升，最多 4 个。",
          a.star.bursts,
          (w) => `该块复杂度 ${num(w.raw)}；以正跃升量排序`,
          (w) => `+${num(w.riseRaw, 1)}`,
        )}${windowList(
          "rhythm",
          "输入节奏与位移",
          "节奏负担最高的起音窗口，最多 5 个。",
          a.rhythm.windows,
          (w) =>
            `${w.onsets} 组起音 · ${num(w.onsetRate)} 次/秒 · 平均位移 ${num(w.movementMean)}`,
          (w) => num(w.raw, 3),
        )}${windowList(
          "lock",
          "锁手与占用",
          "HOLD 占用期间的输入负担，最多 6 个。",
          a.input.locks,
          (w) =>
            `${esc(w.kind === "touch-hold-start" ? "Touch HOLD" : "HOLD")} @${esc(w.position)} · 源码第 ${w.line} 行 · ${w.foreign} 个外来输入<br>持续 ${num(w.sustained)} · 位移 ${num(w.movement)} · 协调 ${num(w.coordination)}`,
          (w) => num(w.raw),
        )}
      </div>
    </section>
    <details class="raw-panel">
      <summary>原始观察量与版本 <span>用于复核与复现</span></summary>
      <dl class="raw-grid">
        ${o.scoreScale === 'chart' ? a.chartRelative.axes.map(axis => `<div><dt>${esc(axis.axis)} 原始负担</dt><dd>${num(axis.raw, 4)}</dd></div>`).join('') : a.features.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${num(f.value, 4)}</dd></div>`).join('')}
      </dl>
      <p class="versions">
        ${Object.entries(a.versions)
          .map(([k, v]) => `${esc(k)}: ${esc(v)}`)
          .join(" · ")}
      </p>
    </details>`;
}
export function mountRadar(
  host: HTMLElement,
  a: ChartAnalysis,
  scale: ScoreScale,
  _onSelect: (axis: string) => void,
) {
  host.replaceChildren(createRadar(a, scale, (axis) => _onSelect(axis)));
}
