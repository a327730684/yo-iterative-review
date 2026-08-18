#!/usr/bin/env node
/**
 * multi-md-html
 * 将多个 Markdown 文件融合为一个带 Tabs 切换的 HTML，支持 Mermaid 图表渲染。
 *
 * 使用方法:
 *   node multi-md-html.js --input="<md1,md2,...>" [--tabs="<名1,名2,...>"] [--output="<目录>"] [--title="<标题>"] [--name="index"]
 */

const fs = require('fs');
const path = require('path');
const { ensureMarked, convertMarkdown, BASE_CSS, MERMAID_SCRIPTS } = require('./base');

const TABS_CSS = `
.tab-bar { position: sticky; top: 0; z-index: 10; display: flex; gap: 4px; padding: 0 24px; background: #f1e7d8; border-bottom: 1px solid #e0d2bd; overflow-x: auto; }
.tab { padding: 12px 20px; border: none; background: transparent; font-size: 14px; color: #8c6a45; cursor: pointer; white-space: nowrap; border-bottom: 3px solid transparent; }
.tab:hover { color: #5f4326; }
.tab.active { color: #b0503c; font-weight: 600; border-bottom-color: #f0a030; }
.tab-pane { display: none; }
.tab-pane.active { display: block; }
`;

const TABS_SCRIPT = `<script>
document.querySelectorAll('.tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.tab, .tab-pane').forEach(function (el) { el.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});
</script>`;

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function multiHtmlTemplate(title, tabs, bodies) {
  const tabButtons = tabs.map((t, i) =>
    `<button class="tab${i === 0 ? ' active' : ''}" data-target="pane-${i}">${escapeHtml(t)}</button>`
  ).join('\n');
  const panes = bodies.map((body, i) =>
    `<div class="tab-pane${i === 0 ? ' active' : ''}" id="pane-${i}"><div class="doc-body">${body}</div></div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${BASE_CSS}
body { margin: 0; }
${TABS_CSS}</style>
${MERMAID_SCRIPTS}
</head>
<body>
<div class="tab-bar">
${tabButtons}
</div>
${panes}
${TABS_SCRIPT}
</body>
</html>`;
}

function main() {
  const args = process.argv.slice(2);

  let inputArg = '';
  let tabsArg = '';
  let outputDir = '';
  let title = '文档';
  let name = 'index';

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      inputArg = arg.slice(8);
    } else if (arg.startsWith('--tabs=')) {
      tabsArg = arg.slice(7);
    } else if (arg.startsWith('--output=')) {
      outputDir = arg.slice(9);
    } else if (arg.startsWith('--title=')) {
      title = arg.slice(8);
    } else if (arg.startsWith('--name=')) {
      name = arg.slice(7);
    }
  }

  if (!inputArg) {
    console.log(`
Usage: node multi-md-html.js --input="<md1,md2,...>" [--tabs="<name1,name2,...>"] [--output="<dir>"] [--title="<title>"] [--name="index"]

Options:
  --input    Markdown file paths, separated by "," (required)
  --tabs     Tab names, separated by ",", matched with --input by index (default: file basenames)
  --output   Output directory (default: directory of the first input file)
  --title    HTML page title (default: "文档")
  --name     Output file name without extension (default: "index")

Examples:
  node multi-md-html.js --input="docs/a.md,docs/b.md" --tabs="概览,API" --output="dist"
`);
    process.exit(0);
  }

  const mdPaths = inputArg.split(',').map(s => path.resolve(s.trim())).filter(Boolean);
  if (mdPaths.length === 0) {
    console.error('Error: no input files');
    process.exit(1);
  }
  for (const p of mdPaths) {
    if (!fs.existsSync(p)) {
      console.error('Error: file does not exist:', p);
      process.exit(1);
    }
  }

  const tabs = tabsArg
    ? tabsArg.split(',').map(s => s.trim())
    : mdPaths.map(p => path.basename(p, '.md'));
  if (tabs.length !== mdPaths.length) {
    console.error(`Error: tabs count (${tabs.length}) does not match input count (${mdPaths.length})`);
    process.exit(1);
  }

  const markedInstance = ensureMarked();
  const bodies = mdPaths.map(p => convertMarkdown(fs.readFileSync(p, 'utf8'), markedInstance));

  const dir = outputDir ? path.resolve(outputDir) : path.dirname(mdPaths[0]);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const htmlPath = path.join(dir, name + '.html');
  fs.writeFileSync(htmlPath, multiHtmlTemplate(title, tabs, bodies));
  console.log('Generated', htmlPath);
}

if (require.main === module) {
  main();
}

module.exports = { multiHtmlTemplate };
