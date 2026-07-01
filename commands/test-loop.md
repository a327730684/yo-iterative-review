---
description: Start an iterative test loop against existing backend code.
argument-hint: <description of what to test> [--test-agent <name>] [--fix-agent <name>] [--max-test-count N]
---

Run an iterative test loop on existing backend code: the tester writes and executes minimal tests, and the fix agent repairs failures until all tests pass or the round limit is reached.

## Your task

User input: `$ARGUMENTS`

1. **Complete the test requirement (critical)**  
   If the user's description is vague, e.g. "test the feature I just wrote", do not pass it through verbatim. First summarize it into an executable test requirement based on the current context. It must include: **what to test, where the target code is, and what language it uses**. Use the description as-is if it is already explicit.

2. **Build and run the command (background mode)**

   Parameters supported by `node iterative-runner/test-loop.ts`:
   - `--test-agent <name>`: tester agent, defaults to `tester`
   - `--fix-agent <name>`: fix agent; if omitted, no agent is specified (`--agent` is an alias for `--fix-agent`)
   - `--max-test-count N`: maximum test rounds, defaults to 2

   Example:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/iterative-runner/test-loop.ts "Test the Snowflake class in src/snowflake.py: cover next_id uniqueness and worker_id out-of-range ValueError" --max-test-count 2
   ```

   **IMPORTANT: This loop is long-running (write tests + multiple test/fix rounds, often many minutes). You MUST run it in background mode** (Bash tool with `run_in_background: true`), never as a blocking foreground call. After launching, set up a monitor (or periodically read the output file) so you are notified when it finishes, and keep the user informed of progress instead of blocking.

3. **Report**  
   Once the background run completes, read its final summary and report the result to the user.
