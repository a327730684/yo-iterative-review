#!/usr/bin/env node
// yo-tech-graph diagram generator.
//
// Usage:
//   node generate-from-template.js <template-type> <output.svg> [data] [options]
//
// data: inline JSON string, "@path/to/data.json", a .json file path, or "-" for stdin.
// options:
//   --style, -s <id|name>   override the style selector in the data
//   --layout-report, --report <path>  write the JSON layout report
//   --profile <name|map>    composition profile: standard (default) | showcase

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSvgWithReport } from "./lib/render.js";
import { resolveStyleIndex } from "./lib/styles.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `Usage: node generate-from-template.js <template-type> <output.svg> [data] [options]

template-type: architecture | data-flow | flowchart | sequence | comparison | timeline |
               mind-map | agent | memory | use-case | class | state-machine | er-diagram |
               network-topology
data: inline JSON string, @data.json, path/to/data.json, or "-" for stdin

Options:
  -s, --style <id|name>        style id (1-12) or name, overrides data.style
      --profile <p>            composition profile: standard | showcase
      --report, --layout-report <path>  also write the JSON layout report
  -h, --help                   show this help`;

const readDataArgument = (arg) => {
  if (arg === undefined) return readStdin();
  if (arg === "-") return readStdin();
  if (arg.startsWith("@")) return fs.readFileSync(path.resolve(arg.slice(1)), "utf8");
  if (arg.endsWith(".json") && fs.existsSync(path.resolve(arg))) {
    return fs.readFileSync(path.resolve(arg), "utf8");
  }
  return arg; // inline JSON string
};

const readStdin = () => {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    throw new Error("no input data: pass @file.json, an inline JSON string, or pipe JSON via stdin");
  }
};

const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const main = () => {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.some((a) => a === "-h" || a === "--help")) {
    console.log(USAGE);
    process.exit(argv.length ? 0 : 1);
  }

  const positional = [];
  let styleOverride;
  let profileOverride;
  let layoutReport;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-s" || arg === "--style") styleOverride = argv[++i];
    else if (arg === "--profile") profileOverride = argv[++i];
    else if (arg === "--report" || arg === "--layout-report") layoutReport = argv[++i];
    else positional.push(arg);
  }
  const [templateType, outputPath, dataArg] = positional;

  if (!templateType || !outputPath) {
    console.error("Error: template-type and output-path are required\n");
    console.error(USAGE);
    process.exit(1);
  }

  let reportPath = layoutReport;
  const fail = (message) => {
    if (reportPath) {
      writeJson(reportPath, {
        schema_version: 1,
        ok: false,
        issues: [{ severity: "error", code: "LAYOUT_ERROR", message: String(message) }],
      });
    }
    console.error(`Error: ${message}`);
    process.exit(1);
  };

  try {
    const data = JSON.parse(readDataArgument(dataArg));
    if (styleOverride !== undefined) data.style = /^\d+$/.test(String(styleOverride)) ? Number(styleOverride) : styleOverride;
    if (profileOverride !== undefined) {
      data.composition = /^[\w-]+$/.test(profileOverride) ? profileOverride : JSON.parse(profileOverride);
    }
    resolveStyleIndex(data); // fail fast on bad style selectors with a clear message

    const [svgContent, report] = buildSvgWithReport(templateType, data, resolveStyleIndex);
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, `${svgContent}\n`, "utf8");
    console.log(`✓ SVG generated: ${outputPath}`);
    if (reportPath) {
      writeJson(reportPath, report);
      console.log(`✓ Layout report: ${reportPath}`);
    }
  } catch (error) {
    fail(error instanceof SyntaxError && /JSON/.test(error.message) ? `Invalid JSON: ${error.message}` : error.message);
  }
};

main();
