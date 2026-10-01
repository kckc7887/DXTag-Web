# DXTag-Web

[DXTag](https://github.com/kckc7887/DXTag) 的静态展示页：上传一份 `maidata.txt`，
在浏览器里直接算出 **键盘 · 星星 · 技巧 · 体力 · 爆发** 五维评分，用雷达图展示，
并逐项列出每一分的来源。

线上地址：<https://kckc7887.github.io/DXTag-Web/>

## 它做什么

- **纯前端计算。** 谱面解析与评分全部在 Web Worker 里跑，文件不会上传到任何服务器。
- **雷达图 + 归因。** 五个维度各自给出基础负担、补充项、原值、归一值、权重与对总分的实际贡献。
- **与引擎逐位一致。** 页面不重新实现算法，而是直接调用引擎源码；`npm run verify` 会对每张示例谱
  比对页面分数与 `scoreChart()` 的输出，并把每个轴的乘法链复算回内部值。
- **细节证据。** 星星最重的片段、复杂度突增、输入节奏最不规则的窗口、锁手窗口都会列出拍点与源码行。
- **和 CLI 对齐。** “复制 CLI JSON”输出的就是 `node dist/cli.mjs` 会打印的同一份内容。

## 引擎来源

评分引擎以 **git submodule** 固定在 `engine/`，指向 `kckc7887/DXTag`。
算法本身不在本仓库里维护；升级引擎只需移动 submodule：

```powershell
git submodule update --remote engine
npm run verify     # 先确认分数与归因仍然一致
git add engine && git commit -m "更新评分引擎"
```

克隆本仓库时要带上 submodule：

```powershell
git clone --recurse-submodules https://github.com/kckc7887/DXTag-Web.git
# 已经克隆过的话：
git submodule update --init --recursive
```

## 本地开发

需要 Node.js 22 或更新版本。

```powershell
npm ci
npm run dev        # http://localhost:5173/DXTag-Web/
npm run verify     # 引擎一致性校验（分数、融合值、归因复算）
npm run typecheck
npm run build      # 产物在 dist/
npm run preview
```

构建产物以 `/DXTag-Web/` 为基准路径（GitHub Pages 的项目页路径）。
如要部署到用户页或自定义域名，用环境变量覆盖：

```powershell
$env:VITE_BASE = '/'
npm run build
```

## 部署

推送 `main` 后由 `.github/workflows/deploy.yml` 自动构建并发布到 GitHub Pages。
流水线在构建前会跑 `npm run verify` 和 `npm run typecheck`，两者任一失败都不会发布。

## 局限

评分为未标定的启发式工作量代理，不含判定结果或最优手序求解，也不代表官方定数。
只处理普通谱 `inote_2` 至 `inote_6`，地雷不参与评分。算法细节见
[DXTag 技术文档](https://github.com/kckc7887/DXTag/blob/main/docs/ALGORITHM.md)。

## 许可

本仓库代码使用 MIT License。评分引擎版权归 [DXTag](https://github.com/kckc7887/DXTag) 所有，
Copyright (c) 2026 尘言。页面内的三份示例谱面为本仓库自行编写的合成 Simai 文本。
