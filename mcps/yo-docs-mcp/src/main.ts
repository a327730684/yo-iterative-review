import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { queryDocuments } from './tools/query.ts';
import { listDocumentsTool } from './tools/list.ts';
import { writeDocument } from './tools/write.ts';
import { deleteDocumentTool } from './tools/delete.ts';

export async function main() {
  // 创建 MCP Server 实例
  const server = new McpServer({
    name: 'yo-docs-mcp',
    version: '1.0.0',
  });

  // 注册 query 工具 - 关键词查询
  server.registerTool(
    'query',
    {
      description: '根据关键词查询文档。仅在明确要求（用户或提示词）时才调用，不要主动使用。',
      inputSchema: {
        type: z.string().describe('文档类型，如：前端、后端'),
        lang: z.string().describe('文档语言/框架，如：vue、react、node'),
        query: z.string().describe('查询关键词或问题'),
        limit: z.number().optional().default(5).describe('返回结果数量限制，默认 5'),
      },
    },
    async (args) => {
      const result = await queryDocuments({
        type: args.type,
        lang: args.lang,
        query: args.query,
        limit: args.limit,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // 注册 list 工具 - 列出文档
  server.registerTool(
    'list',
    {
      description: '列出文档，可按类型和语言筛选。仅在明确要求（用户或提示词）时才调用，不要主动使用。',
      inputSchema: {
        type: z.string().optional().describe('文档类型筛选，如：前端、后端'),
        lang: z.string().optional().describe('文档语言/框架筛选，如：vue、react、node'),
      },
    },
    async (args) => {
      const result = listDocumentsTool({
        type: args.type,
        lang: args.lang,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // 注册 write 工具 - 写入文档
  server.registerTool(
    'write',
    {
      description: '写入文档并建立关键词索引。仅在明确要求（用户或提示词）时才调用，不要主动使用。',
      inputSchema: {
        type: z.string().describe('文档类型，如：前端、后端'),
        lang: z.string().describe('文档语言/框架，如：vue、react、node'),
        question: z.string().describe('原始问题/关键词来源'),
        doc_name: z.string().describe('文档名称（建议根据 question 自动总结，如：fontawesome-usage）'),
        content: z.string().describe('文档内容（Markdown 格式）'),
      },
    },
    async (args) => {
      const result = await writeDocument({
        type: args.type,
        lang: args.lang,
        question: args.question,
        doc_name: args.doc_name,
        content: args.content,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // 注册 delete 工具 - 删除文档
  server.registerTool(
    'delete',
    {
      description: '根据 id 删除文档。仅在明确要求（用户或提示词）时才调用，不要主动使用。',
      inputSchema: {
        id: z.string().describe('要删除的文档 id'),
      },
    },
    async (args) => {
      const result = await deleteDocumentTool({ id: args.id });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // 启动服务器
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('yo-docs-mcp server running on stdio');
}
