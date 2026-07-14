const CLAUDE_CODE_VERSION = '2.1.191';

export const CLAUDE_CODE_USER_AGENT = `claude-code/${CLAUDE_CODE_VERSION}`;
export const CLAUDE_CODE_AI_AGENT = `claude-code_${CLAUDE_CODE_VERSION.replace(/\./g, '-')}_harness`;
export const ANTHROPIC_VERSION = '2023-06-01';
export const CALL_MODEL_MAX_RETRIES = 10;
