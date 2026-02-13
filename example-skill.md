---
name: high-risk-review
description: Review high-risk work items and write a bugs-only summary. Use when the user asks to review a high-risk item, perform a high-risk review, or wants a bugs-only summary of a work item or PR.
---

# High-Risk Review

Review a high-risk work item and produce a summary listing only bugs found. No other details.

## Instructions

1. **Review changes critically:** Inspect code diffs, tests, and modified behavior with extra attention to impact and risk. Act as a red team.
2. **Check linked items:** Ensure any linked ADO items and their fixes are accounted for.
3. **Check master/main:** Confirm relevant fixes from main are present or reconciled.
4. **Write tests for each bug:** For every bug found, write a failing test that reproduces it. Place tests alongside existing test files or in a sensible location. Each test should clearly name the bug it covers.
5. **Write bugs-only summary:** Create `feedback###.md` containing only the bugs found — no suggestions, no warnings, no style notes.

## Output format

```markdown
# Bugs — Work Item ###

- **Bug:** [concise description]
  - **Location:** [file:line or area]
  - **Impact:** [what breaks or could break]

- **Bug:** [concise description]
  - **Location:** [file:line or area]
  - **Impact:** [what breaks or could break]
```

If no bugs are found, write:

```markdown
# Bugs — Work Item ###

No bugs found.
```
