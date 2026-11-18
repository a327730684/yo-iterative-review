#!/usr/bin/env node
// 调用百炼 qwen-image 文生图，图片下载到本地目录。

const fs = require('fs');
const path = require('path');

const WORKSPACE_ID = 'llm-m22pdmcqhed8y1m7';
const ENDPOINT = `https://${WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`;

const MODELS = {
  'qwen-image-3.0-pro': 3,
  'qwen-image-3.0': 3,
  'qwen-image-2.1-pro': 10,
};

const RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const RESOLUTIONS = { '1k': 1024, '1.5k': 1536, '2k': 2048 };

// 分辨率按长边算，短边按比例推，对齐 16 的倍数以保证 512~2048 区间内。
function toSize(ratio, resolution) {
  const [w, h] = ratio.split(':').map(Number);
  const long = RESOLUTIONS[resolution];
  const snap = (v) => Math.max(512, Math.min(2048, Math.round(v / 16) * 16));
  return [w >= h ? long : snap((long * w) / h), w >= h ? snap((long * h) / w) : long];
}

function parseArgs(argv) {
  const opts = { out: './qwen-images', name: null, ratio: '1:1', resolution: '1k', n: 1, images: [], model: 'qwen-image-3.0' };
  const flags = { prompt_extend: true, enable_thinking: true };
  const positional = [];
  const valued = ['out', 'name', 'ratio', 'res', 'n', 'negative', 'seed', 'model', 'image'];
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) { positional.push(key); continue; }
    const name = key.slice(2);
    if (name === 'no-extend') { flags.prompt_extend = false; continue; }
    if (name === 'no-thinking') { flags.enable_thinking = false; continue; }
    if (name === 'watermark') { flags.watermark = true; continue; }
    if (!valued.includes(name)) throw new Error(`未知参数 ${key}`);
    const value = argv[++i];
    if (name === 'image') opts.images.push(value);
    else if (name === 'res') opts.resolution = value;
    else opts[name] = value;
  }
  opts.prompt = positional.join(' ').trim();
  if (!(opts.model in MODELS)) throw new Error(`未知模型 ${opts.model}，可选：${Object.keys(MODELS).join(' / ')}`);
  if (!RATIOS.includes(opts.ratio)) throw new Error(`未知比例 ${opts.ratio}，可选：${RATIOS.join(' / ')}`);
  if (!(opts.resolution in RESOLUTIONS)) throw new Error(`未知分辨率 ${opts.resolution}，可选：${Object.keys(RESOLUTIONS).join(' / ')}`);
  if (opts.images.length > MODELS[opts.model]) throw new Error(`${opts.model} 最多支持 ${MODELS[opts.model]} 张参考图`);
  return { ...opts, ...flags };
}

// 接口只接受公网 URL 或 data:base64；本地文件路径在此统一转换。
function toImageRef(value) {
  if (/^(https?:\/\/|data:)/.test(value)) return value;
  if (!fs.existsSync(value)) throw new Error(`参考图不存在: ${value}`);
  const mime = value.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(value).toString('base64')}`;
}

async function requestImage(opts) {
  // I2I 时参考图必须排在 text 之前。
  const content = opts.images.map(toImageRef).map((image) => ({ image }));
  content.push({ text: opts.prompt });

  const parameters = { prompt_extend: opts.prompt_extend, enable_thinking: opts.enable_thinking, n: Number(opts.n) };
  parameters.size = toSize(opts.ratio, opts.resolution).join('*');
  if (opts.negative) parameters.negative_prompt = opts.negative;
  if (opts.seed) parameters.seed = Number(opts.seed);
  if (opts.watermark) parameters.watermark = true;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ALI_API_TOKEN}`,
    },
    body: JSON.stringify({
      model: opts.model,
      input: { messages: [{ role: 'user', content }] },
      parameters,
    }),
  });

  const body = await res.json();
  if (!res.ok || body.code && body.code !== 'OK') {
    throw new Error(`接口返回错误: ${JSON.stringify(body)}`);
  }
  return body;
}

// 接口固定返回 PNG 链接（24 小时后失效），立即下载。
async function saveImage(url, outDir, index, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const ext = path.extname(new URL(url).pathname).replace('.', '') || 'png';
  const file = path.resolve(outDir, `${name}-${index + 1}.${ext}`);
  const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
  await fs.promises.writeFile(file, buffer);
  return file;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.prompt) throw new Error('缺少图片描述参数');
  if (!process.env.ALI_API_TOKEN) throw new Error('未设置环境变量 ALI_API_TOKEN');

  const startedAt = Date.now();
  const body = await requestImage(opts);

  // content 是 [{type, image}] 数组。
  const contents = [].concat(body.output?.choices?.[0]?.message?.content ?? []);
  const images = contents.map((c) => (typeof c === 'string' ? c : c?.image)).filter(Boolean);
  if (!images.length) throw new Error(`响应中没有图片: ${JSON.stringify(body)}`);

  const { output_width: width, output_height: height } = body.usage ?? {};
  const name = opts.name || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  for (const [i, content] of images.entries()) {
    const file = await saveImage(content, opts.out, i, name);
    console.log(`${file}  ${width}x${height}  (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { toSize, RATIOS, RESOLUTIONS };
