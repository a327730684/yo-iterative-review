// SVG assembly ported from generate-from-template.py.
// Paint order: defs → canvas → window controls → header meta → title →
// style signature → containers → arrows (routing order) → nodes → arrow
// labels → legend → blueprint block → footer. Composition gate is fatal.

import { createHash } from "node:crypto";
import * as geo from "./geometry.js";
import { FLOW_ALIASES, MARKER_IDS, STYLE_NAMES, parseStyle } from "./styles.js";
import { normalizeDiagram } from "./ir.js";
import { resolveContract, assessComposition, routeStretch } from "./quality.js";

const DEFAULT_VIEWBOX = {
  architecture: [960, 600], "data-flow": [960, 600], flowchart: [960, 640],
  sequence: [960, 700], comparison: [960, 620], timeline: [960, 520],
  "mind-map": [960, 620], agent: [960, 700], memory: [960, 720],
  "use-case": [960, 600], class: [960, 700], "state-machine": [960, 620],
  "er-diagram": [960, 680], "network-topology": [960, 620],
};

const RESERVED_DOM_IDS = new Set([
  ...Object.values(MARKER_IDS), "blueprint-title-block", "blueprintGrid", "cloudGradient", "cloudGrid",
  "footer", "glowBlue", "glowGreen", "glowOrange", "glowPurple", "legend", "legend-zone",
  "opsGradient", "opsGrid", "pulseGlow", "reviewGrid", "shadowGlass", "shadowSoft",
  "style-signature", "terminalGradient", "transitDots",
]);
const EDGE_DOM_SUFFIXES = ["-bridge-mask", "-critical-glow", "-direction", "-hop", "-label", "-rail-casing", "-review-stroke"];

const escapeText = (value) =>
  value === null || value === undefined
    ? ""
    : String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (value) => escapeText(value).replace(/"/g, "&quot;");
const safeIdentifier = (value, fallback) => {
  const cleaned = String(value ?? fallback).replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
};

const allocateDomIdentifier = (base, used, suffixes = []) => {
  let candidate = safeIdentifier(base, "element");
  let sequence = 2;
  const blocked = (id) => used.has(id) || suffixes.some((s) => used.has(id + s));
  while (blocked(candidate)) {
    candidate = `${safeIdentifier(base, "element")}-${sequence}`;
    sequence += 1;
  }
  used.add(candidate);
  for (const suffix of suffixes) used.add(candidate + suffix);
  return candidate;
};

const deterministicJitter = (seed, elementId, passIndex, amplitude = 1.5) => {
  const digest = createHash("sha256").update(`${seed}:${elementId}:${passIndex}`).digest();
  const unit = digest.readUInt32BE(0) / (2 ** 32 - 1);
  return geo.round2((unit * 2.0 - 1.0) * amplitude);
};

// ---- Node model ----

const nodeBounds = (data) => {
  const kind = String(data.kind ?? data.shape ?? "rect");
  const x = geo.toFloat(data.x);
  const y = geo.toFloat(data.y);
  if (kind === "circle") {
    const r = geo.toFloat(data.r, 50);
    return [x - r, y - r, x + r, y + r];
  }
  const width = geo.toFloat(data.width, 180);
  const height = geo.toFloat(data.height, 76);
  return [x, y, x + width, y + height];
};

const normalizeNode = (nodeData, fallbackId) => {
  const bounds = nodeBounds(nodeData);
  return {
    nodeId: String(nodeData.id ?? fallbackId),
    kind: String(nodeData.kind ?? nodeData.shape ?? "rect"),
    data: nodeData,
    bounds,
    cx: (bounds[0] + bounds[2]) / 2,
    cy: (bounds[1] + bounds[3]) / 2,
  };
};

const anchorOnSide = (node, side, offset = 0.0) => {
  const [left, top, right, bottom] = node.bounds;
  const s = String(side).toLowerCase();
  const safeX = Math.min(Math.max(node.cx + offset, left + 12), right - 12);
  const safeY = Math.min(Math.max(node.cy + offset, top + 12), bottom - 12);
  if (s === "left") return [left, safeY];
  if (s === "right") return [right, safeY];
  if (s === "top") return [safeX, top];
  if (s === "bottom") return [safeX, bottom];
  if (s === "top-left") return [left, top];
  if (s === "top-right") return [right, top];
  if (s === "bottom-left") return [left, bottom];
  if (s === "bottom-right") return [right, bottom];
  return [node.cx, node.cy];
};

const anchorPoint = (node, toward, port = null, offset = 0.0) => {
  if (port) return anchorOnSide(node, port, offset);
  const [left, top, right, bottom] = node.bounds;
  const dx = toward[0] - node.cx;
  const dy = toward[1] - node.cy;
  const width = right - left;
  const height = bottom - top;
  if (Math.abs(dx) * height >= Math.abs(dy) * width) return dx >= 0 ? [right, node.cy] : [left, node.cy];
  return dy >= 0 ? [node.cx, bottom] : [node.cx, top];
};

const inferredPort = (node, toward) => {
  const [left, top, right, bottom] = node.bounds;
  const dx = toward[0] - node.cx;
  const dy = toward[1] - node.cy;
  const width = right - left;
  const height = bottom - top;
  if (Math.abs(dx) * height >= Math.abs(dy) * width) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
};

// ---- Defs / canvas / title / meta ----

const renderDefs = (styleIndex, style) => {
  const markerSize = styleIndex === 4 ? "8" : styleIndex === 11 ? "12" : "10";
  const markerHeight = styleIndex === 4 ? "6" : styleIndex === 11 ? "9" : "7";
  const refX = styleIndex === 4 ? "7" : styleIndex === 11 ? "11" : "9";
  const refY = styleIndex === 4 ? "3" : styleIndex === 11 ? "4.5" : "3.5";
  const markerUnits = styleIndex === 11 ? ' markerUnits="userSpaceOnUse"' : "";
  const markerLines = [];
  for (const [key, color] of Object.entries(style.arrow_colors)) {
    const markerId = MARKER_IDS[key] ?? "arrowA";
    markerLines.push(
      `    <marker id="${markerId}" markerWidth="${markerSize}" markerHeight="${markerHeight}" ` +
      `refX="${refX}" refY="${refY}" orient="auto"${markerUnits}>`,
    );
    const points = styleIndex === 4 ? "0 0, 8 3, 0 6" : styleIndex === 11 ? "0 0, 12 4.5, 0 9" : "0 0, 10 3.5, 0 7";
    markerLines.push(`      <polygon points="${points}" fill="${color}"/>`);
    markerLines.push("    </marker>");
  }

  const filters = [];
  if (style.shadow) {
    filters.push(
      '    <filter id="shadowSoft" x="-20%" y="-20%" width="140%" height="160%">',
      '      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.12"/>',
      "    </filter>",
      '    <filter id="shadowGlass" x="-20%" y="-20%" width="140%" height="160%">',
      '      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#020617" flood-opacity="0.28"/>',
      "    </filter>",
    );
  }
  if (styleIndex === 3) {
    filters.push(
      '    <pattern id="blueprintGrid" width="32" height="32" patternUnits="userSpaceOnUse">',
      '      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#0ea5e9" stroke-opacity="0.12" stroke-width="1"/>',
      "    </pattern>",
    );
  }
  if (styleIndex === 2) {
    filters.push(
      '    <linearGradient id="terminalGradient" x1="0%" y1="0%" x2="100%" y2="100%">',
      '      <stop offset="0%" stop-color="#0f0f1a"/>',
      '      <stop offset="100%" stop-color="#1a1a2e"/>',
      "    </linearGradient>",
      '    <filter id="glowBlue" x="-30%" y="-30%" width="160%" height="160%">',
      '      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#3b82f6" flood-opacity="0.65"/>',
      "    </filter>",
      '    <filter id="glowPurple" x="-30%" y="-30%" width="160%" height="160%">',
      '      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#a855f7" flood-opacity="0.72"/>',
      "    </filter>",
      '    <filter id="glowGreen" x="-30%" y="-30%" width="160%" height="160%">',
      '      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#22c55e" flood-opacity="0.62"/>',
      "    </filter>",
      '    <filter id="glowOrange" x="-30%" y="-30%" width="160%" height="160%">',
      '      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#f97316" flood-opacity="0.62"/>',
      "    </filter>",
    );
  }
  if (styleIndex === 9) {
    filters.push(
      '    <pattern id="reviewGrid" width="24" height="24" patternUnits="userSpaceOnUse">',
      '      <circle cx="1" cy="1" r="0.8" fill="#8c7d68" fill-opacity="0.18"/>',
      "    </pattern>",
    );
  }
  if (styleIndex === 10) {
    filters.push(
      '    <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="100%" y2="100%">',
      '      <stop offset="0%" stop-color="#f8fcff"/>',
      '      <stop offset="100%" stop-color="#dfedf7"/>',
      "    </linearGradient>",
      '    <pattern id="cloudGrid" width="32" height="32" patternUnits="userSpaceOnUse">',
      '      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#7fa3c2" stroke-opacity="0.10" stroke-width="1"/>',
      "    </pattern>",
    );
  }
  if (styleIndex === 11) {
    filters.push(
      '    <pattern id="transitDots" width="28" height="28" patternUnits="userSpaceOnUse">',
      '      <circle cx="2" cy="2" r="0.9" fill="#8d867b" fill-opacity="0.12"/>',
      "    </pattern>",
    );
  }
  if (styleIndex === 12) {
    filters.push(
      '    <linearGradient id="opsGradient" x1="0%" y1="0%" x2="100%" y2="100%">',
      '      <stop offset="0%" stop-color="#07111f"/>',
      '      <stop offset="100%" stop-color="#0b1b2e"/>',
      "    </linearGradient>",
      '    <pattern id="opsGrid" width="36" height="36" patternUnits="userSpaceOnUse">',
      '      <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#38bdf8" stroke-opacity="0.055" stroke-width="1"/>',
      "    </pattern>",
      '    <filter id="pulseGlow" x="-30%" y="-30%" width="160%" height="160%">',
      '      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#f59e0b" flood-opacity="0.62"/>',
      "    </filter>",
    );
  }

  const styles = [
    `    text { font-family: ${style.font_family}; }`,
    `    .title { font-size: ${style.title_size}px; font-weight: 700; fill: ${style.title_fill}; }`,
    `    .subtitle { font-size: ${style.subtitle_size}px; font-weight: 500; fill: ${style.subtitle_fill}; }`,
    `    .section { font-size: 13px; font-weight: 700; fill: ${style.section_label_fill}; letter-spacing: 1.4px; }`,
    `    .section-sub { font-size: 12px; font-weight: 500; fill: ${style.section_sub_fill}; }`,
    `    .node-title { font-weight: 700; fill: ${style.text_primary}; }`,
    `    .node-sub { font-size: 12px; font-weight: 500; fill: ${style.text_secondary}; }`,
    `    .node-type { font-size: ${style.type_label_size}px; font-weight: 700; fill: ${style.type_label_fill}; letter-spacing: 0.08em; }`,
    `    .arrow-label { font-size: 12px; font-weight: 600; fill: ${style.arrow_label_fill}; }`,
    `    .legend { font-size: 12px; font-weight: 500; fill: ${style.legend_fill}; }`,
    `    .footnote { font-size: 12px; font-weight: 500; fill: ${style.text_muted}; }`,
    `    .metric-label { font-size: 8.5px; font-weight: 700; fill: ${style.text_muted}; text-transform: uppercase; }`,
    `    .metric-value { font-size: 9.5px; font-weight: 700; fill: ${style.text_primary}; }`,
  ];
  return ["  <defs>", ...markerLines, ...filters, "    <style>", ...styles, "    </style>", "  </defs>"].join("\n");
};

const renderCanvas = (styleIndex, style, width, height) => {
  const background = String(style.background);
  const rect = (role, fill) =>
    `  <rect data-graph-role="${role}" width="${width}" height="${height}" fill="${fill}"/>`;
  if (styleIndex === 2) return rect("background", "url(#terminalGradient)");
  if (styleIndex === 9) return [rect("background", background), rect("decoration", "url(#reviewGrid)")].join("\n");
  if (styleIndex === 10) return [rect("background", "url(#cloudGradient)"), rect("decoration", "url(#cloudGrid)")].join("\n");
  if (styleIndex === 11) return [rect("background", background), rect("decoration", "url(#transitDots)")].join("\n");
  if (styleIndex === 12) return [rect("background", "url(#opsGradient)"), rect("decoration", "url(#opsGrid)")].join("\n");
  return rect("background", background);
};

const titlePosition = (style, width) =>
  style.title_align === "left" ? [48.0, "start"] : [width / 2.0, "middle"];

const renderTitleBlock = (style, data, width) => {
  const title = escapeText(data.title ?? "Diagram");
  const subtitle = escapeText(data.subtitle ?? "");
  const [x, anchor] = titlePosition(style, width);
  if (anchor === "middle") {
    const parts = [`  <text x="${x}" y="56" text-anchor="${anchor}" class="title">${title}</text>`];
    let cursorY = 82;
    if (subtitle) {
      parts.push(`  <text x="${x}" y="${cursorY}" text-anchor="${anchor}" class="subtitle">${subtitle}</text>`);
      cursorY += 24;
    }
    return [parts.join("\n"), cursorY + 10];
  }
  const parts = [`  <text x="${x}" y="48" text-anchor="${anchor}" class="title">${title}</text>`];
  let cursorY = 72;
  if (subtitle) {
    parts.push(`  <text x="${x}" y="${cursorY}" text-anchor="${anchor}" class="subtitle">${subtitle}</text>`);
    cursorY += 18;
  }
  if (style.title_divider) {
    parts.push(
      `  <line x1="48" y1="${cursorY + 10}" x2="${width - 48}" y2="${cursorY + 10}" ` +
      `stroke="${style.section_stroke}" stroke-width="1"/>`,
    );
    cursorY += 26;
  }
  return [parts.join("\n"), cursorY + 8];
};

const renderWindowControls = (data, styleIndex, width) => {
  let controls = data.window_controls;
  if (!controls) return "";
  if (controls === true) controls = ["#ef4444", "#f59e0b", "#10b981"];
  if (styleIndex !== 2) return "";
  let cursorX = 20.0;
  const lines = [];
  for (const color of controls) {
    lines.push(`  <circle cx="${cursorX}" cy="20" r="5.5" fill="${color}"/>`);
    cursorX += 18;
  }
  return lines.join("\n");
};

const renderHeaderMeta = (data, style, width) => {
  const metaLeft = escapeText(data.meta_left ?? "");
  const metaCenter = escapeText(data.meta_center ?? "");
  const metaRight = escapeText(data.meta_right ?? "");
  if (!metaLeft && !metaCenter && !metaRight) return "";
  const fill = String(data.meta_fill ?? style.text_muted);
  const size = geo.toFloat(data.meta_size, 11);
  const lines = [];
  if (metaLeft) lines.push(`  <text x="28" y="24" font-size="${size}" font-weight="600" fill="${fill}">${metaLeft}</text>`);
  if (metaCenter) lines.push(`  <text x="${width / 2}" y="24" text-anchor="middle" font-size="${size}" font-weight="600" fill="${fill}">${metaCenter}</text>`);
  if (metaRight) lines.push(`  <text x="${width - 28}" y="24" text-anchor="end" font-size="${size}" font-weight="600" fill="${fill}">${metaRight}</text>`);
  return lines.join("\n");
};

// Domain fingerprint badge for the engineering styles (9-12).
const renderStyleSignature = (styleIndex, data, width) => {
  if (![9, 10, 11, 12].includes(styleIndex)) return "";
  const badgeWidth = 176.0;
  const badgeHeight = 34.0;
  const x = width - 48 - badgeWidth;
  const y = 22.0;
  if (styleIndex === 9) {
    const level = String(data.c4_level ?? "review").toUpperCase();
    const state = String(data.review_state ?? "REVIEW READY").toUpperCase();
    const topRaw = `C4 · ${level} VIEW`;
    const [topText, topSize] = geo.fitSingleLineText(topRaw, badgeWidth - 46, { preferred: 8.5, minimum: 6.2 });
    const [stateText, stateSize] = geo.fitSingleLineText(state, badgeWidth - 46, { preferred: 8, minimum: 6.2 });
    return [
      '  <g id="style-signature" data-graph-role="decoration" data-style-signature="c4-review-board">',
      `    <rect x="${x}" y="${y}" width="${badgeWidth}" height="${badgeHeight}" rx="7" fill="#fffdf7" stroke="#8c7d68" stroke-width="1.2" stroke-dasharray="6 4"/>`,
      `    <path d="M ${x + 12} ${y + 17} l 5 5 9 -11" fill="none" stroke="#365f56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      `    <text x="${x + 34}" y="${y + 14}" font-size="${topSize}" font-weight="800" fill="#8a6f43">${escapeText(topText)}</text>`,
      `    <text x="${x + 34}" y="${y + 27}" font-size="${stateSize}" font-weight="700" fill="#5f665f">${escapeText(stateText)}</text>`,
      "  </g>",
    ].join("\n");
  }
  if (styleIndex === 10) {
    const platform = String(data.platform_profile ?? "cloud").toUpperCase();
    const mode = String(data.deployment_mode ?? "DEPLOYMENT MAP").toUpperCase();
    const regions = (data.containers ?? []).filter(
      (c) => c && typeof c === "object" && c.deployment_kind === "region",
    ).length;
    const topRaw = `${platform} · ${regions} REGIONS`;
    const [topText, topSize] = geo.fitSingleLineText(topRaw, badgeWidth - 55, { preferred: 8.5, minimum: 6.2 });
    const [modeText, modeSize] = geo.fitSingleLineText(mode, badgeWidth - 55, { preferred: 8, minimum: 6.2 });
    return [
      '  <g id="style-signature" data-graph-role="decoration" data-style-signature="cloud-ownership-map">',
      `    <rect x="${x}" y="${y}" width="${badgeWidth}" height="${badgeHeight}" rx="9" fill="#ffffff" fill-opacity="0.82" stroke="#7fa3c2" stroke-width="1.1"/>`,
      `    <rect x="${x + 11}" y="${y + 9}" width="14" height="14" rx="4" fill="#dbeafe" stroke="#2563eb" stroke-width="1"/>`,
      `    <rect x="${x + 20}" y="${y + 13}" width="14" height="14" rx="4" fill="#dcfce7" stroke="#059669" stroke-width="1"/>`,
      `    <text x="${x + 43}" y="${y + 14}" font-size="${topSize}" font-weight="800" fill="#315d7e">${escapeText(topText)}</text>`,
      `    <text x="${x + 43}" y="${y + 27}" font-size="${modeSize}" font-weight="700" fill="#52718d">${escapeText(modeText)}</text>`,
      "  </g>",
    ].join("\n");
  }
  if (styleIndex === 11) {
    const topics = data.topics;
    const lineCount = Array.isArray(topics) ? topics.length : 0;
    const lineCode = String(data.line_code ?? "EVENT METRO").toUpperCase();
    const signatureWidth = 226.0;
    const signatureX = width - 48 - signatureWidth;
    const [lineCodeText, lineCodeSize] = geo.fitSingleLineText(lineCode, signatureWidth - 58, { preferred: 8.5, minimum: 6.2 });
    const detailRaw = `${lineCount} TOPIC LINES · DECLARED STOPS`;
    const [detailText, detailSize] = geo.fitSingleLineText(detailRaw, signatureWidth - 58, { preferred: 8, minimum: 6.2 });
    return [
      '  <g id="style-signature" data-graph-role="decoration" data-style-signature="event-metro-map">',
      `    <rect x="${signatureX}" y="${y}" width="${signatureWidth}" height="${badgeHeight}" rx="7" fill="#17213c" stroke="#514c43" stroke-width="1"/>`,
      `    <line x1="${signatureX + 12}" y1="${y + 17}" x2="${signatureX + 36}" y2="${y + 17}" stroke="#e4475b" stroke-width="3"/>`,
      `    <circle cx="${signatureX + 18}" cy="${y + 17}" r="4" fill="#fbf7ee" stroke="#e4475b" stroke-width="2"/>`,
      `    <circle cx="${signatureX + 31}" cy="${y + 17}" r="4" fill="#fbf7ee" stroke="#e4475b" stroke-width="2"/>`,
      `    <text x="${signatureX + 46}" y="${y + 14}" font-size="${lineCodeSize}" font-weight="800" fill="#ffffff">${escapeText(lineCodeText)}</text>`,
      `    <text x="${signatureX + 46}" y="${y + 27}" font-size="${detailSize}" font-weight="700" fill="#f3d5d9">${escapeText(detailText)}</text>`,
      "  </g>",
    ].join("\n");
  }
  // style 12
  const services = (data.nodes ?? []).filter((n) => n && typeof n === "object" && n.ops_role === "service");
  const rank = { unknown: 0, ok: 1, warn: 2, critical: 3 };
  let worst = "unknown";
  for (const node of services) {
    const status = String(node.status ?? "unknown");
    if ((rank[status] ?? 0) > (rank[worst] ?? 0)) worst = status;
  }
  let windowText = String(data.observation_window ?? "");
  if (!windowText) {
    for (const node of services) {
      const signals = node.signals;
      if (signals && typeof signals === "object") {
        const first = Object.values(signals).find((v) => v && typeof v === "object");
        if (first) { windowText = String(first.window ?? ""); break; }
      }
    }
  }
  const statusColor = { ok: "#22c55e", warn: "#f59e0b", critical: "#f43f5e", unknown: "#64748b" }[worst] ?? "#64748b";
  const topRaw = `LIVE · ${(windowText.toUpperCase() || "WINDOW")}`;
  const detailRaw = `${worst.toUpperCase()} · CORRELATED TRACE`;
  const [topText, topSize] = geo.fitSingleLineText(topRaw, badgeWidth - 70, { preferred: 8.5, minimum: 6.2 });
  const [detailText, detailSize] = geo.fitSingleLineText(detailRaw, badgeWidth - 70, { preferred: 8, minimum: 6.2 });
  return [
    '  <g id="style-signature" data-graph-role="decoration" data-style-signature="ops-live-investigation">',
    `    <rect x="${x}" y="${y}" width="${badgeWidth}" height="${badgeHeight}" rx="7" fill="#0d1b2a" stroke="#29435d" stroke-width="1.1"/>`,
    `    <circle cx="${x + 15}" cy="${y + 17}" r="4" fill="${statusColor}"/>`,
    `    <path d="M ${x + 25} ${y + 18} h 5 l 3 -6 5 12 4 -8 h 7" fill="none" stroke="#38bdf8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `    <text x="${x + 58}" y="${y + 14}" font-size="${topSize}" font-weight="800" fill="#eff6ff">${escapeText(topText)}</text>`,
    `    <text x="${x + 58}" y="${y + 27}" font-size="${detailSize}" font-weight="700" fill="${statusColor}">${escapeText(detailText)}</text>`,
    "  </g>",
  ].join("\n");
};

const renderBlueprintTitleBlock = (data, style, styleIndex, width, height) => {
  if (styleIndex !== 3) return ["", null];
  const block = data.blueprint_title_block;
  if (!block) return ["", null];
  const blockWidth = geo.toFloat(block.width, 256);
  const blockHeight = geo.toFloat(block.height, 92);
  const x = geo.toFloat(block.x, width - blockWidth - 28);
  const y = geo.toFloat(block.y, height - blockHeight - 18);
  const title = escapeText(block.title ?? data.title ?? "");
  const subtitle = escapeText(block.subtitle ?? "SYSTEM ARCHITECTURE");
  const leftCaption = escapeText(block.left_caption ?? "REV: 1.0");
  const centerCaption = escapeText(block.center_caption ?? "AUTO-GENERATED");
  const rightCaption = escapeText(block.right_caption ?? "DWG: ARCH-001");
  const stroke = String(block.stroke ?? style.section_stroke);
  const fill = String(block.fill ?? "#0b3552");
  const titleFill = String(block.title_fill ?? style.text_primary);
  const subFill = String(block.subtitle_fill ?? style.section_label_fill);
  const mutedFill = String(block.muted_fill ?? style.text_muted);
  const footerTop = y + 54;
  const columnWidth = blockWidth / 3;
  const captionWidth = Math.max(24.0, columnWidth - 12);

  const captionSize = (raw) => {
    const estimated = geo.estimateTextWidth(raw, 9.5);
    return geo.round2(Math.max(6.0, Math.min(9.5, (9.5 * captionWidth) / Math.max(estimated, 1.0))));
  };

  const captionY = Math.min(y + blockHeight - 4, footerTop + Math.max(12.0, blockHeight - 54) / 2 + 3);
  const captions = [
    [leftCaption, x + columnWidth / 2, mutedFill],
    [centerCaption, x + blockWidth / 2, subFill],
    [rightCaption, x + blockWidth - columnWidth / 2, mutedFill],
  ];
  const lines = [
    `  <rect x="${x}" y="${y}" width="${blockWidth}" height="${blockHeight}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`,
    `  <line x1="${x}" y1="${y + 18}" x2="${x + blockWidth}" y2="${y + 18}" stroke="${stroke}" stroke-width="1"/>`,
    `  <line x1="${x}" y1="${y + 54}" x2="${x + blockWidth}" y2="${y + 54}" stroke="${stroke}" stroke-width="1"/>`,
    `  <line x1="${x + columnWidth}" y1="${footerTop}" x2="${x + columnWidth}" y2="${y + blockHeight}" stroke="${stroke}" stroke-width="0.7"/>`,
    `  <line x1="${x + 2 * columnWidth}" y1="${footerTop}" x2="${x + 2 * columnWidth}" y2="${y + blockHeight}" stroke="${stroke}" stroke-width="0.7"/>`,
    `  <text x="${x + blockWidth / 2}" y="${y + 13}" text-anchor="middle" font-size="10" font-weight="600" fill="${mutedFill}">${subtitle}</text>`,
    `  <text x="${x + blockWidth / 2}" y="${y + 42}" text-anchor="middle" font-size="18" font-weight="700" fill="${titleFill}">${title}</text>`,
    ...captions.map(
      ([caption, captionX, captionFill]) =>
        `  <text x="${captionX}" y="${captionY}" text-anchor="middle" font-size="${captionSize(caption)}" font-weight="600" fill="${captionFill}">${caption}</text>`,
    ),
  ];
  return [lines.join("\n"), geo.rectangleBounds(x - 6, y - 6, blockWidth + 12, blockHeight + 12)];
};

// ---- Containers ----

const sectionHeaderText = (container, style) => {
  let text;
  if (container.header_text) {
    text = String(container.header_text ?? "");
  } else {
    const label = String(container.label ?? "");
    const prefix = String(container.header_prefix ?? "").trim();
    const separator = String(container.header_separator ?? (prefix ? " // " : ""));
    text = prefix ? `${prefix}${separator}${label}` : label;
  }
  if (style.section_upper && !container.preserve_case) text = text.toUpperCase();
  return text;
};

const renderSection = (container, style) => {
  const x = geo.toFloat(container.x);
  const y = geo.toFloat(container.y);
  const width = geo.toFloat(container.width);
  const height = geo.toFloat(container.height);
  const rx = geo.toFloat(container.rx, style.name === "Notion Clean" ? 4 : 16);
  const fill = String(container.fill ?? style.section_fill);
  const stroke = String(container.stroke ?? style.section_stroke);
  const dash = String(container.stroke_dasharray ?? style.section_dash);
  const label = sectionHeaderText(container, style);
  const subtitle = String(container.subtitle ?? "");
  const sideLabel = String(container.side_label ?? "").trim();
  const sideLabelFill = String(container.side_label_fill ?? style.text_secondary);
  const sideLabelSize = geo.toFloat(container.side_label_size, 14);
  const sideLabelWeight = String(container.side_label_weight ?? "600");
  const sideLabelAnchor = String(container.side_label_anchor ?? "end");
  const head =
    `  <rect data-graph-role="container" x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="1.4"` + (dash ? ` stroke-dasharray="${dash}"` : "") + "/>";
  const lines = [head];
  const treatment = String(style.canvas_treatment ?? "");
  if (treatment === "review") {
    const seed = container._rough_seed ?? 0;
    const elementId = container.id ?? label ?? "container";
    const dx = deterministicJitter(seed, elementId, 1);
    const dy = deterministicJitter(seed, elementId, 2);
    lines.push(
      `  <rect data-graph-role="decoration" x="${x + 2 + dx}" y="${y + 2 + dy}" width="${width - 4}" height="${height - 4}" ` +
      `rx="${Math.max(3, rx - 1)}" fill="none" stroke="${stroke}" stroke-width="0.9" stroke-dasharray="13 7" opacity="0.42"/>`,
    );
  } else if (treatment === "cloud" && container.deployment_kind) {
    const deploymentKind = String(container.deployment_kind);
    const badge = escapeText(deploymentKind.toUpperCase());
    const badgeWidth = Math.max(54.0, geo.estimateTextWidth(String(container.deployment_kind), 9) + 18);
    const spineColor = { global: "#2563eb", region: "#0891b2", network: "#7c3aed" }[deploymentKind] ?? "#7fa3c2";
    lines.push(
      `  <rect data-graph-role="decoration" x="${x + width - badgeWidth - 14}" y="${y + 10}" width="${badgeWidth}" height="18" rx="9" fill="#dbeafe" stroke="#93c5fd" stroke-width="0.8"/>`,
    );
    lines.push(
      `  <text data-graph-role="decoration" x="${x + width - badgeWidth / 2 - 14}" y="${y + 22.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#315d7e">${badge}</text>`,
    );
    lines.push(
      `  <line data-graph-role="decoration" x1="${x + 8}" y1="${y + 42}" x2="${x + 8}" y2="${y + height - 14}" stroke="${spineColor}" stroke-width="2.2" stroke-linecap="round" opacity="0.72"/>`,
    );
  } else if (treatment === "transit") {
    lines.push(
      `  <line data-graph-role="decoration" x1="${x + 18}" y1="${y + 34}" x2="${x + width - 18}" y2="${y + 34}" stroke="${stroke}" stroke-width="1" stroke-dasharray="2 7" opacity="0.35"/>`,
    );
  } else if (treatment === "ops") {
    lines.push(
      `  <line data-graph-role="decoration" x1="${x + 14}" y1="${y + 34}" x2="${x + width - 14}" y2="${y + 34}" stroke="#38bdf8" stroke-width="1" opacity="0.16"/>`,
    );
    if (String(container.id ?? "").toLowerCase().includes("trace")) {
      const rulerLeft = x + width - 244;
      const rulerRight = x + width - 24;
      lines.push(
        `  <line data-graph-role="decoration" x1="${rulerLeft}" y1="${y + 22}" x2="${rulerRight}" y2="${y + 22}" stroke="#38bdf8" stroke-width="1" opacity="0.42"/>`,
      );
      for (let index = 0; index < 5; index++) {
        const tickX = rulerLeft + ((rulerRight - rulerLeft) * index) / 4;
        lines.push(
          `  <line data-graph-role="decoration" x1="${tickX}" y1="${y + 18}" x2="${tickX}" y2="${y + 26}" stroke="#38bdf8" stroke-width="1" opacity="0.52"/>`,
        );
        lines.push(
          `  <text data-graph-role="decoration" x="${tickX}" y="${y + 14}" text-anchor="middle" font-size="7" font-weight="700" fill="#6f8ba5">${index * 25}%</text>`,
        );
      }
    }
  }
  if (label) lines.push(`  <text x="${x + 18}" y="${y + 24}" class="section">${escapeText(label)}</text>`);
  if (subtitle) lines.push(`  <text x="${x + 18}" y="${y + 44}" class="section-sub">${escapeText(subtitle)}</text>`);
  if (sideLabel) {
    const sideX = geo.toFloat(container.side_label_x, Math.max(28, x - 18));
    const sideY = geo.toFloat(container.side_label_y, y + height / 2);
    lines.push(
      `  <text x="${sideX}" y="${sideY}" text-anchor="${sideLabelAnchor}" dominant-baseline="middle" font-size="${sideLabelSize}" font-weight="${sideLabelWeight}" fill="${sideLabelFill}">${escapeText(sideLabel)}</text>`,
    );
  }
  return lines.join("\n");
};

const containerHeaderBounds = (container, style) => {
  const label = (style ? sectionHeaderText(container, style) : String(container.header_text ?? "") || String(container.label ?? "")).trim();
  const subtitle = String(container.subtitle ?? "").trim();
  if (!label && !subtitle) return null;
  const x = geo.toFloat(container.x);
  const y = geo.toFloat(container.y);
  const width = geo.toFloat(container.width);
  const headerHeight = geo.toFloat(container.header_height, subtitle ? 54 : 30);
  const labelWidth = label ? geo.estimateTextWidth(label, 13) : 0.0;
  const subtitleWidth = subtitle ? geo.estimateTextWidth(subtitle, 12) : 0.0;
  const reservedWidth = Math.min(width - 12, Math.max(labelWidth, subtitleWidth) + 30);
  return geo.rectangleBounds(x + 8, y + 6, reservedWidth, headerHeight);
};

// ---- Node rendering ----

const renderTags = (node, x, y, style) => {
  const tags = node.tags ?? [];
  if (!tags.length) return [];
  let cursorX = x;
  const lines = [];
  for (const tag of tags) {
    const label = escapeText(tag.label ?? "");
    const width = Math.max(62, String(tag.label ?? "").length * 8 + 18);
    const fill = tag.fill ?? "#eff6ff";
    const stroke = tag.stroke ?? "#bfdbfe";
    const textFill = tag.text_fill ?? style.arrow_colors.read;
    lines.push(`  <rect x="${cursorX}" y="${y}" width="${width}" height="16" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
    lines.push(`  <text x="${cursorX + width / 2}" y="${y + 11.5}" text-anchor="middle" font-size="11" font-weight="500" fill="${textFill}">${label}</text>`);
    cursorX += width + 8;
  }
  return lines;
};

const renderRectNode = (node, style, kind) => {
  const x = geo.toFloat(node.x);
  const y = geo.toFloat(node.y);
  const width = geo.toFloat(node.width, 180);
  const height = geo.toFloat(node.height, 76);
  const rx = geo.toFloat(node.rx, style.node_radius);
  const fill = String(node.fill ?? style.node_fill);
  const stroke = String(node.stroke ?? style.node_stroke);
  const strokeWidth = geo.toFloat(node.stroke_width, kind !== "rect" ? 2.0 : 1.8);
  let filterAttr = "";
  if (node.filter) {
    filterAttr = ` filter="url(#${node.filter})"`;
  } else if (node.glow) {
    const glowMap = { blue: "glowBlue", purple: "glowPurple", green: "glowGreen", orange: "glowOrange" };
    if (glowMap[node.glow]) filterAttr = ` filter="url(#${glowMap[node.glow]})"`;
  } else if (style.node_shadow && !node.flat) {
    filterAttr = ` filter="${style.node_shadow}"`;
  }
  const titleText = String(node.label ?? "");
  const title = escapeText(titleText);
  const subtitle = escapeText(node.sublabel ?? "");
  const typeLabel = escapeText(node.type_label ?? "");
  const accentFill = node.accent_fill;
  const lines = [];

  if (kind === "double_rect") {
    lines.push(`  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`);
    lines.push(`  <rect x="${x + 6}" y="${y + 6}" width="${width - 12}" height="${height - 12}" rx="${Math.max(rx - 3, 4)}" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="0.65"/>`);
  } else if (kind === "terminal") {
    lines.push(`  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`);
    lines.push(`  <rect x="${x}" y="${y}" width="${width}" height="18" rx="${rx}" fill="${node.header_fill ?? "#1f2937"}" opacity="0.95"/>`);
    const headerColors = node.header_dots ?? ["#ef4444", "#f59e0b", "#10b981"];
    headerColors.forEach((color, idx) => lines.push(`  <circle cx="${x + 16 + idx * 14}" cy="${y + 9}" r="4" fill="${color}"/>`));
    lines.push(`  <text x="${x + 18}" y="${y + 44}" font-size="28" font-weight="700" fill="${node.prompt_fill ?? "#10b981"}">$</text>`);
    lines.push(`  <text x="${x + 38}" y="${y + 44}" font-size="22" font-weight="500" fill="${style.text_secondary}">_</text>`);
  } else if (kind === "document") {
    const fold = Math.min(18, width * 0.18, height * 0.22);
    const path = `M ${x} ${y} L ${x + width - fold} ${y} L ${x + width} ${y + fold} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
    lines.push(`  <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`);
    lines.push(`  <path d="M ${x + width - fold} ${y} L ${x + width - fold} ${y + fold} L ${x + width} ${y + fold}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`);
    for (let idx = 0; idx < 4; idx++) {
      const lineY = y + 26 + idx * 14;
      lines.push(`  <line x1="${x + 18}" y1="${lineY}" x2="${x + width - 28}" y2="${lineY}" stroke="${node.line_stroke ?? "#c4b5fd"}" stroke-width="1.2"/>`);
    }
  } else if (kind === "folder") {
    const tabW = Math.min(54, width * 0.34);
    const tabH = 18;
    const path = `M ${x} ${y + tabH} L ${x + tabW * 0.4} ${y + tabH} L ${x + tabW * 0.58} ${y} L ${x + tabW} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
    lines.push(`  <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`);
    for (let idx = 0; idx < 3; idx++) {
      const lineY = y + 42 + idx * 14;
      lines.push(`  <line x1="${x + 22}" y1="${lineY}" x2="${x + width - 22}" y2="${lineY}" stroke="${node.line_stroke ?? stroke}" stroke-opacity="0.35" stroke-width="1.2"/>`);
    }
  } else if (kind === "hexagon") {
    const inset = 22;
    const path = `M ${x + inset} ${y} L ${x + width - inset} ${y} L ${x + width} ${y + height / 2} L ${x + width - inset} ${y + height} L ${x + inset} ${y + height} L ${x} ${y + height / 2} Z`;
    lines.push(`  <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`);
  } else if (kind === "speech") {
    const tail = 18;
    const path = (
      `M ${x + rx} ${y} L ${x + width - rx} ${y} Q ${x + width} ${y} ${x + width} ${y + rx} ` +
      `L ${x + width} ${y + height - rx} Q ${x + width} ${y + height} ${x + width - rx} ${y + height} ` +
      `L ${x + 26} ${y + height} L ${x + 12} ${y + height + tail} L ${x + 16} ${y + height} ` +
      `L ${x + rx} ${y + height} Q ${x} ${y + height} ${x} ${y + height - rx} ` +
      `L ${x} ${y + rx} Q ${x} ${y} ${x + rx} ${y} Z`
    );
    lines.push(`  <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`);
  } else {
    lines.push(`  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`);
  }

  if (accentFill && kind === "icon_box") {
    lines.push(`  <rect x="${x + 12}" y="${y + 12}" width="${width - 24}" height="${height - 24}" rx="${Math.max(rx - 4, 4)}" fill="${accentFill}" opacity="0.9"/>`);
  }

  if (kind === "user_avatar") {
    const circleFill = node.icon_fill ?? "#dbeafe";
    const iconStroke = node.icon_stroke ?? stroke;
    const cx = x + 26;
    const cy = y + height / 2;
    lines.push(`  <circle cx="${cx}" cy="${cy}" r="18" fill="${circleFill}" stroke="${iconStroke}" stroke-width="1.6"/>`);
    lines.push(`  <circle cx="${cx}" cy="${cy - 6}" r="5" fill="${iconStroke}"/>`);
    lines.push(`  <path d="M ${cx - 10} ${cy + 11} Q ${cx} ${cy + 2} ${cx + 10} ${cy + 11}" fill="none" stroke="${iconStroke}" stroke-width="2"/>`);
  }

  if (kind === "bot") {
    const cx = x + width / 2;
    const cy = y + height / 2 + 2;
    const bodyFill = node.body_fill ?? "#1e293b";
    const accent = node.accent_fill ?? "#34d399";
    lines.push(`  <rect x="${cx - 42}" y="${cy - 32}" width="84" height="84" rx="18" fill="${bodyFill}" stroke="#334155" stroke-width="1.8"${filterAttr}/>`);
    lines.push(`  <rect x="${cx - 26}" y="${cy - 16}" width="52" height="22" rx="6" fill="#0f172a" stroke="#475569" stroke-width="1.2"/>`);
    lines.push(`  <circle cx="${cx - 12}" cy="${cy - 5}" r="5" fill="${accent}"/>`);
    lines.push(`  <circle cx="${cx + 12}" cy="${cy - 5}" r="5" fill="${accent}"/>`);
    lines.push(`  <rect x="${cx - 14}" y="${cy + 14}" width="28" height="6" rx="3" fill="#334155"/>`);
    lines.push(`  <line x1="${cx}" y1="${cy - 36}" x2="${cx}" y2="${cy - 50}" stroke="${accent}" stroke-width="3"/>`);
    lines.push(`  <circle cx="${cx}" cy="${cy - 54}" r="5" fill="${accent}"/>`);
  }

  if (kind === "circle_cluster") {
    const r = Math.min(width, height) / 4.0;
    const centers = [
      [x + width * 0.36, y + height * 0.56],
      [x + width * 0.58, y + height * 0.45],
      [x + width * 0.74, y + height * 0.58],
    ];
    for (const [cx, cy] of centers) {
      lines.push(`  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`);
    }
  }

  const typeOffset = y + 18;
  let titleY = y + height / 2 - (typeLabel && !["terminal", "bot"].includes(kind) ? 4 : 0);
  if (kind === "document" || kind === "folder") titleY = y + height + 26;
  else if (kind === "circle_cluster") titleY = y + height / 2 + 8;
  else if (kind === "bot") titleY = y + height + 22;
  else if (kind === "user_avatar") titleY = y + height / 2 + 6;

  if (typeLabel) {
    lines.push(`  <text x="${x + (kind === "user_avatar" ? 54 : width / 2)}" y="${typeOffset}" text-anchor="middle" class="node-type">${typeLabel}</text>`);
    if (!["document", "folder", "circle_cluster", "bot"].includes(kind)) titleY += 10;
  }

  let titleX = x + width / 2;
  let textAnchor = "middle";
  if (kind === "user_avatar") { titleX = x + 64; textAnchor = "start"; }
  if (kind === "terminal") titleY = y + height - 14;
  const titleSize = geo.toFloat(node.title_size, geo.fittedTextSize(titleText, width - (kind === "double_rect" ? 32 : 24)));
  lines.push(`  <text x="${titleX}" y="${titleY}" text-anchor="${textAnchor}" class="node-title" font-size="${titleSize}">${title}</text>`);

  if (subtitle) {
    let subY = titleY + 22;
    if (kind === "document") { subY = y + height + 44; }
    if (kind === "folder") subY = y + height + 44;
    if (kind === "circle_cluster") subY = y + height / 2 + 28;
    if (kind === "bot") subY = y + height + 42;
    if (kind === "terminal") subY = y + height + 20;
    lines.push(`  <text x="${titleX}" y="${subY}" text-anchor="${textAnchor}" class="node-sub">${subtitle}</text>`);
  }

  if (node.tags) {
    let tagY = y + height - 20;
    if (["document", "folder", "circle_cluster", "bot", "terminal"].includes(kind)) tagY = y + height + 52;
    lines.push(...renderTags(node, x + 18, tagY, style));
  }

  return lines.join("\n");
};

const renderCylinder = (node, style) => {
  const x = geo.toFloat(node.x);
  const y = geo.toFloat(node.y);
  const width = geo.toFloat(node.width, 160);
  const height = geo.toFloat(node.height, 120);
  const rx = width / 2;
  const ry = Math.min(18, height / 8);
  const fill = String(node.fill ?? "#ecfdf5");
  const stroke = String(node.stroke ?? "#10b981");
  const strokeWidth = geo.toFloat(node.stroke_width, 2.2);
  const labelText = String(node.label ?? "");
  const label = escapeText(labelText);
  const subtitle = escapeText(node.sublabel ?? "");
  const lines = [
    `  <ellipse cx="${x + width / 2}" cy="${y + ry}" rx="${rx / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
    `  <rect x="${x}" y="${y + ry}" width="${width}" height="${height - 2 * ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
    `  <ellipse cx="${x + width / 2}" cy="${y + height - ry}" rx="${rx / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  ];
  // Decorative grid ellipses only when they cannot strike through the label.
  if (height >= 90) {
    lines.push(
      `  <ellipse cx="${x + width / 2}" cy="${y + height * 0.38}" rx="${rx / 2}" ry="${ry}" fill="none" stroke="${stroke}" stroke-opacity="0.45" stroke-width="1.2"/>`,
      `  <ellipse cx="${x + width / 2}" cy="${y + height * 0.6}" rx="${rx / 2}" ry="${ry}" fill="none" stroke="${stroke}" stroke-opacity="0.25" stroke-width="1.2"/>`,
    );
  }
  lines.push(
    `  <text x="${x + width / 2}" y="${y + height / 2 - 6}" text-anchor="middle" class="node-title" font-size="${geo.toFloat(node.title_size, geo.fittedTextSize(labelText, width - 24))}">${label}</text>`,
  );
  if (subtitle) {
    // Clamp above the bottom cap's upper arc so it cannot strike the text.
    const subY = Math.min(y + height / 2 + 18, y + height - 2 * ry - 3);
    lines.push(`  <text x="${x + width / 2}" y="${subY}" text-anchor="middle" class="node-sub">${subtitle}</text>`);
  }
  return lines.join("\n");
};

const renderNode = (node, style) => {
  const kind = String(node.kind ?? node.shape ?? "rect");
  if (kind === "cylinder") return renderCylinder(node, style);
  return renderRectNode(node, style, kind);
};

// ---- Arrows ----

const colorForFlow = (style, arrowData) => {
  if (arrowData.color) return String(arrowData.color);
  const flow = FLOW_ALIASES[String(arrowData.flow ?? "control").toLowerCase()] ?? "control";
  return String(style.arrow_colors[flow]);
};

const markerForColor = (style, color, arrowData) => {
  if (arrowData.marker) return `url(#${arrowData.marker})`;
  for (const [name, token] of Object.entries(style.arrow_colors)) {
    if (token === color) return `url(#${MARKER_IDS[name] ?? "arrowA"})`;
  }
  return "url(#arrowA)";
};

const renderLabelBadge = (x, y, text, style, labelStyle = "offset") => {
  const width = Math.max(36.0, geo.estimateTextWidth(text, 12) + 14);
  const parts = [];
  if (labelStyle === "badge") {
    parts.push(
      `  <rect x="${geo.round2(x - width / 2)}" y="${geo.round2(y - 10)}" width="${width}" height="20" rx="6" fill="${style.arrow_label_bg}" opacity="${style.arrow_label_opacity}"/>`,
    );
  }
  parts.push(`  <text x="${geo.round2(x)}" y="${geo.round2(y + 4)}" text-anchor="middle" class="arrow-label">${escapeText(text)}</text>`);
  return parts.join("\n");
};

const estimateDualLabelBounds = (x, y, primary, secondary) => {
  const width = Math.max(42.0, geo.estimateTextWidth(primary, 11.5) + 16, geo.estimateTextWidth(secondary, 8.5) + 16);
  return geo.rectangleBounds(x - width / 2, y - 16, width, 32);
};

const renderDualLabelBadge = (x, y, primary, secondary, style) => {
  const width = Math.max(42.0, geo.estimateTextWidth(primary, 11.5) + 16, geo.estimateTextWidth(secondary, 8.5) + 16);
  return [
    `  <rect x="${geo.round2(x - width / 2)}" y="${geo.round2(y - 16)}" width="${geo.round2(width)}" height="32" rx="7" fill="${style.arrow_label_bg}" opacity="${style.arrow_label_opacity}"/>`,
    `  <text x="${geo.round2(x)}" y="${geo.round2(y - 1)}" text-anchor="middle" class="arrow-label" font-size="11.5">${escapeText(primary)}</text>`,
    `  <text x="${geo.round2(x)}" y="${geo.round2(y + 11)}" text-anchor="middle" font-size="8.5" font-weight="800" fill="${style.type_label_fill}">[${escapeText(secondary)}]</text>`,
  ].join("\n");
};

// Fan out multiple edges that share one (node, port) so endpoints don't stack.
const prepareArrows = (arrows, nodeMap) => {
  const prepared = arrows.map((arrow) => structuredClone(arrow));
  const endpointGroups = new Map();

  prepared.forEach((arrow, index) => {
    const edgeId = String(arrow.id ?? `edge-${String(index).padStart(3, "0")}`);
    arrow._edge_id = edgeId;
    arrow._edge_dom_id = String(arrow._dom_id || safeIdentifier(edgeId, `edge-${String(index).padStart(3, "0")}`));
    const source = arrow.source ? nodeMap.get(String(arrow.source)) : null;
    const target = arrow.target ? nodeMap.get(String(arrow.target)) : null;
    const startHint = [geo.toFloat(arrow.x1), geo.toFloat(arrow.y1)];
    const endHint = [geo.toFloat(arrow.x2), geo.toFloat(arrow.y2)];

    if (source) {
      const toward = target === null ? endHint : [target.cx, target.cy];
      const sourcePort = String(arrow.source_port || inferredPort(source, toward)).toLowerCase();
      arrow._resolved_source_port = sourcePort;
      const key = `${source.nodeId}|${sourcePort}`;
      if (!endpointGroups.has(key)) endpointGroups.set(key, []);
      endpointGroups.get(key).push([index, "source", edgeId]);
    }
    if (target) {
      const toward = source === null ? startHint : [source.cx, source.cy];
      const targetPort = String(arrow.target_port || inferredPort(target, toward)).toLowerCase();
      arrow._resolved_target_port = targetPort;
      const key = `${target.nodeId}|${targetPort}`;
      if (!endpointGroups.has(key)) endpointGroups.set(key, []);
      endpointGroups.get(key).push([index, "target", edgeId]);
    }
  });

  for (const [key, endpoints] of [...endpointGroups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const [nodeId, port] = key.split("|");
    const node = nodeMap.get(nodeId);
    const span = ["left", "right"].includes(port)
      ? node.bounds[3] - node.bounds[1]
      : node.bounds[2] - node.bounds[0];
    const ordered = [...endpoints].sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
    const count = ordered.length;
    const usableSpan = Math.max(0.0, span - 24.0);
    if (count > 1 && usableSpan / (count - 1) < 6.0) {
      throw new Error(`PORT_CAPACITY: ${nodeId}.${port} cannot fit ${count} distinct endpoints`);
    }
    const spacing = count <= 1 ? 0.0 : Math.min(18.0, usableSpan / (count - 1));
    ordered.forEach(([arrowIndex, endpoint], position) => {
      const offset = (position - (count - 1) / 2.0) * spacing;
      prepared[arrowIndex][`_${endpoint}_port_offset`] = geo.round2(offset);
    });
  }
  return prepared;
};

const routeHintPoints = (arrow, nodeMap) => {
  const source = arrow.source ? nodeMap.get(String(arrow.source)) : null;
  const target = arrow.target ? nodeMap.get(String(arrow.target)) : null;
  const startHint = [geo.toFloat(arrow.x1), geo.toFloat(arrow.y1)];
  const endHint = [geo.toFloat(arrow.x2), geo.toFloat(arrow.y2)];
  let start;
  if (source) {
    const toward = target === null ? endHint : [target.cx, target.cy];
    start = anchorPoint(source, toward, arrow.source_port ? String(arrow.source_port) : null);
  } else start = startHint;
  let end;
  if (target) {
    const toward = source === null ? startHint : [source.cx, source.cy];
    end = anchorPoint(target, toward, arrow.target_port ? String(arrow.target_port) : null);
  } else end = endHint;
  const waypoints = (arrow.route_points ?? []).map(([x, y]) => [geo.toFloat(x), geo.toFloat(y)]);
  return [start, ...waypoints, end];
};

const legendLayout = (data, legend, width, height) => {
  if (!legend.length) return null;
  const orientation = String(data.legend_orientation ?? "vertical").trim().toLowerCase();
  if (!["vertical", "horizontal"].includes(orientation)) throw new Error("legend_orientation must be vertical or horizontal");
  let x = geo.toFloat(data._legend_x ?? data.legend_x, 42);
  const defaultY = orientation === "horizontal" ? height - 82 : height - (legend.length * 22 + 34);
  let y = geo.toFloat(data._legend_y ?? data.legend_y, defaultY);
  const position = String(data.legend_position ?? "bottom-left");
  const labelWidths = legend.map((item) => geo.estimateTextWidth(String(item.label ?? ""), 12));
  let blockWidth;
  let blockHeight;
  if (orientation === "horizontal") {
    blockWidth = labelWidths.reduce((sum, w) => sum + 40 + w + 28, 0) - 18;
    blockHeight = 28;
  } else {
    blockWidth = 40 + (labelWidths.length ? Math.max(...labelWidths) : 84) + 12;
    blockHeight = legend.length * 22 + 6;
  }
  if (!("_legend_x" in data) && position === "bottom-right") x = geo.toFloat(data.legend_x, width - blockWidth - 42);
  else if (!("_legend_x" in data) && position === "top-right") {
    x = geo.toFloat(data.legend_x, width - blockWidth - 42);
    y = geo.toFloat(data.legend_y, 96);
  } else if (!("_legend_x" in data) && position === "top-left") {
    x = geo.toFloat(data.legend_x, 42);
    y = geo.toFloat(data.legend_y, 96);
  }
  return [x, y, geo.rectangleBounds(x - 10, y - 14, blockWidth + 20, blockHeight + 18)];
};

const resolveLegendLayout = (data, legend, width, height, obstacles, arrows, nodeMap) => {
  const requested = legendLayout(data, legend, width, height);
  if (!requested) return null;
  const [requestedX, requestedY, requestedBounds] = requested;
  const hintRoutes = arrows.filter((arrow) => arrow.route_points).map((arrow) => routeHintPoints(arrow, nodeMap));
  const canvas = [0.0, 0.0, width, height];

  const isSafe = (bounds) => {
    if (!geo.boundsInside(bounds, canvas, 8)) return false;
    if (obstacles.some((obstacle) => geo.boundsIntersect(bounds, obstacle, 6))) return false;
    return !hintRoutes.some((route) => {
      for (let i = 1; i < route.length; i++) {
        if (geo.segmentHitsBounds(route[i - 1], route[i], bounds)) return true;
      }
      return false;
    });
  };

  if (isSafe(requestedBounds)) {
    return {
      requested: [geo.round2(requestedX), geo.round2(requestedY)],
      actual: [geo.round2(requestedX), geo.round2(requestedY)],
      moved: false,
      bounds: requestedBounds,
    };
  }
  if (data.legend_locked) throw new Error("locked legend intersects diagram content or a mandatory route");

  const blockWidth = requestedBounds[2] - requestedBounds[0];
  const blockHeight = requestedBounds[3] - requestedBounds[1];
  const candidates = [];
  for (let top = 84; top <= Math.max(85, Math.trunc(height - blockHeight - 8)); top += 8) {
    for (let left = 8; left <= Math.max(9, Math.trunc(width - blockWidth - 8)); left += 8) {
      candidates.push([left + 10, top + 14]);
    }
  }
  candidates.sort(
    (a, b) =>
      Math.abs(a[0] - requestedX) + Math.abs(a[1] - requestedY) - (Math.abs(b[0] - requestedX) + Math.abs(b[1] - requestedY)) ||
      a[1] - b[1] || a[0] - b[0],
  );
  for (const [x, y] of candidates) {
    const bounds = [x - 10, y - 14, x - 10 + blockWidth, y - 14 + blockHeight];
    if (isSafe(bounds)) {
      data._legend_x = x;
      data._legend_y = y;
      return {
        requested: [geo.round2(requestedX), geo.round2(requestedY)],
        actual: [geo.round2(x), geo.round2(y)],
        moved: true,
        bounds,
      };
    }
  }
  throw new Error("no collision-free legend position is available");
};

const footerLayout = (data, width, height) => {
  const text = String(data.footer ?? "").trim();
  if (!text) return null;
  const footerWidth = Math.max(140, text.length * 7);
  let x = geo.toFloat(data.footer_x, 42);
  const y = geo.toFloat(data.footer_y, height - 16);
  const position = String(data.footer_position ?? "bottom-left");
  if (position === "bottom-right") x = geo.toFloat(data.footer_x, width - footerWidth - 42);
  return [x, y, geo.rectangleBounds(x, y - 12, footerWidth, 16)];
};

const renderArrow = (arrow, style, styleIndex, nodeMap, routeObstacles, labelObstacles, { existingRoutes, canvasBounds }) => {
  const edgeId = String(arrow._edge_id || "edge");
  const edgeDomId = String(arrow._edge_dom_id || safeIdentifier(edgeId, "edge"));
  const startHint = [geo.toFloat(arrow.x1), geo.toFloat(arrow.y1)];
  const endHint = [geo.toFloat(arrow.x2), geo.toFloat(arrow.y2)];
  const sourceNode = arrow.source ? nodeMap.get(String(arrow.source)) : null;
  const targetNode = arrow.target ? nodeMap.get(String(arrow.target)) : null;
  const sourcePort = arrow._resolved_source_port ?? arrow.source_port;
  const targetPort = arrow._resolved_target_port ?? arrow.target_port;

  let start;
  if (sourceNode) {
    const toward = targetNode === null ? endHint : [targetNode.cx, targetNode.cy];
    start = anchorPoint(sourceNode, toward, sourcePort ? String(sourcePort) : null, geo.toFloat(arrow._source_port_offset));
  } else start = startHint;

  let end;
  if (targetNode) {
    const toward = sourceNode === null ? startHint : [sourceNode.cx, sourceNode.cy];
    end = anchorPoint(targetNode, toward, targetPort ? String(targetPort) : null, geo.toFloat(arrow._target_port_offset));
  } else end = endHint;

  const obstacles = [...routeObstacles];
  const routingData = { ...arrow };
  if (sourcePort) routingData.source_port = sourcePort;
  if (targetPort) routingData.target_port = targetPort;
  const route = geo.buildOrthogonalRoute(start, end, obstacles, routingData, {
    canvasBounds,
    existingRoutes,
  });
  const interactions = geo.routeInteractions(route, existingRoutes);
  if (interactions.overlapCount) throw new Error(`edge ${edgeId} has an unresolved collinear overlap`);
  const bridges = [...interactions.crossings];
  const bends = geo.bendCount(route);
  const stretch = routeStretch(route);
  const pathD = geo.pathWithBridges(route, bridges);
  const color = colorForFlow(style, arrow);
  const width = geo.toFloat(arrow.stroke_width, style.arrow_width);
  let dash = arrow.stroke_dasharray;
  if ((dash === null || dash === undefined) && arrow.dashed) dash = "6,4";
  const marker = markerForColor(style, color, arrow);
  const sourceId = escapeAttr(arrow.source ?? "");
  const targetId = escapeAttr(arrow.target ?? "");
  const bridgeAttr = bridges.map(([bx, by]) => `${geo.formatNumber(bx)},${geo.formatNumber(by)}`).join(";");
  const edgeKind = String(arrow.edge_kind ?? arrow.transit_type ?? "flow");
  const topicId = String(arrow.topic_id ?? "");
  const protocol = String(arrow.protocol ?? "");
  const via = String(arrow.via ?? "");
  const flow = String(arrow.flow ?? "");
  const sharedAttributes =
    `data-edge-id="${escapeAttr(edgeId)}" data-source="${sourceId}" data-target="${targetId}" ` +
    `data-edge-kind="${escapeAttr(edgeKind)}" data-topic-id="${escapeAttr(topicId)}" ` +
    `data-flow="${escapeAttr(flow)}" data-protocol="${escapeAttr(protocol)}" data-via="${escapeAttr(via)}" ` +
    `data-bends="${bends}" data-route-stretch="${geo.round2(stretch)}"`;

  const renderedPaths = [];
  if (bridges.length) {
    renderedPaths.push(
      `  <path id="${escapeAttr(edgeDomId)}-bridge-mask" data-graph-role="bridge-mask" data-owner="${escapeAttr(edgeId)}" ` +
      `d="${pathD}" fill="none" stroke="${style.background}" stroke-width="${geo.round2(width + 4.5)}" ` +
      `stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  if (styleIndex === 9) {
    const roughOffset = deterministicJitter(arrow._rough_seed ?? 0, edgeId, 7, 1.2);
    renderedPaths.push(
      `  <path id="${escapeAttr(edgeDomId)}-review-stroke" data-graph-role="decoration" data-owner="${escapeAttr(edgeId)}" ` +
      `d="${pathD}" fill="none" stroke="${color}" stroke-width="0.9" stroke-dasharray="2.5,2" opacity="0.30" ` +
      `stroke-dashoffset="${geo.round2(roughOffset)}"/>`,
    );
  } else if (styleIndex === 11 && String(arrow.transit_type ?? "") === "rail") {
    renderedPaths.push(
      `  <path id="${escapeAttr(edgeDomId)}-rail-casing" data-graph-role="decoration" data-owner="${escapeAttr(edgeId)}" ` +
      `d="${pathD}" fill="none" stroke="${style.rail_casing}" stroke-width="${geo.round2(width + 3.2)}" ` +
      `stroke-linecap="round" stroke-linejoin="round" opacity="0.28"/>`,
    );
  } else if (styleIndex === 12 && arrow.critical) {
    renderedPaths.push(
      `  <path id="${escapeAttr(edgeDomId)}-critical-glow" data-graph-role="decoration" data-owner="${escapeAttr(edgeId)}" ` +
      `d="${pathD}" fill="none" stroke="${color}" stroke-width="${geo.round2(width + 5)}" ` +
      `stroke-linecap="round" stroke-linejoin="round" opacity="0.22" filter="url(#pulseGlow)"/>`,
    );
  }
  let path =
    `  <path id="${escapeAttr(edgeDomId)}" data-graph-role="edge" ${sharedAttributes} ` +
    `data-bridges="${bridgeAttr}" d="${pathD}" fill="none" stroke="${color}" ` +
    `stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" marker-end="${marker}"`;
  if (dash) path += ` stroke-dasharray="${dash}"`;
  if (arrow.opacity !== null && arrow.opacity !== undefined) path += ` opacity="${arrow.opacity}"`;
  path += "/>";
  renderedPaths.push(path);
  if (styleIndex === 11 && String(arrow.transit_type ?? "") === "rail" && route.length >= 2) {
    const directionX = (route[0][0] + route[route.length - 1][0]) / 2;
    const directionY = (route[0][1] + route[route.length - 1][1]) / 2;
    renderedPaths.push(
      `  <path id="${escapeAttr(edgeDomId)}-direction" data-graph-role="decoration" data-owner="${escapeAttr(edgeId)}" ` +
      `d="M ${directionX - 3.5} ${directionY - 3.5} L ${directionX + 1.5} ${directionY} L ${directionX - 3.5} ${directionY + 3.5}" ` +
      `fill="none" stroke="${style.background}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  if (styleIndex === 12 && arrow.critical && route.length >= 2) {
    const hopX = (route[0][0] + route[route.length - 1][0]) / 2;
    const hopY = (route[0][1] + route[route.length - 1][1]) / 2;
    const hop = Number.parseInt(arrow.critical_hop ?? 1, 10);
    const totalHops = Number.parseInt(arrow.critical_hops ?? 1, 10);
    renderedPaths.push(
      `  <circle id="${escapeAttr(edgeDomId)}-hop" data-graph-role="decoration" data-owner="${escapeAttr(edgeId)}" ` +
      `cx="${hopX}" cy="${hopY}" r="9" fill="${style.background}" stroke="${color}" stroke-width="1.2"/>`,
      `  <text data-graph-role="decoration" data-owner="${escapeAttr(edgeId)}" x="${hopX}" y="${hopY + 2.7}" ` +
      `text-anchor="middle" font-size="7" font-weight="800" fill="${color}">${hop}/${totalHops}</text>`,
    );
  }

  let labelSvg = "";
  let labelBounds = null;
  const label = String(arrow.label ?? "").trim();
  const secondaryLabel = styleIndex === 9 ? protocol.trim() : "";
  let effectiveLabel = label;
  if (styleIndex === 10 && !label && via.trim()) effectiveLabel = via.trim();
  if (effectiveLabel) {
    let labelProxy = effectiveLabel;
    if (secondaryLabel && geo.estimateTextWidth(secondaryLabel, 12) > geo.estimateTextWidth(effectiveLabel, 12)) {
      labelProxy = secondaryLabel;
    }
    const [labelX, labelY] = geo.chooseLabelPositionAvoiding(route, labelProxy, labelObstacles, {
      routes: existingRoutes,
      canvasBounds,
      dx: geo.toFloat(arrow.label_dx, 0),
      dy: geo.toFloat(arrow.label_dy, -4),
    });
    let labelContent;
    if (secondaryLabel) {
      labelContent = renderDualLabelBadge(labelX, labelY, effectiveLabel, secondaryLabel, style);
      labelBounds = estimateDualLabelBounds(labelX, labelY, effectiveLabel, secondaryLabel);
    } else {
      labelContent = renderLabelBadge(labelX, labelY, effectiveLabel, style, String(arrow.label_style ?? "badge"));
      labelBounds = geo.estimateLabelBounds(labelX, labelY, effectiveLabel);
    }
    labelSvg = (
      `  <g id="${escapeAttr(edgeDomId)}-label" data-graph-role="label" data-owner="${escapeAttr(edgeId)}" data-graph-bounds="` +
      `${geo.formatNumber(labelBounds[0])},${geo.formatNumber(labelBounds[1])},` +
      `${geo.formatNumber(labelBounds[2])},${geo.formatNumber(labelBounds[3])}">\n` +
      `${labelContent}\n  </g>`
    );
  }

  const report = {
    id: edgeId,
    source: String(arrow.source ?? ""),
    target: String(arrow.target ?? ""),
    source_port: [geo.round2(start[0]), geo.round2(start[1])],
    target_port: [geo.round2(end[0]), geo.round2(end[1])],
    waypoints: (arrow.route_points ?? []).map(([x, y]) => [geo.toFloat(x), geo.toFloat(y)]),
    route: route.map(([x, y]) => [geo.round2(x), geo.round2(y)]),
    length: geo.round2(geo.routeLengthEuclid(route)),
    bends,
    route_stretch: geo.round2(stretch),
    crossings: interactions.crossings.map(([x, y]) => [geo.round2(x), geo.round2(y)]),
    bridges: bridges.map(([x, y]) => [geo.round2(x), geo.round2(y)]),
  };
  return { edgeId, pathSvg: renderedPaths.join("\n"), labelSvg, labelBounds, route, report };
};

// Euclidean length for the report (mirrors geometry.route_length upstream);
// routing/scoring use the Manhattan metric inside geometry.routeScore.
const renderLegend = (legend, style, width, height, data) => {
  const layout = legendLayout(data, legend, width, height);
  if (!layout) return "";
  const [legendX, legendY, bounds] = layout;
  const lines = [
    '  <g id="legend" data-graph-role="legend">',
    `    <rect id="legend-zone" data-graph-role="reserved" data-reserved-kind="legend" ` +
      `x="${geo.formatNumber(bounds[0])}" y="${geo.formatNumber(bounds[1])}" ` +
      `width="${geo.formatNumber(bounds[2] - bounds[0])}" height="${geo.formatNumber(bounds[3] - bounds[1])}" ` +
      `rx="10" fill="none" stroke="none"/>`,
  ];
  const orientation = String(data.legend_orientation ?? "vertical").trim().toLowerCase();
  let cursorX = legendX;
  legend.forEach((item, idx) => {
    const y = orientation === "horizontal" ? legendY : legendY + idx * 22;
    let color = item.color;
    if (!color) {
      color = style.arrow_colors[FLOW_ALIASES[String(item.flow ?? "control").toLowerCase()] ?? "control"];
    }
    const marker = markerForColor(style, String(color), { flow: item.flow ?? "control" });
    const itemX = orientation === "horizontal" ? cursorX : legendX;
    lines.push(
      `    <line data-graph-role="decoration" x1="${itemX}" y1="${y}" x2="${itemX + 30}" y2="${y}" ` +
      `stroke="${color}" stroke-width="${style.arrow_width}" marker-end="${marker}"/>`,
    );
    lines.push(`    <text data-graph-role="decoration" x="${itemX + 40}" y="${y + 4}" class="legend">${escapeText(item.label ?? "")}</text>`);
    if (orientation === "horizontal") cursorX += 40 + geo.estimateTextWidth(String(item.label ?? ""), 12) + 28;
  });
  if (data.legend_box) {
    const bg = data.legend_box_fill ?? style.arrow_label_bg;
    const opacity = data.legend_box_opacity ?? 0.88;
    lines.splice(
      2, 0,
      `    <rect data-graph-role="decoration" x="${geo.formatNumber(bounds[0])}" y="${geo.formatNumber(bounds[1])}" ` +
      `width="${geo.formatNumber(bounds[2] - bounds[0])}" height="${geo.formatNumber(bounds[3] - bounds[1])}" ` +
      `rx="10" fill="${bg}" opacity="${opacity}"/>`,
    );
  }
  lines.push("  </g>");
  return lines.join("\n");
};

const renderFooter = (data, style, width, height) => {
  const layout = footerLayout(data, width, height);
  if (!layout) return "";
  const [x, y] = layout;
  const text = String(data.footer ?? "").trim();
  return `  <text x="${x}" y="${y}" class="footnote">${escapeText(text)}</text>`;
};

const boundsMetadata = (bounds) => bounds.map((v) => geo.formatNumber(v)).join(",");

// ---- Orchestration ----

const parseTemplateViewbox = (templateType) => DEFAULT_VIEWBOX[templateType] ?? [960, 600];

export const buildSvgWithReport = (templateType, data, resolveStyle) => {
  const { inputSchema, mode, styleIndex: resolvedIndex, data: sourceData } = normalizeDiagram(data, templateType, resolveStyle);
  const [styleIndex, style] = parseStyle(resolvedIndex);
  const compositionContract = resolveContract(sourceData.composition ?? sourceData.quality_profile ?? "standard");
  if (sourceData.style_overrides) Object.assign(style, sourceData.style_overrides);

  let [width, height] = parseTemplateViewbox(templateType);
  width = geo.toFloat(sourceData.width, width);
  height = geo.toFloat(sourceData.height, height);
  if (sourceData.viewBox) {
    const match = String(sourceData.viewBox).match(/^0 0 ([0-9.]+) ([0-9.]+)/);
    if (match) {
      width = Number.parseFloat(match[1]);
      height = Number.parseFloat(match[2]);
    }
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("canvas width and height must be finite positive numbers");
  }

  const containers = sourceData.containers ?? [];
  const nodesData = sourceData.nodes ?? [];
  const arrowsData = sourceData.arrows ?? [];
  const legend = sourceData.legend ?? [];

  if (styleIndex === 9) {
    const roughSeed = sourceData.rough_seed ?? 0;
    for (const nodeData of nodesData) if (nodeData._rough_seed === undefined) nodeData._rough_seed = roughSeed;
    for (const container of containers) if (container._rough_seed === undefined) container._rough_seed = roughSeed;
    for (const arrowData of arrowsData) if (arrowData._rough_seed === undefined) arrowData._rough_seed = roughSeed;
  }

  const defs = renderDefs(styleIndex, style);
  const canvas = renderCanvas(styleIndex, style, width, height);
  const [titleBlock, contentStartY] = renderTitleBlock(style, sourceData, width);
  const windowControls = renderWindowControls(sourceData, styleIndex, width);
  const headerMeta = renderHeaderMeta(sourceData, style, width);
  const styleSignature = renderStyleSignature(styleIndex, sourceData, width);

  for (const nodeData of nodesData) {
    if (!("y" in nodeData) && nodeData.auto_place) {
      nodeData.y = contentStartY + geo.toFloat(nodeData.offset_y, 0);
    }
  }

  const normalizedNodes = nodesData.map((node, idx) => normalizeNode(node, `node-${idx}`));
  if (new Set(normalizedNodes.map((n) => n.nodeId)).size !== normalizedNodes.length) {
    throw new Error("node ids must be unique");
  }
  const nodeMap = new Map(normalizedNodes.map((n) => [n.nodeId, n]));

  const usedDomIds = new Set(RESERVED_DOM_IDS);
  containers.forEach((container, index) => {
    const rawId = String(container.id ?? `container-${String(index).padStart(3, "0")}`);
    container._dom_id = allocateDomIdentifier(safeIdentifier(rawId, `container-${String(index).padStart(3, "0")}`), usedDomIds, ["-header"]);
  });
  arrowsData.forEach((arrow, index) => {
    const rawId = String(arrow.id ?? `edge-${String(index).padStart(3, "0")}`);
    arrow._dom_id = allocateDomIdentifier(safeIdentifier(rawId, `edge-${String(index).padStart(3, "0")}`), usedDomIds, EDGE_DOM_SUFFIXES);
  });
  normalizedNodes.forEach((node) => {
    node.data._dom_id = allocateDomIdentifier(`node-${safeIdentifier(node.nodeId, "node")}`, usedDomIds);
  });

  const sectionObstacles = containers
    .map((container) => containerHeaderBounds(container, style))
    .filter((bounds) => bounds !== null);
  const footerReserved = footerLayout(sourceData, width, height);
  const [blueprintBlockSvg, blueprintBlockBounds] = renderBlueprintTitleBlock(sourceData, style, styleIndex, width, height);
  const nodeObstacles = normalizedNodes.map((node) => node.bounds);
  const placementObstacles = [...nodeObstacles, ...sectionObstacles];
  if (footerReserved) placementObstacles.push(footerReserved[2]);
  if (blueprintBlockBounds) placementObstacles.push(blueprintBlockBounds);
  const legendPlacement = resolveLegendLayout(sourceData, legend, width, height, placementObstacles, arrowsData, nodeMap);
  const legendReserved = legendLayout(sourceData, legend, width, height);

  const reservedBounds = [...sectionObstacles];
  if (legendReserved) reservedBounds.push(legendReserved[2]);
  if (footerReserved) reservedBounds.push(footerReserved[2]);
  if (blueprintBlockBounds) reservedBounds.push(blueprintBlockBounds);

  const routeObstacles = [...nodeObstacles, ...reservedBounds];
  const labelObstacles = [...nodeObstacles, ...reservedBounds];
  // Arrow labels must not land on the title/subtitle band; routes may still cross it.
  const titleBand = [24, 24, width - 24, Math.max(24, contentStartY - 6)];
  labelObstacles.push(titleBand);
  const preparedArrows = prepareArrows(arrowsData, nodeMap);
  const renderedByIndex = new Map();
  const existingRoutes = [];
  const routingOrder = preparedArrows
    .map((arrow, index) => [arrow.route_points ? 0 : 1, index])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([, index]) => index);

  const issues = [];
  const canvasBounds = [0.0, 0.0, width, height];
  for (const index of routingOrder) {
    const rendered = renderArrow(
      preparedArrows[index], style, styleIndex, nodeMap, routeObstacles, labelObstacles,
      { existingRoutes, canvasBounds },
    );
    renderedByIndex.set(index, rendered);
    existingRoutes.push(rendered.route);
    if (rendered.labelBounds) {
      labelObstacles.push(rendered.labelBounds);
      routeObstacles.push(rendered.labelBounds);
    }
    if (rendered.report.bridges.length) {
      issues.push({
        severity: "info",
        code: "EDGE_CROSSING_BRIDGED",
        element: rendered.edgeId,
        coordinates: rendered.report.bridges,
      });
    }
  }

  const contractData = compositionContract;
  const visualTheme = STYLE_NAMES[styleIndex];
  const diagramType = String(sourceData.diagram_type ?? mode);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.trunc(width)} ${Math.trunc(height)}" ` +
    `width="${Math.trunc(width)}" height="${Math.trunc(height)}" data-generator="yo-tech-graph" ` +
    `data-schema-version="1" data-text-metrics="heuristic-v1" ` +
    `data-style-id="${styleIndex}" data-visual-theme="${escapeAttr(visualTheme)}" ` +
    `data-diagram-type="${escapeAttr(diagramType)}" ` +
    `data-quality-profile="${escapeAttr(compositionContract.profile)}" ` +
    `data-max-bends-per-edge="${contractData.max_bends_per_edge}" ` +
    `data-max-total-bends="${contractData.max_total_bends}" ` +
    `data-max-route-stretch="${contractData.max_route_stretch}" ` +
    `data-max-bridged-crossings="${contractData.max_bridged_crossings}" ` +
    `data-min-node-gap="${contractData.min_node_gap}" ` +
    `data-min-container-gutter="${contractData.min_container_gutter}" ` +
    `data-min-label-clearance="${contractData.min_label_clearance}" ` +
    `data-min-segment-length="${contractData.min_segment_length}">`,
  ];
  lines.push(defs);
  lines.push(canvas);
  if (windowControls) lines.push(windowControls);
  if (headerMeta) lines.push(headerMeta);
  lines.push(titleBlock);
  if (styleSignature) lines.push(styleSignature);

  containers.forEach((container, index) => {
    const containerId = String(
      container._dom_id || safeIdentifier(container.id, `container-${String(index).padStart(3, "0")}`),
    );
    const containerBounds = geo.rectangleBounds(
      geo.toFloat(container.x), geo.toFloat(container.y),
      geo.toFloat(container.width), geo.toFloat(container.height),
    );
    lines.push(
      `  <g id="${escapeAttr(containerId)}" data-graph-role="container" ` +
      `data-container-id="${escapeAttr(container.id ?? "")}" ` +
      `data-semantic-role="${escapeAttr(container.deployment_kind ?? container.c4_type ?? "boundary")}" ` +
      `data-graph-bounds="${boundsMetadata(containerBounds)}">`,
    );
    lines.push(renderSection(container, style));
    const headerBounds = containerHeaderBounds(container, style);
    if (headerBounds) {
      lines.push(
        `    <rect id="${escapeAttr(containerId)}-header" data-graph-role="reserved" data-reserved-kind="container-header" ` +
        `x="${geo.formatNumber(headerBounds[0])}" y="${geo.formatNumber(headerBounds[1])}" ` +
        `width="${geo.formatNumber(headerBounds[2] - headerBounds[0])}" height="${geo.formatNumber(headerBounds[3] - headerBounds[1])}" ` +
        `fill="none" stroke="none"/>`,
      );
    }
    lines.push("  </g>");
  });

  // Bridge masks paint between the two crossing edges: preserve routing order.
  for (const index of routingOrder) lines.push(renderedByIndex.get(index).pathSvg);

  normalizedNodes.forEach((node) => {
    const nodeId = String(node.data._dom_id || `node-${safeIdentifier(node.nodeId, "node")}`);
    const semanticRole = node.data.c4_type ?? node.data.deployment_kind ?? node.data.transit_role
      ?? node.data.ops_role ?? node.data.kind ?? "node";
    lines.push(
      `  <g id="${escapeAttr(nodeId)}" data-graph-role="node" data-node-id="${escapeAttr(node.nodeId)}" ` +
      `data-semantic-role="${escapeAttr(semanticRole)}" data-parent="${escapeAttr(node.data.parent ?? "")}" ` +
      `data-status="${escapeAttr(node.data.status ?? "")}" data-graph-bounds="${boundsMetadata(node.bounds)}">`,
    );
    lines.push(renderNode(node.data, style));
    lines.push("  </g>");
  });

  for (let index = 0; index < preparedArrows.length; index++) {
    const labelSvg = renderedByIndex.get(index).labelSvg;
    if (labelSvg) lines.push(labelSvg);
  }

  const legendSvg = renderLegend(legend, style, width, height, sourceData);
  if (legendSvg) lines.push(legendSvg);

  if (blueprintBlockSvg) {
    if (blueprintBlockBounds) {
      lines.push(`  <g id="blueprint-title-block" data-graph-role="reserved" data-graph-bounds="${boundsMetadata(blueprintBlockBounds)}">`);
      lines.push(blueprintBlockSvg);
      lines.push("  </g>");
    } else {
      lines.push(blueprintBlockSvg);
    }
  }

  const footerSvg = renderFooter(sourceData, style, width, height);
  if (footerSvg) {
    if (footerReserved) {
      lines.push(`  <g id="footer" data-graph-role="reserved" data-graph-bounds="${boundsMetadata(footerReserved[2])}">`);
      lines.push(footerSvg);
      lines.push("  </g>");
    } else {
      lines.push(footerSvg);
    }
  }

  lines.push("</svg>");

  const composition = assessComposition({
    nodes: normalizedNodes.map((node) => [node.nodeId, node.bounds]),
    containers: containers.map((container, index) => [
      String(container.id ?? `container-${String(index).padStart(3, "0")}`),
      geo.rectangleBounds(
        geo.toFloat(container.x), geo.toFloat(container.y),
        geo.toFloat(container.width), geo.toFloat(container.height),
      ),
    ]),
    edges: [...renderedByIndex.values()].map((r) => r.report),
    contract: compositionContract,
  });
  if (!composition.ok) {
    const summary = composition.violations
      .map((item) => `${item.code}:${item.element}=${item.actual}>${item.limit}`)
      .join("; ");
    throw new Error(`COMPOSITION_QUALITY: ${summary}`);
  }

  const report = {
    schema_version: 1,
    input_schema: inputSchema,
    mode,
    style: { id: styleIndex, name: visualTheme },
    ok: true,
    canvas: { width: geo.round2(width), height: geo.round2(height) },
    text_metrics: "heuristic-v1",
    placements: {
      legend: legendPlacement
        ? {
            requested: legendPlacement.requested,
            actual: legendPlacement.actual,
            moved: legendPlacement.moved,
            bounds: legendPlacement.bounds.map((v) => geo.round2(v)),
          }
        : null,
    },
    edges: preparedArrows.map((_, index) => renderedByIndex.get(index).report),
    composition,
    issues,
    summary: {
      nodes: nodesData.length,
      edges: preparedArrows.length,
      bridged_crossings: [...renderedByIndex.values()].reduce((sum, r) => sum + r.report.bridges.length, 0),
    },
  };
  return [lines.filter(Boolean).join("\n"), report];
};
