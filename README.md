# Page Curl

纸张弯曲、卷绕与落地。一套可复用的 WebGL 翻页实现与 Codex skill。

基于 [Paper Mono](https://paper.design/mono) 的公开前端观察独立重建，使用 Three.js 与 GLSL。桌面呈现双页展开，窄屏呈现单页纸卷；支持点击、拖拽与回弹。

[点击预览 ↗](https://elowen53.github.io/page-curl-skill/) · [使用指南](skills/page-curl/SKILL.md) · [形变原理](skills/page-curl/references/mobile-reverse.md) · [集成说明](skills/page-curl/references/integration.md)

## 开始

打开[在线预览](https://elowen53.github.io/page-curl-skill/)即可体验翻页，缩窄窗口可查看单页卷绕。下载仓库后，也可在浏览器中打开 [example.html](example.html)，或用 Node.js 18+ 生成独立文件，无需安装依赖：

```sh
node skills/page-curl/scripts/create-demo.mjs --output book.html
```

页面与 Three.js 均嵌入 HTML，生成后可离线使用。

作为 Codex skill 使用，将 [`skills/page-curl`](skills/page-curl) 放入 `~/.codex/skills/page-curl`，在对话中调用 `$page-curl`。

## 页面与模式

将配置保存为 `book.json`。图片路径相对于配置文件，建议宽高比为 1:1.377。

```json
{
  "title": "My magazine",
  "mode": "auto",
  "startSheet": 1,
  "pages": ["a.png", "b.png", "c.png", "d.png"]
}
```

```sh
node skills/page-curl/scripts/create-demo.mjs --config book.json --output book.html
```

| 模式 | 形态 | 页面排列 |
| --- | --- | --- |
| `desktop` | 双页展开，圆柱卷曲 | 每两张图片组成一张纸的正反面 |
| `mobile` | 单页阅读，圆锥卷绕 | 每张图片作为正面，背面为白纸 |
| `auto` | 随窗口切换，默认模式 | 宽度 ≥768px 且横向时使用双页，其余使用单页 |

切换时保留对应阅读位置，并释放旧渲染器。起始位置可通过 `startSheet` 指定跨页，或通过 `startPage` 指定页面图片编号，均从零开始。

## 实现与验证

连续形变同时用于纸面和阴影，法线随弯曲重新计算。纸层高度随翻页进度变化；落地后保持终点状态，避免二次过渡。运行回归检查：

```sh
npm test
```

Three.js 固定为 0.162.0。自动测试覆盖几何接缝、交互状态与时间连续性；实际画面检查见[验证清单](skills/page-curl/references/verification.md)和[验证记录](verification.json)。在线预览由 GitHub Pages 发布，主分支更新时自动生成并部署。

当前范围为两种翻页模型的核心几何与基本交互。演示使用原创纸面；原站的细腻纸墨纹理、长按加速与书末自动重播未包含。

## 许可

[MIT](LICENSE) · [Three.js 许可](skills/page-curl/assets/THREE-LICENSE.txt)
