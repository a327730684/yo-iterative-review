import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  callModelInputSchema,
  callModelToolName,
  callModelHandler,
} from './tools/call-model.ts';

export async function main() {
  const server = new McpServer({
    name: 'yo-tools-mcp',
    version: '1.0.0',
  });

  server.registerTool(
    callModelToolName,
    {
      description: 'Execute an independent, plain-text model call. Focused on completing a single LLM request.',
      inputSchema: callModelInputSchema,
    },
    callModelHandler
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('yo-tools-mcp server running on stdio');
}
