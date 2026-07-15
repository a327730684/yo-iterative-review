/**
 * 统一管理的静态常量 / 默认值。
 *
 * 这里集中放置跨迭代器模块共享、且可能随项目演进调整的静态配置，
 * 避免在多个文件中重复定义相同常量。
 */

// ========== Claude API 相关常量 ==========

export const CLAUDE_CODE_VERSION = '2.1.191';
export const CLAUDE_CODE_USER_AGENT = `claude-code/${CLAUDE_CODE_VERSION}`;
export const CLAUDE_CODE_AI_AGENT = `claude-code_${CLAUDE_CODE_VERSION.replace(/\./g, '-')}_harness`;
export const ANTHROPIC_VERSION = '2023-06-01';

/** callModel 访问 LLM 出错时的最大重试次数。 */
export const CALL_MODEL_MAX_RETRIES = 10;

// ========== 流程默认参数 ==========

/** iterative / develop 阶段默认最大审查轮数。 */
export const DEFAULT_MAX_REVIEW_COUNT = 1;

/** test-loop / develop 阶段默认最大测试轮数。 */
export const DEFAULT_MAX_TEST_COUNT = 2;

/** 单次审查/测试轮次内，修复 agent 的最大尝试次数。 */
export const DEFAULT_MAX_FIX_ATTEMPTS = 3;

/** 默认实现 agent 名称。 */
export const DEFAULT_AGENT = 'implementer';

/** 默认测试 agent 名称。 */
export const DEFAULT_TEST_AGENT = 'tester';

// ========== 通用 JSON Schema ==========

/** 检查 Markdown 修复清单是否全部完成的校验 schema。 */
export const COMPLETED_CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    completed: { type: 'boolean' },
  },
  required: ['completed'],
} as const;
