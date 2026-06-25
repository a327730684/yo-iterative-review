#!/usr/bin/env node
/**
 * yo-pdf2md
 * 将 PDF 文件每页转为图片，通过多模态模型识别后输出标准 Markdown。
 *
 * 使用方法:
 *   node yo-pdf2md.ts yo_pdf2md --input="file.pdf" --output="output.md"
 *
 * 环境变量:
 *   yo_base_url   - API 基础 URL
 *   yo_api_key    - API 密钥
 *   yo_multi_model - 多模态模型名称
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ============ 类型定义 ============

interface EnvConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface CliArgs {
  toolName: string;
  input: string;
  output: string;
  dpi: number;
  showHelp: boolean;
}

// ============ 环境变量 ============

function getEnvConfig(): EnvConfig {
  const baseUrl = process.env.yo_base_url || "";
  const apiKey = process.env.yo_api_key || "";
  const model = process.env.yo_multi_model || "";

  const missing: string[] = [];
  if (!baseUrl) missing.push("yo_base_url");
  if (!apiKey) missing.push("yo_api_key");
  if (!model) missing.push("yo_multi_model");

  if (missing.length > 0) {
    console.error(
      `错误: 缺少环境变量 ${missing.join(", ")}\n` +
        `请设置:\n  ${missing.map((v) => `export ${v}=<value>`).join("\n  ")}`
    );
    process.exit(1);
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}

// ============ CLI 参数解析 ============

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    toolName: "",
    input: "",
    output: "",
    dpi: 200,
    showHelp: false,
  };

  if (args.includes("--help") || args.includes("-h")) {
    result.showHelp = true;
    return result;
  }

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) continue;
      const key = arg.slice(2, eqIdx);
      const value = arg.slice(eqIdx + 1);

      switch (key) {
        case "input":
          result.input = value;
          break;
        case "output":
          result.output = value;
          break;
        case "dpi":
          result.dpi = parseInt(value, 10) || 200;
          break;
      }
    } else if (!result.toolName) {
      result.toolName = arg;
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`
yo-pdf2md - PDF 转 Markdown 工具

使用方法:
  node yo-pdf2md.ts yo_pdf2md --input="<绝对路径>" --output="<绝对路径>"

参数:
  --input=<path>    (必填) 输入 PDF 文件的绝对路径
  --output=<path>   (必填) 输出 Markdown 文件的绝对路径
  --dpi=<number>    (可选) 图片分辨率，默认 200
  --help, -h        显示帮助信息

环境变量:
  yo_base_url       API 基础 URL
  yo_api_key        API 密钥
  yo_multi_model    多模态模型名称

示例:
  node yo-pdf2md.ts yo_pdf2md --input="/path/to/document.pdf" --output="/path/to/document.md"
  node yo-pdf2md.ts yo_pdf2md --input="/Users/me/scan.pdf" --output="/Users/me/scan.md" --dpi=300
`);
}

// ============ 依赖自动安装 ============

async function ensurePdfjs(): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> {
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    console.log("[yo-pdf2md] pdfjs-dist 未找到，正在安装...");
    const scriptDir = import.meta.dirname;
    execSync("npm install --no-save pdfjs-dist", {
      cwd: scriptDir,
      stdio: "inherit",
    });
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
}

async function ensureCanvas(): Promise<typeof import("@napi-rs/canvas")> {
  try {
    return await import("@napi-rs/canvas");
  } catch {
    console.log("[yo-pdf2md] @napi-rs/canvas 未找到，正在安装...");
    const scriptDir = import.meta.dirname;
    execSync("npm install --no-save @napi-rs/canvas", {
      cwd: scriptDir,
      stdio: "inherit",
    });
    return await import("@napi-rs/canvas");
  }
}

// 设置 pdfjs-dist 在 Node.js 环境需要的全局变量
function setupPdfJsGlobals(canvasModule: typeof import("@napi-rs/canvas")): void {
  // pdfjs-dist 需要 DOMMatrix，从 canvas 获取
  const { DOMMatrix } = canvasModule;
  if (DOMMatrix && !(globalThis as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = DOMMatrix;
  }
}

// ============ 多模态 Prompt ============

const PROMPT = `请将这张 PDF 页面图片转换为标准 Markdown 格式。要求：
1. 完整保留所有文字内容
2. 正确使用标题层级（#/##/###）
3. 保留列表、表格、代码块等格式结构
4. 忽略页眉页脚中的页码
5. 仅输出 Markdown 内容，不要任何解释或前缀`;

// ============ Claude Code 身份伪装 ============

const CLAUDE_CODE_VERSION = "2.1.191";
const CLAUDE_CODE_USER_AGENT = `claude-code/${CLAUDE_CODE_VERSION}`;
const CLAUDE_CODE_AI_AGENT = `claude-code_${CLAUDE_CODE_VERSION.replace(/\./g, "-")}_harness`;

// ============ API 调用 ============

async function callMultimodalAPI(
  imageBuffer: Buffer,
  config: EnvConfig,
  mediaType: string
): Promise<string> {
  const base64 = imageBuffer.toString("base64");
  const url = `${config.baseUrl}/v1/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "User-Agent": CLAUDE_CODE_USER_AGENT,
      "AI-Agent": CLAUDE_CODE_AI_AGENT,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  if (!result.content || result.content.length === 0) {
    throw new Error("API 返回内容为空");
  }

  const textBlock = result.content.find((c) => c.type === "text");
  if (!textBlock?.text) {
    throw new Error("API 返回中未找到文本内容");
  }

  return textBlock.text;
}

// ============ 单页处理 ============

async function processPage(
  imageBuffer: Buffer,
  pageNumber: number,
  config: EnvConfig,
  mediaType: string
): Promise<{ markdown: string; success: boolean }> {
  try {
    const markdown = await callMultimodalAPI(imageBuffer, config, mediaType);
    return { markdown, success: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[yo-pdf2md] 警告: 第 ${pageNumber} 页处理失败: ${errMsg}`);
    return {
      markdown: `<!-- 第 ${pageNumber} 页: 处理失败 - ${errMsg} -->`,
      success: false,
    };
  }
}

// ============ 主转换逻辑 ============

async function convertPdfToMd(
  args: CliArgs,
  config: EnvConfig
): Promise<void> {
  const canvasModule = await ensureCanvas();
  setupPdfJsGlobals(canvasModule);
  const pdfjs = await ensurePdfjs();
  const { createCanvas } = canvasModule;

  const pdfPath = path.resolve(args.input);
  if (!fs.existsSync(pdfPath)) {
    console.error(`错误: 文件不存在 - ${pdfPath}`);
    process.exit(1);
  }

  const outputPath = path.resolve(args.output);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 使用 pdfjs-dist 直接打开 PDF
  const pdfBuffer = new Uint8Array(fs.readFileSync(pdfPath));
  const document = await pdfjs.getDocument({ data: pdfBuffer }).promise;
  const totalPages = document.numPages;
  const scale = args.dpi / 72;

  console.log(`[yo-pdf2md] PDF 共 ${totalPages} 页，DPI: ${args.dpi} (scale: ${scale.toFixed(2)})`);

  // 流式写入文件
  const separator = "\n\n---\n\n";
  const writeStream = fs.createWriteStream(outputPath, "utf-8");
  let successCount = 0;
  let failCount = 0;

  try {
    // 显式按页码逐页处理
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log(`[yo-pdf2md] 处理第 ${pageNum}/${totalPages} 页...`);

      // 1. 读取当前页
      const page = await document.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // 2. 渲染为 PNG Buffer
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      const renderTask = page.render({
        canvas: canvas as any,
        canvasContext: context as any,
        viewport,
      });
      await renderTask.promise;

      const imageBuffer = canvas.toBuffer("image/png");

      // 释放当前页资源
      page.cleanup();

      // 3. 写入分页分隔符（非首页）
      if (pageNum > 1) {
        writeStream.write(separator);
      }

      // 4. 发送给多模态模型分析
      const { markdown, success } = await processPage(
        imageBuffer,
        pageNum,
        config,
        "image/png"
      );

      // 5. 写入文件
      writeStream.write(markdown);

      if (success) successCount++;
      else failCount++;
    }
  } finally {
    writeStream.end();
  }

  console.log(
    `[yo-pdf2md] 转换完成: ${successCount} 页成功, ${failCount} 页失败`
  );
  console.log(`[yo-pdf2md] 已输出到: ${outputPath}`);
}

// ============ 入口 ============

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.showHelp || !args.toolName) {
    showHelp();
    process.exit(args.showHelp ? 0 : 1);
  }

  if (args.toolName !== "yo_pdf2md") {
    console.error(`错误: 未知工具 '${args.toolName}'`);
    console.error("可用工具: yo_pdf2md");
    process.exit(1);
  }

  if (!args.input) {
    console.error("错误: 缺少 --input 参数");
    showHelp();
    process.exit(1);
  }

  if (!args.output) {
    console.error("错误: 缺少 --output 参数");
    showHelp();
    process.exit(1);
  }

  if (!path.isAbsolute(args.input)) {
    console.error(`错误: --input 必须为绝对路径，当前: ${args.input}`);
    process.exit(1);
  }

  if (!path.isAbsolute(args.output)) {
    console.error(`错误: --output 必须为绝对路径，当前: ${args.output}`);
    process.exit(1);
  }

  const config = getEnvConfig();

  try {
    await convertPdfToMd(args, config);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[yo-pdf2md] 转换失败: ${errMsg}`);
    process.exit(1);
  }
}

main();
