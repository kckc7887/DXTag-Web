# DXTag-Web

在浏览器中读取 `maidata.txt`，查看谱面的五维评分、计算拆分和高负担片段。适合了解一张谱面的构成，或比较不同谱面的侧重。

**[打开 DXTag-Web](https://kckc7887.github.io/DXTag-Web/)** · [评分引擎](https://github.com/kckc7887/DXTag) · [算法说明](https://github.com/kckc7887/DXTag/blob/cc99a103abcafd4a3b4310401deab2cc7bff5049/docs/ALGORITHM.md)

## 使用

1. 选择或拖入一份 `maidata.txt`，也可以直接粘贴文本。没有文件时，可先打开内置示例。
2. 页面计算文件中的普通难度，通过难度按钮切换结果。
3. 查看雷达图和五维分数，点击维度查看计算拆分；下方列出星星、节奏和 HOLD 占手相关的高负担片段。
4. 需要保存分数时，复制 JSON。内容包含本次成功计算的所有难度，每张谱面有 `title`、`difficulty`、`scores` 三个字段，与引擎 CLI 的结果格式一致。浏览器不允许写入剪贴板时，页面会显示可选中的 JSON 文本，供手动复制。

支持的难度为 `&inote_2`（BASIC）、`&inote_3`（ADVANCED）、`&inote_4`（EXPERT）、`&inote_5`（MASTER）和 `&inote_6`（Re:MASTER）。一个文件可以包含多个难度；某个难度计算失败时，会单独显示错误，其他成功结果仍可查看。

文件应使用 UTF-8，或带 BOM 的 UTF-16 LE／BE。编码错误时，请先转换编码；找不到普通谱时，请检查是否包含上述 `&inote_*` 字段。Slide 路径无法完整解算时，该难度不会给出分数，可按错误中的行号检查原文。

## 如何看分数

五项均为 **0.0–10.0**，保留一位小数。分数越高，表示当前模型估计的该项负担越大。

| 维度 | 主要观察内容 |
| --- | --- |
| 键盘 | 按键密度与排列，以及 Touch 输入和 HOLD 占手期间的额外负担 |
| 星星 | Slide 路径运动、启动节奏、同时滑动的协调与前后接续 |
| 技巧 | 按键排列、节奏不规则度、星星协调和 HOLD 占手负担 |
| 体力 | 持续按键密度与连续滑动占用 |
| 爆发 | 短时间内的输入负担，以及局部星星复杂度的上升 |

这些分数是**尚未经过玩家表现标定的启发式估计**，不代表官方定数、达成率或个人上手难度。模型不模拟实际判定，也不求解最优手序；五项有重叠，不能相加当作总难度。曲名、谱师和文件声明等级不参与评分，地雷也不计入评分。

详细拆分使用引擎内部的 **0–100** 标尺，最终再换算为 **0–10**。其中：

- **原值**是算法计算出的观察量，不同项目的单位和尺度可能不同。
- **归一值**由固定锚点换算，达到上限后封顶；10.0 不表示已覆盖所有可能的高难谱。
- **权重与贡献**说明某一项如何进入本轴。键盘、技巧和爆发按运算顺序补足剩余分值，贡献不是简单的「归一值 × 权重」。
- **片段列表**只展示模型选出的部分高值窗口，用于回看谱面，不是完整的难点标注。

比较结果时，请留意页面显示的算法与标尺版本。更完整的定义和公式见 [引擎算法说明](https://github.com/kckc7887/DXTag/blob/cc99a103abcafd4a3b4310401deab2cc7bff5049/docs/ALGORITHM.md)。

## 数据处理

文件在浏览器内读取，解析和评分在 Web Worker 中完成。当前页面没有上传谱面、账号登录或分析历史保存功能，也不将谱面写入浏览器本地存储。加载网页仍需向托管站点请求页面资源；这与上传谱面内容是两回事。

只有主动点击复制按钮，结果才会写入系统剪贴板。内置的三份示例是项目自编的合成 Simai 文本，不包含第三方谱面库。

## 本地开发

建议使用 **Node.js 22 的最新补丁版本**（与 CI 的主版本一致）和 npm。当前 Vite 7 的 Node.js 要求为 `^20.19.0 || >=22.12.0`；使用 Node.js 22 时不要安装早期版本。

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
| `npm run verify` | 用内置样例检查页面分析与引擎分数的一致性，并复算归因 |
| `npm run verify:ui` | 使用模拟 DOM 和 Worker 检查输入、切换、重置、异步响应与复制等交互逻辑 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build` | 生成静态文件到 `dist/` |
| `npm run preview` | 预览构建产物，默认端口 4173 |

提交前依次运行 `npm run verify`、`npm run verify:ui`、`npm run typecheck` 和 `npm run build`。

- `verify` 当前覆盖三份内置示例，不代替引擎的完整测试，也不验证评分的实际有效性。
- `verify:ui` 在 Node.js 中模拟 DOM 和 Worker，检查页面状态与事件逻辑；不验证真实浏览器的渲染、布局、辅助技术支持或剪贴板权限。
- 修改界面后，还应在浏览器中检查文件导入、文本粘贴、难度切换、错误提示、复制及手动复制备用框，并检查窄屏布局和键盘操作。

### 引擎与页面的分工

`engine/` 是 [DXTag](https://github.com/kckc7887/DXTag) 的 Git submodule，由本仓库固定到一个提交。构建时直接打包引擎源码，无须先在 `engine/` 单独安装或构建。

- `src/analyze.ts` 调用引擎的解析与算法模块，保留用于解释分数的中间值，并按引擎顺序完成归一化和融合。
- `src/worker.ts` 在后台线程执行分析，`src/main.ts` 处理输入和页面状态。
- `src/render.ts`、`src/radar.ts` 和 `src/style.css` 负责结果展示。
- `src/verify-entry.ts` 将页面分析结果与引擎的 `scoreChart()` 对照。

更新引擎时，应在 `engine/` 中选择并检出明确的目标提交，再运行上述检查，同时核对 `src/analyze.ts` 的计算顺序和归因是否仍与引擎一致。最终提交的是新的 submodule 指针，而不是把引擎源码复制到页面仓库。

## 部署

这是一个静态站点，构建产物为 `dist/`。默认资源路径是 `/DXTag-Web/`，用于 GitHub Pages 项目页。

[部署工作流](.github/workflows/deploy.yml) 在推送到 `main` 或手动触发时运行：拉取 submodule、安装依赖、执行一致性校验和类型检查、构建，再发布到 GitHub Pages。仓库的 Pages 发布来源需设为 GitHub Actions；任一前置步骤失败，发布不会继续。

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

其他子路径同样通过 `VITE_BASE` 指定，例如 `/tools/dxtag/`。预览时使用与构建相同的值，检查后将 `dist/` 交给静态托管服务；不要直接双击 `index.html` 运行。

## 许可

页面项目的 `package.json` 标注为 MIT。评分引擎的完整许可与版权声明见 [MIT 许可](https://github.com/kckc7887/DXTag/blob/cc99a103abcafd4a3b4310401deab2cc7bff5049/LICENSE)。
