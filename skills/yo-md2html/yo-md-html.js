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
const { execSync } = require('child_process');

function ensureMarked() {
  try {
    return require('marked').marked;
  } catch {
    console.log('[yo-md-html] marked not found, installing...');
    const scriptDir = __dirname;
    execSync('npm install --no-save marked', { cwd: scriptDir, stdio: 'inherit' });
    const markedPath = require.resolve('marked', { paths: [scriptDir] });
    delete require.cache[markedPath];
    return require(markedPath).marked;
  }
}

function htmlTemplate(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.8; max-width: 880px; margin: 40px auto; padding: 0 24px; color: #2b2b2b; background: #faf7f2; }
h1, h2, h3, h4 { color: #1a1a1a; margin-top: 1.6em; margin-bottom: .9em; }
h1 { font-size: 2em; }
h2 { border-bottom: 1px solid #e9e2d8; padding-bottom: .35em; position: relative; }
h2::after { content: ""; position: absolute; left: 0; bottom: -2px; width: 56px; height: 3px; background: #f0a030; border-radius: 2px; }
pre { background: #f7ecdc; padding: 16px; overflow: auto; border-radius: 6px; font-size: 85%; line-height: 1.45; border: 1px solid #e8d5b5; }
code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 85%; background: #f7ecdc; padding: .2em .4em; border-radius: 3px; color: #b0503c; }
pre code { background: transparent; padding: 0; color: inherit; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #e8d5b5; padding: 8px 12px; }
th { background: #f7ecdc; font-weight: 600; color: #8c5a2b; }
tr:nth-child(even) { background: #faf1e3; }
blockquote { border-left: 4px solid #d9a05b; color: #7a6a58; background: #faf1e3; padding: 4px 16px; margin-left: 0; border-radius: 0 6px 6px 0; }
hr { border: 0; border-top: 1px solid #e8d5b5; margin: 24px 0; }
a { color: #c2703d; text-decoration: none; }
a:hover { text-decoration: underline; }
.mermaid { background: transparent; text-align: center; }
.mermaid svg { max-width: 100%; height: auto; }
</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script type="module">
  import elkLayouts from 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0/dist/mermaid-layout-elk.esm.min.mjs';
  mermaid.registerLayoutLoaders(elkLayouts);
  mermaid.initialize({ startOnLoad: true, theme: 'neo', look: 'neo' });
</script>
</head>
<body>
${body}
</body>
</html>`;
}

function convertMarkdown(mdContent, markedInstance) {
  // Extract mermaid blocks before markdown parsing
  const mermaids = [];
  const placeholder = (idx) => `<!-- MERMAID_${idx} -->`;
  let cleaned = mdContent.replace(/```mermaid\s*\n([\s\S]*?)```/g, (_, code) => {
    const idx = mermaids.length;
    mermaids.push(code.trim());
    return placeholder(idx);
  });

  // Convert markdown to HTML
  let htmlBody = markedInstance.parse(cleaned);

  // Restore mermaid blocks
  mermaids.forEach((code, idx) => {
    htmlBody = htmlBody.replace(placeholder(idx), `<pre class="mermaid">${code}</pre>`);
  });

  return htmlBody;
}

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

module.exports = { convertMarkdown, convertFile, htmlTemplate };
