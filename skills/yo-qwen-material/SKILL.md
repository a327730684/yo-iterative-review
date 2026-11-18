---
name: yo-qwen-material
description: '生成透明背景素材图（icon/贴纸/插画元素等）。当用户要求"生成一个素材/图标/贴纸/透明背景的 XX/抠图素材"时使用。输出透明背景 PNG，固定 1k、1:1、单张，可选绿/蓝/品红幕背景；调用方只需传素材描述与输出目录。'
---

# qwen-material 透明背景素材生成

生成带透明背景的素材图：qwen-image 以纯绿幕出图，ffmpeg `colorkey` 抠图输出 RGBA PNG。

## 前置条件

1. 环境变量 `ALI_API_TOKEN`（同 yo-qwen-image skill），**不要**把 key 写进脚本或文件
2. **系统必须安装 ffmpeg 并加入 PATH**（找不到时脚本报错退出；也可用环境变量 `FFMPEG_PATH` 指定绝对路径）

## 用法

```bash
node scripts/material.js "<素材描述>" --out <输出目录> [--name <文件名前缀>] [--bg green|blue|magenta]
```

| 参数 | 说明 | 必填 |
|---|---|---|
| 素材描述 | 只描述主体本身，不要写背景/尺寸/张数 | 是 |
| `--out` | 透明背景 PNG 的输出目录 | 是 |
| `--name` | 输出文件名前缀（默认时间戳），产物为 `<name>.png` | 否 |
| `--bg` | 色幕底色：`green`（默认）/ `blue` / `magenta` | 否 |

**底色怎么选**：主体含大面积绿（叶子、绿皮火车）用 `blue`；含大面积蓝（海洋、蓝天）用 `green`；两者都有用 `magenta`。主体颜色与色幕分离才能抠干净。

固定项（脚本内置，调用方不可传）：`1k`、`1:1`、生成 **1 张**、模型 `qwen-image-3.0`。

示例：

```bash
node scripts/material.js "一辆橙红色跑车，日系动漫赛璐璐风格，3/4 侧前方视角" --out ./assets --name car
# => ./assets/car.png

node scripts/material.js "一片绿色树叶" --out ./assets --name leaf --bg blue
# 绿色主体改蓝幕，避免被一起抠掉
```

## 产出

| 文件 | 位置 |
|---|---|
| qwen 原图（绿幕，临时） | 系统临时目录 `qwen-material/<name>-1.png`（Windows 即 `%TEMP%\qwen-material\`） |
| 抠图结果（透明背景） | `--out` 指定目录下的 `<name>.png` |

脚本打印最终产物绝对路径、尺寸、采样到的 key 色与耗时。退出码非 0 表示失败。

## 流程（脚本内部）

1. 在用户描述**末尾强制追加**色幕约束（按 `--bg` 指定的绿/蓝/品红，无渐变/阴影/倒影/地面/文字/水印），负面词固定屏蔽文字、阴影、渐变背景等
2. qwen-image 只生成 1 张 1k 1:1，下载到临时目录
3. 采样图片 4 角 8x8 均值作为 key 色（生成的色幕并非标准色值且带轻微渐变，写死会抠不净）
4. `colorkey` 按采样色抠背景 + alpha 硬化（阈值 90），输出到 `--out`

## 已知坑

- **主体与色幕同色会被抠掉**：按上文选 `--bg` 避让；主体本身是绿色却坚持绿幕、或大面积渐变含底色，本 skill 不适合，换 rembg 等语义分割方案
- **玻璃/高光半透明**：色幕会反光到车窗等部位被误抠，alpha 硬化已修复
- **边缘轻微毛糙**：colorkey 硬边缘，1k 尺寸下做 icon 可用；要发丝级边缘本 skill 不适合

## 相关

底层文生图能力来自 `yo-qwen-image` skill（`scripts/generate.js` 为其副本，额外导出 `requestImage`/`saveImage` 供本 skill 调用）。要自由比例/分辨率/多张出图，直接用 yo-qwen-image skill。
