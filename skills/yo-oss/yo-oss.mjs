#!/usr/bin/env node
/**
 * yo-oss
 * 上传本地文件 / 目录到阿里云 OSS，基于 @voyo/ali-oss。
 *
 * 使用方法:
 *   node yo-oss.mjs yo_oss_upload --file="<file>" --key="<key>"
 *   node yo-oss.mjs yo_oss_upload --dir="<dir>" --prefix="<prefix>"
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_NAMES = {
  region: 'OSS_REGION',
  endpoint: 'OSS_ENDPOINT',
  accessKeyId: 'OSS_ACCESS_KEY_ID',
  accessKeySecret: 'OSS_ACCESS_KEY_SECRET',
  bucket: 'OSS_BUCKET',
};

function readEnv(name) {
  return process.env[name] && process.env[name].trim();
}

function loadSettingsOverrides() {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) return {};
    const json = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const env = json.env || {};
    return {
      region: env.OSS_REGION,
      endpoint: env.OSS_ENDPOINT,
      accessKeyId: env.OSS_ACCESS_KEY_ID,
      accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
      bucket: env.OSS_BUCKET,
    };
  } catch {
    return {};
  }
}

/**
 * ali-oss SDK expects region like `oss-cn-shanghai`, not the short form `shanghai`.
 * Derive it from endpoint when available.
 */
function deriveRegion(region, endpoint) {
  if (!region) return null;
  if (region.startsWith('oss-')) return region;
  if (endpoint) {
    const m = endpoint.match(/^(oss-[a-z0-9-]+)\.aliyuncs\.com/i);
    if (m) return m[1];
  }
  return region;
}

function resolveConfig() {
  const o = loadSettingsOverrides();
  const endpoint = o.endpoint || readEnv(ENV_NAMES.endpoint);
  const region = deriveRegion(o.region || readEnv(ENV_NAMES.region), endpoint);
  const cfg = {
    region,
    endpoint,
    accessKeyId: o.accessKeyId || readEnv(ENV_NAMES.accessKeyId),
    accessKeySecret: o.accessKeySecret || readEnv(ENV_NAMES.accessKeySecret),
    bucket: o.bucket || readEnv(ENV_NAMES.bucket),
  };
  const missing = Object.entries({
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    bucket: cfg.bucket,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Missing OSS config: ${missing.join(', ')}. ` +
        `Set them in process env (${missing.map((k) => ENV_NAMES[k]).join(', ')}) ` +
        `or in ~/.claude/settings.json -> env.`
    );
  }
  return cfg;
}

function ensureAliOss() {
  try {
    return import('@voyo/ali-oss');
  } catch {
    console.log('[yo-oss] @voyo/ali-oss not found, installing...');
    execSync('npm install --no-save @voyo/ali-oss', { cwd: __dirname, stdio: 'inherit' });
    return import('@voyo/ali-oss');
  }
}

function ensureZtwxUtils() {
  try {
    return import('@ztwx/utils');
  } catch {
    console.log('[yo-oss] @ztwx/utils not found, installing...');
    execSync('npm install --no-save @ztwx/utils', { cwd: __dirname, stdio: 'inherit' });
    return import('@ztwx/utils');
  }
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else if (entry.isFile()) {
      out.push({ abs: full, rel });
    }
  }
  return out;
}

/** 把唯一 id 注入到文件名（保留扩展名） */
function suffixName(name, uid) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name}-${uid}`;
  return `${name.slice(0, dot)}-${uid}${name.slice(dot)}`;
}

/** 在保留目录结构的前提下，给相对路径的最后一段加 uid 后缀 */
function suffixRelPath(rel, uid) {
  const idx = rel.lastIndexOf('/');
  const dir = idx >= 0 ? rel.slice(0, idx + 1) : '';
  const base = idx >= 0 ? rel.slice(idx + 1) : rel;
  return `${dir}${suffixName(base, uid)}`;
}

async function yoOssUpload({ file, key, dir, prefix, unique } = {}) {
  if (!file && !dir) {
    throw new Error('Either --file or --dir must be provided.');
  }
  const cfg = resolveConfig();
  const aliMod = await ensureAliOss();
  const { AliYoOSS } = aliMod;

  // --unique 默认 true，--unique=false 时不追加 uid
  const wantUnique = unique === undefined ? true : unique !== false && unique !== 'false';

  const { getUniqueId } = await ensureZtwxUtils();

  const client = new AliYoOSS({
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    bucket: cfg.bucket,
  });

  if (file) {
    if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
    const baseName = path.basename(file);
    let targetKey = key || baseName;
    let uid = null;
    if (wantUnique) {
      uid = getUniqueId();
      targetKey = key ? suffixName(key, uid) : suffixName(baseName, uid);
    }
    const result = await client.putFile(targetKey, path.resolve(file));
    return {
      bucket: cfg.bucket,
      mode: 'file',
      count: 1,
      items: [{ key: targetKey, name: result.name, url: result.url, status: result.res?.status, uid }],
    };
  }

  if (!fs.existsSync(dir)) throw new Error(`Dir not found: ${dir}`);
  const basePrefix = (prefix ?? path.basename(dir)).replace(/\\/g, '/');
  const files = walkFiles(dir);
  const items = [];
  for (const f of files) {
    let remoteKey = `${basePrefix}/${f.rel}`;
    let uid = null;
    if (wantUnique) {
      uid = getUniqueId();
      remoteKey = `${basePrefix}/${suffixRelPath(f.rel, uid)}`;
    }
    const result = await client.putFile(remoteKey, f.abs);
    items.push({ key: remoteKey, name: result.name, url: result.url, status: result.res?.status, uid });
  }
  return {
    bucket: cfg.bucket,
    mode: 'dir',
    prefix: basePrefix,
    count: items.length,
    items,
  };
}

const tools = { yo_oss_upload: yoOssUpload };

function parseArgs(argv) {
  let toolName = '';
  const params = {};
  for (const arg of argv) {
    if (arg.startsWith('--tool=')) {
      toolName = arg.slice(7);
    } else if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=');
      if (k && v !== undefined) {
        let parsed = v;
        if (v === 'true') parsed = true;
        else if (v === 'false') parsed = false;
        else if (!isNaN(v) && v.trim() !== '') parsed = Number(v);
        params[k] = parsed;
      }
    } else if (!arg.startsWith('-')) {
      if (!toolName) toolName = arg;
    }
  }
  return { toolName, params };
}

function printHelp() {
  console.log(`
Usage: node yo-oss.mjs [options] <tool-name>

Available tools:
  - yo_oss_upload --file=<path> --key=<key>
  - yo_oss_upload --dir=<path> --prefix=<prefix>

Options:
  --file=<path>       Upload a single file
  --key=<key>         Target OSS object key (with --file)
  --dir=<path>        Upload all files under a directory (recursive)
  --prefix=<prefix>   Key prefix used when uploading a directory
  --unique=<bool>     Append @ztwx/utils unique id to each filename (default true)
  --tool=<name>       Specify tool name explicitly
  --help, -h          Show this help

Examples:
  node yo-oss.mjs yo_oss_upload --file="dist/index.html" --key="static/index.html"
  node yo-oss.mjs yo_oss_upload --dir="dist" --prefix="static/dist"
  node yo-oss.mjs yo_oss_upload --dir="dist" --prefix="static/dist" --unique=false
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  const { toolName, params } = parseArgs(argv);
  const name = toolName || 'yo_oss_upload';
  const fn = tools[name];
  if (!fn) {
    console.error(`Error: Unknown tool '${name}'`);
    printHelp();
    process.exit(1);
  }
  try {
    const result = await fn(params);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('yo-oss.mjs')) {
  main();
}

export default tools;
export { tools, yoOssUpload };