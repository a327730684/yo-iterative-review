// end.js - SubagentStop hook
// 测试：读取 start.js 设置的环境变量
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'subagent-hooks.log');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const timestamp = new Date().toISOString();
  let logEntry = `[${timestamp}] SubagentStop`;

  try {
    const data = JSON.parse(input);
    logEntry += ` | type=${data.agent_type} | id=${data.agent_id}`;
  } catch (e) {
    logEntry += ' | (no input data)';
  }

  // 尝试读取 start.js 设置的环境变量
  logEntry += ` | PID=${process.pid}`;
  logEntry += ` | SUBAGENT_TEST_VAR="${process.env.SUBAGENT_TEST_VAR || '(未设置)'}"`;
  logEntry += ` | SUBAGENT_PID="${process.env.SUBAGENT_PID || '(未设置)'}"`;

  // 判断是否同一进程
  if (process.env.SUBAGENT_PID && String(process.pid) === process.env.SUBAGENT_PID) {
    logEntry += ' | 结论: 同一进程!';
  } else {
    logEntry += ' | 结论: 不同进程 (环境变量无法共享)';
  }

  logEntry += '\n';
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(logEntry.trim());
});
