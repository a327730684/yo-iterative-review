/**
 * 直接调用模型 API（参考 yo-pdf2md.ts 中的 callMultimodalAPI 实现）。
 *
 * 环境变量：
 *   ANTHROPIC_BASE_URL   - API 基础 URL
 *   ANTHROPIC_AUTH_TOKEN - API 认证令牌
 *   ANTHROPIC_MODEL      - 模型名称
 */

const CLAUDE_CODE_VERSION = '2.1.191';
const CLAUDE_CODE_USER_AGENT = `claude-code/${CLAUDE_CODE_VERSION}`;
const CLAUDE_CODE_AI_AGENT = `claude-code_${CLAUDE_CODE_VERSION.replace(/\./g, '-')}_harness`;
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * 从环境变量读取模型配置。
 * @returns {{ baseUrl: string, apiKey: string, model: string }}
 */
export function getModelConfig() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || '';
  const model = process.env.ANTHROPIC_MODEL || '';

  const missing = [];
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
 * @param {object} options
 * @param {Array<{role: string, content: string | Array<object>}>} options.messages 消息列表
 * @param {number} [options.maxTokens] 最大输出 token 数；不传则不限制，由服务端决定
 * @param {{ baseUrl: string, apiKey: string, model: string }} [options.config] 模型配置，默认从环境变量读取
 * @param {AbortSignal} [options.signal] AbortController signal
 * @returns {Promise<string>} 模型返回的文本内容
 */
export async function callModel({
  messages,
  maxTokens,
  config = getModelConfig(),
  signal,
}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages 必须是非空数组');
  }

  const url = `${config.baseUrl}/v1/messages`;
  const body = {
    model: config.model,
    messages: messages.map(normalizeMessage),
  };

  if (maxTokens != null) {
    body.max_tokens = maxTokens;
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

  const result = await response.json();

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
 *
 * @param {Buffer | Uint8Array} buffer 图片二进制数据
 * @param {string} mediaType 媒体类型，例如 image/png、image/jpeg
 * @returns {{ type: 'image', source: { type: 'base64', media_type: string, data: string } }}
 */
export function imageBlock(buffer, mediaType) {
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
 *
 * @param {object} options
 * @param {string} options.prompt 文本提示词
 * @param {Buffer | Uint8Array} options.imageBuffer 图片二进制数据
 * @param {string} options.mediaType 媒体类型，例如 image/png、image/jpeg
 * @param {number} [options.maxTokens] 最大输出 token 数；不传则不限制
 * @param {{ baseUrl: string, apiKey: string, model: string }} [options.config]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<string>}
 */
export async function callModelWithImage({
  prompt,
  imageBuffer,
  mediaType,
  maxTokens,
  config = getModelConfig(),
  signal,
}) {
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

function normalizeMessage(message) {
  if (!message || typeof message.role !== 'string') {
    throw new Error('每条 message 必须包含 role 字段');
  }

  let content = message.content;
  if (typeof content === 'string') {
    content = [{ type: 'text', text: content }];
  } else if (Array.isArray(content)) {
    content = content.map(normalizeContentBlock);
  } else {
    throw new Error('message.content 必须是字符串或 content block 数组');
  }

  return { role: message.role, content };
}

function normalizeContentBlock(block) {
  if (!block || typeof block.type !== 'string') {
    throw new Error('content block 必须包含 type 字段');
  }

  if (
    block.type === 'image' &&
    block.source &&
    block.source.type === 'base64' &&
    (Buffer.isBuffer(block.source.data) || block.source.data instanceof Uint8Array)
  ) {
    return {
      ...block,
      source: {
        ...block.source,
        data: Buffer.from(block.source.data).toString('base64'),
      },
    };
  }

  return block;
}
