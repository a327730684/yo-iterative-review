#!/usr/bin/env node
/**
 * base
 * yo-md-html.js 与 multi-md-html.js 的公共方法：依赖加载、Markdown 转换、HTML 模板。
 */

const fs = require('fs');
const { execSync } = require('child_process');
const { pathToFileURL } = require('url');

function ensureMarked() {
  try {
    return require('marked').marked;
  } catch {
    console.log('[yo-md-html] marked not found, installing...');
    const scriptDir = __dirname;
    // 成对安装：--no-save 单装会 prune 掉另一个已装依赖
    execSync('npm install --no-save marked pele', { cwd: scriptDir, stdio: 'inherit' });
    const markedPath = require.resolve('marked', { paths: [scriptDir] });
    delete require.cache[markedPath];
    return require(markedPath).marked;
  }
}

// pele 为 ESM 包，须动态 import；缺失时先 npm install 再按路径加载
async function ensurePele() {
  try {
    return await import('pele');
  } catch {
    console.log('[yo-md-html] pele not found, installing...');
    execSync('npm install --no-save marked pele', { cwd: __dirname, stdio: 'inherit' });
    try {
      return await import('pele');
    } catch {
      const pelePath = require.resolve('pele', { paths: [__dirname] });
      return await import(pathToFileURL(pelePath).href);
    }
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

// pele 主题：白卡片容器＋蓝→玫红渐变描边＋白节点＋黑连线＋灰底边标签
const PELE_CSS = `
.pele-wrap { overflow-x: auto; margin: 16px 0; padding: 12px; background: #FFFFFF; border: 1px solid #E4E4E2; border-radius: 12px;
  --pele-bg: #DBDBDB; --pele-fg: #1F2937; --pele-muted: #6B7280; --pele-line: #141414;
  --pele-surface: #FBFBFD; --pele-surface-alt: #F3F4F6; --pele-border: url(#peleGrad);
  --pele-accent: #E11D48; --pele-radius: 2px;
  --pele-font: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
  --pele-font-mono: ui-monospace, Consolas, monospace;
  --pele-series-1: #C15F3C; --pele-series-2: #7D9B76; --pele-series-3: #6A9BCC; --pele-series-4: #C99B3F;
  --pele-series-5: #9B6A9D; --pele-series-6: #4E8D87; --pele-series-7: #B4552D; --pele-series-8: #5B6472; }
.pele-wrap svg { display: block; margin: 0 auto; }
`;

// 渐变描边供 --pele-border:url(#peleGrad) 引用，全页共用一份
const GRADIENT_DEFS = `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="peleGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#E11D48"/></linearGradient></defs></svg>`;

const DEFAULT_SCALE = 0.85;

// 预渲染：mermaid 文本→内联 SVG（12px 字、紧凑间距），按 scale 等比缩小；失败保留原 pre
function renderMermaids(html, pele, scale = DEFAULT_SCALE) {
  return html.replace(/<pre class="mermaid">([\s\S]*?)<\/pre>/g, (m, code) => {
    try {
      const r = pele.render(code.trim(), {
        fontSize: 12, padding: 6,
        config: { flowchart: { nodeSpacing: 30, rankSpacing: 30 } },
      });
      const w = Math.round(r.width * scale), h = Math.round(r.height * scale);
      const svg = r.svg.replace(/width="[\d.]+"/, `width="${w}"`).replace(/height="[\d.]+"/, `height="${h}"`);
      return `<div class="pele-wrap">${svg}</div>`;
    } catch (e) {
      console.error('[yo-md-html] pele render fail:', e.message);
      return m;
    }
  });
}

function htmlTemplate(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${BASE_CSS}
body { max-width: 880px; margin: 40px auto; padding: 0 24px; }
${PELE_CSS}</style>
</head>
<body>
${GRADIENT_DEFS}
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

module.exports = { ensureMarked, ensurePele, convertMarkdown, renderMermaids, htmlTemplate, BASE_CSS, PELE_CSS, GRADIENT_DEFS, DEFAULT_SCALE };
