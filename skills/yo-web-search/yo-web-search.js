#!/usr/bin/env node
/**
 * bailian-web-search
 * 搜索可用于查询百科知识、时事新闻、天气等信息。
 *
 * 使用方法:
 *   node bailian-web-search.js [options] <tool-name>
 *   ALI_API_TOKEN=your_token node bailian-web-search.js <tool-name> --query="..." --count=5
 */

// 加载 .env 文件
import fs from 'fs';
import path from 'path';



// API Token (从环境变量或命令行参数获取)
let API_TOKEN = '';

// 工具函数定义
/**
 * 搜索可用于查询百科知识、时事新闻、天气等信息
 * @param {string} query - user query in the format of string
 * @param {integer} count - number of search results
 * @returns {Promise<Object>} - API 响应结果
 */
async function bailianWebSearch({ query, count } = {}) {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp', {
    method: 'POST',
    headers: {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'bailian_web_search',
        arguments: {
          query: query,
          count: count
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }

  // 读取并解析 SSE 流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    
    // 尝试直接解析整个 buffer（处理无换行的情况）
    try {
      const json = JSON.parse(buffer);
      if (json.result) {
        // 如果 result 包含 content 数组且第一个元素有 text 字段
        // 尝试解析 text 字段中的 JSON
        if (json.result.content && json.result.content[0] && json.result.content[0].text) {
          try {
            const innerJson = JSON.parse(json.result.content[0].text);
            return innerJson;
          } catch (innerError) {
            // 如果 text 不是 JSON，返回原始 text
            return json.result.content[0].text;
          }
        }
        return json.result;
      }
    } catch (e) {
      // 解析失败，继续累积数据
    }
    
    // 也尝试标准 SSE 格式（带 data: 前缀）
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data.trim() === '[DONE]') break;
        try {
          const json = JSON.parse(data);
          if (json.result) {
            if (json.result.content && json.result.content[0] && json.result.content[0].text) {
              try {
                const innerJson = JSON.parse(json.result.content[0].text);
                return innerJson;
              } catch (innerError) {
                return json.result.content[0].text;
              }
            }
            return json.result;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
  
  throw new Error('No valid response from MCP server');
}


// 导出所有工具
const tools = {
  bailian_web_search: bailianWebSearch
};

/**
 * 命令行参数处理
 */
async function main() {
  const args = process.argv.slice(2);

  // 从环境变量读取 token
  API_TOKEN = process.env.ALI_API_TOKEN || '';

  // 解析命令行参数
  let toolName = '';
  const params = {};

  for (const arg of args) {
    if (arg.startsWith('--tool=')) {
      toolName = arg.slice(7);
    } else if (arg.startsWith('--token=')) {
      API_TOKEN = arg.slice(8);
    } else if (arg.startsWith('--')) {
      // 解析其他参数，如 --query=value, --count=5 等
      const [key, value] = arg.slice(2).split('=');
      if (key && value !== undefined) {
        // 尝试解析为数字或布尔值
        let parsedValue = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(value) && !isNaN(parseFloat(value))) parsedValue = parseFloat(value);
        params[key] = parsedValue;
      }
    } else if (!arg.startsWith('-')) {
      // 第一个非选项参数作为工具名称
      if (!toolName) toolName = arg;
    }
  }

  // 显示帮助信息
  if (!toolName || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node bailian-web-search.js [options] <tool-name>

Available tools:
  - bailian_web_search --query=<value> --count=<value>

Options:
  --tool=<name>     Specify tool name
  --query=<value>     user query in the format of string
  --count=<value>     number of search results
  --token=<token>   Override API token from environment
  --help, -h        Show this help message

Examples:
  node bailian-web-search.js bailian_web_search --query="人工智能" --count=5
  node bailian-web-search.js --tool=bailian_web_search --query="人工智能" --count=5 --token=<your-token>
  API_TOKEN=your_token node bailian-web-search.js bailian_web_search --query="人工智能" --count=5
`);
    process.exit(0);
  }

  // 查找并调用对应的工具函数
  if (!tools[toolName]) {
    console.error(`Error: Unknown tool '${toolName}'`);
    console.error('Available tools:', Object.keys(tools).join(', '));
    process.exit(1);
  }

  try {
    const result = await tools[toolName](params);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// 当直接执行此脚本时运行 main 函数
if (process.argv[1]?.endsWith('bailian-web-search.js')) {
  main();
}

// 模块导出
export default tools;
export { tools, bailianWebSearch };
