#!/usr/bin/env node
/**
 * yo-md-html
 * 将 Markdown 文件或目录转换为 HTML，支持 Mermaid 图表渲染。
 *
 * 使用方法:
 *   node yo-md-html.js yo_md_html --input="<文件或目录>" [--output="<目录>"] [--title="<标题>"]
 */

const fs = require('fs');
const path = require('path');
const { ensureMarked, convertMarkdown, htmlTemplate } = require('./base');

function convertFile(mdPath, outDir, markedInstance, customTitle) {
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const htmlBody = convertMarkdown(mdContent, markedInstance);
  const baseName = path.basename(mdPath, '.md');
  const title = customTitle || baseName;
  const htmlPath = path.join(outDir, baseName + '.html');
  fs.writeFileSync(htmlPath, htmlTemplate(title, htmlBody));
  console.log('Generated', htmlPath);
  return htmlPath;
}

function main() {
  const args = process.argv.slice(2);

  let inputPath = '';
  let outputDir = '';
  let customTitle = '';

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      inputPath = arg.slice(8);
    } else if (arg.startsWith('--output=')) {
      outputDir = arg.slice(9);
    } else if (arg.startsWith('--title=')) {
      customTitle = arg.slice(8);
    }
  }

  if (!inputPath) {
    console.log(`
Usage: node yo-md-html.js yo_md_html --input="<path>" [--output="<dir>"] [--title="<title>"]

Options:
  --input    Markdown file or directory path (required)
  --output   Output directory for HTML files (default: same as input)
  --title    Custom HTML title for single file conversion

Examples:
  node yo-md-html.js yo_md_html --input="docs/readme.md" --output="dist"
  node yo-md-html.js yo_md_html --input="docs" --output="site"
`);
    process.exit(0);
  }

  const markedInstance = ensureMarked();

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error('Error: Input path does not exist:', resolvedInput);
    process.exit(1);
  }

  const stat = fs.statSync(resolvedInput);
  if (stat.isFile()) {
    const dir = outputDir ? path.resolve(outputDir) : path.dirname(resolvedInput);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    convertFile(resolvedInput, dir, markedInstance, customTitle);
  } else if (stat.isDirectory()) {
    const dir = outputDir ? path.resolve(outputDir) : resolvedInput;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const files = fs.readdirSync(resolvedInput).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
      console.log('No .md files found in', resolvedInput);
      process.exit(0);
    }
    for (const file of files) {
      convertFile(path.join(resolvedInput, file), dir, markedInstance);
    }
  } else {
    console.error('Invalid input path:', resolvedInput);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { convertFile };
