#!/usr/bin/env node
// 透明背景素材生成：qwen-image 绿幕出图，ffmpeg 抠图输出 PNG。

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { requestImage, saveImage } = require('./generate');

// 底色选项：主体含绿用 blue，含蓝用 green，都有用品红。抠图 key 色由 4 角采样自动适配。
const SCREENS = {
  green: '纯正绿色绿幕',
  blue: '纯正蓝色蓝幕',
  magenta: '纯正品红色色幕',
};
// 末尾强制色幕约束；负面词屏蔽文字/阴影等干扰抠图的元素。
const NEGATIVE = '文字，字母，水印，阴影，倒影，地面，渐变背景，纹理背景，模糊';

function ffmpeg(args) {
  try {
    return execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', args, { maxBuffer: 1 << 24 });
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('未找到 ffmpeg，请安装并加入 PATH（或设置环境变量 FFMPEG_PATH）');
    throw new Error(`ffmpeg 失败: ${err.stderr?.toString().trim() || err.message}`);
  }
}

// 采 4 角 8x8 均值作 colorkey 目标色，吸收模型绿幕的轻微色偏与渐变。
function sampleKeyColor(file) {
  const corners = [[0, 0], [1016, 0], [0, 1016], [1016, 1016]];
  const sum = [0, 0, 0];
  for (const [x, y] of corners) {
    const px = ffmpeg(['-v', 'error', '-i', file, '-vf', `crop=8:8:${x}:${y},scale=1:1,format=rgb24`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
    if (px.length < 3) throw new Error(`采样失败: ${file} @${x},${y}`);
    sum[0] += px[0]; sum[1] += px[1]; sum[2] += px[2];
  }
  return sum.map((v) => Math.round(v / corners.length).toString(16).padStart(2, '0')).join('');
}

// colorkey 抠绿幕；alpha 硬化修复绿幕反光导致玻璃/高光被误抠成半透明。
function cutout(src, dest) {
  const key = sampleKeyColor(src);
  const vf = `colorkey=0x${key}:0.18:0.06,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(alpha(X,Y),90),255,alpha(X,Y))'`;
  ffmpeg(['-v', 'error', '-y', '-i', src, '-vf', vf, '-pix_fmt', 'rgba', '-frames:v', '1', dest]);
  return key;
}

async function generateMaterial(desc, { out, name, bg = 'green' }) {
  if (!process.env.ALI_API_TOKEN) throw new Error('未设置环境变量 ALI_API_TOKEN');
  if (!(bg in SCREENS)) throw new Error(`未知底色 ${bg}，可选：${Object.keys(SCREENS).join(' / ')}`);
  const base = name || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tmpDir = path.join(os.tmpdir(), 'qwen-material');
  fs.mkdirSync(tmpDir, { recursive: true });

  const suffix = `。该图为素材：背景必须是完全纯净的${SCREENS[bg]}，无渐变、无阴影、无倒影、无地面、无文字、无水印，画面只有主体与纯色背景两层。`;
  const body = await requestImage({
    prompt: desc.trim() + suffix,
    images: [], negative: NEGATIVE, n: 1,
    ratio: '1:1', resolution: '1k', model: 'qwen-image-3.0',
    prompt_extend: true, enable_thinking: true,
  });
  const contents = [].concat(body.output?.choices?.[0]?.message?.content ?? []);
  const url = contents.map((c) => (typeof c === 'string' ? c : c?.image)).find(Boolean);
  if (!url) throw new Error(`响应中没有图片: ${JSON.stringify(body)}`);

  const src = await saveImage(url, tmpDir, 0, base);
  fs.mkdirSync(out, { recursive: true });
  const dest = path.resolve(out, `${base}.png`);
  const key = cutout(src, dest);
  return { src, dest, key };
}

function parseArgs(argv) {
  const opts = { out: null, name: null, bg: 'green' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--out' || key === '--name' || key === '--bg') { opts[key.slice(2)] = argv[++i]; continue; }
    if (key.startsWith('--')) throw new Error(`未知参数 ${key}，只支持 --out / --name / --bg`);
    positional.push(key);
  }
  opts.desc = positional.join(' ').trim();
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.desc) throw new Error('缺少素材描述参数');
  if (!opts.out) throw new Error('缺少 --out 输出目录');

  const startedAt = Date.now();
  const { src, dest, key } = await generateMaterial(opts.desc, opts);
  console.log(`${dest}  1024x1024  bg=${opts.bg}  key=0x${key}  (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
  console.log(`原图(临时): ${src}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { generateMaterial };
