#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

const mcpServerDir = __dirname;
const nodeModulesDir = join(mcpServerDir, 'node_modules');

if (!existsSync(nodeModulesDir)) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execSync(`${npmCmd} install`, { cwd: mcpServerDir, stdio: 'inherit' });
}
