#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";


const mcpServerDir = import.meta.dirname;

const nodeModulesDir = join(mcpServerDir, 'node_modules');

if (!existsSync(nodeModulesDir)) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execSync(`${npmCmd} install`, { cwd: mcpServerDir, stdio: 'inherit' });
}
