---
name: yo-pdf2md
description: 将 PDF 文件转换为 Markdown 格式，使用多模态大模型识别页面内容并提取结构化文本。
---

# PDF to Markdown Converter

## 触发条件
- 用户需要将 PDF 文件转换为 Markdown 格式
- 用户要求从 PDF 提取文本内容并保留格式结构
- 用户提及转换 .pdf 文件为 .md 文件

## 说明
需要配置以下环境变量：
- `yo_base_url`: API 基础 URL（Anthropic Messages API 兼容格式）
- `yo_api_key`: API 密钥
- `yo_multi_model`: 多模态模型名称（支持图片输入）

## 工具详情

将 PDF 文件的每一页渲染为图片，使用多模态大模型识别并转换为标准 Markdown 格式。

**调用方式：**

```bash
node yo-pdf2md.ts yo_pdf2md --input="<PDF绝对路径>" --output="<输出绝对路径>"
```

**参数说明：**

- `input` (string, 必填): 输入 PDF 文件的**绝对路径**
- `output` (string, 必填): 输出 Markdown 文件的**绝对路径**
- `dpi` (number, 可选): 图片分辨率，默认 200，值越大识别越精细但越慢

**示例：**

```bash
# 基本用法
node yo-pdf2md.ts yo_pdf2md --input="/Users/me/docs/document.pdf" --output="/Users/me/docs/document.md"

# 高分辨率（适用于扫描件或小字体）
node yo-pdf2md.ts yo_pdf2md --input="/path/to/scan.pdf" --output="/path/to/scan.md" --dpi=300
```

## 特性
- **多页支持**: 自动处理多页 PDF，每页独立识别后合并
- **格式保留**: 保留标题、列表、表格、代码块等 Markdown 结构
- **容错机制**: 单页失败不影响整体转换，失败页以注释占位
- **自动安装依赖**: 首次运行自动安装 `pdf-to-img`
- **原生 TypeScript**: Node.js v22.6+ 直接运行，无需编译

## 依赖
- `pdfjs-dist`: PDF 解析引擎（首次运行自动安装）
- `@napi-rs/canvas`: 页面渲染为图片，预编译二进制无需编译（首次运行自动安装）
- Node.js v22.6+ (支持 TypeScript strip-types)
