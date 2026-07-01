---
description: Run implement-review then test-fix end to end in one pipeline.
argument-hint: <description of what to build> [--agent <impl>] [--test-agent <tester>] [--fix-agent <fixer>] [--max-review-count N] [--max-test-count M]
---

Run the full `develop` pipeline: first the implement-review loop writes and hardens the code, then an intermediate step turns the implementation summary into a test requirement, and finally the test-fix loop writes tests and repairs failures. The loops live inside the two stages; `develop` only orchestrates them plus one intermediate LLM step.

## Your task

User input: `$ARGUMENTS`

1. **Clarify the requirement**  
   If the user's description is incomplete, first complete it into an executable requirement based on the current context (what to do, target files/modules, constraints). You do NOT need to spell out the test requirement — the pipeline derives it automatically from the implementation summary.

2. **Build and run the command (background mode)**

   Parameters supported by `node iterative-runner/develop.ts`:
   - `--agent <name>`: implement/fix agent for stage one, defaults to `implementer`
   - `--test-agent <name>`: tester agent for stage two, defaults to `tester`
   - `--fix-agent <name>`: fix agent for stage two; if omitted, no agent is specified
   - `--max-review-count N`: maximum review rounds, defaults to 1
   - `--max-test-count M`: maximum test rounds, defaults to 2

   Example:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/iterative-runner/develop.ts "Implement a title service under test/ using Express" --max-review-count 1 --max-test-count 1
   ```

   **IMPORTANT: This pipeline is long-running (implement + review/fix rounds, then test/fix rounds, often many minutes). You MUST run it in background mode** (Bash tool with `run_in_background: true`), never as a blocking foreground call. After launching, set up a monitor (or periodically read the output file) so you are notified when it finishes, and keep the user informed of progress instead of blocking.

3. **Report**  
   Once the background run completes, read its final merged summary (stage one implement-review + stage two test-fix) and report the result to the user.
