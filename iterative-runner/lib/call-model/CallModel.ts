import {
  ANTHROPIC_VERSION,
  CALL_MODEL_MAX_RETRIES,
  CLAUDE_CODE_AI_AGENT,
  CLAUDE_CODE_USER_AGENT,
} from '../../env.ts';
import { buildHeaders, getModelConfig, imageBlock, sleep } from './utils.ts';
import type {
  CallModelOptions,
  CallModelWithImageOptions,
  ContentBlock,
  Message,
  ModelConfig,
} from './types.ts';

export interface CallModelConfig {
  anthropicVersion?: string;
  userAgent?: string;
  aiAgent?: string;
  maxRetries?: number;
}

export class CallModel {
  private readonly anthropicVersion: string;
  private readonly userAgent: string;
  private readonly aiAgent: string;
  private readonly maxRetries: number;

  constructor(config: CallModelConfig = {}) {
    this.anthropicVersion = config.anthropicVersion ?? ANTHROPIC_VERSION;
    this.userAgent = config.userAgent ?? CLAUDE_CODE_USER_AGENT;
    this.aiAgent = config.aiAgent ?? CLAUDE_CODE_AI_AGENT;
    this.maxRetries = config.maxRetries ?? CALL_MODEL_MAX_RETRIES;
  }

  /** 调用 /v1/messages 接口。出错时按指数退避重试。 */
  async call({
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

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.callOnce({ messages, maxTokens, config, signal, responseFormat });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt >= this.maxRetries) break;

        const delayMs = Math.min(1000 * 2 ** attempt, 30000);
        console.warn(
          `[callModel] 第 ${attempt + 1} 次调用失败，${delayMs}ms 后重试: ${lastError.message}`
        );
        await sleep(delayMs, signal);

        if (signal?.aborted) throw lastError;
      }
    }

    throw lastError ?? new Error('调用模型失败');
  }

  /** 便捷方法：传入文本 + 图片调用模型。 */
  async callWithImage({
    prompt,
    imageBuffer,
    mediaType,
    maxTokens = 16384,
    config = getModelConfig(),
    signal,
  }: CallModelWithImageOptions): Promise<string> {
    return this.call({
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

  // ============ 内部方法 ============

  private async callOnce({
    messages,
    maxTokens,
    config,
    signal,
    responseFormat,
  }: {
    messages: Message[];
    maxTokens?: number;
    config: ModelConfig;
    signal?: AbortSignal;
    responseFormat?: CallModelOptions['responseFormat'];
  }): Promise<string> {
    const url = `${config.baseUrl}/v1/messages`;
    const body: Record<string, unknown> = {
      model: config.model,
      messages: messages.map(normalizeMessage),
    };

    if (maxTokens != null) body.max_tokens = maxTokens;
    if (responseFormat) body.output_config = { format: responseFormat };

    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders({
        apiKey: config.apiKey,
        anthropicVersion: this.anthropicVersion,
        userAgent: this.userAgent,
        aiAgent: this.aiAgent,
      }),
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
    if (!textBlock?.text) throw new Error('API 返回中未找到文本内容');

    return textBlock.text;
  }
}

// ============ 消息归一化 ============

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
        source: { ...block.source, data: Buffer.from(rawData).toString('base64') },
      };
    }
  }

  return block;
}
