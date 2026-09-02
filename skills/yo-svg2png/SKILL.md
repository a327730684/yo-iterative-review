---
name: yo-svg2png
description: 当需要 svg 转 png、svg 导出图片、svg 截图时使用。
---

# SVG 转 PNG

用系统浏览器的 headless 截图。零依赖，直接打开本地 `file://` 路径，**不要起 HTTP 服务，不要装 cairosvg / playwright / ImageMagick**。

## 命令模板

```bash
<browser> \
  --headless=new --disable-gpu \
  --force-device-scale-factor=<scale> \
  --window-size=<w>,<h> \
  --screenshot="<输出png绝对路径>" \
  "file:///<svg绝对路径>"
```

`<browser>` 按平台选（Chromium 系都支持这套参数）：

| 平台 | 浏览器路径 |
| --- | --- |
| Windows (Edge) | `"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"` |
| Windows (Chrome) | `"C:/Program Files/Google/Chrome/Application/chrome.exe"` |
| macOS (Chrome) | `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` |
| macOS (Edge) | `"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"` |
| Linux | `google-chrome` 或 `chromium`（在 PATH 中） |

先确认哪个存在就用哪个（Windows 几乎必有 Edge；macOS 看装的浏览器；Linux 用 `command -v` 查）。

## 参数怎么定

1. **`<w>,<h>`**：读 SVG 文件的 `width`/`height` 属性；没有就读 `viewBox` 的后两个数。
2. **`<scale>`**：默认 `2`（高清）。用户要更高就 3，要原尺寸就 1。
3. **输出路径**：默认与 SVG 同目录同名、后缀改 `.png`。
4. **file:// URL**：盘符后路径用正斜杠，如 `file:///D:/workspace/a/b.svg`。

## 示例

`diag.svg`（1340×860）→ 同目录 2x PNG：

```bash
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --force-device-scale-factor=2 --window-size=1340,860 --screenshot="D:/docs/diag.png" "file:///D:/docs/diag.svg"
```

## 注意

- 转换后用 Read 打开 PNG 检查渲染结果（文字溢出、元素错位），有问题改 SVG 后重跑。
- Edge 不存在时换 Chrome：`C:/Program Files/Google/Chrome/Application/chrome.exe`，参数相同。
- SVG 若引用外部资源（外链字体/图片）才会渲染缺失；纯内联 SVG 用 file:// 没有任何限制。
