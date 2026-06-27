import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

export function checkDeps(): void {
  const nodeModulesPath = join(projectRoot, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    console.error('[yo-docs-mcp] node_modules 不存在，正在执行 npm install ...');
    execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
    console.error('[yo-docs-mcp] npm install 完成');
  }
}
