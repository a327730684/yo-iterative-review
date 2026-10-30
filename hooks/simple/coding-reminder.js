#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROMPT_FILE = path.join(__dirname, '..', 'prompts', 'coding-reminder.md');
const EVENT_NAME = process.argv[2];

const CONTEXT = fs.readFileSync(PROMPT_FILE, 'utf8').trim();

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let event = EVENT_NAME;
  if (!event && input) {
    try {
      const data = JSON.parse(input);
      event = data.hookEventName || data.event;
    } catch {
      // ignore parse errors
    }
  }

  // SessionStart is context-only: plain stdout is injected as additional context.
  if (event === 'SessionStart') {
    console.log(CONTEXT);
    return;
  }

  // SubagentStart expects structured JSON output.
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: event || 'SubagentStart',
        additionalContext: CONTEXT,
      },
    })
  );
});
