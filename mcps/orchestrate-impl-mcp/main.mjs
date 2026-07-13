#!/usr/bin/env node

/**
 * orchestrate-impl MCP Server
 *
 * 将「实现需求编排器」skill 封装为 MCP Server，
 * 通过结构化的 tool 接口强制约束编排流程。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'orchestrate-impl',
  version: '1.0.0',
});

// ========== 辅助：统一错误处理 ==========

function textResult(text, isError = false) {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

function jsonResult(data) {
  return textResult(JSON.stringify(data, null, 2));
}

async function safeExecuteAsync(fn) {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return textResult(`错误: ${msg}`, true);
  }
}

// ========== Tool 1: create_flow ==========

server.registerTool(
  'orchestrate_start_flow',
  {
    description:
      '开始代码编写流程， 第一步',
    inputSchema: z.object({}),
  },
  async () => {
    return safeExecuteAsync(async () => {
      return jsonResult(`
在 "{project_dir}/work_flow/" 目录下创建两个文件：
1. "<feature_name>_design.md" —— 需求设计文档 
  - 如果用户已提供，则直接复制到 work_flow/ 目录下。否则根据用户澄清，主动规划生成 <feature_name>_design.md
2. "<feature_name>_plan.md" —— 实现计划表（主 agent 专属维护）
  - 将design中的计划，拆解为任务。
  - 按前后端拆分为若干**大模块**，每个大模块下再拆分为若干**小功能**。用 markdown checkbox 记录进度。
  - 每大功能及其下的小功能的 checkbox 初始状态为未完成。
  如：
  - 功能1
    - [ ] 子功能1
    - [ ] 子功能2
  - 功能2
    - [ ] 子功能3
    - [ ] 子功能4

完成上面两个文件后，请调用本mcp的tool: "orchestrate_flow2" 。
        `);
    });
  }
);

// ========== Tool 2: set_design ==========

server.registerTool(
  'orchestrate_flow2',
  {
    description:
      'orchestrate_start_flow完成后使用',
    inputSchema: z.object({}),
  },
  async () => {
    return safeExecuteAsync(async () => {

      return jsonResult(`
开始决定代码实施的agent。如果存在前后端代码均要实施，则需要用户选择两个(前后各一个)实施agent。
可供选择的agent列表中，列出所有可用agent，且加上临时创建agent。
如：
1. agent1
2. agent2
3. agent3
4. 以上都不是，使用临时subagent.

实施的 subAgent选择完成后，请调用本mcp的tool: "orchestrate_flow3" 。
        `);
    });
  }
);

// ========== Tool 3: create_plan ==========

server.registerTool(
  'orchestrate_flow3',
  {
    description:
      'orchestrate_flow2完成后使用',
    inputSchema: z.object({}),
  },
  async () => {
    return safeExecuteAsync(async () => {

      return jsonResult(`
上一步用户选中的agent 作为subAgent，你自身作为mainAgent。

subAgent:

- 只有subAgent去实施代码，mainAgent只负责协调和管理，并在subAgent完成一个**小模块**后，更新计划表。
- subAgent区分前后端。
- subAgent完成一个**小模块**后通知mainAgent
- subAgent完成一个**大模块**后也通知mainAgent，告知本轮共完成了哪些任务，并结束运行。subAgent的运行生命周期在一个大模块内。 
- subAgent每次接受任务时，都需要读取完整<feature_name>_design.md 文件，以及接受mainAgent根据plan派发给它的任务。
- subAgent只返回完成进度，不返回代码给mainAgent.

mainAgent:

- 你做为mainAgent按照<feature_name>_plan.md 文件中的任务顺序，以**大模块**为单位将任务发放给subagent，一步步地不断地调控subAgent，并最终完成<feature_name>_plan.md 文件中规划的所有任务， 每完成一个**小模块**，都需要更新计划表中的checkbox。你的工程可能是全新的，也可能要继续完成的，主要取决于plan中是否有未完成任务。
- subAgent的最大并发量为2个（前端+后端）， 当只存在前端或后端任务时，则并发量为1个，所有任务的按照顺序串行。
- 当subAgent完成一个**大模块**后，继续下一个**大模块**任务时，你需要对此subAgent开启一个新的实例去执行，这样保证其完成下个**大模块**时，它的上下文是干净的。

举例：你接受到一个前端任务计划，存在大模块A和大模块B，用户选择了agentA作为前端实施的agent。你使用agentA去实施大模块A(要求agentA读取<feature_name>_design.md 完整的文件 和当前需要实施的大模块A功能), 完成后，更新plan表。然后再开启新的agentA去实施大模块B(要求agentA读取<feature_name>_design.md 完整的文件 和当前需要实施的大模块B功能)。
直到plan表上所有的**大模块**都完成，你的任务才结束。
        `);
    });
  }
);



// ========== 启动服务器 ==========

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('orchestrate-impl MCP Server 已启动');
}

export { main };

main().catch(err => {
  console.error('MCP Server 启动失败:', err);
  process.exit(1);
});
