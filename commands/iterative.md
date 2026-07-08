---
description: Start an iterative implementation-review loop with quality gate.
argument-hint: <description of what to implement> [--agent <name>] [--max-review-count N]
---

Run an iterative implement-review loop: the implementer writes code, the reviewer finds issues, and the loop continues until review passes or the round limit is reached.

## Your task

User input: `$ARGUMENTS`

1. **Clarify the requirement**  
   If the user's description is incomplete, first complete it into an executable requirement based on the current context (what to do, target files/modules, constraints).

2. **Build and run the command (background mode)**

   Parameters supported by `node iterative-runner/iterative.ts`:
   - `--agent <name>`: implement/fix agent, defaults to `implementer`
   - `--max-review-count N`: maximum review rounds, defaults to 1

   Example:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/iterative-runner/iterative.ts "Implement a JWT login API: email+password verification, return tokens, bcrypt, rate limiting" --max-review-count 3
   ```

   **IMPORTANT: This loop is long-running (implement + multiple review/fix rounds, often many minutes). You MUST run it in background mode** (Bash tool with `run_in_background: true`), never as a blocking foreground call. After launching, set up a monitor (or periodically read the output file) so you are notified when it finishes, and keep the user informed of progress instead of blocking.

3. **Report**  
   Once the background run completes, read its final summary and report the result to the user.
