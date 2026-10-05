# DXTag-Web

在浏览器中读取 `maidata.txt`，查看谱面的五维评分、计算拆分和高负担片段。适合了解一张谱面的构成，或比较不同谱面的侧重。

**[打开 DXTag-Web](https://kckc7887.github.io/DXTag-Web/)** · [评分引擎](https://github.com/kckc7887/DXTag) · [算法说明](https://github.com/kckc7887/DXTag/blob/c935291289b51631339965f7ce04a8308d43762f/docs/ALGORITHM.md)

## 页面与交互

界面采用宣传片的浅青白底、彩色圆环、描边标题和轻量动效，直接呈现谱面输入与分析工具。雷达只绘制轮廓线；彩色圆环是装饰，**五边形网格外沿**才对应 10.0。结果以可点击的五维分数、可展开的计算依据和证据片段组织，不把五项相加成总分。

## 使用

1. 选择或拖入自己的 `maidata.txt`，也可以直接粘贴完整文本。页面初始等待输入，不预置谱面。
2. 页面计算文件中的普通难度，通过难度按钮切换结果。
3. 切换“相对全曲库 / 相对本谱面”，雷达、五维数值和展开项同步显示所选标尺。点击维度查看依据；下方的位置图标记模型选出的高负担窗口，点击类别可展开对应证据。位置图只覆盖选中证据的时间范围，不是完整谱面的密度图。
4. 复制 JSON 保存当前标尺的分数，内容包含本次成功计算的所有难度及 `title`、`difficulty`。全曲库模式输出 `scores`，本谱面模式输出 `chartRelativeScores`，每次只导出一组。浏览器不允许写入剪贴板时，页面会显示可选中的 JSON 文本，供手动复制。

支持的难度为 `&inote_2`（BASIC）、`&inote_3`（ADVANCED）、`&inote_4`（EXPERT）、`&inote_5`（MASTER）和 `&inote_6`（Re:MASTER）。一个文件可以包含多个难度；某个难度计算失败时，会单独显示错误，其他成功结果仍可查看。

文件应使用 UTF-8，或带 BOM 的 UTF-16 LE／BE。编码错误时，请先转换编码；找不到普通谱时，请检查是否包含上述 `&inote_*` 字段。Slide 路径无法完整解算时，该难度不会给出分数，可按错误中的行号检查原文。

## 如何看分数

五项均为 **0.0–10.0**，保留一位小数。“相对全曲库”使用引擎的固定标尺，可跨谱面比较；“相对本谱面”使用同一份曲库五维融合结果，按本谱最大值等比放大，用于比较同谱五维强弱。

两种标尺共用固定锚点、权重、融合、封顶和中间舍入。设曲库融合后的内部五维值为 `F`（0–100），`M` 为五维最大值：

```text
曲库分数 = Math.round(F[axis]) / 10
单曲分数 = M > 0 ? Math.round(F[axis] / M * 100) / 10 : 0
```

单曲换算在最后公共分数显示舍入之前进行，不从页面已显示的曲库分数反推比例。最强项为 10.0；内部五维全零时返回五个零，无真实 Slide 时星星仍为零。多个维度在曲库计算中封顶时继续并列。等比换算保留内部五维的比例和排序，一位小数的显示舍入可能产生新的并列。微小内部正值即使在曲库模式显示为 0.0，仍参与单曲比例计算。

切换标尺会同步更新雷达、分数、展开详情的得分与换算说明、原始量区域和 JSON。默认使用全曲库模式。

| 维度 | 主要观察内容 |
| --- | --- |
| 键盘 | 按键密度与排列，以及 Touch 输入和 HOLD 占手期间的额外负担 |
| 星星 | Slide 路径运动、启动节奏、同时滑动的协调与前后接续 |
| 技巧 | 按键排列、节奏不规则度、星星协调和 HOLD 占手负担 |
| 体力 | 持续按键密度与连续滑动占用 |
| 爆发 | 短时间内的输入与滑动负担，以及局部负担突增 |

这些分数是**尚未经过玩家表现标定的启发式估计**，不代表官方定数、达成率或个人上手难度。模型不模拟实际判定，也不求解最优手序；五项有重叠，不能相加当作总难度。曲名、谱师和文件声明等级不参与评分，地雷也不计入评分。

两种模式共用曲库的公式、锚点、权重、来源表和证据片段，来源表中的归一值与贡献仍使用 **0–100** 内部标尺。单曲详情另列“本轴融合值 ÷ 本谱最大融合值 × 10”的换算过程；原始量区域展示本谱五维融合值及最大值。下方滑动、节奏和锁手观察片段保持同一来源。其中：

- **原值**是算法计算出的观察量，不同项目的单位和尺度可能不同。
- **归一值**由固定锚点换算，达到上限后封顶；10.0 不表示已覆盖所有可能的高难谱。
- **权重与贡献**说明某一项如何进入本轴。键盘、技巧和爆发按运算顺序补足剩余分值，贡献不是简单的「归一值 × 权重」。
- **片段列表**只展示模型选出的部分高值窗口，用于回看谱面，不是完整的难点标注。

当前算法版本为 `dxtag-five-axis-v1.4`，单曲版本为 `chart-relative-library-v1`；全曲库标尺保持原版本。更完整的定义和公式见 [引擎算法说明](https://github.com/kckc7887/DXTag/blob/c935291289b51631339965f7ce04a8308d43762f/docs/ALGORITHM.md)。

## 数据处理

文件在浏览器内读取，解析和评分在 Web Worker 中完成。当前页面没有上传谱面、账号登录或分析历史保存功能，也不将谱面写入浏览器本地存储。加载网页仍需向托管站点请求页面资源；这与上传谱面内容是两回事。

只有主动点击复制按钮，结果才会写入系统剪贴板。

## 本地开发

使用 Node.js 22.12.0 或更新版本和 npm。

```sh
git clone --recurse-submodules https://github.com/kckc7887/DXTag-Web.git
cd DXTag-Web
npm ci
npm run dev
```

打开终端显示的地址，默认是 `http://localhost:5173/DXTag-Web/`。已有克隆但 `engine/` 为空时，先运行：

```sh
git submodule update --init --recursive
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务，默认端口 5173 |
| `npm run build` | 生成静态文件到 `dist/` |
| `npm run preview` | 预览构建产物，默认端口 4173 |

### 界面资源

短标题使用随页面托管的 约 138 KB 的 Heavy 字体子集，正文及子集以外的用户曲名回退到系统字体。字体来自 Adobe Source Han Sans SC，遵循 SIL OFL 1.1，修改后字体名为 DXTag Display；许可证与说明位于 [`public/fonts/`](public/fonts/)。仅在更新静态标题文字时才需要重新生成子集：

```sh
python -m pip install fonttools brotli
python scripts/subset-display-font.py /path/to/SourceHanSansSC-Heavy.otf
```

通常的 npm 构建不需要 Python。圆环、字形排版与动效使用本项目的 CSS / SVG 实现，无视频库或第三方动效运行时。页面不包含宣传片中的封面、音乐或真实谱面数据。

### 引擎与页面的分工

`engine/` 是 [DXTag](https://github.com/kckc7887/DXTag) 的 Git submodule，由本仓库固定到一个提交。构建时直接打包引擎源码，无须先在 `engine/` 单独安装或构建。

- `src/analyze.ts` 调用引擎的解析与算法模块，保留用于解释分数的中间值，并按引擎顺序完成归一化和融合。
- `src/worker.ts` 在后台线程执行分析，`src/main.ts` 处理输入和页面状态。
- `src/render.ts`、`src/radar.ts` 和 `src/style.css` 负责结果展示。
更新引擎时，在 `engine/` 中检出明确的目标提交；本仓库提交新的 submodule 指针。

## 部署

这是一个静态站点，构建产物为 `dist/`。默认资源路径是 `/DXTag-Web/`，用于 GitHub Pages 项目页。

[部署工作流](.github/workflows/deploy.yml) 在推送到 `main` 或手动触发时拉取 submodule、安装依赖、构建并发布到 GitHub Pages。仓库的 Pages 发布来源需设为 GitHub Actions。

部署到域名根路径时，需在运行命令的环境中设置 `VITE_BASE`。当前配置直接读取 `process.env.VITE_BASE`，仅写入 `.env.local` 不会覆盖构建路径。

macOS／Linux（sh、bash、zsh）：

```sh
VITE_BASE=/ npm run build
VITE_BASE=/ npm run preview
```

Windows PowerShell：

```powershell
$env:VITE_BASE = '/'
npm run build
npm run preview
```

其他子路径同样通过 `VITE_BASE` 指定，例如 `/tools/dxtag/`。将 `dist/` 交给静态托管服务；不要直接双击 `index.html` 运行。

## 许可

页面项目的 `package.json` 标注为 MIT。随附的字体为 SIL OFL 1.1 许可，见 [字体许可](public/fonts/OFL.txt)，不属于 MIT 许可范围。评分引擎的完整许可与版权声明见 [MIT 许可](https://github.com/kckc7887/DXTag/blob/c935291289b51631339965f7ce04a8308d43762f/LICENSE)。
