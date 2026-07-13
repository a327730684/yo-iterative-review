#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!existsSync(join(__dirname, 'node_modules'))) {
  execSync(process.platform === 'win32' ? 'npm.cmd install' : 'npm install', {
    cwd: __dirname,
    stdio: 'inherit',
  });
}

await import('./main.mjs');
