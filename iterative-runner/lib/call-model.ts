/**
 * 直接调用模型 API（参考 yo-pdf2md.ts 中的 callMultimodalAPI 实现）。
 *
 * 环境变量：
 *   ANTHROPIC_BASE_URL   - API 基础 URL
 *   ANTHROPIC_AUTH_TOKEN - API 认证令牌
 *   ANTHROPIC_MODEL      - 模型名称
 */

import {
  ANTHROPIC_VERSION,
  CLAUDE_CODE_AI_AGENT,
  CLAUDE_CODE_USER_AGENT,
  CALL_MODEL_MAX_RETRIES,
} from '../env.ts';

export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export type ContentBlock = TextBlock | ImageBlock;

export interface Message {
  role: string;
  content: string | ContentBlock[];
}

export interface JsonSchemaFormat {
  type: 'json_schema';
  schema: Record<string, unknown>;
}

export interface CallModelOptions {
  messages: Message[];
  maxTokens?: number;
  config?: ModelConfig;
  signal?: AbortSignal;
  responseFormat?: JsonSchemaFormat;
}

export interface CallModelWithImageOptions {
  prompt: string;
  imageBuffer: Buffer | Uint8Array;
  mediaType: string;
  maxTokens?: number;
  config?: ModelConfig;
  signal?: AbortSignal;
}

/**
 * 从环境变量读取模型配置。
 */
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

/**
 * 调用 /v1/messages 接口。
 *
 * 当访问 LLM 出错时，会按指数退避进行最多 CALL_MODEL_MAX_RETRIES 次重试。
 */
export async function callModel({
  messages,
  maxTokens = 16384,
  config = getModelConfig(),
  signal,
  responseFormat,
}: CallModelOptions): Promise<string> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages 必须是非空数组');
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= CALL_MODEL_MAX_RETRIES; attempt++) {
    try {
      return await callModelOnce({
        messages,
        maxTokens,
        config,
        signal,
        responseFormat,
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt >= CALL_MODEL_MAX_RETRIES) {
        break;
      }

      // 指数退避：1s, 2s, 4s... 上限 30s
      const delayMs = Math.min(1000 * 2 ** attempt, 30000);
      console.warn(
        `[callModel] 第 ${attempt + 1} 次调用失败，${delayMs}ms 后重试: ${lastError.message}`
      );
      await sleep(delayMs, signal);

      // 如果 signal 已触发，直接抛出；避免继续无意义重试
      if (signal?.aborted) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('调用模型失败');
}

interface CallModelOnceOptions {
  messages: Message[];
  maxTokens?: number;
  config: ModelConfig;
  signal?: AbortSignal;
  responseFormat?: JsonSchemaFormat;
}

async function callModelOnce({
  messages,
  maxTokens,
  config,
  signal,
  responseFormat,
}: CallModelOnceOptions): Promise<string> {
  const url = `${config.baseUrl}/v1/messages`;
  const body: Record<string, unknown> = {
    model: config.model,
    messages: messages.map(normalizeMessage),
  };

  if (maxTokens != null) {
    body.max_tokens = maxTokens;
  }

  if (responseFormat) {
    body.output_config = { format: responseFormat };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'Authorization': `Bearer ${config.apiKey}`,
      'anthropic-version': ANTHROPIC_VERSION,
      'User-Agent': CLAUDE_CODE_USER_AGENT,
      'AI-Agent': CLAUDE_CODE_AI_AGENT,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  if (!result.content || result.content.length === 0) {
    throw new Error('API 返回内容为空');
  }

  const textBlock = result.content.find((c) => c.type === 'text');
  if (!textBlock?.text) {
    throw new Error('API 返回中未找到文本内容');
  }

  return textBlock.text;
}

/**
 * 构造一个图片 content block，可与 callModel 一起使用。
 */
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

/**
 * 便捷方法：调用模型并传入一段文本 + 一张图片。
 */
export async function callModelWithImage({
  prompt,
  imageBuffer,
  mediaType,
  maxTokens = 16384,
  config = getModelConfig(),
  signal,
}: CallModelWithImageOptions): Promise<string> {
  return callModel({
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }, imageBlock(imageBuffer, mediaType)],
      },
    ],
    maxTokens,
    config,
    signal,
  });
}

// ============ 内部辅助 ============

function normalizeMessage(message: Message): Message {
  if (!message || typeof message.role !== 'string') {
    throw new Error('每条 message 必须包含 role 字段');
  }

  let content: ContentBlock[];
  if (typeof message.content === 'string') {
    content = [{ type: 'text', text: message.content }];
  } else if (Array.isArray(message.content)) {
    content = message.content.map(normalizeContentBlock);
  } else {
    throw new Error('message.content 必须是字符串或 content block 数组');
  }

  return { role: message.role, content };
}

function normalizeContentBlock(block: ContentBlock): ContentBlock {
  if (!block || typeof block.type !== 'string') {
    throw new Error('content block 必须包含 type 字段');
  }

  if (block.type === 'image' && block.source && block.source.type === 'base64') {
    const rawData = block.source.data as unknown as Buffer | Uint8Array;
    if (Buffer.isBuffer(rawData) || rawData instanceof Uint8Array) {
      return {
        ...block,
        source: {
          ...block.source,
          data: Buffer.from(rawData).toString('base64'),
        },
      };
    }
  }

  return block;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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
