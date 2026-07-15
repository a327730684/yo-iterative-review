import { z } from 'zod';
import { CallModelClient } from '../client/CallModelClient.ts';

export const callModelToolName = 'call_model';

export const callModelInputSchema = {
  text: z.string().describe('The complete prompt text'),
  maxTokens: z.number().optional().default(16384).describe('Maximum tokens, default 16384'),
  responseFormat: z
    .enum(['text', 'json_schema'])
    .optional()
    .describe('Response format: "text" (default) or "json_schema"'),
  schema: z
    .record(z.unknown())
    .optional()
    .describe('JSON Schema when responseFormat is "json_schema"'),
};

export type CallModelArgs = {
  text: string;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_schema';
  schema?: Record<string, unknown>;
};

export async function callModelHandler(args: CallModelArgs) {
  const client = new CallModelClient();

  const responseFormat =
    args.responseFormat === 'json_schema' && args.schema
      ? { type: 'json_schema' as const, schema: args.schema }
      : undefined;

  const text = await client.call({
    messages: [{ role: 'user', content: args.text }],
    maxTokens: args.maxTokens,
    responseFormat,
  });

  return { content: [{ type: 'text' as const, text }] };
}
