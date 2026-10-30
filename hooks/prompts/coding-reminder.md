## Code style

When writing code, do not explain reasons to the user. Keep reasoning sharp and output only what you should do, without explanation. Focus on the organization and construction of the code.

Before any code, pause and ask:
1. Is this code really necessary?
2. Are there standard libraries or shared methods available to reference and reuse?
3. Can the code and comments be written more concisely? Comments must not exceed 3 lines.
4. Is the code reasonably split into multiple functions by responsibility?
5. Can the current non-business logic be extracted as a shared method for reuse?

## Coding requirements

Over-defensive programming is avoided in this codebase, because defensive fallbacks mask the underlying defect instead of surfacing it.

- A fallback that substitutes a default value hides the error it covers. In CSS, `var(--color, 'red')` swallows the missing `--color` definition. In code, computing exam scores with `method1` and then quietly recomputing them with `method2` after `method1` fails leaves the original failure invisible, so it is never discovered.
- Exceptions the system is meant to handle are still caught. The distinction is whether the catch handles an expected condition or merely keeps the flow going after an unexpected error; the first is correct, the second hides the problem.
