---
name: yo-qwen-image
description: '使用阿里云百炼 qwen-image 文生图/图生图。当用户要求"生成图片/画一张图/生成一张 XX 图/文生图/改一下这张图"时使用。支持长中文描述、比例与分辨率档位，自动下载图片到本地。'
---

# qwen-image 文生图

调用阿里云百炼 `qwen-image` 模型生成图片，图片直接下载到本地目录。

## 前置条件

需要环境变量 `ALI_API_TOKEN`。缺失时提示用户设置，**不要**把 key 写进脚本或文件。

## 用法

脚本路径以本 SKILL.md 所在目录为基准（`<skill-dir>/scripts/generate.js`），执行前先切到该目录或用绝对路径调用：

```bash
node scripts/generate.js "<图片描述>" [选项]
```

| 选项 | 说明 | 默认 |
|---|---|---|
| `--ratio <r>` | 比例：`1:1` `3:4` `4:3` `9:16` `16:9` | `1:1` |
| `--res <r>` | 分辨率：`1k` `1.5k` `2k` | `1k` |
| `--out <dir>` | 输出目录 | `./qwen-images` |
| `--name <file>` | 输出文件名前缀，脚本自动追加 `-1`、`-2` 与扩展名 | 时间戳 |
| `--n <k>` | 生成张数，1–6 | 1 |
| `--negative <text>` | 负面提示词（仅 3.0 系列） | 无 |
| `--seed <n>` | 随机种子，固定值可复现结果 | 随机 |
| `--image <url>` | 参考图，做图生图/图片编辑；可重复 | 无 |
| `--model <name>` | `qwen-image-3.0-pro` / `qwen-image-3.0` / `qwen-image-2.1-pro` | `qwen-image-3.0` |
| `--watermark` | 加水印 | 不加 |
| `--no-extend` | 关闭提示词智能改写 | 开启 |
| `--no-thinking` | 关闭思考模式（仅改写开启时生效） | 开启 |

尺寸由脚本按 `--ratio` × `--res` 换算，不需要也不能直接传 `size`。

示例：

```bash
# 竖版封面 3:4 高清
node scripts/generate.js "一只橘猫趴在窗台上，午后暖光，胶片质感" --ratio 3:4 --res 2k --out ./output

# 横版 Banner
node scripts/generate.js "城市夜景航拍" --ratio 16:9 --res 1.5k

# 图生图：基于参考图改写
node scripts/generate.js "把背景换成海边日落，人物不变" \
  --image https://example.com/photo.png --ratio 1:1 --res 1k
```

多行长描述用 heredoc，避免 shell 引号问题：

```bash
node scripts/generate.js "$(cat <<'EOF'
画面是一张竖幅人像摄影，……
整张照片采用暖色胶片感处理。
EOF
)" --ratio 3:4 --res 2k
```

## 参考图要求

JPG/JPEG/PNG/BMP/TIFF/WEBP/GIF，宽高 1–8000px（建议 384–2048），≤10MB。`qwen-image-3.0` 系列最多 3 张，`qwen-image-2.1-pro` 最多 10 张。

## 写描述的要点

用户给的需求越模糊，模型自由发挥越多。要成图稳定，把这几项写清楚：

1. **画面类型与构图**：竖幅/横幅、主体位置（中部偏右）、景别（半身、特写）
2. **主体细节**：外观、材质、颜色、表情、姿态
3. **环境**：场景、光线方向与强度、色调
4. **风格与后期**：摄影/插画/3D、镜头效果（浅景深、逆光）、滤镜（胶片颗粒）

## 产出

脚本把接口返回的临时图片链接立即下载到本地（链接 24 小时后失效），并打印绝对路径、实际尺寸与耗时。退出码非 0 表示失败，错误信息直接来自百炼接口。

接口文档：https://docs.bailian.console.aliyun.com/zh/model-studio/qwen-image-generation-and-editing-api-reference
