// Style resolution: reads token blocks embedded in references/style-*.md.
// The md files are the single source of truth for visual tokens.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const STYLES_DIR = path.join(SKILL_ROOT, "references");

export const STYLE_NAMES = {
  1: "Flat Icon", 2: "Dark Terminal", 3: "Blueprint", 4: "Notion Clean",
  5: "Glassmorphism", 6: "Claude Official", 7: "OpenAI Official", 8: "Dark Luxury",
  9: "C4 Review Canvas", 10: "Cloud Fabric", 11: "Event Transit", 12: "Ops Pulse",
};

export const FLOW_ALIASES = {
  main: "control", api: "control", control: "control", write: "write",
  read: "read", data: "data", async: "async", feedback: "feedback", neutral: "neutral",
};

export const MARKER_IDS = {
  control: "arrowA", write: "arrowB", read: "arrowC",
  data: "arrowE", async: "arrowF", feedback: "arrowG", neutral: "arrowH",
};

// style slug per asset filename (style-<id>-<slug>.md)
const STYLE_FILES = new Map();
for (const name of fs.readdirSync(STYLES_DIR)) {
  const match = name.match(/^style-(\d+)-([a-z0-9-]+)\.md$/);
  if (match) STYLE_FILES.set(Number(match[1]), name);
}

const _token = (value) =>
  String(value).trim().toLowerCase().replace(/_/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();

const STYLE_ALIASES = new Map();
for (const [styleId, styleName] of Object.entries(STYLE_NAMES)) {
  const id = Number(styleId);
  STYLE_ALIASES.set(_token(styleName), id);
  STYLE_ALIASES.set(`style ${id}`, id);
  STYLE_ALIASES.set(`风格 ${id}`, id);
  STYLE_ALIASES.set(`风格${id}`, id);
}
for (const [alias, id] of Object.entries({
  flat: 1, terminal: 2, "dark terminal": 2, notion: 4, glass: 5, claude: 6,
  "openai official": 7, "dark luxury": 8, luxury: 8,
  "review canvas": 9, "c4 canvas": 9, "c4 review": 9, "adr review canvas": 9,
  "architecture review board": 9, "c4 评审": 9, "c4 评审画布": 9, "adr 评审图": 9,
  "架构评审画布": 9, "职责边界评审图": 9,
  "cloud deployment": 10, "deployment topology": 10, "multi region deployment map": 10,
  "region vpc ownership map": 10, "cloud landing zone map": 10, "云部署拓扑": 10,
  "多区域部署图": 10, "region vpc 归属图": 10, "云 landing zone 图": 10,
  "event stream": 11, "event metro": 11, "event metro map": 11, "topic rail map": 11,
  "kafka topology": 11, "stream choreography map": 11, "事件轨道图": 11, "事件地铁图": 11,
  "topic 线路图": 11, "kafka 拓扑图": 11,
  sre: 12, observability: 12, "reliability pulse": 12, "incident investigation view": 12,
  "sre trace review": 12, "golden signals trace": 12, "运维脉冲图": 12, "可靠性脉冲": 12,
  "事故排查视图": 12, "sre trace 评审": 12, "黄金信号追踪图": 12,
})) {
  STYLE_ALIASES.set(_token(alias), id);
}

const profileCache = new Map();

const loadProfile = (styleIndex) => {
  if (profileCache.has(styleIndex)) return profileCache.get(styleIndex);
  const file = STYLE_FILES.get(styleIndex);
  if (!file) throw new Error(`Unsupported style: ${styleIndex}`);
  const content = fs.readFileSync(path.join(STYLES_DIR, file), "utf8");
  const match = content.match(/```json\s*\n([\s\S]*?)```/);
  if (!match) throw new Error(`style asset ${file} has no json token block`);
  const profile = JSON.parse(match[1]);
  profileCache.set(styleIndex, profile);
  return profile;
};

// Resolve numeric / name / slug / Chinese selectors; reject conflicts.
export const resolveStyleIndex = (data) => {
  const selectors = [];
  if (data.style !== null && data.style !== undefined) selectors.push(["style", data.style]);
  if (data.visual_theme !== null && data.visual_theme !== undefined) selectors.push(["visual_theme", data.visual_theme]);
  if (!selectors.length) return 1;

  const resolved = [];
  for (const [field, raw] of selectors) {
    if (typeof raw === "boolean") throw new Error(`STYLE_SELECTOR: ${field} must be a style id or name`);
    let styleId;
    if (Number.isInteger(raw)) {
      styleId = raw;
    } else {
      const text = String(raw).trim();
      if (/^\d+$/.test(text)) styleId = Number.parseInt(text, 10);
      else {
        const normalized = _token(text);
        if (!STYLE_ALIASES.has(normalized)) throw new Error(`STYLE_SELECTOR: unsupported ${field}: ${raw}`);
        styleId = STYLE_ALIASES.get(normalized);
      }
    }
    if (!STYLE_NAMES[styleId]) throw new Error(`STYLE_SELECTOR: unsupported ${field}: ${raw}`);
    resolved.push([field, styleId]);
  }

  if (new Set(resolved.map(([, id]) => id)).size > 1) {
    const details = resolved.map(([field, id]) => `${field}=${id}`).join(", ");
    throw new Error(`STYLE_SELECTOR_CONFLICT: ${details}`);
  }
  return resolved[0][1];
};

// Parse the style selector from input data and return a mutable profile copy.
export const parseStyle = (raw) => {
  const index = raw === null || raw === undefined ? 1 : resolveStyleIndex({ style: raw });
  if (!STYLE_NAMES[index]) throw new Error(`Unsupported style: ${raw}`);
  return [index, structuredClone(loadProfile(index))];
};

export const styleAssetFile = (styleIndex) => STYLE_FILES.get(styleIndex) ?? null;
