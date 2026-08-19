#!/usr/bin/env node
/**
 * base
 * yo-md-html.js 与 multi-md-html.js 的公共方法：依赖加载、Markdown 转换、HTML 模板。
 */

const fs = require('fs');
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

const BASE_CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #2b2b2b; background: #faf7f2; }
.doc-body { max-width: 880px; margin: 40px auto; padding: 0 24px; }
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
img { max-width: 100%; height: auto; border-radius: 10px; }
.mermaid svg { max-width: 100%; height: auto; }
`;

const MERMAID_SCRIPTS = `<script src="https://unpkg.zhimg.com/mermaid@11.16.1/dist/mermaid.min.js"></script>
<script type="module">
  import elkLayouts from 'https://unpkg.zhimg.com/@mermaid-js/layout-elk@0/dist/mermaid-layout-elk.esm.min.mjs';
  mermaid.registerLayoutLoaders(elkLayouts);
  mermaid.initialize({ startOnLoad: true, theme: 'neo', look: 'neo' });
</script>`;

function htmlTemplate(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${BASE_CSS}
body { max-width: 880px; margin: 40px auto; padding: 0 24px; }
</style>
${MERMAID_SCRIPTS}
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

module.exports = { ensureMarked, convertMarkdown, htmlTemplate, BASE_CSS, MERMAID_SCRIPTS };
