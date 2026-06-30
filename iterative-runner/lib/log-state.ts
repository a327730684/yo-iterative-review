import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Logger {
  path: string;
  append(record: Record<string, unknown>): Promise<void>;
}

/**
 * 创建本次流程的日志记录器。
 * @param projectDir 项目根目录
 * @param prefix     日志文件名前缀，用于区分不同流程（默认 `iterative`）
 */
export function createLogger(projectDir: string, prefix = 'iterative'): Logger {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // yyyy-MM-dd
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14); // yyyyMMddHHmmss
  const logDir = join(projectDir, '.voyo-work', 'logs', dateStr);
  const logPath = join(logDir, `${prefix}_${timestamp}.log`);
  
  let dirEnsured = false;

  return {
    path: logPath,
    async append(record: Record<string, unknown>) {
      if (!dirEnsured) {
        await mkdir(logDir, { recursive: true });
        dirEnsured = true;
      }
      const line = JSON.stringify({ ...record, timestamp: new Date().toISOString() }) + '\n';
      await appendFile(logPath, line, 'utf8');
    },
  };
}
