import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RunClaudeAgentOptions {
  agent: string;
  prompt: string;
  schemaPath?: string;
  projectDir: string;
}

interface RunClaudeTextAgentOptions {
  agent: string;
  prompt: string;
  projectDir: string;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * 调用 claude -p 子进程执行一次无头任务，返回结构化 JSON。
 */
export async function runClaudeAgent({
  agent,
  prompt,
  schemaPath,
  projectDir,
}: RunClaudeAgentOptions): Promise<{ inner: unknown; envelope: Record<string, unknown> }> {
  const args = [
    '-p', prompt,
    '--agent', agent,
    '--output-format', 'json',
    '--dangerously-skip-permissions',
  ];

  if (schemaPath) {
    const schema = await readFile(schemaPath, 'utf8');
    args.push('--json-schema', schema);
  }

  const { stdout, stderr, exitCode } = await execClaude(args, { cwd: projectDir });

  if (exitCode !== 0) {
    const errMsg = stderr || `claude -p 退出码 ${exitCode}`;
    throw new Error(`claude -p (${agent}) 失败: ${errMsg}`);
  }

  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(stdout) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`解析 claude -p 外层 JSON 失败: ${message}\n原始 stdout 前 500 字符:\n${stdout.slice(0, 500)}`);
  }

  if (envelope.is_error) {
    throw new Error(`claude -p (${agent}) 返回错误: ${envelope.result || JSON.stringify(envelope)}`);
  }

  let inner: unknown;
  try {
    inner = typeof envelope.result === 'string' ? JSON.parse(envelope.result) : envelope.result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`解析 ${agent} 结构化 result 失败: ${message}\n原始 result 前 1000 字符:\n${String(envelope.result).slice(0, 1000)}`);
  }

  return { inner, envelope };
}

/**
 * 调用 claude -p 子进程执行一次无头任务，返回原始文本。
 * 适用于不要求 agent 输出结构化 JSON 的场景。
 */
export async function runClaudeTextAgent({
  agent,
  prompt,
  projectDir,
}: RunClaudeTextAgentOptions): Promise<string> {
  const args = [
    '-p', prompt,
    '--agent', agent,
    '--dangerously-skip-permissions',
  ];

  const { stdout, stderr, exitCode } = await execClaude(args, { cwd: projectDir });

  if (exitCode !== 0) {
    const errMsg = stderr || `claude -p 退出码 ${exitCode}`;
    throw new Error(`claude -p (${agent}) 失败: ${errMsg}`);
  }

  return stdout.trim();
}

function execClaude(args: string[], { cwd }: { cwd: string }): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', chunk => stdoutChunks.push(chunk));
    child.stderr.on('data', chunk => stderrChunks.push(chunk));

    child.on('error', reject);
    child.on('close', exitCode => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      resolve({ stdout, stderr, exitCode });
    });
  });
}

export { execClaude };
