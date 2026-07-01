import spawn from 'cross-spawn';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RunClaudeAgentOptions {
  agent?: string;
  prompt: string;
  schemaPath?: string;
  projectDir: string;
}

interface RunClaudeTextAgentOptions {
  agent?: string;
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
  // cross-spawn 保留参数边界，schema（单行 JSON）可直接作参数。
  // 但多行 prompt 作命令行参数时换行会在 Windows 下丢失，故 prompt 走 stdin。
  const args = [
    '-p',
    '--output-format', 'json',
    '--dangerously-skip-permissions',
  ];
  if (agent) {
    args.push('--agent', agent);
  }

  if (schemaPath) {
    const schemaRaw = await readFile(schemaPath, 'utf8');
    // 压成单行 JSON：claude --json-schema 不接受参数中的换行，会报 Expected '}'
    const schema = JSON.stringify(JSON.parse(schemaRaw));
    args.push('--json-schema', schema);
  }

  const { stdout, stderr, exitCode } = await execClaude(args, { cwd: projectDir, stdin: prompt });

  if (exitCode !== 0) {
    const errMsg = stderr || `claude -p 退出码 ${exitCode}`;
    throw new Error(`claude -p (${agent || 'default'}) 失败: ${errMsg}`);
  }

  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(stdout) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`解析 claude -p 外层 JSON 失败: ${message}\n原始 stdout 前 500 字符:\n${stdout.slice(0, 500)}`);
  }

  if (envelope.is_error) {
    throw new Error(`claude -p (${agent || 'default'}) 返回错误: ${envelope.result || JSON.stringify(envelope)}`);
  }

  let inner: unknown;
  try {
    inner = typeof envelope.result === 'string' ? JSON.parse(envelope.result) : envelope.result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`解析 ${agent || 'default'} 结构化 result 失败: ${message}\n原始 result 前 1000 字符:\n${String(envelope.result).slice(0, 1000)}`);
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
  // 多行 prompt 走 stdin，避免命令行参数在 Windows 下丢失换行
  const args = [
    '-p',
    '--dangerously-skip-permissions',
  ];
  if (agent) {
    args.push('--agent', agent);
  }

  const { stdout, stderr, exitCode } = await execClaude(args, { cwd: projectDir, stdin: prompt });

  if (exitCode !== 0) {
    const errMsg = stderr || `claude -p 退出码 ${exitCode}`;
    throw new Error(`claude -p (${agent || 'default'}) 失败: ${errMsg}`);
  }

  return stdout.trim();
}

function execClaude(
  args: string[],
  { cwd, stdin }: { cwd: string; stdin?: string },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    // cross-spawn：自动识别 .cmd/.exe/.bat，不开 shell，参数边界保留。
    // 跨平台（Windows/Linux/macOS）一致。
    const child = spawn('claude', args, {
      cwd,
      stdio: stdin !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    // stdio 配置为 'pipe'，运行时 stdout/stderr 必非空；类型签名含 null，故加守卫
    if (child.stdout) child.stdout.on('data', chunk => stdoutChunks.push(chunk));
    if (child.stderr) child.stderr.on('data', chunk => stderrChunks.push(chunk));

    child.on('error', reject);
    child.on('close', exitCode => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      resolve({ stdout, stderr, exitCode });
    });

    // prompt 经 stdin 传入后关闭，claude -p 据此进入非交互模式
    if (stdin !== undefined && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

export { execClaude };
