export interface CliArgs {
  requirements: string;
  flags: Record<string, string>;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const raw = argv.slice(2).join(' ').trim();
  const flags: Record<string, string> = {};
  let requirements = raw;

  const flagRe = /(^|\s)--([a-zA-Z0-9_-]+)\s+(\S+)(?=\s|$)/g;
  let match;
  while ((match = flagRe.exec(requirements)) !== null) {
    const key = match[2];
    const value = match[3];
    flags[key] = value;
    requirements = (requirements.slice(0, match.index) + requirements.slice(match.index + match[0].length)).trim();
    flagRe.lastIndex = 0;
  }

  return { requirements, flags };
}

/**
 * 获取项目根目录。
 * 当前直接取运行时的 cwd，后续可按需扩展为向上查找标记文件。
 */
export function getProjectDir(): string {
  return process.cwd();
}

/**
 * 生成 6 位随机数字字符串。
 */
export function generateRandom6(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
