import {
  ANTHROPIC_VERSION,
  CALL_MODEL_MAX_RETRIES,
  CLAUDE_CODE_AI_AGENT,
  CLAUDE_CODE_USER_AGENT,
} from '../env.ts';

export interface CallModelClientOptions {
  anthropicVersion?: string;
  userAgent?: string;
  aiAgent?: string;
  maxRetries?: number;
}

interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface JsonSchemaFormat {
  type: 'json_schema';
  schema: Record<string, unknown>;
}

export class CallModelClient {
  private readonly anthropicVersion: string;
  private readonly userAgent: string;
  private readonly aiAgent: string;
  private readonly maxRetries: number;

  constructor(config: CallModelClientOptions = {}) {
    this.anthropicVersion = config.anthropicVersion ?? ANTHROPIC_VERSION;
    this.userAgent = config.userAgent ?? CLAUDE_CODE_USER_AGENT;
    this.aiAgent = config.aiAgent ?? CLAUDE_CODE_AI_AGENT;
    this.maxRetries = config.maxRetries ?? CALL_MODEL_MAX_RETRIES;
  }

  async call({
    messages,
    maxTokens = 16384,
    responseFormat,
    signal,
  }: {
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    responseFormat?: JsonSchemaFormat;
    signal?: AbortSignal;
  }): Promise<string> {
    const config = this.getConfig();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.callOnce({ messages, maxTokens, config, responseFormat, signal });
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

  private async callOnce({
    messages,
    maxTokens,
    config,
    responseFormat,
    signal,
  }: {
    messages: Array<{ role: string; content: string }>;
    maxTokens: number;
    config: ModelConfig;
    responseFormat?: JsonSchemaFormat;
    signal?: AbortSignal;
  }): Promise<string> {
    const url = `${config.baseUrl}/v1/messages`;
    const body: Record<string, unknown> = { model: config.model, messages, max_tokens: maxTokens };

    if (responseFormat) {
      body.output_config = { format: responseFormat };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'Authorization': `Bearer ${config.apiKey}`,
        'anthropic-version': this.anthropicVersion,
        'User-Agent': this.userAgent,
        'AI-Agent': this.aiAgent,
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
    if (!textBlock?.text) throw new Error('API 返回中未找到文本内容');

    return textBlock.text;
  }

  private getConfig(): ModelConfig {
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
