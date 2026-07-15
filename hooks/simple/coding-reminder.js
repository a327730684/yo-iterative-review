#!/usr/bin/env node

const ADDITIONAL_CONTEXT = `When writing code, do not explain reasons to the user. Keep reasoning sharp and output only what you should do, without explanation. Focus on the organization and construction of the code.

Before any code, pause and ask:
1. Is this code really necessary?
2. Are there standard libraries or shared methods available to reference and reuse?
3. Can the code and comments be written more concisely? Comments must not exceed 3 lines.
4. Is the code reasonably split into multiple functions by responsibility?
5. Can the current non-business logic be extracted as a shared method for reuse?`;

const EVENT_NAME = process.argv[2];

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
    console.log(ADDITIONAL_CONTEXT);
    return;
  }

  // SubagentStart expects structured JSON output.
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: event || 'SubagentStart',
        additionalContext: ADDITIONAL_CONTEXT,
      },
    })
  );
});
