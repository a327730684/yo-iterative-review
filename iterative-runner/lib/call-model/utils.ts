import {
  ANTHROPIC_VERSION,
  CLAUDE_CODE_AI_AGENT,
  CLAUDE_CODE_USER_AGENT,
} from '../../env.ts';
import type { ImageBlock, ModelConfig } from './types.ts';

export interface HeaderOptions {
  apiKey: string;
  anthropicVersion?: string;
  userAgent?: string;
  aiAgent?: string;
}

/** 构建请求 header，所有对外 headers 在此集中管理。 */
export function buildHeaders({
  apiKey,
  anthropicVersion = ANTHROPIC_VERSION,
  userAgent = CLAUDE_CODE_USER_AGENT,
  aiAgent = CLAUDE_CODE_AI_AGENT,
}: HeaderOptions): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'anthropic-version': anthropicVersion,
    'User-Agent': userAgent,
    'AI-Agent': aiAgent,
  };
}

/** 从环境变量读取模型配置。 */
export function getModelConfig(): ModelConfig {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || '';
  const model = process.env.ANTHROPIC_MODEL || '';

  const missing: string[] = [];
  if (!baseUrl) missing.push('ANTHROPIC_BASE_URL');
  if (!apiKey) missing.push('ANTHROPIC_AUTH_TOKEN');
  if (!model) missing.push('ANTHROPIC_MODEL');

  if (missing.length > 0) {
    throw new Error(
      `缺少环境变量: ${missing.join(', ')}\n` +
        `请设置:\n  ${missing.map((v) => `export ${v}=<value>`).join('\n  ')}`
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

/** 构造图片 content block。 */
export function imageBlock(buffer: Buffer | Uint8Array, mediaType: string): ImageBlock {
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: Buffer.from(buffer).toString('base64'),
    },
  };
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
