// start.js - SubagentStart hook
// 测试：设置环境变量，看 end.js 能否读取
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'subagent-hooks.log');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const timestamp = new Date().toISOString();
  let logEntry = `[${timestamp}] SubagentStart`;

  try {
    const data = JSON.parse(input);
    const { agent_id, agent_type } = data;
    logEntry += ` | type=${agent_type} | id=${agent_id}`;
  } catch (e) {
    logEntry += ' | (no input data)';
  }

  // 设置环境变量
  process.env.SUBAGENT_TEST_VAR = 'Hello from start.js!';
  process.env.SUBAGENT_PID = String(process.pid);
  logEntry += ` | PID=${process.pid}`;
  logEntry += ` | set SUBAGENT_TEST_VAR="${process.env.SUBAGENT_TEST_VAR}"`;

  logEntry += '\n';
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(logEntry.trim());
});
